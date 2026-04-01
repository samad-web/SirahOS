import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { audit } from "../middleware/audit";
import { runAllRefreshTasks } from "../lib/monthly-refresh";
import { prisma } from "../lib/prisma";
import { attachCompany } from "../middleware/companyScope";

const router = Router();

router.use(requireAuth, attachCompany, adminOnly);

// Rate limit destructive operations: 5 requests per 15 minutes
const destructiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many destructive operations. Please wait before trying again." },
});

/** Require X-Confirm-Purge header to prevent accidental data deletion */
function requirePurgeConfirmation(req: Request, res: Response, next: () => void) {
  if (req.headers["x-confirm-purge"] !== "CONFIRM") {
    res.status(400).json({ error: "Missing confirmation. Send header X-Confirm-Purge: CONFIRM" });
    return;
  }
  next();
}

// POST /api/admin/monthly-refresh — manually trigger all monthly refresh tasks
router.post(
  "/monthly-refresh",
  audit({ action: "MANUAL_MONTHLY_REFRESH", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    const results = await runAllRefreshTasks();
    res.json({ message: "Monthly refresh completed", results });
  }
);

// ─── Data Purge Endpoints (rate-limited + confirmation required) ────────────

// DELETE /api/admin/data/customers — delete all customers & invoices
router.delete(
  "/data/customers",
  destructiveLimiter,
  requirePurgeConfirmation,
  audit({ action: "PURGE_CUSTOMERS", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    await prisma.$transaction([
      prisma.payment.deleteMany(),
      prisma.invoiceItem.deleteMany(),
      prisma.invoice.deleteMany(),
      prisma.customer.deleteMany(),
    ]);
    res.json({ message: "All customers and invoices deleted" });
  }
);

// DELETE /api/admin/data/projects — delete all projects, tasks, bugs
router.delete(
  "/data/projects",
  destructiveLimiter,
  requirePurgeConfirmation,
  audit({ action: "PURGE_PROJECTS", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    await prisma.$transaction([
      prisma.taskAssignmentLog.deleteMany(),
      prisma.bugReport.deleteMany(),
      prisma.task.deleteMany(),
      prisma.projectMember.deleteMany(),
      prisma.project.deleteMany(),
    ]);
    res.json({ message: "All projects, tasks, and bugs deleted" });
  }
);

// DELETE /api/admin/data/ledger — delete all ledger entries
router.delete(
  "/data/ledger",
  destructiveLimiter,
  requirePurgeConfirmation,
  audit({ action: "PURGE_LEDGER", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    await prisma.ledgerEntry.deleteMany();
    res.json({ message: "All ledger entries deleted" });
  }
);

// DELETE /api/admin/data/expenses — delete all expenses
router.delete(
  "/data/expenses",
  destructiveLimiter,
  requirePurgeConfirmation,
  audit({ action: "PURGE_EXPENSES", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    await prisma.expense.deleteMany();
    res.json({ message: "All expenses deleted" });
  }
);

// DELETE /api/admin/data/notes — delete all notes
router.delete(
  "/data/notes",
  destructiveLimiter,
  requirePurgeConfirmation,
  audit({ action: "PURGE_NOTES", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    await prisma.$transaction([
      prisma.note.deleteMany(),
      prisma.leadNote.deleteMany(),
    ]);
    res.json({ message: "All notes deleted" });
  }
);

// DELETE /api/admin/data/attendance — delete all attendance & leave records
router.delete(
  "/data/attendance",
  destructiveLimiter,
  requirePurgeConfirmation,
  audit({ action: "PURGE_ATTENDANCE", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    await prisma.$transaction([
      prisma.leaveTimeline.deleteMany(),
      prisma.leave.deleteMany(),
      prisma.leaveBalance.deleteMany(),
      prisma.attendance.deleteMany(),
      prisma.monthlySummary.deleteMany(),
    ]);
    res.json({ message: "All attendance and leave records deleted" });
  }
);

// DELETE /api/admin/data/all — delete ALL data except users
router.delete(
  "/data/all",
  destructiveLimiter,
  requirePurgeConfirmation,
  audit({ action: "PURGE_ALL_DATA", resourceType: "System" }),
  async (_req: Request, res: Response) => {
    await prisma.$transaction([
      prisma.taskAssignmentLog.deleteMany(),
      prisma.bugReport.deleteMany(),
      prisma.task.deleteMany(),
      prisma.projectMember.deleteMany(),
      prisma.project.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.invoiceItem.deleteMany(),
      prisma.invoice.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.ledgerEntry.deleteMany(),
      prisma.pOSItem.deleteMany(),
      prisma.pOSTransaction.deleteMany(),
      prisma.expense.deleteMany(),
      prisma.note.deleteMany(),
      prisma.leadNote.deleteMany(),
      prisma.leaveTimeline.deleteMany(),
      prisma.leave.deleteMany(),
      prisma.leaveBalance.deleteMany(),
      prisma.attendance.deleteMany(),
      prisma.monthlySummary.deleteMany(),
      prisma.auditLog.deleteMany(),
    ]);
    res.json({ message: "All data deleted (users preserved)" });
  }
);

export default router;
