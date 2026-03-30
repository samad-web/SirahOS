import { Router, Request, Response } from "express";
import { z } from "zod";
import { TaskType, TaskStatus, TaskPriority } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { adminOrPMOrLead } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { canAssign, getAssignableUsers } from "../middleware/validateAssignment";

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
router.get("/assignable-users", requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.query as { projectId?: string };

  if (!projectId) {
    res.status(400).json({ error: "projectId query parameter is required" });
    return;
  }

  const { sub, role } = req.user!;
  const users = await getAssignableUsers(sub, role, projectId);
  res.json(users);
});

// ─── GET /api/tasks?projectId=xxx ──────────────────────────────────────────
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.query as { projectId?: string };
  const where: Record<string, unknown> = {};

  if (projectId) {
    where.projectId = projectId;
  }

  // Developers and Testers only see their own tasks
  const { role, sub } = req.user!;
  if (role === "DEVELOPER" || role === "TESTER") {
    where.assigneeId = sub;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  res.json(tasks);
});

// ─── POST /api/tasks — Lead or above with hierarchical permission check ────
router.post(
  "/",
  requireAuth,
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

    const task = await prisma.task.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        createdById: sub,
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
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
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
router.get("/:id/history", requireAuth, async (req: Request, res: Response) => {
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

    // Developers/Testers can only update status on tasks assigned to them
    if ((role === "DEVELOPER" || role === "TESTER") && task.assigneeId !== sub) {
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

// ─── DELETE /api/tasks/:id — Lead or above ─────────────────────────────────
router.delete(
  "/:id",
  requireAuth,
  adminOrPMOrLead,
  audit({ action: "DELETE_TASK", resourceType: "Task" }),
  async (req: Request, res: Response) => {
    await prisma.task.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Task deleted" });
  }
);

export default router;
