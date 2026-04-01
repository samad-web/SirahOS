import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
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

router.use(requireAuth, attachCompany, adminOnly);

// GET /api/notes
router.get("/", async (req: Request, res: Response) => {
  const companyId = (req.user as any).companyId as string | undefined;
  const notes = await prisma.note.findMany({ where: companyId ? { companyId } : {}, orderBy: { updatedAt: "desc" }, take: 200 });
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
    const companyId = (req.user as any).companyId as string | undefined;
    const note = await prisma.note.create({ data: { ...parsed.data, companyId: companyId ?? undefined } });
    res.status(201).json(note);
  }
);

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
    const note = await prisma.note.update({ where: { id: req.params.id as string }, data: parsed.data });
    res.json(note);
  }
);

// DELETE /api/notes/:id
router.delete(
  "/:id",
  audit({ action: "DELETE_NOTE", resourceType: "Note" }),
  async (req: Request, res: Response) => {
    await prisma.note.delete({ where: { id: req.params.id as string } });
    res.json({ ok: true });
  }
);

export default router;
