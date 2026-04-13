/**
 * Every company gets a hidden "General Tasks" project that acts as a home
 * for standalone task assignments — tasks that don't belong to any real
 * project. This lets admin/PM/lead assign work to users without first
 * creating a project, while keeping the Task schema unchanged (projectId
 * stays required).
 *
 * The project is auto-created on first use (lazy) and cached in-memory
 * for the lifetime of the process. It's marked with visibility=PRIVATE
 * and a special name so the UI can filter it out of normal project lists
 * if desired.
 */

import { prisma } from "./prisma";

export const GENERAL_PROJECT_NAME = "General Tasks";
const GENERAL_PROJECT_CLIENT = "Internal";

// In-memory cache: companyId → projectId
const cache = new Map<string, string>();

/**
 * Get or create the "General Tasks" project for a company.
 * Returns the project ID (string). Safe to call concurrently — the upsert
 * is idempotent and the cache prevents redundant DB hits.
 */
export async function getGeneralProjectId(companyId: string): Promise<string> {
  const cached = cache.get(companyId);
  if (cached) return cached;

  // Look for an existing General Tasks project in this company
  let project = await prisma.project.findFirst({
    where: {
      companyId,
      name: GENERAL_PROJECT_NAME,
      client: GENERAL_PROJECT_CLIENT,
    },
    select: { id: true },
  });

  if (!project) {
    // Create it — visibility PRIVATE so it doesn't clutter project lists
    project = await prisma.project.create({
      data: {
        name: GENERAL_PROJECT_NAME,
        client: GENERAL_PROJECT_CLIENT,
        description: "Auto-created project for standalone task assignments. Do not delete.",
        status: "ACTIVE",
        visibility: "PRIVATE",
        companyId,
      },
      select: { id: true },
    });
  }

  cache.set(companyId, project.id);
  return project.id;
}
