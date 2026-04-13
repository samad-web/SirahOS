import { Router, Request, Response } from "express";
import { z } from "zod";
import { RecurringFrequency, RecurringStatus, PaymentType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { attachCompany, requireFeature, requireCompanyMatch } from "../middleware/companyScope";
import { PAGINATION } from "../lib/constants";
import { generateRecurringInvoiceNow } from "../lib/recurring-runner";

const router = Router();

const recurringInclude = {
  customer: { select: { id: true, name: true, company: true, email: true } },
  items: true,
  _count: { select: { invoices: true } },
};

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive().max(999999),
  unitPrice: z.number().positive().max(99999999),
});

const createSchema = z.object({
  name: z.string().min(1),
  customerId: z.string(),
  frequency: z.nativeEnum(RecurringFrequency),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  gstRate: z.number().min(0).max(28).default(18),
  paymentType: z.nativeEnum(PaymentType).default("FULL"),
  emiMonths: z.number().int().min(2).max(12).optional(),
  dueDays: z.number().int().min(0).max(365).default(15),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  frequency: z.nativeEnum(RecurringFrequency).optional(),
  status: z.nativeEnum(RecurringStatus).optional(),
  endDate: z.string().datetime().nullable().optional(),
  gstRate: z.number().min(0).max(28).optional(),
  paymentType: z.nativeEnum(PaymentType).optional(),
  emiMonths: z.number().int().min(2).max(12).nullable().optional(),
  dueDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1).optional(),
});

// All routes require admin + billing feature
router.use(requireAuth, attachCompany, requireFeature("billing"), adminOnly);

// GET /api/recurring-invoices
router.get("/", async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as { status?: RecurringStatus; page?: string; limit?: string };
  const companyId = getUserCompanyId(req);
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (companyId) where.companyId = companyId;

  const take = Math.min(Number(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = ((Math.max(Number(page) || 1, 1)) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.recurringInvoice.findMany({
      where,
      include: recurringInclude,
      orderBy: [{ status: "asc" }, { nextRunAt: "asc" }],
      take,
      skip,
    }),
    prisma.recurringInvoice.count({ where }),
  ]);
  res.json({ data: items, total, page: Math.floor(skip / take) + 1, limit: take });
});

// GET /api/recurring-invoices/:id
router.get("/:id", async (req: Request, res: Response) => {
  const item = await prisma.recurringInvoice.findUnique({
    where: { id: req.params.id as string },
    include: {
      ...recurringInclude,
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, invoiceNumber: true, status: true, createdAt: true, dueDate: true },
      },
    },
  });
  if (!item) {
    res.status(404).json({ error: "Recurring invoice not found" });
    return;
  }
  if (!requireCompanyMatch(item.companyId, req)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  res.json(item);
});

// POST /api/recurring-invoices
router.post(
  "/",
  audit({ action: "CREATE_INVOICE", resourceType: "RecurringInvoice" }),
  async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { items, startDate, endDate, ...data } = parsed.data;
    const companyId = getUserCompanyId(req);

    // Verify customer belongs to this company before linking
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, companyId: true },
    });
    if (!customer) {
      res.status(400).json({ error: "Customer not found" });
      return;
    }
    if (!requireCompanyMatch(customer.companyId, req)) {
      res.status(403).json({ error: "Customer does not belong to your company" });
      return;
    }

    const start = new Date(startDate);
    const created = await prisma.recurringInvoice.create({
      data: {
        ...data,
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        // First run is the startDate itself — the scheduler picks it up on
        // the next cron tick, or it can be triggered manually.
        nextRunAt: start,
        items: { create: items },
        companyId: companyId ?? undefined,
      },
      include: recurringInclude,
    });
    res.status(201).json(created);
  }
);

// PATCH /api/recurring-invoices/:id
router.patch(
  "/:id",
  audit({ action: "UPDATE_INVOICE", resourceType: "RecurringInvoice" }),
  async (req: Request, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const existing = await prisma.recurringInvoice.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: "Recurring invoice not found" });
      return;
    }
    if (!requireCompanyMatch(existing.companyId, req)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const { items, endDate, ...data } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        // Replace all items atomically
        await tx.recurringInvoiceItem.deleteMany({ where: { recurringInvoiceId: existing.id } });
        await tx.recurringInvoiceItem.createMany({
          data: items.map((i) => ({ ...i, recurringInvoiceId: existing.id })),
        });
      }
      return tx.recurringInvoice.update({
        where: { id: existing.id },
        data: {
          ...data,
          endDate: endDate === null ? null : endDate ? new Date(endDate) : undefined,
        },
        include: recurringInclude,
      });
    });

    res.json(updated);
  }
);

// POST /api/recurring-invoices/:id/pause
router.post("/:id/pause", audit({ action: "UPDATE_INVOICE", resourceType: "RecurringInvoice" }), async (req, res) => {
  const existing = await prisma.recurringInvoice.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }
  const updated = await prisma.recurringInvoice.update({ where: { id: existing.id }, data: { status: "PAUSED" }, include: recurringInclude });
  res.json(updated);
});

// POST /api/recurring-invoices/:id/resume
router.post("/:id/resume", audit({ action: "UPDATE_INVOICE", resourceType: "RecurringInvoice" }), async (req, res) => {
  const existing = await prisma.recurringInvoice.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }
  const updated = await prisma.recurringInvoice.update({ where: { id: existing.id }, data: { status: "ACTIVE" }, include: recurringInclude });
  res.json(updated);
});

// POST /api/recurring-invoices/:id/run-now — generate an invoice immediately (admin utility)
router.post("/:id/run-now", audit({ action: "CREATE_INVOICE", resourceType: "RecurringInvoice" }), async (req, res) => {
  const existing = await prisma.recurringInvoice.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }
  if (existing.status !== "ACTIVE") {
    res.status(400).json({ error: "Only ACTIVE recurring invoices can be run" });
    return;
  }
  try {
    const invoice = await generateRecurringInvoiceNow(existing.id);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Generation failed" });
  }
});

// DELETE /api/recurring-invoices/:id
router.delete("/:id", audit({ action: "DELETE_USER", resourceType: "RecurringInvoice" }), async (req, res) => {
  const existing = await prisma.recurringInvoice.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }
  // Soft-end rather than destroying history — generated invoices stay intact
  // because of ON DELETE SET NULL on the FK, but users rarely expect a
  // "delete" to wipe traceability. Flip to ENDED.
  await prisma.recurringInvoice.update({ where: { id: existing.id }, data: { status: "ENDED" } });
  res.json({ success: true });
});

export default router;
