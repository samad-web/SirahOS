/**
 * Pure helpers for recurring-invoice cadence math and generation.
 *
 * Kept free of Prisma/express so they can be unit-tested in isolation —
 * the routes + scheduler import these and do the DB work around them.
 */

import { RecurringFrequency } from "@prisma/client";

/** Return a new Date representing `from` advanced by one `frequency` step. */
export function advanceDate(from: Date, frequency: RecurringFrequency): Date {
  const d = new Date(from);
  switch (frequency) {
    case "WEEKLY":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "MONTHLY":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "QUARTERLY":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "YEARLY":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d;
}

/**
 * Build an invoice number for a generated invoice. Cheap, monotonic, and
 * human-readable: `INV-YYYYMM-<recurringTemplateShortId>-<seq>`.
 * We fall back to a random suffix if the template id is tiny.
 */
export function buildRecurringInvoiceNumber(
  templateId: string,
  seq: number,
  now: Date = new Date()
): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const shortId = templateId.slice(-6).toUpperCase();
  return `INV-${y}${m}-${shortId}-${String(seq).padStart(3, "0")}`;
}

/**
 * Compute the invoice due date for a generated invoice.
 * `dueDays` is how many days after generation payment is due.
 */
export function computeDueDate(generatedAt: Date, dueDays: number): Date {
  const d = new Date(generatedAt);
  d.setUTCDate(d.getUTCDate() + Math.max(0, dueDays));
  return d;
}
