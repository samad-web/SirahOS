import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface AssignmentResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether the assigner (current user) is permitted to assign a task
 * to the target user, based on the hierarchical role structure:
 *
 *   Admin → can assign to anyone (except self)
 *   PM    → can assign to Leads + Members within the same project
 *   Lead  → can assign to Members within the same project they lead
 *   Dev/Tester → cannot assign tasks
 */
export async function canAssign(
  assignerId: string,
  assignerRole: Role,
  targetUserId: string,
  projectId: string
): Promise<AssignmentResult> {
  // Members cannot assign tasks
  if (assignerRole === "DEVELOPER" || assignerRole === "TESTER") {
    return { allowed: false, reason: "Your role does not permit task assignment" };
  }

  // Cannot assign to self
  if (assignerId === targetUserId) {
    return { allowed: false, reason: "Cannot assign a task to yourself" };
  }

  // Fetch target user
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, status: true },
  });

  if (!target) {
    return { allowed: false, reason: "Target user not found" };
  }

  if (target.status !== "ACTIVE") {
    return { allowed: false, reason: "Cannot assign to an inactive user" };
  }

  // Admin can assign to anyone
  if (assignerRole === "ADMIN") {
    return { allowed: true };
  }

  // Cannot assign to Admin
  if (target.role === "ADMIN") {
    return { allowed: false, reason: "Cannot assign tasks to an Admin" };
  }

  // Fetch the project to check relationships
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      pmId: true,
      leadId: true,
      members: { select: { userId: true } },
    },
  });

  if (!project) {
    return { allowed: false, reason: "Project not found" };
  }

  const projectMemberIds = project.members.map((m) => m.userId);
  const isTargetInProject =
    projectMemberIds.includes(targetUserId) ||
    project.pmId === targetUserId ||
    project.leadId === targetUserId;

  // PM: can assign to Leads and Members within their project
  if (assignerRole === "PROJECT_MANAGER") {
    if (project.pmId !== assignerId) {
      return { allowed: false, reason: "You can only assign tasks in projects you manage" };
    }
    if (target.role === "PROJECT_MANAGER") {
      return { allowed: false, reason: "Cannot assign tasks to another Project Manager" };
    }
    if (!isTargetInProject) {
      return { allowed: false, reason: "User is not a member of this project" };
    }
    return { allowed: true };
  }

  // Lead: can assign to Members (DEV/TESTER) in the project they lead
  if (assignerRole === "LEAD") {
    if (project.leadId !== assignerId) {
      return { allowed: false, reason: "You can only assign tasks in projects you lead" };
    }
    if (target.role !== "DEVELOPER" && target.role !== "TESTER") {
      return { allowed: false, reason: "Leads can only assign tasks to Developers and Testers" };
    }
    if (!isTargetInProject) {
      return { allowed: false, reason: "User is not a member of this project" };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "Unknown role" };
}

/**
 * Returns the list of users the given user is allowed to assign tasks to
 * within a specific project.
 */
export async function getAssignableUsers(
  userId: string,
  role: Role,
  projectId: string
) {
  const userSelect = { id: true, name: true, initials: true, role: true, status: true };

  // Members cannot assign
  if (role === "DEVELOPER" || role === "TESTER") {
    return [];
  }

  // Admin: all active project members except self
  if (role === "ADMIN") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        pmId: true,
        leadId: true,
        pm: { select: userSelect },
        lead: { select: userSelect },
        members: { select: { user: { select: userSelect } } },
      },
    });
    if (!project) return [];

    const allUsers: typeof project.pm[] = [];
    if (project.pm && project.pm.id !== userId) allUsers.push(project.pm);
    if (project.lead && project.lead.id !== userId && project.lead.id !== project.pmId) allUsers.push(project.lead);
    for (const m of project.members) {
      if (m.user.id !== userId && m.user.id !== project.pmId && m.user.id !== project.leadId) {
        allUsers.push(m.user);
      }
    }
    return allUsers.filter((u) => u && u.status === "ACTIVE");
  }

  // PM: leads + members in their project
  if (role === "PROJECT_MANAGER") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        pmId: true,
        lead: { select: userSelect },
        members: { select: { user: { select: userSelect } } },
      },
    });
    if (!project || project.pmId !== userId) return [];

    const users: typeof project.lead[] = [];
    if (project.lead && project.lead.id !== userId) users.push(project.lead);
    for (const m of project.members) {
      if (m.user.id !== userId && m.user.id !== project.lead?.id) {
        users.push(m.user);
      }
    }
    return users.filter((u) => u && u.status === "ACTIVE");
  }

  // Lead: only DEVELOPER/TESTER members in their project
  if (role === "LEAD") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        leadId: true,
        members: { select: { user: { select: userSelect } } },
      },
    });
    if (!project || project.leadId !== userId) return [];

    return project.members
      .map((m) => m.user)
      .filter((u) => u.id !== userId && (u.role === "DEVELOPER" || u.role === "TESTER") && u.status === "ACTIVE");
  }

  return [];
}
