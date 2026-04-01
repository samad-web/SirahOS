import { Router, Request, Response } from "express";
import { z } from "zod";
import { LedgerStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { attachCompany, requireFeature, requireCompanyMatch } from "../middleware/companyScope";
import { PAGINATION } from "../lib/constants";

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
router.use(requireAuth, attachCompany, requireFeature("billing"), adminOnly);

// GET /api/ledger
router.get("/", async (req: Request, res: Response) => {
  const { category, status, page, limit } = req.query as { category?: string; status?: LedgerStatus; page?: string; limit?: string };
  const companyId = getUserCompanyId(req);

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (status) where.status = status;
  if (companyId) where.companyId = companyId;

  const take = Math.min(Number(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = ((Math.max(Number(page) || 1, 1)) - 1) * take;

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({ where, orderBy: { date: "desc" }, take, skip }),
    prisma.ledgerEntry.count({ where }),
  ]);

  res.json({ data: entries, total, page: Math.floor(skip / take) + 1, limit: take });
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

    const companyId = getUserCompanyId(req);
    const entry = await prisma.ledgerEntry.create({
      data: { ...parsed.data, date: new Date(parsed.data.date), companyId: companyId ?? undefined },
    });

    res.status(201).json(entry);
  }
);

// DELETE /api/ledger/:id
router.delete(
  "/:id",
  audit({ action: "DELETE_LEDGER_ENTRY", resourceType: "LedgerEntry" }),
  async (req: Request, res: Response) => {
    const existing = await prisma.ledgerEntry.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Entry not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    await prisma.ledgerEntry.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Entry deleted" });
  }
);

export default router;
