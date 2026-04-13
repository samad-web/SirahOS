import { Router, Request, Response } from "express";
import { z } from "zod";
import { TaskType, TaskStatus, TaskPriority } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOrPMOrLead } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { canAssign, getAssignableUsers } from "../middleware/validateAssignment";
import { attachCompany, requireFeature } from "../middleware/companyScope";
import { PAGINATION } from "../lib/constants";
import { getGeneralProjectId } from "../lib/general-project";

const router = Router();

const taskInclude = {
  assignee: { select: { id: true, name: true, initials: true, role: true } },
  createdBy: { select: { id: true, name: true } },
};

const createTaskSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).default("TASK"),
  priority: z.nativeEnum(TaskPriority).default("MEDIUM"),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

// ─── GET /api/tasks/assignable-users?projectId=xxx ─────────────────────────
// Returns users the current user is permitted to assign tasks to in a project
router.get("/assignable-users", requireAuth, attachCompany, requireFeature("projects"), async (req: Request, res: Response) => {
  const { projectId } = req.query as { projectId?: string };

  if (!projectId) {
    res.status(400).json({ error: "projectId query parameter is required" });
    return;
  }

  const { sub, role } = req.user!;
  const users = await getAssignableUsers(sub, role, projectId);
  res.json(users);
});

// ─── GET /api/tasks — supports rich filters for cross-project admin views ─
// Query params: projectId, assigneeId (can be "unassigned"), status, priority, search
router.get("/", requireAuth, attachCompany, requireFeature("projects"), async (req: Request, res: Response) => {
  const { projectId, assigneeId, status, priority, search } = req.query as {
    projectId?: string;
    assigneeId?: string;
    status?: string;
    priority?: string;
    search?: string;
  };
  const where: Record<string, unknown> = {};

  if (projectId) where.projectId = projectId;

  // "unassigned" sentinel → tasks with no assignee
  if (assigneeId === "unassigned") {
    where.assigneeId = null;
  } else if (assigneeId) {
    where.assigneeId = assigneeId;
  }

  if (status && ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(status)) {
    where.status = status;
  }
  if (priority && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)) {
    where.priority = priority;
  }
  if (search) {
    where.OR = [
      { title:       { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // Non-management roles only see their own tasks (overrides any assigneeId filter)
  const { role, sub } = req.user!;
  const MEMBER_ROLES: string[] = ["DEVELOPER", "TESTER", "EDITOR", "DIGITAL_MARKETER"];
  if (MEMBER_ROLES.includes(role)) {
    where.assigneeId = sub;
  }

  const companyId = getUserCompanyId(req);
  if (companyId) where.companyId = companyId;

  const { page, limit } = req.query as { projectId?: string; page?: string; limit?: string };
  const take = Math.min(Number(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = ((Math.max(Number(page) || 1, 1)) - 1) * take;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        ...taskInclude,
        project: { select: { id: true, name: true, client: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ data: tasks, total, page: Math.floor(skip / take) + 1, limit: take });
});

// ─── POST /api/tasks — Lead or above with hierarchical permission check ────
router.post(
  "/",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPMOrLead,
  audit({ action: "CREATE_TASK", resourceType: "Task" }),
  async (req: Request, res: Response) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { sub, role } = req.user!;

    // Hierarchical permission check if assigning
    if (parsed.data.assigneeId) {
      const permission = await canAssign(sub, role, parsed.data.assigneeId, parsed.data.projectId);
      if (!permission.allowed) {
        res.status(403).json({
          error: "PERMISSION_DENIED",
          message: permission.reason,
        });
        return;
      }
    }

    const companyId = getUserCompanyId(req);
    const task = await prisma.task.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        createdById: sub,
        companyId: companyId ?? undefined,
      },
      include: taskInclude,
    });

    // Log the initial assignment
    if (parsed.data.assigneeId) {
      await prisma.taskAssignmentLog.create({
        data: {
          taskId: task.id,
          assignedById: sub,
          assignedToId: parsed.data.assigneeId,
          note: "Initial assignment",
        },
      });
    }

    res.status(201).json(task);
  }
);

// ─── GET /api/tasks/:id ────────────────────────────────────────────────────
router.get("/:id", requireAuth, attachCompany, requireFeature("projects"), async (req: Request, res: Response) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id as string },
    include: taskInclude,
  });

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(task);
});

