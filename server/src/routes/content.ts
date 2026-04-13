/**
 * Content Pipeline routes — CRUD for content items (scripts/videos),
 * platform posting tracking, and status transitions that trigger
 * in-app notifications between editors and digital marketers.
 *
 * Access:
 *   - ADMIN / SUPER_ADMIN: full access
 *   - DIGITAL_MARKETER: can create, edit, post, view all company content
 *   - EDITOR: can view assigned content, update status to COMPLETED
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { ContentStatus, ContentPlatform } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { attachCompany } from "../middleware/companyScope";

const router = Router();

// getUserCompanyId returns string | string[] but our usage is always single-string.
const getCompany = (req: Request): string | undefined => {
  const id = getUserCompanyId(req);
  return typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;
};

const contentInclude = {
  editor: { select: { id: true, name: true, initials: true, role: true, avatarUrl: true } },
  marketer: { select: { id: true, name: true, initials: true, role: true, avatarUrl: true } },
  posts: true,
};

const createSchema = z.object({
  title: z.string().min(1),
  script: z.string().optional(),
  description: z.string().optional(),
  editorId: z.string().optional(),
  assignedDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  platforms: z.array(z.nativeEnum(ContentPlatform)).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  script: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  editorId: z.string().nullable().optional(),
  assignedDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

// Roles that can access content pipeline
const contentRoles = requireRole("ADMIN", "DIGITAL_MARKETER", "EDITOR");

router.use(requireAuth, attachCompany, contentRoles);

// ─── GET /api/content — list all content for the company ─────────────────
router.get("/", async (req: Request, res: Response) => {
  const companyId = getCompany(req);
  const { role, sub } = req.user!;
  const where: Record<string, unknown> = {};
  if (companyId) where.companyId = companyId;

  // Editors only see content assigned to them
  if (role === "EDITOR") {
    where.editorId = sub;
  }

  const items = await prisma.content.findMany({
    where,
    include: contentInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json(items);
});

// ─── GET /api/content/:id ────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const item = await prisma.content.findUnique({
    where: { id: req.params.id as string },
    include: contentInclude,
  });
  if (!item) { res.status(404).json({ error: "Content not found" }); return; }
  res.json(item);
});

// ─── POST /api/content — create new content (marketer / admin) ───────────
router.post("/", async (req: Request, res: Response) => {

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { platforms, ...data } = parsed.data;
  const companyId = getCompany(req);

  const { role, sub } = req.user!;
  // Editors auto-assign themselves; marketers can pick an editor.
  const effectiveEditorId = role === "EDITOR" ? sub : (data.editorId || undefined);
  const effectiveMarketerId = role === "DIGITAL_MARKETER" ? sub : undefined;

  const content = await prisma.content.create({
    data: {
      title: data.title,
      script: data.script,
      description: data.description,
      editorId: effectiveEditorId,
      marketerId: effectiveMarketerId,
      assignedDate: data.assignedDate ? new Date(data.assignedDate) : effectiveEditorId ? new Date() : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      status: effectiveEditorId ? "EDITING" : "DRAFT",
      companyId: companyId ?? undefined,
      // Create platform post entries if specified
      posts: platforms && platforms.length > 0
        ? { create: platforms.map((p) => ({ platform: p })) }
        : undefined,
    },
    include: contentInclude,
  });

  // Notify the editor if assigned
  if (data.editorId) {
    await prisma.notification.create({
      data: {
        type: "CONTENT_ASSIGNED",
        title: "New content assigned",
        message: `"${data.title}" has been assigned to you for editing.`,
        userId: data.editorId,
        linkUrl: "/content",
        companyId: companyId ?? undefined,
      },
    });
  }

  res.status(201).json(content);
});

// ─── PATCH /api/content/:id — update content details ─────────────────────
router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.content.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Content not found" }); return; }

  const { assignedDate, dueDate, editorId, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (assignedDate !== undefined) data.assignedDate = assignedDate ? new Date(assignedDate) : null;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (editorId !== undefined) {
    data.editorId = editorId;
    // Auto-set status to EDITING and assignedDate when editor is first assigned
    if (editorId && existing.status === "DRAFT") {
      data.status = "EDITING";
      if (!existing.assignedDate) data.assignedDate = new Date();
    }
  }

  const updated = await prisma.content.update({
    where: { id: req.params.id as string },
    data,
    include: contentInclude,
  });

  res.json(updated);
});

// ─── POST /api/content/:id/complete — editor marks content as completed ──
router.post("/:id/complete", async (req: Request, res: Response) => {
  const content = await prisma.content.findUnique({
    where: { id: req.params.id as string },
    select: { id: true, title: true, status: true, editorId: true, marketerId: true, companyId: true },
  });
  if (!content) { res.status(404).json({ error: "Content not found" }); return; }

  // Only the assigned editor (or admin) can mark complete
  if (req.user!.role === "EDITOR" && content.editorId !== req.user!.sub) {
    res.status(403).json({ error: "Only the assigned editor can complete this" });
    return;
  }

  const updated = await prisma.content.update({
    where: { id: content.id },
    data: { status: "COMPLETED", submittedDate: new Date() },
    include: contentInclude,
  });

  // Notify the digital marketer that editing is done
  if (content.marketerId) {
    await prisma.notification.create({
      data: {
        type: "CONTENT_COMPLETED",
        title: "Video editing completed",
        message: `"${content.title}" has been completed by the editor and is ready for posting.`,
        userId: content.marketerId,
        linkUrl: "/content",
        companyId: content.companyId ?? undefined,
      },
    });
  }

  res.json(updated);
});

// ─── POST /api/content/:id/post — marketer marks a platform post as posted ─
const postSchema = z.object({
  platform: z.nativeEnum(ContentPlatform),
  postUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

router.post("/:id/post", async (req: Request, res: Response) => {
  if (req.user!.role === "EDITOR") {
    res.status(403).json({ error: "Only marketers or admins can mark posts" });
    return;
  }

  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const content = await prisma.content.findUnique({
    where: { id: req.params.id as string },
    include: { posts: true },
  });
  if (!content) { res.status(404).json({ error: "Content not found" }); return; }

  // Upsert the platform post — update if exists, create if not
  const existingPost = content.posts.find((p: { platform: string }) => p.platform === parsed.data.platform);
  if (existingPost) {
    await prisma.contentPost.update({
      where: { id: existingPost.id },
      data: {
        status: "POSTED",
        postUrl: parsed.data.postUrl,
        notes: parsed.data.notes,
        postedAt: new Date(),
      },
    });
  } else {
    await prisma.contentPost.create({
      data: {
        contentId: content.id,
        platform: parsed.data.platform,
        status: "POSTED",
        postUrl: parsed.data.postUrl,
        notes: parsed.data.notes,
        postedAt: new Date(),
      },
    });
  }

  // Check if all platforms are posted — if yes, update content status to POSTED
  const allPosts = await prisma.contentPost.findMany({ where: { contentId: content.id } });
  const allPosted = allPosts.length > 0 && allPosts.every((p) => p.status === "POSTED");
  if (allPosted && content.status !== "POSTED") {
    await prisma.content.update({
      where: { id: content.id },
      data: { status: "POSTED" },
    });
  }

  // Notify the editor that their work was posted
  if (content.editorId) {
    await prisma.notification.create({
      data: {
        type: "CONTENT_POSTED",
        title: "Your video has been posted!",
        message: `"${content.title}" was posted on ${parsed.data.platform}.`,
        userId: content.editorId,
        linkUrl: "/content",
        companyId: content.companyId ?? undefined,
      },
    });
  }

  const updated = await prisma.content.findUnique({
    where: { id: content.id },
    include: contentInclude,
  });
  res.json(updated);
});

// ─── GET /api/notifications — user's notifications ───────────────────────
router.get("/notifications/mine", async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.sub, read: false },
  });
  res.json({ notifications, unreadCount });
});

// ─── POST /api/content/notifications/read-all ────────────────────────────
router.post("/notifications/read-all", async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, read: false },
    data: { read: true },
  });
  res.json({ success: true });
});

// ─── DELETE /api/content/:id ─────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  const item = await prisma.content.findUnique({ where: { id: req.params.id as string }, select: { editorId: true, marketerId: true } });
  if (!item) { res.status(404).json({ error: "Content not found" }); return; }
  // Editors can only delete content they created (assigned to them)
  if (req.user!.role === "EDITOR" && item.editorId !== req.user!.sub) {
    res.status(403).json({ error: "You can only delete content assigned to you" });
    return;
  }
  await prisma.content.delete({ where: { id: req.params.id as string } });
  res.json({ success: true });
});

export default router;
