import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

/**
 * requireRole(...roles)
 * Usage: router.get("/admin-only", requireAuth, requireRole("ADMIN"), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Required role: ${roles.join(" or ")}. Your role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

// Convenience helpers
export const adminOnly = requireRole(Role.ADMIN);
export const adminOrPM = requireRole(Role.ADMIN, Role.PROJECT_MANAGER);
export const adminOrPMOrLead = requireRole(Role.ADMIN, Role.PROJECT_MANAGER, Role.LEAD);
export const allProjectRoles = requireRole(
  Role.ADMIN,
  Role.PROJECT_MANAGER,
  Role.LEAD,
  Role.DEVELOPER,
  Role.TESTER
);
