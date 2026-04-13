/**
 * Single source of truth for role capabilities and route access.
 *
 * Previously the app had three parallel lists (ROUTE_ACCESS in AuthContext,
 * PERMISSIONS matrix in Profile.tsx, and ad-hoc role checks in view files).
 * They drifted. This module consolidates them so adding or renaming a role
 * only requires updates in one place.
 *
 * The backend has its own RBAC in server/src/middleware/rbac.ts — these two
 * must stay in sync, but TypeScript can't enforce cross-project constraints,
 * so they're manually mirrored.
 */

import type { UserRole } from "./api";

// ─── Role groupings ─────────────────────────────────────────────────────────
// Semantic buckets to express "who can do X" without enumerating every role.

/** Roles with full company-wide admin access. */
export const ADMIN_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN"];

/** Roles that manage projects/teams (admins plus PMs). */
export const MANAGEMENT_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "PROJECT_MANAGER",
];

/** Roles that lead a team (management plus team leads). */
export const TEAM_LEADER_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "PROJECT_MANAGER",
  "LEAD",
];

/** Rank-and-file roles — contribute work but don't assign tasks. */
export const MEMBER_ROLES: readonly UserRole[] = [
  "DEVELOPER",
  "TESTER",
  "EDITOR",
  "DIGITAL_MARKETER",
];

/** Every role in the system. */
export const ALL_ROLES: readonly UserRole[] = [
  ...TEAM_LEADER_ROLES,
  ...MEMBER_ROLES,
];

// ─── Capability checks ─────────────────────────────────────────────────────

export const can = {
  manageUsers:        (r: UserRole) => ADMIN_ROLES.includes(r),
  viewBilling:        (r: UserRole) => ADMIN_ROLES.includes(r),
  manageLeads:        (r: UserRole) => ADMIN_ROLES.includes(r),
  manageProjects:     (r: UserRole) => MANAGEMENT_ROLES.includes(r),
  accessSettings:     (r: UserRole) => MANAGEMENT_ROLES.includes(r),
  assignTasks:        (r: UserRole) => TEAM_LEADER_ROLES.includes(r),
  reviewLeaves:       (r: UserRole) => TEAM_LEADER_ROLES.includes(r),
  reportBugs:         (r: UserRole) => TEAM_LEADER_ROLES.includes(r) || r === "DEVELOPER" || r === "TESTER",
  viewOwnTasks:       (r: UserRole) => ALL_ROLES.includes(r),
  markOwnAttendance:  (r: UserRole) => ALL_ROLES.includes(r),
  isMemberRole:       (r: UserRole) => MEMBER_ROLES.includes(r),
};

// ─── Route access map ───────────────────────────────────────────────────────
// Which roles can navigate to which URL. AppSidebar and ProtectedRoute both
// read from this map.

export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  "/":                    ["SUPER_ADMIN", "ADMIN"],
  "/employees":           ["SUPER_ADMIN", "ADMIN"],
  "/projects":            [...ALL_ROLES],
  "/tasks":               [...TEAM_LEADER_ROLES],
  "/attendance":          [...ALL_ROLES],
  "/invoices":            ["SUPER_ADMIN", "ADMIN"],
  "/recurring-invoices":  ["SUPER_ADMIN", "ADMIN"],
  "/customers":           ["SUPER_ADMIN", "ADMIN"],
  "/expenses":            ["SUPER_ADMIN", "ADMIN"],
  "/ledger":              ["SUPER_ADMIN", "ADMIN"],
  "/content":             ["SUPER_ADMIN", "ADMIN", "DIGITAL_MARKETER", "EDITOR"],
  "/notes":               [...ALL_ROLES],
  "/leads":               ["SUPER_ADMIN", "ADMIN"],
  "/settings":            [...MANAGEMENT_ROLES],
  "/profile":             [...ALL_ROLES],
  "/companies":           ["SUPER_ADMIN"],
};

// ─── Permissions matrix (for Profile page display) ─────────────────────────
// Structured so Profile.tsx can render "what this role can do" without
// duplicating the role lists.

export interface PermissionRow {
  name: string;
  roles: readonly UserRole[];
}

export interface PermissionGroup {
  label: string;
  permissions: PermissionRow[];
}

export const PERMISSIONS: PermissionGroup[] = [
  {
    label: "Dashboard & Reports",
    permissions: [
      { name: "View dashboard & analytics", roles: ADMIN_ROLES },
      { name: "View revenue reports",       roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Projects & Tasks",
    permissions: [
      { name: "Create projects",        roles: ADMIN_ROLES },
      { name: "Manage project teams",   roles: TEAM_LEADER_ROLES },
      { name: "Create & assign tasks",  roles: TEAM_LEADER_ROLES },
      { name: "View assigned tasks",    roles: ALL_ROLES },
      { name: "Report bugs",            roles: [...TEAM_LEADER_ROLES, "DEVELOPER", "TESTER"] },
    ],
  },
  {
    label: "Billing & Finance",
    permissions: [
      { name: "Manage customers",       roles: ADMIN_ROLES },
      { name: "Create & edit invoices", roles: ADMIN_ROLES },
      { name: "View ledger",            roles: ADMIN_ROLES },
      { name: "Manage expenses",        roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Administration",
    permissions: [
      { name: "Manage users",     roles: ADMIN_ROLES },
      { name: "Access settings",  roles: MANAGEMENT_ROLES },
      { name: "Purge data",       roles: ADMIN_ROLES },
      { name: "View leads",       roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Attendance & Leaves",
    permissions: [
      { name: "Mark own attendance",    roles: ALL_ROLES },
      { name: "View team attendance",   roles: TEAM_LEADER_ROLES },
      { name: "Approve leave requests", roles: TEAM_LEADER_ROLES },
    ],
  },
];
