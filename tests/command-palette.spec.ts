/**
 * Tests the global command palette (Cmd+K) and keyboard shortcut help (Shift+?).
 */

import { test, expect } from "@playwright/test";
import { loginAs, DEMO } from "./helpers";

test.describe("Global command palette (Cmd+K)", () => {
  test("opens with Ctrl+K, accepts input, and closes with Escape", async ({ page }) => {
    await loginAs(page, DEMO.admin);

    // Click body to ensure the global keydown handler can fire.
    await page.locator("body").click();
    await page.keyboard.press("Control+K");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // The search input is present and focusable
    const input = dialog.locator("input").first();
    await expect(input).toBeVisible();

    // Can type into it
    await input.fill("test");
    await expect(input).toHaveValue("test");

    // Escape closes the dialog
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Keyboard shortcuts help", () => {
  test("Shift+/ opens the cheat sheet dialog", async ({ page }) => {
    await loginAs(page, DEMO.admin);

    await page.locator("body").click();
    await page.keyboard.press("Shift+Slash");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/keyboard shortcuts/i).first()).toBeVisible();
    await expect(dialog.getByText(/open command palette/i)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
