import { Router, Request, Response } from "express";
import { z } from "zod";
import { InvoiceStatus, PaymentType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { cache } from "../lib/cache";
import { attachCompany, requireFeature, requireCompanyMatch } from "../middleware/companyScope";
import { PAGINATION } from "../lib/constants";

const router = Router();

const invoiceInclude = {
  customer: { select: { id: true, name: true, company: true, email: true } },
  items: true,
  payments: true,
};

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive().max(999999),
  unitPrice: z.number().positive().max(99999999),
});

const createInvoiceSchema = z.object({
  customerId: z.string(),
  invoiceNumber: z.string().min(1),
  gstRate: z.number().min(0).max(28).default(18),
  paymentType: z.nativeEnum(PaymentType).default("FULL"),
  emiMonths: z.number().int().min(2).max(12).optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

const updateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const addPaymentSchema = z.object({
  amount: z.number().positive().max(99999999),
  method: z.string().default("bank_transfer"),
  paidAt: z.string().datetime().optional(),
});

/** Calculate invoice total using integer math (cents) to avoid floating-point errors */
function calculateInvoiceTotal(items: { quantity: number; unitPrice: number }[], gstRate: number) {
  const subtotalCents = items.reduce((s, i) => s + Math.round(i.quantity * i.unitPrice * 100), 0);
  const gstCents = Math.round(subtotalCents * gstRate / 100);
  const totalCents = subtotalCents + gstCents;
  return { subtotal: subtotalCents / 100, gst: gstCents / 100, total: totalCents / 100 };
}

// All invoice routes are admin-only
router.use(requireAuth, attachCompany, requireFeature("billing"), adminOnly);

// GET /api/invoices
router.get("/", async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as { status?: InvoiceStatus; page?: string; limit?: string };
  const companyId = getUserCompanyId(req);
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (companyId) where.companyId = companyId;

  const take = Math.min(Number(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = ((Math.max(Number(page) || 1, 1)) - 1) * take;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.invoice.count({ where }),
  ]);
  res.json({ data: invoices, total, page: Math.floor(skip / take) + 1, limit: take });
});

// POST /api/invoices
router.post(
  "/",
  audit({ action: "CREATE_INVOICE", resourceType: "Invoice" }),
  async (req: Request, res: Response) => {
    const parsed = createInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { items, ...invoiceData } = parsed.data;

    const companyId = getUserCompanyId(req);
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
        items: { create: items },
        companyId: companyId ?? undefined,
      },
      include: invoiceInclude,
    });

    cache.invalidate(companyId ? `reports:summary:${companyId}` : "reports:");
    cache.invalidate(companyId ? `reports:revenue:${companyId}` : "reports:");
    cache.invalidate(companyId ? `reports:gst:${companyId}` : "reports:");
    cache.invalidate(companyId ? `reports:top-clients:${companyId}` : "reports:");
    cache.invalidate(companyId ? `customers:list:${companyId}` : "customers:");
    res.status(201).json(invoice);
  }
);

// GET /api/invoices/:id
router.get("/:id", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id as string },
    include: invoiceInclude,
  });

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  if (!requireCompanyMatch(invoice.companyId, req)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(invoice);
});

// PATCH /api/invoices/:id
router.patch(
  "/:id",
  audit({ action: "UPDATE_INVOICE", resourceType: "Invoice" }),
  async (req: Request, res: Response) => {
    const parsed = updateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    // Verify ownership before update
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (!requireCompanyMatch(existing.companyId, req)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id as string },
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate === null ? null : parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      },
      include: invoiceInclude,
    });

    const companyId = getUserCompanyId(req);
    cache.invalidate(companyId ? `reports:summary:${companyId}` : "reports:");
    cache.invalidate(companyId ? `reports:revenue:${companyId}` : "reports:");
    cache.invalidate(companyId ? `customers:list:${companyId}` : "customers:");
    res.json(invoice);
  }
);

// POST /api/invoices/:id/payments
router.post(
  "/:id/payments",
  audit({ action: "ADD_PAYMENT", resourceType: "Invoice" }),
  async (req: Request, res: Response) => {
    const parsed = addPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const invoiceId = req.params.id as string;

    // Verify ownership before payment
    const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!existing) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (!requireCompanyMatch(existing.companyId, req)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          ...parsed.data,
          paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined,
          invoiceId,
        },
      });

      // Recalculate invoice status using integer cents math
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true },
      });

      if (invoice) {
        const { total } = calculateInvoiceTotal(invoice.items, invoice.gstRate);
        const paidAmount = invoice.payments.reduce((s, p) => s + p.amount, 0);
        // Use cents comparison to avoid floating-point issues
        const totalCents = Math.round(total * 100);
        const paidCents = Math.round(paidAmount * 100);

        let status: InvoiceStatus = "PARTIAL";
        if (paidCents >= totalCents) status = "PAID";
        else if (paidCents === 0) status = "PENDING";

        await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
      }

      return p;
    });

    const companyId = getUserCompanyId(req);
    cache.invalidate(companyId ? `reports:summary:${companyId}` : "reports:");
    cache.invalidate(companyId ? `reports:revenue:${companyId}` : "reports:");
    cache.invalidate(companyId ? `reports:top-clients:${companyId}` : "reports:");
    cache.invalidate(companyId ? `customers:list:${companyId}` : "customers:");
    res.status(201).json(payment);
  }
);

export { calculateInvoiceTotal };
export default router;
