import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Mail, Phone, Globe, Calendar, Briefcase,
  StickyNote, Send, Trash2, Pencil, User, Clock,
  Video, AlertTriangle, Cog, FileText,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { leadsApi, type AdLead, type LeadNote } from "@/lib/api";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const ATTENDANCE_COLORS: Record<string, string> = {
  attended:  "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  no_show:   "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const { data: lead, isLoading } = useQuery<AdLead>({
    queryKey: ["lead", id],
    queryFn: () => leadsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<LeadNote[]>({
    queryKey: ["lead-notes", id],
    queryFn: () => leadsApi.getNotes(id!).then((r) => r.data),
    enabled: !!id,
  });

  const addNote = useMutation({
    mutationFn: (content: string) => leadsApi.addNote(id!, content),
    onSuccess: () => { setNewNote(""); qc.invalidateQueries({ queryKey: ["lead-notes", id] }); },
  });

  const updateNote = useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      leadsApi.updateNote(id!, noteId, content),
    onSuccess: () => { setEditingId(null); setEditContent(""); qc.invalidateQueries({ queryKey: ["lead-notes", id] }); },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => leadsApi.deleteNote(id!, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-notes", id] }),
  });

  const attendanceClass = ATTENDANCE_COLORS[lead?.attendance_status || ""] || "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {isLoading ? (
            <div className="space-y-6">
              <div className="h-8 w-48 bg-muted rounded animate-pulse" />
              <div className="h-64 bg-muted rounded-xl animate-pulse" />
            </div>
          ) : !lead ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-lg font-medium">Lead not found</p>
              <button onClick={() => navigate("/leads")} className="mt-3 text-sm text-primary hover:underline">Back to leads</button>
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
              {/* Back + Header */}
              <motion.div variants={item}>
                <button onClick={() => navigate("/leads")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
                  <ArrowLeft className="h-4 w-4" /> Back to Leads
                </button>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">{lead.name}</h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                      <Briefcase className="h-4 w-4" /> {lead.business_type}
                    </p>
                  </div>
                  <span className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${attendanceClass}`}>
                    {lead.attendance_status ? lead.attendance_status.replace(/_/g, " ") : "Pending"}
                  </span>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left: Lead Info */}
                <motion.div variants={item} className="lg:col-span-1 space-y-6">
                  {/* Contact */}
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-5 py-3.5"><h3 className="text-sm font-semibold">Contact Information</h3></div>
                    <div className="px-5 py-4 space-y-4">
                      <InfoRow icon={Mail} label="Email" value={lead.email} />
                      <InfoRow icon={Phone} label="Phone" value={lead.full_phone || `${lead.country_code} ${lead.phone}`} />
                      {lead.website && (
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Website</p>
                            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{lead.website}</a>
                          </div>
                        </div>
                      )}
                      <InfoRow icon={Calendar} label="Added" value={new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
                    </div>
                  </div>

                  {/* Meeting */}
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-5 py-3.5"><h3 className="text-sm font-semibold">Meeting Details</h3></div>
                    <div className="px-5 py-4 space-y-4">
                      <InfoRow icon={Calendar} label="Meeting Time" value={lead.meeting_time ? new Date(lead.meeting_time).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not scheduled"} />
                      {lead.meet_link && (
                        <div className="flex items-center gap-3">
                          <Video className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Meet Link</p>
                            <a href={lead.meet_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Join Meeting</a>
                          </div>
                        </div>
                      )}
                      {lead.lp_name && <InfoRow icon={FileText} label="Landing Page" value={lead.lp_name} />}
                    </div>
                  </div>

                  {/* Business Details */}
                  {(lead.challenge || lead.automate_process) && (
                    <div className="rounded-xl border bg-card shadow-sm">
                      <div className="border-b px-5 py-3.5"><h3 className="text-sm font-semibold">Business Details</h3></div>
                      <div className="px-5 py-4 space-y-4">
                        {lead.challenge && <InfoRow icon={AlertTriangle} label="Challenge" value={lead.challenge} />}
                        {lead.automate_process && <InfoRow icon={Cog} label="Process to Automate" value={lead.automate_process} />}
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Right: Notes */}
                <motion.div variants={item} className="lg:col-span-2">
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-5 py-3.5 flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Notes</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{notes.length}</span>
                    </div>

                    {/* Add Note */}
                    <div className="border-b px-5 py-4">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note about this lead..."
                        rows={3}
                        className="w-full rounded-lg border bg-muted/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => { if (newNote.trim()) addNote.mutate(newNote.trim()); }}
                          disabled={!newNote.trim() || addNote.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {addNote.isPending ? "Adding..." : "Add Note"}
                        </button>
                      </div>
                    </div>

                    {/* Notes List */}
                    <div className="divide-y">
                      {notesLoading ? (
                        <div className="px-5 py-8 space-y-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2 animate-pulse">
                              <div className="h-3 w-32 bg-muted rounded" />
                              <div className="h-4 w-full bg-muted rounded" />
                            </div>
                          ))}
                        </div>
                      ) : notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <StickyNote className="h-10 w-10 mb-2" />
                          <p className="text-sm font-medium">No notes yet</p>
                          <p className="text-xs mt-1">Add a note to keep track of interactions</p>
                        </div>
                      ) : (
                        notes.map((note) => (
                          <div key={note.id} className="px-5 py-4 hover:bg-muted/30 transition-colors group">
                            {editingId === note.id ? (
                              <div>
                                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                                <div className="flex justify-end gap-2 mt-2">
                                  <button onClick={() => { setEditingId(null); setEditContent(""); }} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
                                  <button
                                    onClick={() => { if (editContent.trim()) updateNote.mutate({ noteId: note.id, content: editContent.trim() }); }}
                                    disabled={updateNote.isPending}
                                    className="rounded-lg gradient-primary px-3 py-1.5 text-xs text-white disabled:opacity-50"
                                  >{updateNote.isPending ? "Saving..." : "Save"}</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="font-medium text-foreground">{note.author?.name || "Admin"}</span>
                                    <Clock className="h-3 w-3" />
                                    <span>{new Date(note.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingId(note.id); setEditContent(note.content); }} className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10"><Pencil className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setDeleteNoteId(note.id)} className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
                                  </div>
                                </div>
                                <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Delete Note Confirmation Modal */}
      {deleteNoteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Delete Note</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Are you sure you want to delete this note? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setDeleteNoteId(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => { deleteNote.mutate(deleteNoteId); setDeleteNoteId(null); }}
                disabled={deleteNote.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {deleteNote.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
