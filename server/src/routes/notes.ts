import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { attachCompany } from "../middleware/companyScope";

const router = Router();

const createNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});

// All authenticated users can access their own notes
router.use(requireAuth, attachCompany);

// GET /api/notes — list current user's notes (+ legacy company-wide notes with no owner)
router.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const companyId = getUserCompanyId(req);
  const notes = await prisma.note.findMany({
    where: {
      OR: [
        { userId },
        // Legacy notes created before per-user scoping — visible to everyone in the same company
        { userId: null, companyId: companyId ?? undefined },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  res.json(notes);
});

// POST /api/notes
router.post(
  "/",
  audit({ action: "CREATE_NOTE", resourceType: "Note" }),
  async (req: Request, res: Response) => {
    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const userId = req.user!.sub;
    const companyId = getUserCompanyId(req);
    const note = await prisma.note.create({
      data: { ...parsed.data, userId, companyId: companyId ?? undefined },
    });
    res.status(201).json(note);
  }
);

// Helper: a user can edit a note if they own it, OR if it's a legacy unowned note in their company
function canModifyNote(existing: { userId: string | null; companyId: string | null }, userId: string, companyId: string | undefined): boolean {
  if (existing.userId === userId) return true;
  if (existing.userId === null && existing.companyId === (companyId ?? null)) return true;
  return false;
}

// PATCH /api/notes/:id
router.patch(
  "/:id",
  audit({ action: "UPDATE_NOTE", resourceType: "Note" }),
  async (req: Request, res: Response) => {
    const parsed = updateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const userId = req.user!.sub;
    const companyId = getUserCompanyId(req);
    const existing = await prisma.note.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
    if (!canModifyNote(existing, userId, companyId)) { res.status(403).json({ error: "Access denied" }); return; }

    // Claim ownership if this was a legacy unowned note
    const data = existing.userId === null ? { ...parsed.data, userId } : parsed.data;
    const note = await prisma.note.update({ where: { id: req.params.id as string }, data });
    res.json(note);
  }
);

// DELETE /api/notes/:id
router.delete(
  "/:id",
  audit({ action: "DELETE_NOTE", resourceType: "Note" }),
  async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const companyId = getUserCompanyId(req);
    const existing = await prisma.note.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
    if (!canModifyNote(existing, userId, companyId)) { res.status(403).json({ error: "Access denied" }); return; }

    await prisma.note.delete({ where: { id: req.params.id as string } });
    res.json({ ok: true });
  }
);

export default router;
