/**
 * Shared Playwright helpers.
 */

import { Page, expect } from "@playwright/test";


export const DEMO = {
  admin:   { email: "arjun@sirahos.in",  password: "demo123" },
  pm:      { email: "priya@sirahos.in",  password: "demo123" },
  lead:    { email: "rahul@sirahos.in",  password: "demo123" },
  dev:     { email: "sneha@sirahos.in",  password: "demo123" },
  tester:  { email: "vikram@sirahos.in", password: "demo123" },
  editor:  { email: "meera@sirahos.in",  password: "demo123" },
  marketer:{ email: "kabir@sirahos.in",  password: "demo123" },
};

/**
 * Log in through the UI and wait for the session to fully settle.
 *
 * Waiting for just the URL to leave /login is not enough — the post-login
 * React state (AuthContext.user + allUsers fetch + ProjectContext initial
 * queries) takes another ~200-800ms to resolve. Global keyboard handlers
 * like the CommandBar's Cmd+K are only attached *after* the CommandBar
 * mounts, which only happens after `user` is truthy. So we wait for the
 * sidebar's "Sign Out" button to appear — that's a reliable signal that
 * AuthProvider has finished hydrating the user.
 */
export async function loginAs(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  // Post-navigation hydration check: Sign Out button only exists when user is loaded.
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 10000 });
}

/** Unique suffix for test-created entities so parallel runs don't collide. */
export function stamp(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
