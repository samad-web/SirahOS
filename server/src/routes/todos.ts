import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { attachCompany } from "../middleware/companyScope";

const router = Router();

const createTodoSchema = z.object({
  title: z.string().min(1),
  goalType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
});

const updateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  goalType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
});

// All authenticated users can access their own todos
router.use(requireAuth, attachCompany);

// GET /api/todos — list current user's todos
router.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const todos = await prisma.todo.findMany({
    where: { userId },
    orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
  res.json(todos);
});

// POST /api/todos — create a new todo
router.post("/", async (req: Request, res: Response) => {
  const parsed = createTodoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.sub;
  const companyId = getUserCompanyId(req);
  const todo = await prisma.todo.create({
    data: { ...parsed.data, userId, companyId: companyId ?? undefined },
  });
  res.status(201).json(todo);
});

// PATCH /api/todos/:id — update a todo
router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateTodoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.sub;
  const existing = await prisma.todo.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Todo not found" }); return; }
  if (existing.userId !== userId) { res.status(403).json({ error: "Access denied" }); return; }

  const todo = await prisma.todo.update({ where: { id: req.params.id as string }, data: parsed.data });
  res.json(todo);
});

// PATCH /api/todos/:id/toggle — quick toggle completed
router.patch("/:id/toggle", async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const existing = await prisma.todo.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Todo not found" }); return; }
  if (existing.userId !== userId) { res.status(403).json({ error: "Access denied" }); return; }

  const todo = await prisma.todo.update({
    where: { id: req.params.id as string },
    data: { completed: !existing.completed },
  });
  res.json(todo);
});

// DELETE /api/todos/:id — delete a todo
router.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const existing = await prisma.todo.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: "Todo not found" }); return; }
  if (existing.userId !== userId) { res.status(403).json({ error: "Access denied" }); return; }

  await prisma.todo.delete({ where: { id: req.params.id as string } });
  res.json({ ok: true });
});

// DELETE /api/todos/completed/clear — clear all completed todos for current user
router.delete("/completed/clear", async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  await prisma.todo.deleteMany({ where: { userId, completed: true } });
  res.json({ ok: true });
});

export default router;
