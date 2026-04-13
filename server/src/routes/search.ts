/**
 * Global search — cross-entity lookup powering the frontend command palette.
 *
 * Design notes:
 *   - Uses Postgres ILIKE via Prisma `contains` with `mode: insensitive`.
 *     Not fuzzy, not ranked, but fast and good enough for a billing app's
 *     data volume. If this ever gets slow, switch to tsvector + GIN index.
 *   - Company-scoped for tenants; SUPER_ADMIN sees across their current
 *     company context (not all companies — that would be a privacy leak).
 *   - Per-entity caps keep result sets small so the UI stays snappy.
 *   - Only entities the caller's role is allowed to view are queried. This
 *     matters: a DEVELOPER querying "invoice-123" should NOT see the hit.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { attachCompany } from "../middleware/companyScope";

const router = Router();

const searchSchema = z.object({
  q: z.string().min(1).max(100),
});

const PER_ENTITY_LIMIT = 5;

type SearchResult = {
  type: "customer" | "invoice" | "project" | "task" | "recurring-invoice";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
};

router.use(requireAuth, attachCompany);

router.get("/", async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    res.json({ results: [] });
    return;
  }

  const { q } = parsed.data;
  const needle = q.trim();
  if (!needle) {
    res.json({ results: [] });
    return;
  }

  const companyId = getUserCompanyId(req);
  const companyWhere = companyId ? { companyId } : {};
  const role = req.user!.role;
  const canViewBilling = role === "ADMIN" || role === "SUPER_ADMIN";
  const canViewProjects =
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "PROJECT_MANAGER" ||
    role === "LEAD";

  // Fire all queries in parallel — Prisma sends separate round-trips but
  // they'll be concurrent on the pool. Total wall time ≈ the slowest one.
  const [customers, invoices, recurring, projects, tasks] = await Promise.all([
    canViewBilling
      ? prisma.customer.findMany({
          where: {
            ...companyWhere,
            OR: [
              { name:    { contains: needle, mode: "insensitive" } },
              { company: { contains: needle, mode: "insensitive" } },
              { email:   { contains: needle, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, company: true, email: true },
          take: PER_ENTITY_LIMIT,
        })
      : Promise.resolve([]),

    canViewBilling
      ? prisma.invoice.findMany({
          where: {
            ...companyWhere,
            OR: [
              { invoiceNumber: { contains: needle, mode: "insensitive" } },
              { notes:         { contains: needle, mode: "insensitive" } },
              { customer: { name:    { contains: needle, mode: "insensitive" } } },
              { customer: { company: { contains: needle, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            customer: { select: { name: true, company: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PER_ENTITY_LIMIT,
        })
      : Promise.resolve([]),

    canViewBilling
      ? prisma.recurringInvoice.findMany({
          where: {
            ...companyWhere,
            OR: [
              { name:  { contains: needle, mode: "insensitive" } },
              { notes: { contains: needle, mode: "insensitive" } },
              { customer: { name: { contains: needle, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            name: true,
            frequency: true,
            customer: { select: { name: true } },
          },
          take: PER_ENTITY_LIMIT,
        })
      : Promise.resolve([]),

    canViewProjects
      ? prisma.project.findMany({
          where: {
            ...companyWhere,
            OR: [
              { name:        { contains: needle, mode: "insensitive" } },
              { client:      { contains: needle, mode: "insensitive" } },
              { description: { contains: needle, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, client: true, status: true },
          take: PER_ENTITY_LIMIT,
        })
      : Promise.resolve([]),

    // Tasks — role-scoped. DEVELOPER/TESTER/EDITOR/DIGITAL_MARKETER only see
    // their own assigned tasks. Higher roles see any task in their company.
    (() => {
      const memberRoles = ["DEVELOPER", "TESTER", "EDITOR", "DIGITAL_MARKETER"];
      const taskWhere: Prisma.TaskWhereInput = {
        ...companyWhere,
        OR: [
          { title:       { contains: needle, mode: "insensitive" } },
          { description: { contains: needle, mode: "insensitive" } },
        ],
      };
      if (memberRoles.includes(role)) {
        taskWhere.assigneeId = req.user!.sub;
      }
      return prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          title: true,
          status: true,
          project: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: PER_ENTITY_LIMIT,
      });
    })(),
  ]);

  const results: SearchResult[] = [
    ...customers.map((c): SearchResult => ({
      type: "customer",
      id: c.id,
      title: c.name,
      subtitle: c.company ? `${c.company} · ${c.email}` : c.email,
      url: `/customers`,
    })),
    ...invoices.map((i): SearchResult => ({
      type: "invoice",
      id: i.id,
      title: i.invoiceNumber,
      subtitle: `${i.customer?.name ?? ""}${i.customer?.company ? " · " + i.customer.company : ""} · ${i.status}`,
      url: `/invoices`,
    })),
    ...recurring.map((r): SearchResult => ({
      type: "recurring-invoice",
      id: r.id,
      title: r.name,
      subtitle: `${r.customer?.name ?? ""} · ${r.frequency.toLowerCase()}`,
      url: `/recurring-invoices`,
    })),
    ...projects.map((p): SearchResult => ({
      type: "project",
      id: p.id,
      title: p.name,
      subtitle: `${p.client} · ${p.status.toLowerCase()}`,
      url: `/projects`,
    })),
    ...tasks.map((t): SearchResult => ({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: `${t.project?.name ?? ""} · ${t.status.replace("_", " ").toLowerCase()}`,
      url: `/projects`,
    })),
  ];

  res.json({ results });
});

export default router;
