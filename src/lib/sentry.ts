/**
 * Sentry client init — kept in its own module so that:
 *   1. main.tsx stays small
 *   2. Unit tests can mock or skip it
 *   3. The init function is a no-op unless VITE_SENTRY_DSN is set, so local dev
 *      and CI don't ship phantom events.
 *
 * Read more: https://docs.sentry.io/platforms/javascript/guides/react/
 */

import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // silent no-op in dev / CI
  const environment = import.meta.env.MODE ?? "development";

  Sentry.init({
    dsn,
    environment,
    // Performance: sample 10% of transactions in prod, 100% elsewhere
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    // Session replay: 0% normal, 100% on error. Cheap insurance.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Filter noise
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "NetworkError",
    ],
    beforeSend(event, hint) {
      // Scrub sensitive fields from breadcrumbs just in case
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, unknown>).authorization;
        delete (event.request.headers as Record<string, unknown>).cookie;
      }
      // In dev, also log to console for convenience
      if (environment !== "production") {
        // eslint-disable-next-line no-console
        console.error("[Sentry]", hint?.originalException ?? event);
      }
      return event;
    },
  });

  initialized = true;
}

/** Manually report an error with optional context. */
export function reportError(err: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    // eslint-disable-next-line no-console
    console.error("[reportError]", err, context);
    return;
  }
  Sentry.captureException(err, { extra: context });
}

/** Attach the current user to all subsequent events. */
export function setSentryUser(user: { id: string; email?: string; role?: string } | null) {
  if (!initialized) return;
  if (user) Sentry.setUser({ id: user.id, email: user.email, role: user.role });
  else Sentry.setUser(null);
}
