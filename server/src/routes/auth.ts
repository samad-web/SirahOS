import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  requireAuth,
} from "../middleware/auth";

const router = Router();

// ─── Per-account brute force protection ─────────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginAttempts(email: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(email: string) {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearLoginAttempts(email: string) {
  loginAttempts.delete(email);
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(key);
  }
}, 30 * 60 * 1000);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── HttpOnly refresh-token cookie config ───────────────────────────────────
const REFRESH_COOKIE_NAME = "bf_refresh";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd, // require HTTPS in prod
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: "/api/auth", // restrict scope to auth routes
  };
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      ...(process.env.NODE_ENV !== "production" && { details: parsed.error.flatten() }),
    });
    return;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Per-account brute force check
  if (!checkLoginAttempts(normalizedEmail)) {
    res.status(429).json({ error: "Too many login attempts for this account. Please try again later." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Always run bcrypt.compare even if user not found to prevent timing attacks
  // that could reveal whether an email is registered
  const DUMMY_HASH = "$2a$12$mojcFvATavCITEHjzDqSyO5wOIhIXSg6qLz9Wg0Vx4Q3pCTufB0fC";
  const validPassword = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !validPassword) {
    recordFailedLogin(normalizedEmail);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status === "INACTIVE") {
    res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
    return;
  }

  clearLoginAttempts(normalizedEmail);
  const payload = { sub: user.id, email: user.email, role: user.role, companyId: user.companyId ?? null };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Persist refresh token (7-day expiry)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

  // Set refresh token as HttpOnly cookie (XSS-safe)
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  // Fetch company with feature flags for the login response
  const company = user.companyId
    ? await prisma.company.findUnique({
        where: { id: user.companyId },
        select: {
          id: true, name: true, slug: true,
          featureBilling: true, featureProjects: true,
          featureAttendance: true, featureLeads: true,
        },
      })
    : null;

  res.json({
    accessToken,
    // refreshToken still sent in body for backward compatibility with existing clients.
    // New clients should rely on the HttpOnly cookie and ignore this field.
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      initials: user.initials,
      avatarUrl: user.avatarUrl,
      companyId: user.companyId,
      company,
    },
  });
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  // Prefer HttpOnly cookie; fall back to body for backward compatibility
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const bodyToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const refreshToken = cookieToken ?? bodyToken;

  if (!refreshToken) {
    // Missing refresh credential → 401 "no session", not 400 "bad request".
    // This is the correct semantic AND lets the frontend interceptor treat
    // it as a recoverable session-expired event rather than a client bug.
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.status(401).json({ error: "No active session", code: "NO_SESSION" });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.status(401).json({ error: "Refresh token revoked or expired" });
    return;
  }

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { token: refreshToken } });
  const newRefreshToken = generateRefreshToken({ sub: payload.sub, email: payload.email, role: payload.role, companyId: payload.companyId ?? null });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: payload.sub, expiresAt } });

  const newAccessToken = generateAccessToken({ sub: payload.sub, email: payload.email, role: payload.role, companyId: payload.companyId ?? null });

  // Refresh the HttpOnly cookie as well
  res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, refreshCookieOptions());
  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  // Accept from cookie or body (legacy)
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const bodyToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const refreshToken = cookieToken ?? bodyToken;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
  res.json({ message: "Logged out successfully" });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true, name: true, email: true, role: true, status: true, initials: true, avatarUrl: true, createdAt: true,
      companyId: true,
      company: {
        select: {
          id: true, name: true, slug: true,
          featureBilling: true, featureProjects: true,
          featureAttendance: true, featureLeads: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

export default router;
