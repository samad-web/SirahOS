/**
 * Content Pipeline — unified page for Digital Marketers and Editors.
 *
 * Digital Marketer sees:
 *   - All content with scripts/copy
 *   - Platform posting status (YouTube, Instagram, LinkedIn)
 *   - Ability to create content, assign editors, mark posts as posted
 *   - Notifications when editors complete videos
 *
 * Editor sees:
 *   - Content assigned to them
 *   - Assigned date + due date + submitted date
 *   - Ability to mark content as completed
 *   - Notifications when their content gets posted
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, X, FileText, CheckCircle2, Send, Youtube, Instagram, Linkedin,
  Clock, CalendarIcon, PenLine, Megaphone, Eye, ExternalLink,
} from "lucide-react";
import {
  contentApi, usersApi,
  type Content, type ContentStatus, type ContentPlatform, type AppUser,
} from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_META: Record<ContentStatus, { label: string; cls: string; icon: React.ElementType }> = {
  DRAFT:     { label: "Draft",     cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",               icon: FileText     },
  EDITING:   { label: "Editing",   cls: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",     icon: PenLine      },
  REVIEW:    { label: "Review",    cls: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",     icon: Eye          },
  COMPLETED: { label: "Completed", cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  POSTED:    { label: "Posted",    cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",             icon: Send         },
};

const PLATFORM_META: Record<ContentPlatform, { label: string; icon: React.ElementType; cls: string }> = {
  YOUTUBE:   { label: "YouTube",   icon: Youtube,   cls: "text-red-500" },
  INSTAGRAM: { label: "Instagram", icon: Instagram,  cls: "text-pink-500" },
  LINKEDIN:  { label: "LinkedIn",  icon: Linkedin,   cls: "text-blue-600" },
};

const fmtDate = (iso?: string | null) => iso ? format(new Date(iso), "d MMM yyyy") : "—";

export default function ContentPipeline() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const role = user?.role ?? "EDITOR";
  const isMarketer = role === "DIGITAL_MARKETER" || role === "ADMIN" || role === "SUPER_ADMIN";
  const isEditor = role === "EDITOR";
  const canCreate = isMarketer || isEditor;

  const { data: contentList = [], isLoading } = useQuery({
    queryKey: ["content"],
    queryFn: () => contentApi.list().then(r => r.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-assignable"],
    queryFn: () => usersApi.assignable().then(r => r.data),
    enabled: isMarketer,
  });

  const editors = useMemo(() => users.filter(u => u.role === "EDITOR"), [users]);

  const [showCreate, setShowCreate] = useState(false);
  const [showScript, setShowScript] = useState<Content | null>(null);
  const [showPost, setShowPost] = useState<Content | null>(null);
  const [filter, setFilter] = useState<"all" | ContentStatus>("all");

  // ─── Create form ───
  const [form, setForm] = useState({
    title: "", script: "", description: "", editorId: "",
    dueDate: undefined as Date | undefined,
    platforms: [] as ContentPlatform[],
  });

  const filtered = useMemo(() => {
    if (filter === "all") return contentList;
    return contentList.filter(c => c.status === filter);
  }, [contentList, filter]);

  const stats = useMemo(() => ({
    total: contentList.length,
    editing: contentList.filter(c => c.status === "EDITING").length,
    completed: contentList.filter(c => c.status === "COMPLETED").length,
    posted: contentList.filter(c => c.status === "POSTED").length,
  }), [contentList]);

  // ─── Mutations ───
  const createMut = useMutation({
    mutationFn: () => contentApi.create({
      title: form.title,
      script: form.script || undefined,
      description: form.description || undefined,
      editorId: form.editorId || undefined,
      dueDate: form.dueDate?.toISOString(),
      platforms: form.platforms.length > 0 ? form.platforms : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content"] });
      toast.success("Content created");
      setShowCreate(false);
      setForm({ title: "", script: "", description: "", editorId: "", dueDate: undefined, platforms: [] });
    },
    onError: () => toast.error("Failed to create content"),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => contentApi.complete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content"] }); toast.success("Marked as completed — marketer notified!"); },
    onError: () => toast.error("Failed to complete"),
  });

  // ─── Post modal state ───
  const [postPlatform, setPostPlatform] = useState<ContentPlatform>("YOUTUBE");
  const [postUrl, setPostUrl] = useState("");

  const postMut = useMutation({
    mutationFn: () => {
      if (!showPost) throw new Error("No content selected");
      return contentApi.post(showPost.id, { platform: postPlatform, postUrl: postUrl || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content"] });
      toast.success("Marked as posted — editor notified!");
      setShowPost(null);
      setPostUrl("");
    },
    onError: () => toast.error("Failed to mark as posted"),
  });

  const togglePlatform = (p: ContentPlatform) =>
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search content…" />
        <div className="p-6 space-y-5 max-w-[1400px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Content Pipeline</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isMarketer ? "Manage scripts, assign editors, and track platform posting." : "Your assigned content — edit, complete, and track."}
              </p>
            </div>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm">
                <Plus size={15} aria-hidden /> New Content
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total",     value: stats.total,     icon: FileText,     color: "text-primary" },
              { label: "Editing",   value: stats.editing,   icon: PenLine,      color: "text-indigo-500" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-emerald-500" },
              { label: "Posted",    value: stats.posted,    icon: Send,         color: "text-blue-500" },
            ].map(s => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
                  <s.icon size={15} className={s.color} strokeWidth={1.5} aria-hidden />
                </div>
                <span className="text-xl font-bold font-mono tabular-nums">{s.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {(["all", "DRAFT", "EDITING", "COMPLETED", "POSTED"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${filter === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "All" : STATUS_META[f].label}
              </button>
            ))}
          </div>

          {/* Content list */}
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="surface-elevated p-5 animate-pulse space-y-3">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-3 w-96 bg-muted rounded" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="surface-elevated py-16 text-center">
                <Megaphone size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} aria-hidden />
                <p className="text-sm font-medium text-muted-foreground">No content found</p>
                {canCreate && <button onClick={() => setShowCreate(true)} className="text-xs text-primary font-semibold hover:underline mt-2">+ Create Content</button>}
              </div>
            ) : filtered.map((item, i) => {
              const meta = STATUS_META[item.status];
              const StatusIcon = meta.icon;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="surface-elevated p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                      <StatusIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Title + status */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
                      </div>

                      {/* Description */}
                      {item.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.description}</p>}

                      {/* Date row — for editors */}
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground mb-3">
                        <span className="flex items-center gap-1"><CalendarIcon size={10} aria-hidden /> Assigned: {fmtDate(item.assignedDate)}</span>
                        {item.dueDate && <span className="flex items-center gap-1"><Clock size={10} aria-hidden /> Due: {fmtDate(item.dueDate)}</span>}
                        {item.submittedDate && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={10} aria-hidden /> Submitted: {fmtDate(item.submittedDate)}</span>}
                        {item.editor && (
                          <span className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full gradient-primary flex items-center justify-center">
                              <span className="text-[7px] font-bold text-white">{item.editor.initials}</span>
                            </div>
                            Editor: {item.editor.name}
                          </span>
                        )}
                      </div>

                      {/* Platform posting status */}
                      <div className="flex items-center gap-2 mb-3">
                        {(["YOUTUBE", "INSTAGRAM", "LINKEDIN"] as ContentPlatform[]).map(platform => {
                          const pMeta = PLATFORM_META[platform];
                          const PIcon = pMeta.icon;
                          const post = item.posts.find(p => p.platform === platform);
                          const isPosted = post?.status === "POSTED";
                          return (
                            <div key={platform}
                              className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border ${
                                isPosted
                                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                                  : post ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" : "border-border bg-muted/30"
                              }`}>
                              <PIcon size={12} className={pMeta.cls} />
                              <span className="font-medium">{isPosted ? "Posted" : post ? "Pending" : "—"}</span>
                              {isPosted && post?.postUrl && (
                                <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* View script button */}
                        {item.script && (
                          <button onClick={() => setShowScript(item)} className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 font-medium transition-colors">
                            View Script
                          </button>
                        )}
                        {/* Editor: mark complete */}
                        {role === "EDITOR" && (item.status === "EDITING" || item.status === "REVIEW") && item.editorId === user?.id && (
                          <button onClick={() => completeMut.mutate(item.id)} disabled={completeMut.isPending}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 font-medium transition-colors">
                            Mark Completed
                          </button>
                        )}
                        {/* Marketer: mark as posted on a platform */}
                        {isMarketer && (item.status === "COMPLETED" || item.status === "EDITING") && (
                          <button onClick={() => { setShowPost(item); setPostPlatform("YOUTUBE"); setPostUrl(""); }}
                            className="text-[11px] px-2.5 py-1 rounded-lg gradient-primary text-white font-medium hover:opacity-90 transition-opacity">
                            Mark as Posted
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ─── Create Content Modal ─── */}
      {showCreate && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">New Content</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close"><X size={16} aria-hidden /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="c-title" className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Title</label>
                <input id="c-title" autoFocus className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="Video title or content name" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="c-script" className="text-xs font-medium text-muted-foreground block mb-1.5">Script / Content Copy</label>
                <textarea id="c-script" rows={5} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none font-mono"
                  placeholder="Full script, talking points, captions…" value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="c-desc" className="text-xs font-medium text-muted-foreground block mb-1.5">Description</label>
                <textarea id="c-desc" rows={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                  placeholder="Brief context about this content…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className={`grid ${isEditor ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
                {/* Assign Editor — only shown to marketers/admins. Editors auto-assign themselves. */}
                {!isEditor && (
                <div>
                  <label htmlFor="c-editor" className="text-xs font-medium text-muted-foreground block mb-1.5">Assign Editor</label>
                  <select id="c-editor" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.editorId} onChange={e => setForm(f => ({ ...f, editorId: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {editors.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Due Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className={`w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 flex items-center gap-2 text-left ${form.dueDate ? "text-foreground" : "text-muted-foreground/60"}`}>
                        <CalendarIcon size={13} aria-hidden />
                        <span>{form.dueDate ? format(form.dueDate, "d MMM yyyy") : "Pick date"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.dueDate} onSelect={d => setForm(f => ({ ...f, dueDate: d ?? undefined }))}
                        disabled={d => d < new Date(new Date().setHours(0,0,0,0))} initialFocus className="rounded-xl border-0" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {/* Platform checkboxes */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Target Platforms</label>
                <div className="flex items-center gap-2">
                  {(["YOUTUBE", "INSTAGRAM", "LINKEDIN"] as ContentPlatform[]).map(p => {
                    const pMeta = PLATFORM_META[p];
                    const PIcon = pMeta.icon;
                    const selected = form.platforms.includes(p);
                    return (
                      <button key={p} type="button" onClick={() => togglePlatform(p)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                          selected ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        }`}>
                        <PIcon size={14} className={selected ? pMeta.cls : ""} />
                        {pMeta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.title.trim()}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                {createMut.isPending ? "Creating…" : "Create Content"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Script Viewer Modal ─── */}
      {showScript && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">{showScript.title} — Script</h3>
              <button onClick={() => setShowScript(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close"><X size={16} aria-hidden /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-muted rounded-xl p-4">{showScript.script}</pre>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Mark as Posted Modal ─── */}
      {showPost && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">Mark as Posted</h3>
              <button onClick={() => setShowPost(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close"><X size={16} aria-hidden /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Mark <strong className="text-foreground">{showPost.title}</strong> as posted on a platform.</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Platform</label>
                <div className="flex items-center gap-2">
                  {(["YOUTUBE", "INSTAGRAM", "LINKEDIN"] as ContentPlatform[]).map(p => {
                    const pMeta = PLATFORM_META[p];
                    const PIcon = pMeta.icon;
                    const alreadyPosted = showPost.posts.find(pp => pp.platform === p)?.status === "POSTED";
                    return (
                      <button key={p} type="button" disabled={alreadyPosted} onClick={() => setPostPlatform(p)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                          alreadyPosted ? "opacity-40 cursor-default border-border" :
                          postPlatform === p ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        }`}>
                        <PIcon size={14} className={postPlatform === p ? pMeta.cls : ""} />
                        {pMeta.label}
                        {alreadyPosted && <CheckCircle2 size={10} className="text-emerald-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="post-url" className="text-xs font-medium text-muted-foreground block mb-1.5">Post URL (optional)</label>
                <input id="post-url" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="https://youtube.com/watch?v=..." value={postUrl} onChange={e => setPostUrl(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowPost(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => postMut.mutate()} disabled={postMut.isPending}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                {postMut.isPending ? "Posting…" : "Mark as Posted"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
