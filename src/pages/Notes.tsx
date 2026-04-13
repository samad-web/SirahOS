import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, StickyNote, Trash2, Save, Check, Search,
  Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered,
  X, Target, Calendar, CalendarRange, CalendarDays, Circle, CheckCircle2,
} from "lucide-react";
import { notesApi, todosApi, Note, Todo, GoalType } from "@/lib/api";
import { toast } from "sonner";
import DOMPurify from "dompurify";

// ─── Auto-correction utilities ──────────────────────────────────────────────

const CORRECTIONS: Record<string, string> = {
  "teh": "the", "dont": "don't", "cant": "can't", "wont": "won't",
  "im": "I'm", "ive": "I've", "youre": "you're", "theyre": "they're",
  "its": "it's", "thats": "that's", "whats": "what's",
  "didnt": "didn't", "doesnt": "doesn't", "isnt": "isn't",
  "wasnt": "wasn't", "werent": "weren't", "havent": "haven't",
  "hasnt": "hasn't", "wouldnt": "wouldn't", "couldnt": "couldn't",
  "shouldnt": "shouldn't", "arent": "aren't",
  "recieve": "receive", "seperate": "separate", "occured": "occurred",
  "untill": "until", "wich": "which", "becuase": "because",
};

function autoCorrect(text: string): string {
  let result = text;
  result = result.replace(/ {2,}/g, " ");
  result = result.replace(/([.!?,;:])([A-Za-z])/g, "$1 $2");
  result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
  result = result.replace(/\b(\w+)\b/g, (word) => {
    const lower = word.toLowerCase();
    if (CORRECTIONS[lower]) {
      const corrected = CORRECTIONS[lower];
      return word[0] === word[0].toUpperCase()
        ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
        : corrected;
    }
    return word;
  });
  return result;
}

// ─── Goal type config ───────────────────────────────────────────────────────

const GOAL_CONFIG: Record<GoalType, { label: string; icon: React.ElementType; cls: string; bgCls: string }> = {
  DAILY:   { label: "Daily",   icon: Calendar,      cls: "text-blue-600 dark:text-blue-400",   bgCls: "bg-blue-50 dark:bg-blue-900/30" },
  WEEKLY:  { label: "Weekly",  icon: CalendarRange,  cls: "text-violet-600 dark:text-violet-400", bgCls: "bg-violet-50 dark:bg-violet-900/30" },
  MONTHLY: { label: "Monthly", icon: CalendarDays,   cls: "text-amber-600 dark:text-amber-400",  bgCls: "bg-amber-50 dark:bg-amber-900/30" },
};

type PageTab = "notes" | "goals";

// ─── Component ──────────────────────────────────────────────────────────────

