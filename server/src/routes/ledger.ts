import { Router, Request, Response } from "express";
import { z } from "zod";
import { LedgerStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";

const router = Router();

const createEntrySchema = z.object({
  date: z.string().datetime(),
  ref: z.string().min(1),
  description: z.string().min(1),
  account: z.string().min(1),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  category: z.string().optional(),
  status: z.nativeEnum(LedgerStatus).default("PAID"),
});

// All ledger routes are admin-only
router.use(requireAuth, adminOnly);

// GET /api/ledger
router.get("/", async (req: Request, res: Response) => {
  const { category, status } = req.query as { category?: string; status?: LedgerStatus };

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const entries = await prisma.ledgerEntry.findMany({
    where,
    orderBy: { date: "desc" },
    take: 500,
  });

  res.json(entries);
});

// POST /api/ledger
router.post(
  "/",
  audit({ action: "CREATE_LEDGER_ENTRY", resourceType: "LedgerEntry" }),
  async (req: Request, res: Response) => {
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const entry = await prisma.ledgerEntry.create({
      data: { ...parsed.data, date: new Date(parsed.data.date) },
    });

    res.status(201).json(entry);
  }
);

// DELETE /api/ledger/:id
router.delete(
  "/:id",
  audit({ action: "DELETE_LEDGER_ENTRY", resourceType: "LedgerEntry" }),
  async (req: Request, res: Response) => {
    await prisma.ledgerEntry.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Entry deleted" });
  }
);

export default router;
