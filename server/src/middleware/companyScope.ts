import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { Company } from "@prisma/client";
import { getUserCompanyId } from "./auth";

// Extend Express Request to carry company
declare global {
  namespace Express {
    interface Request {
      company?: Company;
    }
  }
}

const featureMap = {
  billing: "featureBilling" as const,
  projects: "featureProjects" as const,
  attendance: "featureAttendance" as const,
  leads: "featureLeads" as const,
};

export type FeatureFlag = keyof typeof featureMap;

/**
 * Extracts companyId from JWT, validates that the company is ACTIVE,
 * and attaches the full company object to req.company.
 * SUPER_ADMIN bypasses this entirely.
 */
export function attachCompany(req: Request, res: Response, next: NextFunction): void {
  const { role } = req.user!;

  if (role === "SUPER_ADMIN") {
    next();
    return;
  }

  const companyId = getUserCompanyId(req);

  if (!companyId) {
    res.status(403).json({ error: "No company assigned to this user" });
    return;
  }

  prisma.company
    .findUnique({ where: { id: companyId } })
    .then((company) => {
      if (!company || company.status === "SUSPENDED") {
        res.status(403).json({ error: "Company is suspended or not found" });
        return;
      }
      req.company = company;
      next();
    })
    .catch(next);
}

/**
 * Feature guard factory — wrap routes that belong to a specific module.
 * Must be used AFTER attachCompany.
 */
export function requireFeature(flag: FeatureFlag) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user!.role === "SUPER_ADMIN") {
      next();
      return;
    }

    const featureField = featureMap[flag];
    if (!req.company || !req.company[featureField]) {
      res.status(403).json({ error: `Module '${flag}' is not enabled for your company` });
      return;
    }

    next();
  };
}

/**
 * Verifies that a resource belongs to the requesting user's company.
 * Use for GET/:id, PATCH/:id, DELETE/:id routes on company-scoped resources.
 * Must be used AFTER attachCompany.
 */
export function requireCompanyMatch(resourceCompanyId: string | null | undefined, req: Request): boolean {
  if (req.user!.role === "SUPER_ADMIN") return true;
  const userCompanyId = getUserCompanyId(req);
  if (!userCompanyId) return false;
  return resourceCompanyId === userCompanyId;
}
