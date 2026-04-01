import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { Role } from "@prisma/client";

const router = Router();

const superAdminOnly = requireRole(Role.SUPER_ADMIN);

const createCompanySchema = z.object({
  companyName: z.string().min(1),
  companySlug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  grantSuperAdmin: z.boolean().default(false),
  features: z.object({
    billing: z.boolean().default(true),
    projects: z.boolean().default(true),
    attendance: z.boolean().default(true),
    leads: z.boolean().default(true),
  }).default({}),
});

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  featureBilling: z.boolean().optional(),
  featureProjects: z.boolean().optional(),
  featureAttendance: z.boolean().optional(),
  featureLeads: z.boolean().optional(),
});

// All company routes require SUPER_ADMIN
router.use(requireAuth, superAdminOnly);

// GET /api/companies — List all companies with stats
router.get("/", async (_req: Request, res: Response) => {
  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { users: true } },
      users: {
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true, name: true, email: true, role: true },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(companies);
});

// GET /api/companies/:id — Get single company details
router.get("/:id", async (req: Request, res: Response) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id as string },
    include: {
      _count: { select: { users: true } },
      users: {
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true, name: true, email: true, role: true },
        take: 3,
      },
    },
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  // Get user counts
  const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
    prisma.user.count({ where: { companyId: company.id } }),
    prisma.user.count({ where: { companyId: company.id, status: "ACTIVE" } }),
    prisma.user.count({ where: { companyId: company.id, status: "INACTIVE" } }),
  ]);

  res.json({
    ...company,
    userStats: { total: totalUsers, active: activeUsers, inactive: inactiveUsers },
  });
});

// POST /api/companies — Create a new company + its Admin user
router.post("/", async (req: Request, res: Response) => {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { companyName, companySlug, adminName, adminEmail, adminPassword, grantSuperAdmin, features } = parsed.data;

  // Check slug uniqueness
  const existingSlug = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (existingSlug) {
    res.status(409).json({ error: "Company slug already exists" });
    return;
  }

  // Check admin email uniqueness
  const existingEmail = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
  if (existingEmail) {
    res.status(409).json({ error: "Admin email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const initials = adminName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Create company and admin user in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug: companySlug,
        featureBilling: features.billing,
        featureProjects: features.projects,
        featureAttendance: features.attendance,
        featureLeads: features.leads,
      },
    });

    const admin = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail.toLowerCase(),
        passwordHash,
        role: grantSuperAdmin ? "SUPER_ADMIN" : "ADMIN",
        initials,
        companyId: company.id,
      },
      select: {
        id: true, name: true, email: true, role: true, status: true, initials: true,
      },
    });

    return { company, admin };
  });

  res.status(201).json(result);
});

// PATCH /api/companies/:id — Update name, status, feature flags
router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const company = await prisma.company.update({
    where: { id: req.params.id as string },
    data: parsed.data,
    include: {
      _count: { select: { users: true } },
    },
  });

  res.json(company);
});

// DELETE /api/companies/:id — Soft-delete (set status = SUSPENDED)
router.delete("/:id", async (req: Request, res: Response) => {
  const company = await prisma.company.update({
    where: { id: req.params.id as string },
    data: { status: "SUSPENDED" },
  });

  res.json({ message: "Company suspended", company });
});

// GET /api/companies/:id/users — List users in a company
router.get("/:id/users", async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { companyId: req.params.id as string },
    select: {
      id: true, name: true, email: true, role: true, status: true, initials: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(users);
});

// PATCH /api/companies/:companyId/users/:userId/role — Promote/demote a user to SUPER_ADMIN
router.patch("/:id/users/:userId/role", async (req: Request, res: Response) => {
  const { grantSuperAdmin } = z.object({ grantSuperAdmin: z.boolean() }).parse(req.body);

  const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId as string } });
  if (!targetUser || targetUser.companyId !== req.params.id) {
    res.status(404).json({ error: "User not found in this company" });
    return;
  }

  // Only toggle between ADMIN and SUPER_ADMIN — don't touch other roles
  if (targetUser.role !== "ADMIN" && targetUser.role !== "SUPER_ADMIN") {
    res.status(400).json({ error: "Only admin users can be promoted to Super Admin" });
    return;
  }

  const newRole = grantSuperAdmin ? "SUPER_ADMIN" : "ADMIN";
  const user = await prisma.user.update({
    where: { id: req.params.userId as string },
    data: { role: newRole },
    select: { id: true, name: true, email: true, role: true, status: true, initials: true },
  });

  res.json(user);
});

export default router;
