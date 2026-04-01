/**
 * Structured logger with environment-based log levels.
 * Replaces raw console.log/warn/error throughout the codebase.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const IS_PROD = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test";
const MIN_LEVEL: LogLevel = IS_TEST ? "error" : IS_PROD ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatMessage(level: LogLevel, tag: string, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
  if (meta !== undefined) {
    return `${base} ${typeof meta === "string" ? meta : JSON.stringify(meta)}`;
  }
  return base;
}

function createLogger(tag: string) {
  return {
    debug(message: string, meta?: unknown) {
      if (shouldLog("debug")) console.debug(formatMessage("debug", tag, message, meta));
    },
    info(message: string, meta?: unknown) {
      if (shouldLog("info")) console.info(formatMessage("info", tag, message, meta));
    },
    warn(message: string, meta?: unknown) {
      if (shouldLog("warn")) console.warn(formatMessage("warn", tag, message, meta));
    },
    error(message: string, meta?: unknown) {
      if (shouldLog("error")) console.error(formatMessage("error", tag, message, meta));
    },
  };
}

export const logger = {
  create: createLogger,
  // Convenience loggers for common modules
  server: createLogger("Server"),
  db: createLogger("Database"),
  auth: createLogger("Auth"),
  audit: createLogger("Audit"),
  scheduler: createLogger("Scheduler"),
  cache: createLogger("Cache"),
};
