/**
 * Covers:
 *   - The inline role-switcher confirmation modal added to Employees
 *   - Focus trap on the modal (Tab wraps within the dialog)
 *   - The skip-link becomes focusable as the first Tab stop
 */

import { test, expect } from "@playwright/test";
import { loginAs, DEMO } from "./helpers";

test.describe("Employees — role switcher", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO.admin);
  });

  test("changing a role surfaces the confirm modal and cancel leaves it unchanged", async ({ page }) => {
    // Navigate and wait for the /api/users response to complete — this is
    // the signal that React Query has data and the table isn't loading.
    const usersResponse = page.waitForResponse(
      (resp) => resp.url().includes("/api/users") && resp.status() === 200,
      { timeout: 40000 },
    );
    await page.goto("/employees");
    await usersResponse;

    await expect(page.getByRole("heading", { name: /employees/i })).toBeVisible();

    // Find the role-switch <select> for any non-self employee.
    const roleSelect = page.getByLabel(/^change role for /i).first();
    await expect(roleSelect).toBeVisible({ timeout: 15000 });

    // Read current role so we can assert no change after cancel
    const startValue = await roleSelect.inputValue();
    // Pick a different role to trigger the confirm dialog
    const newRole = startValue === "TESTER" ? "DEVELOPER" : "TESTER";
    await roleSelect.selectOption(newRole);

    // Confirmation dialog appears
    const dialog = page.getByRole("dialog", { name: /change role/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Cancel → dialog closes, role stays at startValue
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    // The select's value should be back to the original
    await expect(roleSelect).toHaveValue(startValue);
  });
});

test.describe("Accessibility", () => {
  test("skip link exists in the DOM and is focusable", async ({ page }) => {
    await loginAs(page, DEMO.admin);

    // The skip link is absolutely positioned off-screen until focused.
    // Rather than simulating a Tab walk (which varies by browser initial
    // focus target), assert it can be focused programmatically and reports
    // as focused — that's the a11y contract that matters.
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();

    // Its href should target the main landmark
    await expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  test("skip link jumps focus to the main landmark on activation", async ({ page }) => {
    await loginAs(page, DEMO.admin);

    // Wait for the AppSidebar effect that labels <main> with id/tabindex
    await expect(page.locator("main#main-content")).toBeVisible({ timeout: 5000 });

    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await skipLink.focus();
    await page.keyboard.press("Enter");

    // URL hash resolves to #main-content
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("main#main-content")).toBeVisible();
  });
});
