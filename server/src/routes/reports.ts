import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { cache, TTL } from "../lib/cache";
import { attachCompany, requireFeature } from "../middleware/companyScope";

const router = Router();

// All report routes are admin-only
router.use(requireAuth, attachCompany, requireFeature("billing"), adminOnly);

// GET /api/reports/summary — Dashboard KPIs
router.get("/summary", async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const cacheKey = companyId ? `reports:summary:${companyId}` : "reports:summary";
  const companyFilter = companyId ? { companyId } : {};
  const data = await cache.getOrSet(cacheKey, TTL.MEDIUM, async () => {
    const [invoices, customers, projects, ledger] = await Promise.all([
      prisma.invoice.findMany({ where: companyFilter, include: { items: true, payments: true } }),
      prisma.customer.count({ where: companyFilter }),
      prisma.project.count({ where: companyFilter }),
      prisma.ledgerEntry.findMany({ where: companyFilter }),
    ]);

    // Use cents for all intermediate math to avoid floating-point rounding errors
    const totalInvoicedCents = invoices.reduce((sum, inv) => {
      const subtotalCents = inv.items.reduce((s, i) => s + Math.round(i.quantity * i.unitPrice * 100), 0);
      return sum + subtotalCents + Math.round(subtotalCents * inv.gstRate / 100);
    }, 0);
    const totalInvoiced = totalInvoicedCents / 100;

    const totalCollectedCents = invoices.reduce((sum, inv) => {
      return sum + inv.payments.reduce((s, p) => s + Math.round(p.amount * 100), 0);
    }, 0);
    const totalCollected = totalCollectedCents / 100;

    const totalExpensesCents = ledger
      .filter((e) => e.debit > 0)
      .reduce((sum, e) => sum + Math.round(e.debit * 100), 0);
    const totalExpenses = totalExpensesCents / 100;

    const netProfit = (totalCollectedCents - totalExpensesCents) / 100;

    return {
      totalRevenue: totalCollected,
      totalInvoiced,
      totalExpenses,
      netProfit,
      profitMargin: totalCollected > 0 ? ((netProfit / totalCollected) * 100).toFixed(1) : "0.0",
      totalCustomers: customers,
      totalProjects: projects,
      pendingInvoices: invoices.filter((i) => i.status === "PENDING").length,
      overdueInvoices: invoices.filter((i) => i.status === "OVERDUE").length,
    };
  });

  res.json(data);
});

// GET /api/reports/revenue — Monthly revenue breakdown (last 12 months)
router.get("/revenue", async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const cacheKey = companyId ? `reports:revenue:${companyId}` : "reports:revenue";
  const companyFilter = companyId ? { companyId } : {};
  const data = await cache.getOrSet(cacheKey, TTL.MEDIUM, async () => {
    const [invoices, ledger] = await Promise.all([
      prisma.invoice.findMany({ where: companyFilter, include: { items: true, payments: true }, orderBy: { createdAt: "asc" } }),
      prisma.ledgerEntry.findMany({ where: companyFilter, orderBy: { date: "asc" } }),
    ]);

    const months: { month: string; revenue: number; expenses: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });

      const revenue = invoices
        .filter((inv) => {
          const created = new Date(inv.createdAt);
          return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
        })
        .reduce((sum, inv) => sum + inv.payments.reduce((s, p) => s + p.amount, 0), 0);

      const expenses = ledger
        .filter((e) => {
          const eDate = new Date(e.date);
          return eDate.getMonth() === d.getMonth() && eDate.getFullYear() === d.getFullYear() && e.debit > 0;
        })
        .reduce((sum, e) => sum + e.debit, 0);

      months.push({ month: label, revenue, expenses });
    }
    return months;
  });

  res.json(data);
});

// GET /api/reports/gst — GST collection breakdown
router.get("/gst", async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const cacheKey = companyId ? `reports:gst:${companyId}` : "reports:gst";
  const companyFilter = companyId ? { companyId } : {};
  const data = await cache.getOrSet(cacheKey, TTL.MEDIUM, async () => {
    const invoices = await prisma.invoice.findMany({ where: companyFilter, include: { items: true } });
    const result: Record<string, number> = {};
    for (const inv of invoices) {
      const subtotalCents = inv.items.reduce((s, i) => s + Math.round(i.quantity * i.unitPrice * 100), 0);
      const gstCents = Math.round(subtotalCents * inv.gstRate / 100);
      const key = `${inv.gstRate}%`;
      result[key] = (result[key] ?? 0) + gstCents / 100;
    }
    return result;
  });
  res.json(data);
});

// GET /api/reports/top-clients
router.get("/top-clients", async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const cacheKey = companyId ? `reports:top-clients:${companyId}` : "reports:top-clients";
  const companyFilter = companyId ? { companyId } : {};
  const data = await cache.getOrSet(cacheKey, TTL.MEDIUM, async () => {
    const customers = await prisma.customer.findMany({
      where: companyFilter,
      include: { invoices: { include: { payments: true } } },
    });
    return customers
      .map((c) => ({
        id: c.id, name: c.name, company: c.company,
        revenue: c.invoices.reduce((sum, inv) => sum + inv.payments.reduce((s, p) => s + p.amount, 0), 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  });
  res.json(data);
});

export default router;
