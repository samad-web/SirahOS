import { Router, Request, Response } from "express";
import { z } from "zod";
import { ProjectStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly, adminOrPM, adminOrPMOrLead } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { attachCompany, requireFeature, requireCompanyMatch } from "../middleware/companyScope";

const router = Router();

const projectInclude = {
  pm: { select: { id: true, name: true, initials: true, role: true } },
  lead: { select: { id: true, name: true, initials: true, role: true } },
  members: { include: { user: { select: { id: true, name: true, initials: true, role: true } } } },
  _count: { select: { tasks: true, bugs: true } },
};

const createProjectSchema = z.object({
  name: z.string().min(1),
  client: z.string().min(1),
  description: z.string().optional(),
  deadline: z.string().datetime().optional(),
  pmId: z.string().optional(),
  githubUrl: z.string().url().optional(),
  developedBy: z.string().optional(),
});

const assignPmSchema = z.object({ pmId: z.string() });
const assignLeadSchema = z.object({ leadId: z.string() });
const addMemberSchema = z.object({ userId: z.string() });

const updateStatusSchema = z.object({
  status: z.nativeEnum(ProjectStatus),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Filter projects the requesting user is allowed to see */
async function getVisibleProjects(userId: string, role: Role, companyId?: string) {
  const companyFilter = companyId ? { companyId } : {};
  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    return prisma.project.findMany({ where: companyFilter, include: projectInclude, orderBy: { createdAt: "desc" } });
  }
  if (role === Role.PROJECT_MANAGER) {
    return prisma.project.findMany({ where: { pmId: userId, ...companyFilter }, include: projectInclude, orderBy: { createdAt: "desc" } });
  }
  if (role === Role.LEAD) {
    return prisma.project.findMany({ where: { leadId: userId, ...companyFilter }, include: projectInclude, orderBy: { createdAt: "desc" } });
  }
  // Developer / Tester — only projects they are members of
  return prisma.project.findMany({
    where: { members: { some: { userId } }, ...companyFilter },
    include: projectInclude,
    orderBy: { createdAt: "desc" },
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/projects
router.get("/", requireAuth, attachCompany, requireFeature("projects"), async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const projects = await getVisibleProjects(req.user!.sub, req.user!.role, companyId);
  res.json(projects);
});

// POST /api/projects — Admin only
router.post(
  "/",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOnly,
  audit({ action: "CREATE_PROJECT", resourceType: "Project" }),
  async (req: Request, res: Response) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const companyId = getUserCompanyId(req);
    const project = await prisma.project.create({
      data: {
        ...parsed.data,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
        companyId: companyId ?? undefined,
      },
      include: projectInclude,
    });

    res.status(201).json(project);
  }
);

// GET /api/projects/:id
router.get("/:id", requireAuth, attachCompany, requireFeature("projects"), async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id as string },
    include: {
      ...projectInclude,
      tasks: { include: { assignee: { select: { id: true, name: true, initials: true } } }, orderBy: { createdAt: "desc" } },
      bugs: { include: { reportedBy: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!requireCompanyMatch(project.companyId, req)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(project);
});

// PATCH /api/projects/:id/assign-pm — Admin only
router.patch(
  "/:id/assign-pm",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOnly,
  audit({ action: "ASSIGN_PM", resourceType: "Project" }),
  async (req: Request, res: Response) => {
    const parsed = assignPmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "pmId is required" });
      return;
    }

    const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    const project = await prisma.project.update({
      where: { id: req.params.id as string },
      data: { pmId: parsed.data.pmId },
      include: projectInclude,
    });
    res.json(project);
  }
);

// PATCH /api/projects/:id/assign-lead — PM or Admin
router.patch(
  "/:id/assign-lead",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPM,
  audit({ action: "ASSIGN_LEAD", resourceType: "Project" }),
  async (req: Request, res: Response) => {
    const parsed = assignLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "leadId is required" });
      return;
    }

    const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    const project = await prisma.project.update({
      where: { id: req.params.id as string },
      data: { leadId: parsed.data.leadId },
      include: projectInclude,
    });
    res.json(project);
  }
);

// POST /api/projects/:id/members — Lead or above
router.post(
  "/:id/members",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPMOrLead,
  audit({ action: "ADD_MEMBER", resourceType: "Project" }),
  async (req: Request, res: Response) => {
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: req.params.id as string, userId: parsed.data.userId } },
      create: { projectId: req.params.id as string, userId: parsed.data.userId },
      update: {},
    });

    res.status(201).json({ message: "Member added" });
  }
);

// DELETE /api/projects/:id/members/:userId — Lead or above
router.delete(
  "/:id/members/:userId",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPMOrLead,
  audit({ action: "REMOVE_MEMBER", resourceType: "Project" }),
  async (req: Request, res: Response) => {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: req.params.id as string, userId: req.params.userId as string } },
    });
    res.json({ message: "Member removed" });
  }
);

// PATCH /api/projects/:id/status — PM or above
router.patch(
  "/:id/status",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPM,
  audit({ action: "UPDATE_PROJECT_STATUS", resourceType: "Project" }),
  async (req: Request, res: Response) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const existing = await prisma.project.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireCompanyMatch(existing.companyId, req)) { res.status(403).json({ error: "Access denied" }); return; }

    const project = await prisma.project.update({
      where: { id: req.params.id as string },
      data: { status: parsed.data.status },
      include: projectInclude,
    });
    res.json(project);
  }
);

export default router;
