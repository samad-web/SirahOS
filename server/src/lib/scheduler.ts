/**
 * Cron-based scheduler for recurring tasks.
 *
 * Jobs:
 *   - 1st of every month, 09:00 — WhatsApp EMI payment reminders
 *   - 1st of every month, 01:00 — Archive attendance summaries
 *   - 1st of every month, 01:10 — Ensure leave balances exist
 *   - 1st of January, 00:30      — Leave balance yearly rollover
 *   - 1st of every month, 02:00 — Cleanup expired refresh tokens
 *   - 1st of every month, 03:00 — Prune old audit logs (>6 months)
 *
 * All jobs use Asia/Kolkata timezone.
 */

import cron, { ScheduledTask } from "node-cron";
import { prisma } from "./prisma";
import { sendWhatsAppMessage } from "./evolution";
import {
  archiveAttendanceSummaries,
  ensureCurrentYearBalances,
  rolloverLeaveBalances,
  cleanupExpiredTokens,
  pruneOldAuditLogs,
} from "./monthly-refresh";

const TZ = { timezone: "Asia/Kolkata" };
const tasks: ScheduledTask[] = [];

const fmt = (n: number) => `Rs.${n.toLocaleString("en-IN")}`;

/** Send payment reminders to all active EMI customers with a phone number. */
export async function sendEmiReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
  const customers = await prisma.customer.findMany({
    where: { paymentType: "EMI", status: "ACTIVE", phone: { not: null } },
  });

  let sent = 0, failed = 0, skipped = 0;

  for (const c of customers) {
    if (!c.phone) { skipped++; continue; }

    const message = [
      `Hi ${c.name},`,
      ``,
      `This is a friendly reminder that your monthly installment of *${fmt(c.monthlyEmi ?? 0)}* is due.`,
      c.totalAmount ? `Total plan: ${fmt(c.totalAmount)} over ${c.totalMonths ?? "—"} months.` : "",
      ``,
      `Please make your payment at the earliest.`,
      `Thank you — Sirahos`,
    ].filter(Boolean).join("\n");

    const ok = await sendWhatsAppMessage(c.phone, message);
    if (ok) sent++; else failed++;
  }

  console.log(`[Scheduler] EMI reminders — sent: ${sent}, failed: ${failed}, skipped: ${skipped}`);
  return { sent, failed, skipped };
}

/** Wrap a job so failures are logged but don't crash the process */
function safeJob(name: string, fn: () => Promise<unknown>) {
  return async () => {
    console.log(`[Scheduler] Starting: ${name}`);
    try {
      await fn();
      console.log(`[Scheduler] Completed: ${name}`);
    } catch (err) {
      console.error(`[Scheduler] FAILED: ${name}`, err instanceof Error ? err.message : err);
    }
  };
}

/** Register all cron jobs. Call once after server starts. */
export function initScheduler() {
  tasks.push(
    cron.schedule("0 9 1 * *",  safeJob("EMI reminders",          sendEmiReminders),            TZ),
    cron.schedule("0 1 1 * *",  safeJob("Attendance archive",     archiveAttendanceSummaries),  TZ),
    cron.schedule("10 1 1 * *", safeJob("Ensure leave balances",  ensureCurrentYearBalances),   TZ),
    cron.schedule("30 0 1 1 *", safeJob("Leave rollover",         rolloverLeaveBalances),       TZ),
    cron.schedule("0 2 1 * *",  safeJob("Token cleanup",          cleanupExpiredTokens),        TZ),
    cron.schedule("0 3 1 * *",  safeJob("Audit log prune",        pruneOldAuditLogs),           TZ),
  );

  console.log("   Scheduler: 6 jobs registered (IST timezone)");
}

/** Stop all cron tasks (used during graceful shutdown) */
export function stopScheduler() {
  tasks.forEach((t) => t.stop());
  console.log("[Scheduler] All jobs stopped");
}
