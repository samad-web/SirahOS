// Sentry must initialize BEFORE importing modules it auto-instruments (express, http).
import { initSentry, reportError, Sentry } from "./lib/sentry";
initSentry();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import bugRoutes from "./routes/bugs";
import invoiceRoutes from "./routes/invoices";
import recurringInvoiceRoutes from "./routes/recurringInvoices";
import customerRoutes from "./routes/customers";
import ledgerRoutes from "./routes/ledger";
import reportsRoutes from "./routes/reports";
import attendanceRoutes from "./routes/attendance";
import leavesRoutes from "./routes/leaves";
import expenseRoutes from "./routes/expenses";
import noteRoutes from "./routes/notes";
import todoRoutes from "./routes/todos";
import leadRoutes from "./routes/leads";
import adminRoutes from "./routes/admin";
import fineRoutes from "./routes/fines";
import companyRoutes from "./routes/companies";
import searchRoutes from "./routes/search";
import contentRoutes from "./routes/content";
import { initScheduler, stopScheduler } from "./lib/scheduler";
import { verifyDatabaseConnection, disconnectPrisma } from "./lib/prisma";
import { requestTimeout } from "./middleware/timeout";
import { logger } from "./lib/logger";

// ─── Process-level crash handlers (register FIRST) ──────────────────────────

process.on("uncaughtException", (err) => {
  logger.server.error("Uncaught exception", err);
  reportError(err, { source: "uncaughtException" });
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.server.error("Unhandled rejection", reason);
  reportError(reason, { source: "unhandledRejection" });
});

// ─── Express app setup ──────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = "0.0.0.0";
const startTime = Date.now();

// ─── Trust proxy (required behind Render / cloud load balancers) ────────────
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ─── HTTPS Enforcement (production) ─────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(301, `https://${req.get("host")}${req.url}`);
    }
    next();
  });
}

// ─── Security Middleware (OWASP headers) ────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", ...(process.env.CORS_ORIGIN?.split(",").map(o => o.trim()) ?? [])],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    // Helmet v8 enables these by default, but be explicit:
    xContentTypeOptions: true,       // X-Content-Type-Options: nosniff
    xFrameOptions: { action: "deny" }, // X-Frame-Options: DENY
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);
// CORS: support comma-separated origins for production (e.g. "https://app.sirahos.com,https://sirahos.vercel.app")
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:8080")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 20 : 500,
  message: { error: "Too many login attempts, please try again later." },
});

app.use(limiter);

// ─── Body + Cookie Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Request Timeout ────────────────────────────────────────────────────────
app.use(requestTimeout());

// ─── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── Health Check (with database verification) ──────────────────────────────
app.get("/health", async (_req, res) => {
  const dbOk = await verifyDatabaseConnection();
  const status = dbOk ? "ok" : "degraded";
  const code = dbOk ? 200 : 503;

  res.status(code).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    database: dbOk ? "connected" : "disconnected",
    environment: process.env.NODE_ENV ?? "development",
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/bugs", bugRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/recurring-invoices", recurringInvoiceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leavesRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/fines", fineRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/content", contentRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler (maps known error types) ──────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // Prisma unique constraint violation → 409
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "A record with this data already exists" });
      return;
    }

    // Prisma not found → 404
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    // Prisma validation → 400
    if (err instanceof Prisma.PrismaClientValidationError) {
      res.status(400).json({ error: "Invalid request data" });
      return;
    }

    // JWT errors → 401
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Everything else → 500 with error tracking ID
    const errorId = crypto.randomUUID();
    logger.server.error(`Error ${errorId}: ${err.stack ?? err.message}`);
    // Forward to Sentry with the errorId so support tickets map to events.
    Sentry.withScope((scope) => {
      scope.setTag("errorId", errorId);
      scope.setExtra("url", _req.originalUrl);
      scope.setExtra("method", _req.method);
      reportError(err);
    });

    res.status(500).json({
      error: process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
      errorId,
    });
  }
);

// ─── Start ──────────────────────────────────────────────────────────────────

let server: ReturnType<typeof app.listen>;

async function start() {
  // ─── Startup env validation ───────────────────────────────────────────────
  const requiredEnvVars = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.server.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Verify database on startup
  const dbOk = await verifyDatabaseConnection();
  if (!dbOk) {
    logger.db.error("Cannot connect to database. Server will start but DB operations will fail.");
  } else {
    logger.db.info("Connected");
  }

  server = app.listen(PORT, HOST, () => {
    logger.server.info(`Sirahos API running on http://localhost:${PORT}`);
    logger.server.info(`Environment: ${process.env.NODE_ENV ?? "development"}`);
    initScheduler();
  });

  // Keep-alive timeout (prevent socket hang in production)
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.server.info(`Received ${signal}. Shutting down gracefully...`);

  // Stop accepting new connections
  stopScheduler();

  if (server) {
    server.close(async () => {
      logger.server.info("HTTP server closed");
      await disconnectPrisma();
      logger.server.info("Database disconnected");
      process.exit(0);
    });

    // Hard kill after 15 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.server.error("Forced exit after timeout");
      process.exit(1);
    }, 15_000);
  } else {
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

start();

export default app;
