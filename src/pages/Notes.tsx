import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, StickyNote, Trash2, Save, Check, Search,
  Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered,
  X,
} from "lucide-react";
import { notesApi, Note } from "@/lib/api";
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
  // Normalize multiple spaces
  result = result.replace(/ {2,}/g, " ");
  // Space after punctuation if followed by a letter
  result = result.replace(/([.!?,;:])([A-Za-z])/g, "$1 $2");
  // Capitalize first letter of sentences
  result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
  // Apply word corrections
  result = result.replace(/\b(\w+)\b/g, (word) => {
    const lower = word.toLowerCase();
    if (CORRECTIONS[lower]) {
      // Preserve capitalization of first letter
      const corrected = CORRECTIONS[lower];
      return word[0] === word[0].toUpperCase()
        ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
        : corrected;
    }
    return word;
  });
  return result;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Notes() {
  const [notes, setNotes]       = useState<Note[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchNotes = useCallback(async () => {
    try { const { data } = await notesApi.list(); setNotes(data); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const currentNote = notes.find(n => n.id === selected);

  const selectNote = (note: Note) => {
    setSelected(note.id);
    setTitle(note.title);
    setSaved(false);
    // Set editor content after render
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = DOMPurify.sanitize(note.content);
    }, 0);
  };

  const handleNew = async () => {
    try {
      const { data } = await notesApi.create({ title: "Untitled Note", content: "" });
      setNotes(prev => [data, ...prev]);
      selectNote(data);
    } catch { toast.error("Failed to create note"); }
  };

  const handleSave = async () => {
    if (!selected || !editorRef.current) return;
    setSaving(true);
    const rawContent = DOMPurify.sanitize(editorRef.current.innerHTML);
    try {
      await notesApi.update(selected, { title, content: rawContent });
      setNotes(prev => prev.map(n => n.id === selected ? { ...n, title, content: rawContent, updatedAt: new Date().toISOString() } : n));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await notesApi.delete(deleteTarget);
      setNotes(prev => prev.filter(n => n.id !== deleteTarget));
      if (selected === deleteTarget) { setSelected(null); setTitle(""); }
      toast.success("Note deleted");
    } catch { toast.error("Failed to delete note"); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  // Auto-correct on blur
  const handleEditorBlur = () => {
    if (!editorRef.current) return;
    const el = editorRef.current;
    // Apply auto-correct to text nodes only (preserve HTML tags)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const corrected = autoCorrect(node.textContent ?? "");
      if (corrected !== node.textContent) node.textContent = corrected;
    }
  };

  // Debounced auto-save on input
  const handleEditorInput = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => handleSave(), 3000);
  };

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const toggleHeading = (tag: string) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const parent = sel.anchorNode?.parentElement;
      if (parent?.tagName.toLowerCase() === tag.toLowerCase()) {
        exec("formatBlock", "p");
      } else {
        exec("formatBlock", tag);
      }
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

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <PageHeader placeholder="Search notes…" />

        <div className="flex flex-1 overflow-hidden">
          {/* ─── Left panel: note list ─── */}
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
              {loading ? (
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

          {/* ─── Right panel: editor ─── */}
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
                {/* Title */}
                <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
                  <input className="flex-1 text-lg font-bold bg-transparent outline-none placeholder:text-muted-foreground"
                    placeholder="Note title…" value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={() => { if (title !== currentNote?.title) handleSave(); }} />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"><Check size={12} /> Saved</span>}
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-xl hover:bg-muted transition-colors disabled:opacity-50">
                      <Save size={12} /> {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 px-6 py-2 border-b border-border/50 bg-muted/30">
                  {toolbar.map((btn, i) => (
                    <button key={btn.label} onMouseDown={e => e.preventDefault()} onClick={btn.action} title={btn.label}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <btn.icon size={15} />
                    </button>
                  ))}
                  <div className="mx-2 w-px h-5 bg-border" />
                  <span className="text-[10px] text-muted-foreground">Auto-correct on blur</span>
                </div>

                {/* Editor */}
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
      </main>

      {/* Delete Confirmation Modal */}
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
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
