import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { attachCompany } from "../middleware/companyScope";

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many password change attempts, please try again later." },
});

const router = Router();

const reportsToSelect = { id: true, name: true, initials: true, role: true } as const;

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(Role),
  reportsToId: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const updateReportsToSchema = z.object({
  reportsToId: z.string().nullable(),
});

// GET /api/users — Admin only
router.get("/", requireAuth, attachCompany, adminOnly, async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const users = await prisma.user.findMany({
    where: companyId ? { companyId } : {},
    select: {
      id: true, name: true, email: true, role: true,
      status: true, initials: true, createdAt: true,
      reportsToId: true,
      reportsTo: { select: reportsToSelect },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

// GET /api/users/assignable — All authenticated users (for assignment dropdowns)
router.get("/assignable", requireAuth, attachCompany, async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", ...(companyId ? { companyId } : {}) },
    select: {
      id: true, name: true, email: true, role: true, initials: true,
      reportsToId: true,
      reportsTo: { select: reportsToSelect },
    },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

// POST /api/users — Admin only
router.post(
  "/",
  requireAuth,
  attachCompany,
  adminOnly,
  audit({ action: "CREATE_USER", resourceType: "User" }),
  async (req: Request, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { name, email, password, role, reportsToId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const companyId = getUserCompanyId(req);
    const user = await prisma.user.create({
      data: {
        name, email: email.toLowerCase(), passwordHash, role, initials,
        reportsToId: reportsToId || null,
        companyId: companyId ?? undefined,
      },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        initials: true, createdAt: true, reportsToId: true,
        reportsTo: { select: reportsToSelect },
      },
    });

    res.status(201).json(user);
  }
);

// PATCH /api/users/:id/status — Admin only
router.patch(
  "/:id/status",
  requireAuth,
  adminOnly,
  audit({ action: "UPDATE_USER_STATUS", resourceType: "User" }),
  async (req: Request, res: Response) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { status: parsed.data.status },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    res.json(user);
  }
);

// PATCH /api/users/:id/reports-to — Admin only (reassign manager)
router.patch(
  "/:id/reports-to",
  requireAuth,
  adminOnly,
  audit({ action: "REASSIGN_USER", resourceType: "User" }),
  async (req: Request, res: Response) => {
    const parsed = updateReportsToSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    // Validate that the target manager exists and has an appropriate role
    if (parsed.data.reportsToId) {
      const manager = await prisma.user.findUnique({
        where: { id: parsed.data.reportsToId },
        select: { role: true },
      });
      if (!manager || !([Role.ADMIN, Role.PROJECT_MANAGER, Role.LEAD] as Role[]).includes(manager.role)) {
        res.status(400).json({ error: "Target must be an Admin, PM, or Lead" });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { reportsToId: parsed.data.reportsToId },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        initials: true, reportsToId: true,
        reportsTo: { select: reportsToSelect },
      },
    });

    res.json(user);
  }
);

// PATCH /api/users/:id — Admin only (update user details)
const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).optional(),
  reportsToId: z.string().nullable().optional(),
});

router.patch(
  "/:id",
  requireAuth,
  adminOnly,
  audit({ action: "UPDATE_USER", resourceType: "User" }),
  async (req: Request, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { name, email, role, reportsToId } = parsed.data;
    const userId = req.params.id as string;

    // Check if email is already taken by another user
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing && existing.id !== userId) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
    }

    const data: Record<string, unknown> = {};
    if (name) {
      data.name = name;
      data.initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email) data.email = email.toLowerCase();
    if (role) data.role = role;
    if (reportsToId !== undefined) data.reportsToId = reportsToId;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, name: true, email: true, role: true, status: true,
        initials: true, createdAt: true, reportsToId: true,
        reportsTo: { select: reportsToSelect },
      },
    });

    res.json(user);
  }
);

// DELETE /api/users/:id — Admin only
router.delete(
  "/:id",
  requireAuth,
  adminOnly,
  audit({ action: "DELETE_USER", resourceType: "User" }),
  async (req: Request, res: Response) => {
    const userId = req.params.id as string;

    // Prevent self-deletion
    if (userId === req.user!.sub) {
      res.status(400).json({ error: "Cannot delete your own account" });
      return;
    }

    // Schema onDelete rules handle all cleanup automatically:
    // - Cascade: tasks, bugs, assignment logs, audit logs, leaves, attendance, etc.
    // - SetNull: project PM/lead, task assignee, bug assignee, reportsTo
    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true });
  }
);

// ─── Profile (self-service) ─────────────────────────────────────────────────

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
}).refine(
  (d) => !d.newPassword || d.currentPassword,
  { message: "Current password is required to set a new password", path: ["currentPassword"] }
);

// GET /api/users/profile — get own full profile
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true, name: true, email: true, role: true, status: true,
      initials: true, createdAt: true, updatedAt: true,
      reportsToId: true,
      reportsTo: { select: reportsToSelect },
      _count: {
        select: {
          assignedTasks: true,
          createdTasks: true,
          managedProjects: true,
          leadProjects: true,
          projectMemberships: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

// PATCH /api/users/profile — update own name/password
router.patch("/profile", requireAuth, passwordChangeLimiter, async (req: Request, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { name, currentPassword, newPassword } = parsed.data;
  const userId = req.user!.sub;

  // If changing password, verify current one
  if (newPassword) {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!existing || !(await bcrypt.compare(currentPassword!, existing.passwordHash))) {
      res.status(403).json({ error: "Current password is incorrect" });
      return;
    }
  }

  const data: Record<string, string> = {};
  if (name) {
    data.name = name;
    data.initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }
  if (newPassword) {
    data.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, name: true, email: true, role: true, status: true,
      initials: true, createdAt: true, updatedAt: true,
      reportsToId: true,
      reportsTo: { select: reportsToSelect },
    },
  });

  res.json(user);
});

export default router;
