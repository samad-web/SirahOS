import { Router, Request, Response } from "express";
import { z } from "zod";
import { InvoiceStatus, PaymentType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { cache } from "../lib/cache";

const router = Router();

const invoiceInclude = {
  customer: { select: { id: true, name: true, company: true, email: true } },
  items: true,
  payments: true,
};

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
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
  amount: z.number().positive(),
  method: z.string().default("bank_transfer"),
  paidAt: z.string().datetime().optional(),
});

// All invoice routes are admin-only
router.use(requireAuth, adminOnly);

// GET /api/invoices
router.get("/", async (req: Request, res: Response) => {
  const { status } = req.query as { status?: InvoiceStatus };
  const where = status ? { status } : {};

  const invoices = await prisma.invoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(invoices);
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

    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
        items: { create: items },
      },
      include: invoiceInclude,
    });

    cache.invalidate("reports:");
    cache.invalidate("customers:");
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

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id as string },
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate === null ? null : parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      },
      include: invoiceInclude,
    });

    cache.invalidate("reports:");
    cache.invalidate("customers:");
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

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          ...parsed.data,
          paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined,
          invoiceId,
        },
      });

      // Recalculate invoice status
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true },
      });

      if (invoice) {
        const subtotal = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const total = subtotal * (1 + invoice.gstRate / 100);
        const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);

        let status: InvoiceStatus = "PARTIAL";
        if (paid >= total) status = "PAID";
        else if (paid === 0) status = "PENDING";

        await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
      }

      return p;
    });

    cache.invalidate("reports:");
    cache.invalidate("customers:");
    res.status(201).json(payment);
  }
);

export default router;