// ─── GET /api/tasks/:id/history — assignment audit trail ───────────────────
router.get("/:id/history", requireAuth, attachCompany, requireFeature("projects"), async (req: Request, res: Response) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id as string } });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const logs = await prisma.taskAssignmentLog.findMany({
    where: { taskId: req.params.id as string },
    include: {
      assignedBy: { select: { id: true, name: true, initials: true, role: true } },
      assignedTo: { select: { id: true, name: true, initials: true, role: true } },
    },
    orderBy: { assignedAt: "desc" },
    take: 100,
  });

  res.json(logs);
});

// ─── PATCH /api/tasks/:id — with hierarchical reassignment check ───────────
router.patch(
  "/:id",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  audit({ action: "UPDATE_TASK", resourceType: "Task" }),
  async (req: Request, res: Response) => {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { role, sub } = req.user!;
    const task = await prisma.task.findUnique({ where: { id: req.params.id as string } });

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Non-management roles can only update status on tasks assigned to them
    const MEMBER_ROLES: string[] = ["DEVELOPER", "TESTER", "EDITOR", "DIGITAL_MARKETER"];
    if (MEMBER_ROLES.includes(role) && task.assigneeId !== sub) {
      res.status(403).json({ error: "You can only update tasks assigned to you" });
      return;
    }

    // Hierarchical permission check when reassigning
    if (parsed.data.assigneeId && parsed.data.assigneeId !== task.assigneeId) {
      const permission = await canAssign(sub, role, parsed.data.assigneeId, task.projectId);
      if (!permission.allowed) {
        res.status(403).json({
          error: "PERMISSION_DENIED",
          message: permission.reason,
        });
        return;
      }

      // Log the reassignment
      await prisma.taskAssignmentLog.create({
        data: {
          taskId: task.id,
          assignedById: sub,
          assignedToId: parsed.data.assigneeId,
          note: (req.body as Record<string, unknown>).reassignNote as string ?? "Reassigned",
        },
      });
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id as string },
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate === null ? null : parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        assigneeId: parsed.data.assigneeId === null ? null : parsed.data.assigneeId,
      },
      include: taskInclude,
    });

    res.json(updated);
  }
);

// ─── PATCH /api/tasks/:id/assign — dedicated reassign endpoint ─────────────
router.patch(
  "/:id/assign",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPMOrLead,
  audit({ action: "REASSIGN_TASK", resourceType: "Task" }),
  async (req: Request, res: Response) => {
    const { assigned_to, note } = req.body as { assigned_to?: string; note?: string };

    if (!assigned_to) {
      res.status(400).json({ error: "assigned_to is required" });
      return;
    }

    const task = await prisma.task.findUnique({ where: { id: req.params.id as string } });
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const { sub, role } = req.user!;

    // Hierarchical permission check
    const permission = await canAssign(sub, role, assigned_to, task.projectId);
    if (!permission.allowed) {
      res.status(403).json({
        error: "PERMISSION_DENIED",
        message: permission.reason,
      });
      return;
    }

    // Update the task
    const updated = await prisma.task.update({
      where: { id: req.params.id as string },
      data: { assigneeId: assigned_to },
      include: taskInclude,
    });

    // Log the reassignment
    await prisma.taskAssignmentLog.create({
      data: {
        taskId: task.id,
        assignedById: sub,
        assignedToId: assigned_to,
        note: note ?? "Reassigned",
      },
    });

    res.json({
      success: true,
      message: "Task reassigned successfully",
      data: updated,
    });
  }
);

