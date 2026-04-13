/**
 * Auth smoke tests — login, logout, and protected-route redirects.
 *
 * Runs against the live dev server at http://localhost:8080 (set in
 * playwright.config.ts). Expects the seed database with the demo users.
 */

import { test, expect } from "@playwright/test";

const ADMIN = { email: "arjun@sirahos.in", password: "demo123" };

test.describe("Authentication", () => {
  test("login with valid admin credentials lands on dashboard", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    await page.getByPlaceholder("you@company.com").fill(ADMIN.email);
    await page.getByPlaceholder("••••••••").fill(ADMIN.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Admin lands on the dashboard at "/"
    await page.waitForURL(/\/$|\/$/);
    await expect(page).toHaveURL(/\/$/);
  });

  test("login with wrong password shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@company.com").fill(ADMIN.email);
    await page.getByPlaceholder("••••••••").fill("wrong-password-zzz");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Error message should appear (backend returns "Invalid email or password")
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visit to a protected route redirects to /login", async ({ page }) => {
    // Start completely clean — no session state
    await page.goto("/");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout returns the user to /login", async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.getByPlaceholder("you@company.com").fill(ADMIN.email);
    await page.getByPlaceholder("••••••••").fill(ADMIN.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/$/);

    // Click the Sign Out button in the sidebar
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
