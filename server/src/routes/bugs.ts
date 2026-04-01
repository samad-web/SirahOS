import { Router, Request, Response } from "express";
import { z } from "zod";
import { BugSeverity, BugStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOrPM } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { attachCompany, requireFeature } from "../middleware/companyScope";
import { PAGINATION } from "../lib/constants";

const router = Router();

const bugInclude = {
  reportedBy: { select: { id: true, name: true, initials: true } },
  assignedTo: { select: { id: true, name: true, initials: true } },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
};

const createBugSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.nativeEnum(BugSeverity).default("MEDIUM"),
  taskId: z.string().optional(),
});

const assignBugSchema = z.object({
  assignedToId: z.string(),
});

const updateBugStatusSchema = z.object({
  status: z.nativeEnum(BugStatus),
  resolution: z.string().optional(),
});

// GET /api/bugs?projectId=xxx
router.get("/", requireAuth, attachCompany, requireFeature("projects"), async (req: Request, res: Response) => {
  const { projectId } = req.query as { projectId?: string };
  const { role, sub } = req.user!;

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;

  // Developers see only bugs assigned to them
  if (role === Role.DEVELOPER) {
    where.assignedToId = sub;
  }

  const companyId = getUserCompanyId(req);
  if (companyId) where.companyId = companyId;

  const { page, limit } = req.query as { projectId?: string; page?: string; limit?: string };
  const take = Math.min(Number(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = ((Math.max(Number(page) || 1, 1)) - 1) * take;

  const [bugs, total] = await Promise.all([
    prisma.bugReport.findMany({ where, include: bugInclude, orderBy: { createdAt: "desc" }, take, skip }),
    prisma.bugReport.count({ where }),
  ]);

  res.json({ data: bugs, total, page: Math.floor(skip / take) + 1, limit: take });
});

// POST /api/bugs — Testers and above can report bugs
router.post(
  "/",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  audit({ action: "REPORT_BUG", resourceType: "BugReport" }),
  async (req: Request, res: Response) => {
    const { role } = req.user!;

    // Admins, PMs, Leads, and Testers can report bugs
    if (role === Role.DEVELOPER) {
      res.status(403).json({ error: "Developers cannot report bugs directly" });
      return;
    }

    const parsed = createBugSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const companyId = getUserCompanyId(req);
    const bug = await prisma.bugReport.create({
      data: {
        ...parsed.data,
        reportedById: req.user!.sub,
        companyId: companyId ?? undefined,
      },
      include: bugInclude,
    });

    res.status(201).json(bug);
  }
);

// PATCH /api/bugs/:id/assign — PM or Admin only (enforces workflow: bug → PM → Dev)
router.patch(
  "/:id/assign",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPM,
  audit({ action: "ASSIGN_BUG", resourceType: "BugReport" }),
  async (req: Request, res: Response) => {
    const parsed = assignBugSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "assignedToId is required" });
      return;
    }

    const bug = await prisma.bugReport.update({
      where: { id: req.params.id as string },
      data: {
        assignedToId: parsed.data.assignedToId,
        status: BugStatus.ASSIGNED,
      },
      include: bugInclude,
    });

    res.json(bug);
  }
);

// PATCH /api/bugs/:id/status
router.patch(
  "/:id/status",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  audit({ action: "UPDATE_BUG_STATUS", resourceType: "BugReport" }),
  async (req: Request, res: Response) => {
    const parsed = updateBugStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { role, sub } = req.user!;
    const bug = await prisma.bugReport.findUnique({ where: { id: req.params.id as string } });

    if (!bug) {
      res.status(404).json({ error: "Bug not found" });
      return;
    }

    // Enforce role-based status transitions
    const { status } = parsed.data;

    if (role === Role.DEVELOPER && bug.assignedToId !== sub) {
      res.status(403).json({ error: "You can only update bugs assigned to you" });
      return;
    }

    // Testers can only verify bugs (IN_REVIEW → VERIFIED)
    if (role === Role.TESTER && status !== BugStatus.VERIFIED && status !== BugStatus.CLOSED) {
      res.status(403).json({ error: "Testers can only verify or close bugs" });
      return;
    }

    const updated = await prisma.bugReport.update({
      where: { id: req.params.id as string },
      data: { status, resolution: parsed.data.resolution },
      include: bugInclude,
    });

    res.json(updated);
  }
);

export default router;
