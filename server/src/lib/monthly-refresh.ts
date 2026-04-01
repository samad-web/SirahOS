/**
 * Monthly database refresh tasks.
 *
 * Each function is idempotent — safe to re-run without data corruption.
 * All operate within try/catch so individual failures are isolated.
 */

import { prisma } from "./prisma";
import { AttendanceStatus, LeaveType } from "@prisma/client";
import { logger } from "./logger";

const log = logger.create("Refresh");

// ─── Config ──────────────────────────────────────────────────────────────────

/** Default leave allocations per year (days) */
const DEFAULT_LEAVE_ALLOCATION: Record<string, number> = {
  CASUAL: 12,
  SICK: 7,
  EARNED: 15,
  UNPAID: 0, // unlimited — no allocation tracked
};

/** Max carry-forward days from previous year */
const CARRY_FORWARD_CAP: Record<string, number> = {
  CASUAL: 3,
  SICK: 0,
  EARNED: 10,
  UNPAID: 0,
};

// ─── 1. Archive Attendance Summaries ─────────────────────────────────────────

/**
 * Generates a per-user attendance summary for the previous month.
 * Does NOT delete raw Attendance rows — they remain as source of truth.
 */
export async function archiveAttendanceSummaries(): Promise<{ processed: number }> {
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-12
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const startDate = new Date(prevYear, prevMonth - 1, 1);
  const endDate = new Date(prevYear, prevMonth, 0, 23, 59, 59); // last day of prev month
  const totalDays = endDate.getDate();

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let processed = 0;

  for (const user of users) {
    const records = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
      },
      select: { status: true },
    });

    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0, ABSENT: 0, HALFDAY: 0, WFH: 0,
    };
    records.forEach((r) => { counts[r.status]++; });

    await prisma.monthlySummary.upsert({
      where: { userId_year_month: { userId: user.id, year: prevYear, month: prevMonth } },
      create: {
        userId: user.id,
        year: prevYear,
        month: prevMonth,
        present: counts.PRESENT,
        absent: counts.ABSENT,
        halfDay: counts.HALFDAY,
        wfh: counts.WFH,
        totalDays,
      },
      update: {
        present: counts.PRESENT,
        absent: counts.ABSENT,
        halfDay: counts.HALFDAY,
        wfh: counts.WFH,
        totalDays,
      },
    });

    processed++;
  }

  log.info(` Attendance summaries archived for ${prevYear}-${String(prevMonth).padStart(2, "0")}: ${processed} users`);
  return { processed };
}

// ─── 2. Leave Balance Yearly Rollover ────────────────────────────────────────

/**
 * Creates leave balances for the new year, carrying forward unused days
 * from the previous year (with caps). Only runs in January.
 */
export async function rolloverLeaveBalances(): Promise<{ created: number }> {
  const now = new Date();
  if (now.getMonth() !== 0) {
    log.info("Leave rollover skipped — not January");
    return { created: 0 };
  }

  const newYear = now.getFullYear();
  const prevYear = newYear - 1;
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let created = 0;

  for (const user of users) {
    for (const leaveType of ["CASUAL", "SICK", "EARNED"] as LeaveType[]) {
      const prevBalance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveType_year: { userId: user.id, leaveType, year: prevYear } },
      });

      const remaining = prevBalance ? Math.max(0, prevBalance.total - prevBalance.used) : 0;
      const carryForward = Math.min(remaining, CARRY_FORWARD_CAP[leaveType] ?? 0);
      const defaultAlloc = DEFAULT_LEAVE_ALLOCATION[leaveType] ?? 0;

      await prisma.leaveBalance.upsert({
        where: { userId_leaveType_year: { userId: user.id, leaveType, year: newYear } },
        create: { userId: user.id, leaveType, year: newYear, total: defaultAlloc + carryForward, used: 0 },
        update: {}, // don't overwrite if already exists
      });

      created++;
    }
  }

  log.info(` Leave balances rolled over to ${newYear}: ${created} records`);
  return { created };
}

// ─── 3. Ensure Current Year Balances ─────────────────────────────────────────

/**
 * Creates missing leave balances for the current year for any active user
 * that doesn't have them yet (catches users created mid-year).
 */
export async function ensureCurrentYearBalances(): Promise<{ created: number }> {
  const year = new Date().getFullYear();
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let created = 0;

  for (const user of users) {
    for (const leaveType of ["CASUAL", "SICK", "EARNED"] as LeaveType[]) {
      const existing = await prisma.leaveBalance.findUnique({
        where: { userId_leaveType_year: { userId: user.id, leaveType, year } },
      });

      if (!existing) {
        const defaultAlloc = DEFAULT_LEAVE_ALLOCATION[leaveType] ?? 0;
        await prisma.leaveBalance.create({
          data: { userId: user.id, leaveType, year, total: defaultAlloc, used: 0 },
        });
        created++;
      }
    }
  }

  if (created > 0) log.info(`Created ${created} missing leave balances for ${year}`);
  return { created };
}

// ─── 4. Expired Token Cleanup ────────────────────────────────────────────────

export async function cleanupExpiredTokens(): Promise<{ deleted: number }> {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  log.info(` Cleaned up ${count} expired refresh tokens`);
  return { deleted: count };
}

// ─── 5. Audit Log Pruning ────────────────────────────────────────────────────

export async function pruneOldAuditLogs(): Promise<{ deleted: number }> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);

  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  log.info(` Pruned ${count} audit logs older than 6 months`);
  return { deleted: count };
}

// ─── Run All (for admin trigger) ─────────────────────────────────────────────

export async function runAllRefreshTasks() {
  const results: Record<string, unknown> = {};

  const tasks = [
    { name: "archiveAttendance", fn: archiveAttendanceSummaries },
    { name: "ensureLeaveBalances", fn: ensureCurrentYearBalances },
    { name: "rolloverLeaveBalances", fn: rolloverLeaveBalances },
    { name: "cleanupTokens", fn: cleanupExpiredTokens },
    { name: "pruneAuditLogs", fn: pruneOldAuditLogs },
  ];

  for (const task of tasks) {
    try {
      results[task.name] = await task.fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`${task.name} FAILED: ${msg}`);
      results[task.name] = { error: msg };
    }
  }

  return results;
}
