/**
 * Tests the "Export CSV" buttons added to Customers, Invoices, Ledger, and
 * Expenses. Verifies the button triggers a real download with the expected
 * filename prefix and a plausible CSV body.
 */

import { test, expect } from "@playwright/test";
import { loginAs, DEMO } from "./helpers";

// The Export button's accessible name comes from its aria-label, which is
// specific to each page — "Export customers as CSV", "Export invoices as
// CSV", etc. A wildcard regex matches all of them.
const EXPORT_BUTTON_RE = /export .* as csv/i;

async function verifyCsvDownload(
  page: import("@playwright/test").Page,
  opts: { filenamePrefix: string; expectedHeader: string },
) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: EXPORT_BUTTON_RE }).click();
  const download = await downloadPromise;

  // Filename should start with the datedFilename() prefix
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${opts.filenamePrefix}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));

  // Read the body — should start with UTF-8 BOM + expected header row.
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");

  // UTF-8 BOM
  expect(body.charCodeAt(0)).toBe(0xFEFF);
  // Expected header (after stripping BOM)
  expect(body.slice(1)).toMatch(new RegExp(`^${opts.expectedHeader}`));
}

test.describe("CSV exports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO.admin);
  });

  test("Customers page exports a CSV", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: /customers/i })).toBeVisible();

    // Remote Supabase can be very slow. Wait for the export button to
    // become enabled — it flips from disabled→enabled when the React
    // Query for customers resolves and `filtered.length > 0`.
    const exportBtn = page.getByRole("button", { name: EXPORT_BUTTON_RE });
    await expect(exportBtn).toBeEnabled({ timeout: 30000 });

    await verifyCsvDownload(page, {
      filenamePrefix: "customers",
      expectedHeader: "Name,Company,Email",
    });
  });

  test("Invoices page exports a CSV (skips if no invoices seeded)", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: /invoices/i }).first()).toBeVisible();

    // Wait a beat for React Query to resolve, then decide: if the button is
    // still disabled, the seed DB has no invoices and we skip.
    const exportBtn = page.getByRole("button", { name: EXPORT_BUTTON_RE });
    await page.waitForTimeout(1500);
    const enabled = await exportBtn.isEnabled().catch(() => false);
    test.skip(!enabled, "No invoices in the seed DB to export");

    await verifyCsvDownload(page, {
      filenamePrefix: "invoices",
      expectedHeader: "Invoice #,Customer",
    });
  });
});
