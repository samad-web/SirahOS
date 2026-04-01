import { Router, Request, Response } from "express";
import { z } from "zod";
import { LeaveType, LeaveStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { attachCompany, requireFeature } from "../middleware/companyScope";

const router = Router();

const createLeaveSchema = z.object({
  leaveType: z.nativeEnum(LeaveType),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:    z.string().min(1),
});

const reviewLeaveSchema = z.object({
  status: z.enum(["IN_PROCESS", "APPROVED", "REJECTED"]),
  note:   z.string().optional(),
});

const assignBalanceSchema = z.object({
  userId:    z.string(),
  leaveType: z.nativeEnum(LeaveType),
  total:     z.number().int().positive(),
  year:      z.number().int().min(2020).max(2099),
});

// ─── Visibility helpers ───────────────────────────────────────────────────────

/**
 * Returns the user IDs whose leaves the requester may see.
 * - Admin           → everyone
 * - PM / Lead       → their direct reports (via reportsToId) + unassigned users + self
 * - Dev / Tester    → only themselves
 *
 * Unassigned users (reportsToId = null) are visible to all PMs for backward compat.
 */
async function getVisibleUserIds(requesterId: string, role: Role): Promise<string[] | "all"> {
  if (role === Role.ADMIN) return "all";

  if (role === Role.PROJECT_MANAGER || role === Role.LEAD) {
    // Direct reports assigned to this manager
    const directReports = await prisma.user.findMany({
      where: { reportsToId: requesterId, status: "ACTIVE" },
      select: { id: true },
    });

    const ids = new Set(directReports.map((u) => u.id));
    ids.add(requesterId); // always see own leaves

    // PM also sees unassigned users (backward compat)
    if (role === Role.PROJECT_MANAGER) {
      const unassigned = await prisma.user.findMany({
        where: { reportsToId: null, status: "ACTIVE", role: { not: Role.ADMIN } },
        select: { id: true },
      });
      unassigned.forEach((u) => ids.add(u.id));
    }

    return [...ids];
  }

  return [requesterId];
}

/**
 * Returns true if requester can approve/reject leaves for the target user.
 * - Admin  → anyone
 * - PM     → their direct reports + unassigned users (not Admin)
 * - Lead   → their direct reports only
 */
async function canApprove(
  requesterId: string,
  requesterRole: Role,
  targetUserId: string,
  targetRole: Role,
  targetReportsToId: string | null
): Promise<boolean> {
  if (requesterRole === Role.ADMIN) return true;

  if (requesterRole === Role.PROJECT_MANAGER) {
    if (targetRole === Role.ADMIN) return false;
    // Approve if user reports to this PM, or is unassigned
    return targetReportsToId === requesterId || targetReportsToId === null;
  }

  if (requesterRole === Role.LEAD) {
    // Lead can only approve their own direct reports
    return targetReportsToId === requesterId;
  }

  return false;
}

const leaveInclude = {
  user: { select: { id: true, name: true, initials: true, role: true } },
  timeline: {
    include: { reviewer: { select: { id: true, name: true, initials: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

// GET /api/leaves?status=&userId=
router.get("/", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const { status, userId } = req.query as { status?: LeaveStatus; userId?: string };
  const { sub, role } = req.user!;

  const allowed = await getVisibleUserIds(sub, role as Role);

  const userIdFilter =
    userId && (allowed === "all" || allowed.includes(userId))
      ? userId
      : allowed === "all"
      ? undefined
      : { in: allowed };

  const leaves = await prisma.leave.findMany({
    where: {
      ...(userIdFilter ? { userId: userIdFilter as string } : {}),
      ...(status ? { status } : {}),
    },
    include: leaveInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  res.json(leaves);
});

// POST /api/leaves — submit leave request (own)
router.post(
  "/",
  requireAuth,
  attachCompany,
  requireFeature("attendance"),
  audit({ action: "REQUEST_LEAVE", resourceType: "Leave" }),
  async (req: Request, res: Response) => {
    const parsed = createLeaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { leaveType, startDate, endDate, reason } = parsed.data;
    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (end < start) {
      res.status(400).json({ error: "End date must be on or after start date" });
      return;
    }

    const companyId = (req.user as any).companyId as string | undefined;
    const leave = await prisma.leave.create({
      data: {
        userId: req.user!.sub,
        leaveType,
        startDate: start,
        endDate:   end,
        reason,
        companyId: companyId ?? undefined,
        timeline: {
          create: {
            status:     LeaveStatus.REQUESTED,
            reviewerId: req.user!.sub,
            note:       "Leave request submitted",
          },
        },
      },
      include: leaveInclude,
    });

    res.status(201).json(leave);
  }
);

// PATCH /api/leaves/:id/review — Admin or PM reviews a leave
router.patch(
  "/:id/review",
  requireAuth,
  attachCompany,
  requireFeature("attendance"),
  audit({ action: "REVIEW_LEAVE", resourceType: "Leave" }),
  async (req: Request, res: Response) => {
    const parsed = reviewLeaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { status, note } = parsed.data;
    const { sub, role } = req.user!;

    const leave = await prisma.leave.findUnique({
      where: { id: req.params.id as string },
      include: { user: { select: { role: true, reportsToId: true } } },
    });

    if (!leave) {
      res.status(404).json({ error: "Leave not found" });
      return;
    }

    // Check if requester can approve this specific leave
    const allowed = await canApprove(sub, role as Role, leave.userId, leave.user.role, leave.user.reportsToId);
    if (!allowed) {
      res.status(403).json({ error: "You do not have permission to review this leave request" });
      return;
    }

    const updated = await prisma.leave.update({
      where: { id: req.params.id as string },
      data: {
        status: status as LeaveStatus,
        timeline: {
          create: {
            status:     status as LeaveStatus,
            reviewerId: sub,
            note:       note ?? null,
          },
        },
      },
      include: leaveInclude,
    });

    // Deduct from leave balance only on approval
    if (status === LeaveStatus.APPROVED) {
      const days =
        Math.ceil(
          (new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      const year = new Date(leave.startDate).getFullYear();

      await prisma.leaveBalance.upsert({
        where: { userId_leaveType_year: { userId: leave.userId, leaveType: leave.leaveType, year } },
        create: { userId: leave.userId, leaveType: leave.leaveType, year, total: 0, used: days },
        update: { used: { increment: days } },
      });
    }

    res.json(updated);
  }
);

// GET /api/leaves/balance?userId=&year=
router.get("/balance", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const { userId, year } = req.query as { userId?: string; year?: string };
  const { sub, role } = req.user!;

  const allowed = await getVisibleUserIds(sub, role as Role);
  const targetId = userId ?? sub;

  if (allowed !== "all" && !allowed.includes(targetId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const y = year ? parseInt(year, 10) : new Date().getFullYear();

  const balances = await prisma.leaveBalance.findMany({
    where: { userId: targetId, year: y },
    include: { user: { select: { id: true, name: true, initials: true } } },
  });

  res.json(balances);
});

// GET /api/leaves/balances/all — all users' balances (Admin/PM)
router.get("/balances/all", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const { role } = req.user!;

  if (role !== Role.ADMIN && role !== Role.PROJECT_MANAGER) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const year = new Date().getFullYear();
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true, name: true, initials: true, role: true,
      leaveBalances: { where: { year } },
    },
    orderBy: { name: "asc" },
  });

  res.json(users);
});

// POST /api/leaves/balance — assign/update leave quota (Admin/PM)
router.post(
  "/balance",
  requireAuth,
  attachCompany,
  requireFeature("attendance"),
  audit({ action: "ASSIGN_LEAVE_BALANCE", resourceType: "LeaveBalance" }),
  async (req: Request, res: Response) => {
    const { role } = req.user!;
    if (role !== Role.ADMIN && role !== Role.PROJECT_MANAGER) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = assignBalanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { userId, leaveType, total, year } = parsed.data;

    const balance = await prisma.leaveBalance.upsert({
      where: { userId_leaveType_year: { userId, leaveType, year } },
      create: { userId, leaveType, total, used: 0, year },
      update: { total },
    });

    res.status(201).json(balance);
  }
);

export default router;
