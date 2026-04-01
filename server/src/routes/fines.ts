import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { attachCompany, requireFeature, requireCompanyMatch } from "../middleware/companyScope";

const router = Router();

const userSelect = { id: true, name: true, initials: true, role: true } as const;

const createFineSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1),
});

// GET /api/fines — Admin gets all fines, non-admin gets only their own
router.get("/", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
  const userId = req.query.userId as string | undefined;
  const companyId = getUserCompanyId(req);

  const where: Record<string, unknown> = isAdmin
    ? userId ? { userId } : {}
    : { userId: req.user!.sub };
  if (companyId) where.companyId = companyId;

  const fines = await prisma.fine.findMany({
    where,
    include: {
      user: { select: userSelect },
      issuedBy: { select: userSelect },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(fines);
});

// GET /api/fines/summary — Admin only: total fines, paid, unpaid per user
router.get("/summary", requireAuth, attachCompany, requireFeature("attendance"), adminOnly, async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const fines = await prisma.fine.findMany({
    where: companyId ? { companyId } : {},
    select: {
      amount: true,
      paid: true,
      userId: true,
      user: { select: userSelect },
    },
  });

  const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
  const totalPaid = fines.reduce((s, f) => s + (f.paid ? f.amount : 0), 0);
  const totalUnpaid = totalAmount - totalPaid;
  const totalCount = fines.length;

  // Per-user breakdown
  const byUser: Record<string, { user: typeof fines[0]["user"]; total: number; paid: number; unpaid: number; count: number }> = {};
  for (const f of fines) {
    if (!byUser[f.userId]) {
      byUser[f.userId] = { user: f.user, total: 0, paid: 0, unpaid: 0, count: 0 };
    }
    byUser[f.userId].total += f.amount;
    byUser[f.userId].count += 1;
    if (f.paid) byUser[f.userId].paid += f.amount;
    else byUser[f.userId].unpaid += f.amount;
  }

  res.json({
    totalAmount,
    totalPaid,
    totalUnpaid,
    totalCount,
    byUser: Object.values(byUser),
  });
});

// GET /api/fines/my-summary — Any user: their own fine totals
router.get("/my-summary", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const fines = await prisma.fine.findMany({
    where: { userId: req.user!.sub },
    select: { amount: true, paid: true },
  });

  const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
  const totalPaid = fines.reduce((s, f) => s + (f.paid ? f.amount : 0), 0);

  res.json({
    totalAmount,
    totalPaid,
    totalUnpaid: totalAmount - totalPaid,
    totalCount: fines.length,
  });
});

// POST /api/fines — Admin only: create a fine
router.post(
  "/",
  requireAuth,
  attachCompany,
  requireFeature("attendance"),
  adminOnly,
  audit({ action: "CREATE_FINE", resourceType: "Fine" }),
  async (req: Request, res: Response) => {
    const parsed = createFineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { userId, amount, reason } = parsed.data;

    // Cannot fine an admin
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.role === "ADMIN") {
      res.status(403).json({ error: "Cannot impose a fine on an admin" });
      return;
    }

    const companyId = getUserCompanyId(req);
    const fine = await prisma.fine.create({
      data: {
        userId,
        amount,
        reason,
        issuedById: req.user!.sub,
        companyId: companyId ?? undefined,
      },
      include: {
        user: { select: userSelect },
        issuedBy: { select: userSelect },
      },
    });

    res.status(201).json(fine);
  }
);

// PATCH /api/fines/:id/paid — Admin only: toggle paid status
router.patch(
  "/:id/paid",
  requireAuth,
  attachCompany,
  requireFeature("attendance"),
  adminOnly,
  audit({ action: "UPDATE_FINE", resourceType: "Fine" }),
  async (req: Request, res: Response) => {
    const { paid } = z.object({ paid: z.boolean() }).parse(req.body);

    const existing = await prisma.fine.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Fine not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    const fine = await prisma.fine.update({
      where: { id: req.params.id as string },
      data: { paid },
      include: {
        user: { select: userSelect },
        issuedBy: { select: userSelect },
      },
    });

    res.json(fine);
  }
);

// DELETE /api/fines/:id — Admin only: delete a fine
router.delete(
  "/:id",
  requireAuth,
  attachCompany,
  requireFeature("attendance"),
  adminOnly,
  audit({ action: "DELETE_FINE", resourceType: "Fine" }),
  async (req: Request, res: Response) => {
    const existing = await prisma.fine.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Fine not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    await prisma.fine.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  }
);

export default router;
