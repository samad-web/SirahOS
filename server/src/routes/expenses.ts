import { Router, Request, Response } from "express";
import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { attachCompany, requireFeature } from "../middleware/companyScope";

const router = Router();

const createExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.nativeEnum(ExpenseCategory).default("OTHER"),
  paymentMethod: z.string().default("cash"),
  receiptNotes: z.string().optional(),
});

const updateExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  paymentMethod: z.string().optional(),
  receiptNotes: z.string().nullable().optional(),
});

router.use(requireAuth, attachCompany, requireFeature("billing"), adminOnly);

// GET /api/expenses
router.get("/", async (req: Request, res: Response) => {
  const { category } = req.query as { category?: ExpenseCategory };
  const companyId = (req.user as any).companyId as string | undefined;
  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (companyId) where.companyId = companyId;
  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    take: 500,
  });
  res.json(expenses);
});

// POST /api/expenses
router.post(
  "/",
  audit({ action: "CREATE_EXPENSE", resourceType: "Expense" }),
  async (req: Request, res: Response) => {
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const companyId = (req.user as any).companyId as string | undefined;
    const expense = await prisma.expense.create({
      data: { ...parsed.data, date: new Date(parsed.data.date), companyId: companyId ?? undefined },
    });
    res.status(201).json(expense);
  }
);

// PATCH /api/expenses/:id
router.patch(
  "/:id",
  audit({ action: "UPDATE_EXPENSE", resourceType: "Expense" }),
  async (req: Request, res: Response) => {
    const parsed = updateExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const data = { ...parsed.data } as Record<string, unknown>;
    if (parsed.data.date) data.date = new Date(parsed.data.date);
    const expense = await prisma.expense.update({ where: { id: req.params.id as string }, data });
    res.json(expense);
  }
);

// DELETE /api/expenses/:id
router.delete(
  "/:id",
  audit({ action: "DELETE_EXPENSE", resourceType: "Expense" }),
  async (req: Request, res: Response) => {
    await prisma.expense.delete({ where: { id: req.params.id as string } });
    res.json({ ok: true });
  }
);

export default router;