// ─── POST /api/tasks/bulk-assign — reassign many tasks to one user ────────
router.post(
  "/bulk-assign",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPMOrLead,
  audit({ action: "BULK_ASSIGN_TASKS", resourceType: "Task" }),
  async (req: Request, res: Response) => {
    const body = req.body as { taskIds?: unknown; assigneeId?: unknown; note?: unknown };
    if (!Array.isArray(body.taskIds) || body.taskIds.length === 0 || typeof body.assigneeId !== "string") {
      res.status(400).json({ error: "taskIds (non-empty array) and assigneeId (string) are required" });
      return;
    }
    const taskIds = body.taskIds.filter((t): t is string => typeof t === "string");
    const assigneeId = body.assigneeId;
    const note = typeof body.note === "string" ? body.note : "Bulk reassignment";
    const { sub, role } = req.user!;
    const companyId = getUserCompanyId(req);

    // Load the candidate tasks (scoped to the user's company)
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, ...(companyId ? { companyId } : {}) },
      select: { id: true, projectId: true },
    });

    // Validate every (task, newAssignee) pair through the same hierarchical check
    // used for single reassignment. If any one fails, reject the whole batch.
    const denied: { taskId: string; reason: string }[] = [];
    for (const task of tasks) {
      const perm = await canAssign(sub, role, assigneeId, task.projectId);
      if (!perm.allowed) denied.push({ taskId: task.id, reason: perm.reason ?? "not permitted" });
    }
    if (denied.length > 0) {
      res.status(403).json({ error: "PERMISSION_DENIED", denied });
      return;
    }

    // Execute the reassignment + assignment log entries atomically
    const validIds = tasks.map(t => t.id);
    await prisma.$transaction([
      prisma.task.updateMany({ where: { id: { in: validIds } }, data: { assigneeId } }),
      prisma.taskAssignmentLog.createMany({
        data: validIds.map(taskId => ({ taskId, assignedById: sub, assignedToId: assigneeId, note })),
      }),
    ]);

    res.json({ success: true, updated: validIds.length });
  }
);

// ─── DELETE /api/tasks/:id — Lead or above ─────────────────────────────────
router.delete(
  "/:id",
  requireAuth,
  attachCompany,
  requireFeature("projects"),
  adminOrPMOrLead,
  audit({ action: "DELETE_TASK", resourceType: "Task" }),
  async (req: Request, res: Response) => {
    await prisma.task.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Task deleted" });
  }
);

// ─── POST /api/tasks/quick — standalone task assignment (no project needed) ──
// Admin, PM, or Lead can assign a task to any active user in their company
// without first creating a project. The task lands in an auto-created
// "General Tasks" project.
const quickTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).default("TASK"),
  priority: z.nativeEnum(TaskPriority).default("MEDIUM"),
  assigneeId: z.string().min(1),
  dueDate: z.string().datetime().optional(),
});

router.post(
  "/quick",
  requireAuth,
  attachCompany,
  adminOrPMOrLead,
  audit({ action: "CREATE_TASK", resourceType: "Task" }),
  async (req: Request, res: Response) => {
    const parsed = quickTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const companyId = getUserCompanyId(req);
    if (!companyId) {
      res.status(403).json({ error: "No company context" });
      return;
    }

    // Verify the assignee exists and is active in the same company
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assigneeId },
      select: { id: true, status: true, companyId: true },
    });
    if (!assignee || assignee.companyId !== companyId) {
      res.status(400).json({ error: "Assignee not found in your company" });
      return;
    }
    if (assignee.status !== "ACTIVE") {
      res.status(400).json({ error: "Cannot assign to an inactive user" });
      return;
    }

    const projectId = await getGeneralProjectId(companyId);

    const task = await prisma.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        type: parsed.data.type,
        priority: parsed.data.priority,
        assigneeId: parsed.data.assigneeId,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        projectId,
        companyId,
        createdById: req.user!.sub,
      },
      include: {
        ...taskInclude,
        project: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(task);
  }
);

export default router;
