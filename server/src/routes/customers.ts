import { Router, Request, Response } from "express";
import { z } from "zod";
import { CustomerStatus, PaymentType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { cache, TTL } from "../lib/cache";
import { attachCompany, requireFeature } from "../middleware/companyScope";

const router = Router();

const createCustomerSchema = z
  .object({
    name: z.string().min(1),
    company: z.string().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
    gstin: z.string().max(15).optional(),
    paymentType: z.nativeEnum(PaymentType).default("FULL"),
    totalAmount: z.number().positive().optional(),
    monthlyEmi: z.number().positive().optional(),
  })
  .refine(
    (d) => d.paymentType !== "EMI" || (d.totalAmount && d.monthlyEmi && d.monthlyEmi <= d.totalAmount),
    { message: "EMI clients require totalAmount and monthlyEmi (monthlyEmi ≤ totalAmount)", path: ["monthlyEmi"] }
  );

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().max(15).optional(),
  notes: z.string().nullable().optional(),
  paymentType: z.nativeEnum(PaymentType).optional(),
  totalAmount: z.number().positive().nullable().optional(),
  monthlyEmi: z.number().positive().nullable().optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
});

// All customer routes are admin-only
router.use(requireAuth, attachCompany, requireFeature("billing"), adminOnly);

// GET /api/customers
router.get("/", async (req: Request, res: Response) => {
  const companyId = (req.user as any).companyId as string | undefined;
  const cacheKey = companyId ? `customers:list:${companyId}` : "customers:list";
  const customers = await cache.getOrSet(cacheKey, TTL.SHORT, () =>
    prisma.customer.findMany({
      where: companyId ? { companyId } : {},
      include: {
        _count: { select: { invoices: true } },
        invoices: { select: { items: true, payments: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
  );
  res.json(customers);
});

// POST /api/customers
router.post(
  "/",
  audit({ action: "CREATE_CUSTOMER", resourceType: "Customer" }),
  async (req: Request, res: Response) => {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const existing = await prisma.customer.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: "Customer with this email already exists" });
      return;
    }

    const { totalAmount, monthlyEmi, paymentType, ...rest } = parsed.data;
    const totalMonths =
      paymentType === "EMI" && totalAmount && monthlyEmi
        ? Math.ceil(totalAmount / monthlyEmi)
        : null;

    const companyId = (req.user as any).companyId as string | undefined;
    const customer = await prisma.customer.create({
      data: {
        ...rest,
        email: rest.email.toLowerCase(),
        paymentType,
        totalAmount: totalAmount ?? null,
        monthlyEmi: monthlyEmi ?? null,
        totalMonths,
        companyId: companyId ?? undefined,
      },
    });

    res.status(201).json(customer);
  }
);

// GET /api/customers/:id
router.get("/:id", async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id as string },
    include: { invoices: { include: { items: true, payments: true } } },
  });

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(customer);
});

// PATCH /api/customers/:id
router.patch(
  "/:id",
  audit({ action: "UPDATE_CUSTOMER", resourceType: "Customer" }),
  async (req: Request, res: Response) => {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { totalAmount, monthlyEmi, paymentType, ...rest } = parsed.data;

    // Recompute totalMonths if EMI fields changed
    const updateData: Record<string, unknown> = { ...rest };
    if (paymentType !== undefined) updateData.paymentType = paymentType;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
    if (monthlyEmi !== undefined) updateData.monthlyEmi = monthlyEmi;

    // If switching to FULL, clear EMI fields
    if (paymentType === "FULL") {
      updateData.totalAmount = null;
      updateData.monthlyEmi = null;
      updateData.totalMonths = null;
    } else if (totalAmount || monthlyEmi) {
      // Fetch current to merge with partial updates
      const current = await prisma.customer.findUnique({ where: { id: req.params.id as string } });
      const amt = (totalAmount ?? current?.totalAmount) as number | null;
      const emi = (monthlyEmi ?? current?.monthlyEmi) as number | null;
      updateData.totalMonths = amt && emi ? Math.ceil(amt / emi) : null;
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json(customer);
  }
);

// POST /api/customers/send-reminders — manually trigger EMI reminders (admin only, for testing)
router.post(
  "/send-reminders",
  audit({ action: "SEND_EMI_REMINDERS", resourceType: "Customer" }),
  async (_req: Request, res: Response) => {
    const { sendEmiReminders } = await import("../lib/scheduler");
    const result = await sendEmiReminders();
    res.json({ message: "Reminders processed", ...result });
  }
);

export default router;
