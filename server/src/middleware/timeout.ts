import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const DEFAULT_TIMEOUT = 30_000; // 30 seconds

export function requestTimeout(ms?: number) {
  const envTimeout = parseInt(process.env.REQUEST_TIMEOUT_MS ?? "", 10);
  const timeout = ms ?? (envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT);

  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.server.warn(`Request timed out: ${req.method} ${req.originalUrl} (${timeout}ms)`);
        res.status(503).json({ error: "Request timed out. Please try again." });
      }
    }, timeout);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  };
}
