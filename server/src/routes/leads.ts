import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, getUserCompanyId } from "../middleware/auth";
import { adminOnly } from "../middleware/rbac";
import { cache, TTL } from "../lib/cache";
import { attachCompany, requireFeature } from "../middleware/companyScope";

const router = Router();

const SUPABASE_URL = process.env.LEADS_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.LEADS_SUPABASE_KEY || "";

const supabaseHeaders: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "count=exact",
};

// ─── Helper: query Supabase REST API ─────────────────────────────────────────

async function supabaseQuery(table: string, params: URLSearchParams): Promise<{ data: Record<string, unknown>[]; count: number }> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const res = await fetch(url, { method: "GET", headers: supabaseHeaders });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>[];
  const range = res.headers.get("content-range");
  const count = range ? parseInt(range.split("/")[1]) || 0 : data.length;
  return { data, count };
}

router.use(requireAuth, attachCompany, requireFeature("leads"), adminOnly);

// ─── GET /api/leads — List leads from Supabase ──────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, attendance_status, business_type, lp_name, page = "1", limit = "20" } = req.query as Record<string, string>;
    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (p - 1) * l;

    const cacheKey = `leads:list:${p}:${l}:${search || ""}:${attendance_status || ""}:${business_type || ""}:${lp_name || ""}`;
    const data = await cache.getOrSet(cacheKey, TTL.LEADS, async () => {
      const params = new URLSearchParams();
      params.set("select", "*");
      params.set("order", "created_at.desc");
      params.set("limit", String(l));
      params.set("offset", String(offset));

      if (attendance_status) params.set("attendance_status", `eq.${attendance_status}`);
      if (business_type) params.set("business_type", `eq.${business_type}`);
      if (lp_name) params.set("lp_name", `eq.${lp_name}`);
      if (search) {
        params.set("or", `(name.ilike.*${search}*,email.ilike.*${search}*,phone.ilike.*${search}*,business_type.ilike.*${search}*)`);
      }

      const { data, count } = await supabaseQuery("leads", params);
      return { items: data, total: count, page: p, limit: l };
    });

    res.json(data);
  } catch {
    res.status(502).json({ error: "Failed to fetch leads from ads database" });
  }
});

// ─── GET /api/leads/stats — Summary counts (cached 2 min) ───────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const data = await cache.getOrSet("leads:stats", TTL.LEADS, async () => {
      const base = new URLSearchParams();
      base.set("select", "id");
      base.set("limit", "0");

      const attended = new URLSearchParams(base);
      attended.set("attendance_status", "eq.attended");
      const noShow = new URLSearchParams(base);
      noShow.set("attendance_status", "eq.no_show");

      const [all, att, ns] = await Promise.all([
        supabaseQuery("leads", new URLSearchParams(base)),
        supabaseQuery("leads", attended),
        supabaseQuery("leads", noShow),
      ]);

      return {
        total: all.count,
        attended: att.count,
        no_show: ns.count,
        pending: all.count - att.count - ns.count,
      };
    });

    res.json(data);
  } catch {
    res.status(502).json({ error: "Failed to fetch stats" });
  }
});

// ─── GET /api/leads/filters — Unique filter values (cached 15 min) ──────────

router.get("/filters", async (_req: Request, res: Response) => {
  try {
    const data = await cache.getOrSet("leads:filters", TTL.LONG, async () => {
      const params = new URLSearchParams();
      params.set("select", "business_type,attendance_status,lp_name");
      params.set("limit", "1000");

      const { data } = await supabaseQuery("leads", params);
      return {
        businessTypes: [...new Set(data.map((d) => d.business_type).filter(Boolean))].sort(),
        attendanceStatuses: [...new Set(data.map((d) => d.attendance_status).filter(Boolean))].sort(),
        lpNames: [...new Set(data.map((d) => d.lp_name).filter(Boolean))].sort(),
      };
    });

    res.json(data);
  } catch {
    res.status(502).json({ error: "Failed to fetch filters" });
  }
});

// ─── GET /api/leads/:id — Single lead ────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = await cache.getOrSet(`leads:detail:${id}`, TTL.LEADS, async () => {
      const params = new URLSearchParams();
      params.set("id", `eq.${id}`);
      params.set("select", "*");

      const url = `${SUPABASE_URL}/rest/v1/leads?${params.toString()}`;
      const r = await fetch(url, { method: "GET", headers: { ...supabaseHeaders, Prefer: "" } });
      if (!r.ok) throw new Error(`Supabase error: ${r.status}`);
      const rows = (await r.json()) as Record<string, unknown>[];
      return rows[0] ?? null;
    });

    if (!data) { res.status(404).json({ error: "Lead not found" }); return; }
    res.json(data);
  } catch {
    res.status(502).json({ error: "Failed to fetch lead" });
  }
});

// ─── GET /api/leads/:id/notes — List notes for a lead ───────────────────────

router.get("/:id/notes", async (req: Request, res: Response) => {
  const companyId = getUserCompanyId(req);
  const notes = await prisma.leadNote.findMany({
    where: { leadId: req.params.id as string, ...(companyId ? { companyId } : {}) },
    include: { author: { select: { id: true, name: true, initials: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(notes);
});

// ─── POST /api/leads/:id/notes — Add note ───────────────────────────────────

const createNoteSchema = z.object({ content: z.string().min(1).max(5000) });

router.post("/:id/notes", async (req: Request, res: Response) => {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const companyId = getUserCompanyId(req);
  const note = await prisma.leadNote.create({
    data: {
      leadId: req.params.id as string,
      content: parsed.data.content,
      authorId: req.user!.sub,
      companyId: companyId ?? undefined,
    },
    include: { author: { select: { id: true, name: true, initials: true } } },
  });
  res.status(201).json(note);
});

// ─── PATCH /api/leads/:id/notes/:noteId — Update note ───────────────────────

router.patch("/:id/notes/:noteId", async (req: Request, res: Response) => {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  // Verify ownership
  const existing = await prisma.leadNote.findUnique({ where: { id: req.params.noteId as string } });
  if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
  const companyId = getUserCompanyId(req);
  if (companyId && existing.companyId !== companyId) { res.status(403).json({ error: "Access denied" }); return; }

  const note = await prisma.leadNote.update({
    where: { id: req.params.noteId as string },
    data: { content: parsed.data.content },
    include: { author: { select: { id: true, name: true, initials: true } } },
  });
  res.json(note);
});

// ─── DELETE /api/leads/:id/notes/:noteId — Delete note ──────────────────────

router.delete("/:id/notes/:noteId", async (req: Request, res: Response) => {
  // Verify ownership
  const existing = await prisma.leadNote.findUnique({ where: { id: req.params.noteId as string } });
  if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
  const companyId = getUserCompanyId(req);
  if (companyId && existing.companyId !== companyId) { res.status(403).json({ error: "Access denied" }); return; }

  await prisma.leadNote.delete({ where: { id: req.params.noteId as string } });
  res.json({ ok: true });
});

export default router;
