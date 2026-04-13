/**
 * End-to-end test for the recurring-invoice feature.
 *
 *   1. Log in as admin
 *   2. Navigate to /recurring-invoices
 *   3. Create a template with a unique name so we don't collide with prior runs
 *   4. Verify it appears in the table with status=Active
 *   5. Trigger "run now" (⚡) and verify the generated count goes up
 *   6. Navigate to /invoices and confirm a fresh invoice with the expected
 *      auto-generated number exists
 *
 * Leaves data behind in the seed DB — tests don't clean up templates
 * because the "delete" action soft-ends them rather than hard-deleting
 * (the UX choice made in routes/recurringInvoices.ts).
 */

import { test, expect } from "@playwright/test";
import { loginAs, DEMO, stamp } from "./helpers";

test.describe("Recurring invoices", () => {
  // This test makes 5+ round-trips to remote Supabase: login, fetch
  // customers, create template, run-now, fetch invoices. At ~4s each,
  // the 30s default test timeout is too tight.
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO.admin);
  });

  test("create → appears in table → run-now → generates real invoice", async ({ page }) => {
    const templateName = `E2E ${stamp("recur")}`;

    // ── 1. Navigate to the page ───────────────────────────────────────────
    await page.goto("/recurring-invoices");
    await expect(page.getByRole("heading", { name: /recurring invoices/i })).toBeVisible();

    // ── 2. Open the create modal ──────────────────────────────────────────
    await page.getByRole("button", { name: /new recurring/i }).click();

    const dialog = page.getByRole("dialog", { name: /new recurring invoice/i });
    await expect(dialog).toBeVisible();

    // ── 3. Fill the form ──────────────────────────────────────────────────
    await dialog.getByLabel("Name").fill(templateName);

    // Pick the first customer in the dropdown that isn't the placeholder.
    // Customers are fetched via React Query, so we have to wait for the
    // <select> to be populated before reading its options.
    const customerSelect = dialog.getByLabel("Customer");
    await customerSelect.waitFor();
    // Remote Supabase can take 5-15s for a cold customers fetch. Give it room.
    await expect
      .poll(async () => {
        return customerSelect.evaluate((el) => (el as HTMLSelectElement).options.length);
      }, { timeout: 25000, message: "customers dropdown never populated" })
      .toBeGreaterThan(1); // > 1 because option[0] is the placeholder

    const firstCustomerValue = await customerSelect.evaluate((el) => {
      const select = el as HTMLSelectElement;
      const opt = Array.from(select.options).find((o) => o.value !== "");
      return opt?.value ?? "";
    });
    expect(firstCustomerValue, "seed DB should have at least one customer").toBeTruthy();
    await customerSelect.selectOption(firstCustomerValue);

    // Fill a single line item
    await dialog.getByLabel("Item 1 description").fill("E2E test retainer");
    await dialog.getByLabel("Item 1 quantity").fill("1");
    await dialog.getByLabel("Item 1 unit price").fill("5000");

    // ── 4. Submit ─────────────────────────────────────────────────────────
    await dialog.getByRole("button", { name: /^create$/i }).click();

    // Remote Supabase takes 3-5s for multi-table writes. Give the submit
    // enough time to finish before asserting the modal has closed.
    await expect(dialog).not.toBeVisible({ timeout: 25000 });

    // ── 5. Confirm the row landed in the table ───────────────────────────
    const row = page.getByRole("row", { name: new RegExp(templateName, "i") });
    await expect(row).toBeVisible({ timeout: 15000 });

    // Status pill should read "Active"
    await expect(row.getByText(/active/i)).toBeVisible();

    // Generated count starts at 0
    const cells = await row.locator("td").allTextContents();
    const generatedCell = cells[4] ?? "";
    expect(generatedCell.trim()).toBe("0");

    // ── 6. Click "Generate now" (⚡) ──────────────────────────────────────
    await row.getByRole("button", { name: new RegExp(`generate invoice now for ${templateName}`, "i") }).click();

    // Wait for the optimistic invalidation + refetch — generated count should tick to 1
    await expect(async () => {
      const refreshedCells = await page
        .getByRole("row", { name: new RegExp(templateName, "i") })
        .locator("td")
        .allTextContents();
      expect(refreshedCells[4]?.trim()).toBe("1");
    }).toPass({ timeout: 20000 });

    // ── 7. Verify at least one generated invoice exists on the Invoices page ─
    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: /invoices/i }).first()).toBeVisible();

    // The auto-generated number follows INV-YYYYMM-<6chars>-<3digits>.
    // Previous test runs may have bumped the seq, so match any suffix.
    await expect(page.getByText(/INV-\d{6}-[A-Z0-9]{6}-\d{3}/).first()).toBeVisible({ timeout: 20000 });
  });
});
