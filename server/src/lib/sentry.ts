/**
 * Sentry Node init — kept separate so index.ts stays readable.
 *
 * No-op unless SENTRY_DSN is set in the environment, so local dev and CI
 * never ship phantom events.
 *
 * IMPORTANT: `initSentry()` must be called BEFORE importing any other code
 * that Sentry wants to auto-instrument (express, http, etc.) for tracing
 * to work. In practice, calling it as the first line in index.ts is fine.
 */

import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // silent no-op in dev / CI
  const environment = process.env.NODE_ENV ?? "development";

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    // Drop known noise + scrub sensitive headers before sending.
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        delete h.authorization;
        delete h.cookie;
      }
      // Drop Prisma P2025 (not-found) — these are expected, not bugs.
      const msg = event.exception?.values?.[0]?.value ?? "";
      if (msg.includes("P2025")) return null;
      return event;
    },
  });

  initialized = true;
}

/** Manually capture an exception with optional context. No-op if Sentry is disabled. */
export function reportError(err: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(err, { extra: context });
}

/** Set the current user for subsequent events (call after auth). */
export function setSentryUser(user: { id: string; email?: string; role?: string } | null) {
  if (!initialized) return;
  if (user) Sentry.setUser({ id: user.id, email: user.email, role: user.role });
  else Sentry.setUser(null);
}

export { Sentry };