export default function Notes() {
  const qc = useQueryClient();
  const [pageTab, setPageTabState] = useState<PageTab>("notes");

  // ─── Notes state ──────────────────────────────────────────────────────────
  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ["notes"],
    queryFn: () => notesApi.list().then(r => r.data),
  });

  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle]       = useState("");
  const [saved, setSaved]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Refs that always hold the latest selected/title — used by flushPendingSave
  // to avoid stale-closure bugs when the user switches notes/tabs while a save is queued.
  const selectedRef = useRef<string | null>(null);
  const titleRef    = useRef<string>("");
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { titleRef.current = title; }, [title]);

  // Cleanup pending save timer on unmount
  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }, []);

  const currentNote = notes.find(n => n.id === selected);

  const saveMut = useMutation({
    mutationFn: (vars: { id: string; title: string; content: string }) =>
      notesApi.update(vars.id, { title: vars.title, content: vars.content }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["notes"] });
      const previous = qc.getQueryData<Note[]>(["notes"]);
      qc.setQueryData<Note[]>(["notes"], old =>
        (old ?? []).map(n => n.id === vars.id ? { ...n, title: vars.title, content: vars.content, updatedAt: new Date().toISOString() } : n)
      );
      return { previous };
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
    onError: (_err, _vars, context) => { if (context?.previous) qc.setQueryData(["notes"], context.previous); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["notes"] }); },
  });

  // Flush any pending save IMMEDIATELY for the currently-selected note,
  // using the latest title/content from refs (not closure). Call this before
  // changing `selected` or unmounting the editor (e.g. switching to Goals tab).
  const flushPendingSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
    const id = selectedRef.current;
    if (!id || !editorRef.current) return;
    const rawContent = DOMPurify.sanitize(editorRef.current.innerHTML);
    const noteInCache = qc.getQueryData<Note[]>(["notes"])?.find(n => n.id === id);
    // Only fire if something actually changed — avoid spurious writes
    if (!noteInCache || noteInCache.title !== titleRef.current || noteInCache.content !== rawContent) {
      saveMut.mutate({ id, title: titleRef.current, content: rawContent });
    }
  };

  const handleSave = () => {
    if (!selected || !editorRef.current) return;
    const rawContent = DOMPurify.sanitize(editorRef.current.innerHTML);
    saveMut.mutate({ id: selected, title, content: rawContent });
  };

  const selectNote = (note: Note) => {
    flushPendingSave(); // persist any unsaved edits to the OUTGOING note first
    setSelected(note.id);
    setTitle(note.title);
    setSaved(false);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = DOMPurify.sanitize(note.content);
    }, 0);
  };

  const createMut = useMutation({
    mutationFn: (data: { title: string; content?: string }) => notesApi.create(data),
    onSuccess: (res) => {
      qc.setQueryData<Note[]>(["notes"], old => [res.data, ...(old ?? [])]);
      selectNote(res.data);
    },
    onError: () => { toast.error("Failed to create note"); },
  });

  const handleNew = () => { createMut.mutate({ title: "Untitled Note", content: "" }); };

  // Tab switch — flush any pending save BEFORE the editor unmounts
  const setPageTab = (tab: PageTab) => {
    if (tab !== pageTab) flushPendingSave();
    setPageTabState(tab);
  };

  // Title input — save with a short debounce so the user doesn't have to blur first
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => handleSave(), 1500);
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notes"] });
      const previous = qc.getQueryData<Note[]>(["notes"]);
      qc.setQueryData<Note[]>(["notes"], old => (old ?? []).filter(n => n.id !== id));
      if (selected === id) { setSelected(null); setTitle(""); }
      return { previous };
    },
    onSuccess: () => { toast.success("Note deleted"); },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(["notes"], context.previous);
      toast.error("Failed to delete note");
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["notes"] }); setDeleteTarget(null); },
  });

  const confirmDelete = () => { if (deleteTarget) deleteMut.mutate(deleteTarget); };

  const handleEditorBlur = () => {
    if (!editorRef.current) return;
    const el = editorRef.current;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const corrected = autoCorrect(node.textContent ?? "");
      if (corrected !== node.textContent) node.textContent = corrected;
    }
  };

  const handleEditorInput = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => handleSave(), 3000);
  };

  const exec = (cmd: string, value?: string) => { document.execCommand(cmd, false, value); editorRef.current?.focus(); };

  const toggleHeading = (tag: string) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const parent = sel.anchorNode?.parentElement;
      if (parent?.tagName.toLowerCase() === tag.toLowerCase()) exec("formatBlock", "p");
      else exec("formatBlock", tag);
    }
  };

  const filteredNotes = notes.filter(n => {
    const q = search.toLowerCase();
    return !q || n.title.toLowerCase().includes(q);
  });

  const toolbar: { icon: React.ElementType; action: () => void; label: string }[] = [
    { icon: Bold,        action: () => exec("bold"),           label: "Bold" },
    { icon: Italic,      action: () => exec("italic"),         label: "Italic" },
    { icon: Underline,   action: () => exec("underline"),      label: "Underline" },
    { icon: Heading1,    action: () => toggleHeading("h1"),    label: "Heading 1" },
    { icon: Heading2,    action: () => toggleHeading("h2"),    label: "Heading 2" },
    { icon: List,        action: () => exec("insertUnorderedList"), label: "Bullet List" },
    { icon: ListOrdered, action: () => exec("insertOrderedList"),  label: "Numbered List" },
  ];

  // ─── Goals / Todos state ──────────────────────────────────────────────────
  const { data: todos = [], isLoading: loadingTodos } = useQuery({
    queryKey: ["todos"],
    queryFn: () => todosApi.list().then(r => r.data),
  });

  const [goalFilter, setGoalFilterState] = useState<GoalType | "ALL">("ALL");
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoType, setNewTodoType] = useState<GoalType>("DAILY");

  // Changing the filter snaps the "new goal" type to the same category
  // so the goal you add appears in the list you're currently looking at.
  const setGoalFilter = (f: GoalType | "ALL") => {
    setGoalFilterState(f);
    if (f !== "ALL") setNewTodoType(f);
  };

  const filteredTodos = useMemo(() => {
    if (goalFilter === "ALL") return todos;
    return todos.filter(t => t.goalType === goalFilter);
  }, [todos, goalFilter]);

  const goalStats = useMemo(() => {
    const byType = (type: GoalType) => {
      const items = todos.filter(t => t.goalType === type);
      return { total: items.length, done: items.filter(t => t.completed).length };
    };
    return { DAILY: byType("DAILY"), WEEKLY: byType("WEEKLY"), MONTHLY: byType("MONTHLY") };
  }, [todos]);

  const createTodoMut = useMutation({
    mutationFn: (data: { title: string; goalType: GoalType }) => todosApi.create(data),
    onSuccess: (res) => {
      qc.setQueryData<Todo[]>(["todos"], old => [res.data, ...(old ?? [])]);
    },
    onError: () => { toast.error("Failed to create goal"); },
  });

  const toggleTodoMut = useMutation({
    mutationFn: (id: string) => todosApi.toggle(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["todos"] });
      const prev = qc.getQueryData<Todo[]>(["todos"]);
      qc.setQueryData<Todo[]>(["todos"], old =>
        (old ?? []).map(t => t.id === id ? { ...t, completed: !t.completed } : t)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(["todos"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["todos"] }); },
  });

  const deleteTodoMut = useMutation({
    mutationFn: (id: string) => todosApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["todos"] });
      const prev = qc.getQueryData<Todo[]>(["todos"]);
      qc.setQueryData<Todo[]>(["todos"], old => (old ?? []).filter(t => t.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(["todos"], ctx.prev); toast.error("Failed to delete"); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["todos"] }); },
  });

  const clearCompletedMut = useMutation({
    mutationFn: () => todosApi.clearCompleted(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["todos"] });
      const prev = qc.getQueryData<Todo[]>(["todos"]);
      qc.setQueryData<Todo[]>(["todos"], old => (old ?? []).filter(t => !t.completed));
      return { prev };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(["todos"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["todos"] }); },
  });

  const handleAddTodo = () => {
    if (!newTodoTitle.trim()) return;
    createTodoMut.mutate({ title: newTodoTitle.trim(), goalType: newTodoType });
    setNewTodoTitle("");
  };

  const completedCount = todos.filter(t => t.completed).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <PageHeader placeholder="Search…" />

        {/* Page-level tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-border">
          {([
            { key: "notes" as const, label: "Notes", icon: StickyNote },
            { key: "goals" as const, label: "Goals", icon: Target },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setPageTab(tab.key)}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
                pageTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── NOTES TAB ─── */}
        {pageTab === "notes" && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left panel: note list */}
            <div className="w-72 border-r border-border flex flex-col bg-background flex-shrink-0">
              <div className="p-3 border-b border-border space-y-2">
                <button onClick={handleNew} className="w-full flex items-center justify-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
                  <Plus size={13} /> New Note
                </button>
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5">
                  <Search size={12} className="text-muted-foreground flex-shrink-0" />
                  <input className="bg-transparent text-xs outline-none w-full placeholder:text-muted-foreground" placeholder="Search notes…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingNotes ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">Loading…</p>
                ) : filteredNotes.length === 0 ? (
                  <div className="p-6 text-center">
                    <StickyNote size={32} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
                    <p className="text-xs text-muted-foreground">No notes yet.</p>
                  </div>
                ) : filteredNotes.map(n => (
                  <button key={n.id} onClick={() => selectNote(n)}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors group ${selected === n.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{n.title || "Untitled"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(n.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(n.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right panel: editor */}
            <div className="flex-1 flex flex-col min-w-0">
              {!selected ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <StickyNote size={48} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
                    <p className="text-sm text-muted-foreground">Select a note or create a new one</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
                    <input className="flex-1 text-lg font-bold bg-transparent outline-none placeholder:text-muted-foreground"
                      placeholder="Note title…" value={title}
                      onChange={handleTitleChange}
                      onBlur={() => { if (title !== currentNote?.title) flushPendingSave(); }} />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"><Check size={12} /> Saved</span>}
                      <button onClick={handleSave} disabled={saveMut.isPending}
                        className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-xl hover:bg-muted transition-colors disabled:opacity-50">
                        <Save size={12} /> {saveMut.isPending ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 px-6 py-2 border-b border-border/50 bg-muted/30">
                    {toolbar.map((btn) => (
                      <button key={btn.label} onMouseDown={e => e.preventDefault()} onClick={btn.action} title={btn.label}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <btn.icon size={15} />
                      </button>
                    ))}
                    <div className="mx-2 w-px h-5 bg-border" />
                    <span className="text-[10px] text-muted-foreground">Auto-correct on blur</span>
                  </div>

                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    onBlur={handleEditorBlur}
                    className="flex-1 px-6 py-4 outline-none overflow-y-auto prose prose-sm dark:prose-invert max-w-none
                      [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2
                      [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
                      [&_p]:mb-2 [&_p]:leading-relaxed
                      [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-2
                      [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-2
                      [&_li]:mb-1"
                    data-placeholder="Start writing…"
                    style={{ minHeight: "300px" }}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── GOALS TAB ─── */}
        {pageTab === "goals" && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5 max-w-3xl mx-auto">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Goals</h2>
                <p className="text-sm text-muted-foreground mt-1">Track your daily, weekly, and monthly goals.</p>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-4">
                {(["DAILY", "WEEKLY", "MONTHLY"] as GoalType[]).map(type => {
                  const cfg = GOAL_CONFIG[type];
                  const stat = goalStats[type];
                  const Icon = cfg.icon;
                  const pct = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
                  return (
                    <motion.div key={type} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="surface-elevated p-4 cursor-pointer hover:ring-2 ring-primary/20 transition-all"
                      onClick={() => setGoalFilter(goalFilter === type ? "ALL" : type)}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${cfg.cls}`}>{cfg.label}</span>
                        <div className={`w-7 h-7 rounded-lg ${cfg.bgCls} flex items-center justify-center`}>
                          <Icon size={14} className={cfg.cls} />
                        </div>
                      </div>
                      <p className="text-lg font-bold font-mono">{stat.done}<span className="text-sm text-muted-foreground font-normal">/{stat.total}</span></p>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{pct}% complete</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Add new goal */}
              <div className="surface-elevated p-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(["DAILY", "WEEKLY", "MONTHLY"] as GoalType[]).map(type => {
                      const cfg = GOAL_CONFIG[type];
                      return (
                        <button key={type} onClick={() => setNewTodoType(type)}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                            newTodoType === type ? `${cfg.bgCls} ${cfg.cls}` : "text-muted-foreground hover:bg-muted"
                          }`}>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    placeholder="Add a new goal…"
                    value={newTodoTitle}
                    onChange={e => setNewTodoTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAddTodo(); }}
                  />
                  <button onClick={handleAddTodo} disabled={!newTodoTitle.trim() || createTodoMut.isPending}
                    className="flex items-center gap-1.5 gradient-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {([
                    { key: "ALL" as const, label: "All" },
                    { key: "DAILY" as const, label: "Daily" },
                    { key: "WEEKLY" as const, label: "Weekly" },
                    { key: "MONTHLY" as const, label: "Monthly" },
                  ]).map(f => (
                    <button key={f.key} onClick={() => setGoalFilter(f.key)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        goalFilter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                      }`}>
                      {f.label}
                      <span className="ml-1 text-[10px] opacity-60">
                        {f.key === "ALL" ? todos.length : todos.filter(t => t.goalType === f.key).length}
                      </span>
                    </button>
                  ))}
                </div>
                {completedCount > 0 && (
                  <button onClick={() => setShowClearConfirm(true)} className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors">
                    Clear {completedCount} completed
                  </button>
                )}
              </div>

              {/* Todo list */}
              <div className="space-y-1.5">
                {loadingTodos ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading goals…</p>
                ) : filteredTodos.length === 0 ? (
                  <div className="text-center py-12">
                    <Target size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
                    <p className="text-sm font-medium text-muted-foreground">No goals yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Add your first goal above to get started.</p>
                  </div>
                ) : filteredTodos.map(todo => {
                  const cfg = GOAL_CONFIG[todo.goalType];
                  return (
                    <motion.div key={todo.id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 hover:border-border transition-all ${
                        todo.completed ? "opacity-60" : ""
                      }`}>
                      <button onClick={() => toggleTodoMut.mutate(todo.id)} className="flex-shrink-0 transition-colors">
                        {todo.completed ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <Circle size={18} className="text-muted-foreground/40 hover:text-primary" />
                        )}
                      </button>
                      <span className={`flex-1 text-sm ${todo.completed ? "line-through text-muted-foreground" : "font-medium"}`}>
                        {todo.title}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bgCls} ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                      <button onClick={() => deleteTodoMut.mutate(todo.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Clear Completed Goals Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Clear completed goals</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  This will permanently delete <span className="font-medium text-foreground">{completedCount}</span> completed goal{completedCount === 1 ? "" : "s"}. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={() => { clearCompletedMut.mutate(); setShowClearConfirm(false); }}
                disabled={clearCompletedMut.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {clearCompletedMut.isPending ? "Clearing…" : "Clear all"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Note Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Delete Note</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Are you sure you want to delete <span className="font-medium text-foreground">{notes.find(n => n.id === deleteTarget)?.title || "this note"}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteMut.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
