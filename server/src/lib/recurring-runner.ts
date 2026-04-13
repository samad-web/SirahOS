/**
 * Recurring-invoice execution engine.
 *
 * Called by:
 *   - The daily cron job (runAllDueRecurringInvoices)
 *   - The /run-now admin endpoint (generateRecurringInvoiceNow)
 *
 * Both paths funnel through `generateFromTemplate` which holds the single
 * source of truth for "create an invoice from a template and advance the
 * cadence." Kept in its own file so `routes/*` and `lib/scheduler.ts` can
 * both import it without circular deps.
 */

import { prisma } from "./prisma";
import { logger } from "./logger";
import { advanceDate, buildRecurringInvoiceNumber, computeDueDate } from "./recurring";

const log = logger.scheduler;

/**
 * Create one invoice from a recurring template and advance its nextRunAt.
 * Runs in a single transaction so a partial failure never leaves the
 * template pointing at a future date with no invoice actually created.
 */
export async function generateFromTemplate(templateId: string, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.recurringInvoice.findUnique({
      where: { id: templateId },
      include: { items: true },
    });
    if (!template) throw new Error(`RecurringInvoice ${templateId} not found`);
    if (template.status !== "ACTIVE") throw new Error(`RecurringInvoice ${templateId} is not ACTIVE`);

    const seq = template.generatedCount + 1;
    const invoiceNumber = buildRecurringInvoiceNumber(template.id, seq, now);
    const dueDate = computeDueDate(now, template.dueDays);

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: template.customerId,
        companyId: template.companyId,
        gstRate: template.gstRate,
        paymentType: template.paymentType,
        emiMonths: template.emiMonths,
        notes: template.notes,
        dueDate,
        recurringInvoiceId: template.id,
        items: {
          create: template.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
      include: { items: true, payments: true, customer: { select: { id: true, name: true, company: true, email: true } } },
    });

    // Advance the cadence. If we've passed endDate, mark ENDED.
    const nextRun = advanceDate(template.nextRunAt, template.frequency);
    const hasEnded = template.endDate !== null && nextRun > template.endDate;

    await tx.recurringInvoice.update({
      where: { id: template.id },
      data: {
        nextRunAt: nextRun,
        lastRunAt: now,
        generatedCount: seq,
        status: hasEnded ? "ENDED" : template.status,
      },
    });

    return invoice;
  });
}

/** Explicit entry point for the /run-now endpoint. */
export async function generateRecurringInvoiceNow(templateId: string) {
  return generateFromTemplate(templateId);
}

/**
 * Called by the daily cron. Finds every ACTIVE template whose `nextRunAt`
 * is on or before today and generates one invoice per template.
 *
 * Multiple runs in a single tick (e.g. a weekly template that missed
 * multiple runs during a long outage) are handled by looping — each call
 * to `generateFromTemplate` advances the cadence by exactly one step.
 */
export async function runAllDueRecurringInvoices(now: Date = new Date()) {
  // Use midnight UTC of "today" so DATE comparisons work correctly even if
  // the cron fires a few minutes late.
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

  const due = await prisma.recurringInvoice.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: endOfToday },
    },
    select: { id: true, name: true, nextRunAt: true, frequency: true },
  });

  log.info(`Recurring invoices due: ${due.length}`);

  let generated = 0;
  let failed = 0;
  for (const template of due) {
    try {
      // Keep generating until we catch up to "today." Bounded so a bug
      // can't produce an infinite loop — 52 weeks is plenty.
      for (let i = 0; i < 52; i++) {
        const fresh = await prisma.recurringInvoice.findUnique({
          where: { id: template.id },
          select: { status: true, nextRunAt: true },
        });
        if (!fresh || fresh.status !== "ACTIVE") break;
        if (fresh.nextRunAt > endOfToday) break;
        await generateFromTemplate(template.id, now);
        generated++;
      }
    } catch (err) {
      failed++;
      log.error(`Failed to generate from template ${template.id}`, err instanceof Error ? err.message : err);
    }
  }

  log.info(`Recurring invoices — generated: ${generated}, failed: ${failed}`);
  return { generated, failed, due: due.length };
}
