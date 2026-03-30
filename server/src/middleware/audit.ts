import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface AuditOptions {
  action: string;
  resourceType: string;
  /** Extract the resource ID from the request — defaults to req.params.id */
  getResourceId?: (req: Request, res: Response) => string | undefined;
  /** Extract extra details to log */
  getDetails?: (req: Request, res: Response) => Record<string, unknown>;
}

/**
 * audit(options)
 * Fire-and-forget middleware that writes an AuditLog row after the handler
 * responds successfully (2xx).
 */
export function audit(opts: AuditOptions) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Intercept res.json to capture the moment of response
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      const result = originalJson(body);

      // Only log on success
      if (res.statusCode >= 200 && res.statusCode < 300 && _req.user) {
        const resourceId =
          opts.getResourceId?.(_req, res) ?? _req.params.id;
        const details = opts.getDetails?.(_req, res);

        prisma.auditLog
          .create({
            data: {
              userId: _req.user.sub,
              action: opts.action,
              resourceType: opts.resourceType,
              resourceId: (resourceId as string) ?? null,
              details: (details as Prisma.InputJsonValue) ?? undefined,
            },
          })
          .catch((err) => console.error("[Audit] Failed to write log:", err));
      }

      return result;
    };

    next();
  };
}
