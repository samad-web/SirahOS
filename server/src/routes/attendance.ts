import { Router, Request, Response } from "express";
import { z } from "zod";
import { AttendanceStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { attachCompany, requireFeature } from "../middleware/companyScope";

const router = Router();

const markSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  status: z.nativeEnum(AttendanceStatus),
  note: z.string().optional(),
});

/**
 * Determine which user IDs the requester can view attendance for.
 * Admin / PM → all users
 * Lead      → their direct project team members
 * Dev/Tester → only themselves
 */
async function getAllowedUserIds(requesterId: string, role: Role): Promise<string[] | "all"> {
  if (role === Role.ADMIN || role === Role.PROJECT_MANAGER) return "all";

  if (role === Role.LEAD) {
    // Members of projects where this user is lead
    const memberships = await prisma.projectMember.findMany({
      where: { project: { leadId: requesterId } },
      select: { userId: true },
    });
    const ids = memberships.map((m) => m.userId);
    ids.push(requesterId); // lead can also see their own
    return [...new Set(ids)];
  }

  return [requesterId];
}

// GET /api/attendance?userId=&year=&month=
router.get("/", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const { userId, year, month } = req.query as {
    userId?: string;
    year?: string;
    month?: string; // 1-based
  };

  const { sub, role } = req.user!;
  const allowed = await getAllowedUserIds(sub, role as Role);

  // Build date range filter
  const dateFilter: Record<string, unknown> = {};
  if (year && month) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10) - 1; // JS months are 0-based
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // last day of month
    dateFilter.gte = start;
    dateFilter.lte = end;
  }

  // Build userId filter
  const userIdFilter =
    userId && (allowed === "all" || allowed.includes(userId))
      ? userId
      : allowed === "all"
      ? undefined
      : { in: allowed };

  const companyId = getUserCompanyId(req);
  const records = await prisma.attendance.findMany({
    where: {
      ...(userIdFilter ? { userId: userIdFilter as string } : {}),
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      ...(companyId ? { companyId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, initials: true, role: true } },
    },
    orderBy: { date: "desc" },
    take: 1000,
  });

  res.json(records);
});

// POST /api/attendance — mark or update own attendance
router.post("/", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { date, status, note } = parsed.data;
  const dateObj = new Date(date);

  const companyId = getUserCompanyId(req);
  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId: req.user!.sub, date: dateObj } },
    create: { userId: req.user!.sub, date: dateObj, status, note, companyId: companyId ?? undefined },
    update: { status, note, markedAt: new Date() },
    include: { user: { select: { id: true, name: true, initials: true } } },
  });

  res.status(201).json(record);
});

// GET /api/attendance/summary?userId=&year=&month= — monthly counts for a user
router.get("/summary", requireAuth, attachCompany, requireFeature("attendance"), async (req: Request, res: Response) => {
  const { userId, year, month } = req.query as {
    userId?: string;
    year?: string;
    month?: string;
  };

  const { sub, role } = req.user!;
  const allowed = await getAllowedUserIds(sub, role as Role);
  const targetId = userId ?? sub;

  if (allowed !== "all" && !allowed.includes(targetId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const y = year ? parseInt(year, 10) : new Date().getFullYear();
  const m = month ? parseInt(month, 10) - 1 : new Date().getMonth();

  const records = await prisma.attendance.findMany({
    where: {
      userId: targetId,
      date: { gte: new Date(y, m, 1), lte: new Date(y, m + 1, 0) },
    },
  });

  const summary = {
    PRESENT: 0, ABSENT: 0, HALFDAY: 0, WFH: 0, total: records.length,
  };
  records.forEach((r) => { summary[r.status]++; });

  res.json(summary);
});

export default router;
