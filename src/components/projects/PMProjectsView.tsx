import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, FolderOpen, Bug, ListTodo, UserPlus, History, RefreshCw } from "lucide-react";
import { useProjects, Task, TaskStatus, BugStatus } from "@/contexts/ProjectContext";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { tasksApi, type AssignableUser, type TaskAssignmentLog } from "@/lib/api";
import { toast } from "sonner";

type Tab = "projects" | "tasks" | "bugs";

const taskStatusCls: Record<TaskStatus, string> = {
  todo:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_review:   "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  done:        "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const bugStatusCls: Record<BugStatus, string> = {
  open:        "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  assigned:    "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_review:   "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  verified:    "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
  closed:      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const severityCls: Record<string, string> = {
  low:      "bg-gray-100 text-gray-500",
  medium:   "bg-amber-50 text-amber-600",
  high:     "bg-orange-50 text-orange-600",
  critical: "bg-red-50 text-red-600",
};

export function PMProjectsView() {
  const { projects, tasks, bugs, assignLead, assignTask, assignBug } = useProjects();
  const { user, allUsers } = useAuth();

  const [tab, setTab] = useState<Tab>("projects");
  const [assignLeadTarget, setAssignLeadTarget] = useState<string | null>(null);
  const [assignDevTarget,  setAssignDevTarget]  = useState<{type:"task"|"bug"; id:string; projectId:string} | null>(null);

  // Hierarchical assignable users per project
  const [assignableCache, setAssignableCache] = useState<Record<string, AssignableUser[]>>({});

  // Reassign modal
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // Assignment history
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [historyLogs, setHistoryLogs] = useState<TaskAssignmentLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const myProjects = projects.filter(p => p.pmId === user?.id);
  const projectIds = myProjects.map(p => p.id);
  const myTasks    = tasks.filter(t => projectIds.includes(t.projectId));
  const myBugs     = bugs.filter(b => projectIds.includes(b.projectId));
  const openBugs   = myBugs.filter(b => b.status === "open").length;

  const leadUsers = allUsers.filter(u => u.role === "LEAD");

  // Fetch assignable users for a project (cached)
  const fetchAssignable = async (projectId: string) => {
    if (assignableCache[projectId]) return assignableCache[projectId];
    try {
      const { data } = await tasksApi.assignableUsers(projectId);
      setAssignableCache(prev => ({ ...prev, [projectId]: data }));
      return data;
    } catch { return []; }
  };

  // Pre-fetch assignable for first project
  useEffect(() => {
    myProjects.forEach(p => fetchAssignable(p.id));
  }, [myProjects.length]);

  const handleAssignLead = (leadId: string) => {
    if (assignLeadTarget) {
      assignLead(assignLeadTarget, leadId);
      toast.success("Lead assigned");
      setAssignLeadTarget(null);
    }
  };

  const handleAssignDev = async (userId: string) => {
    if (!assignDevTarget) return;
    try {
      if (assignDevTarget.type === "task") {
        await tasksApi.reassign(assignDevTarget.id, { assigned_to: userId, note: "Assigned by PM" });
        assignTask(assignDevTarget.id, userId);
      } else {
        assignBug(assignDevTarget.id, userId);
      }
      toast.success("Assigned successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Assignment failed";
      toast.error(msg);
    }
    setAssignDevTarget(null);
  };

  const handleReassign = async () => {
    if (!reassignTask || !reassignTo) return;
    setReassigning(true);
    try {
      await tasksApi.reassign(reassignTask.id, { assigned_to: reassignTo, note: reassignNote || undefined });
      toast.success("Task reassigned");
      assignTask(reassignTask.id, reassignTo);
      setReassignTask(null);
      setReassignTo("");
      setReassignNote("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Permission denied";
      toast.error(msg);
    } finally { setReassigning(false); }
  };

  const openHistory = async (task: Task) => {
    setHistoryTask(task);
    setLoadingHistory(true);
    try { setHistoryLogs((await tasksApi.history(task.id)).data); }
    catch { setHistoryLogs([]); }
    finally { setLoadingHistory(false); }
  };

  const getAssignableForProject = (projectId: string) => assignableCache[projectId] ?? [];

  const tabs: {key:Tab; label:string; icon:React.ElementType; badge?:number}[] = [
    { key:"projects", label:"My Projects", icon:FolderOpen,  badge:myProjects.length },
    { key:"tasks",    label:"Tasks",       icon:ListTodo,     badge:myTasks.length   },
    { key:"bugs",     label:"Bug Reports", icon:Bug,          badge:openBugs>0?openBugs:undefined },
  ];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:"My Projects",  value:myProjects.length, color:"text-primary" },
          { label:"Open Tasks",   value:myTasks.filter(t=>t.status!=="done").length, color:"text-amber-500" },
          { label:"Open Bugs",    value:openBugs, color:"text-red-500" },
        ].map(s=>(
          <motion.div key={s.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">{s.label}</span>
            <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab===t.key?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={13}/>
            {t.label}
            {t.badge !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${t.key==="bugs"&&openBugs>0?"bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400":"bg-muted text-muted-foreground"}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── PROJECTS TAB ── */}
      {tab==="projects"&&(
        <div className="space-y-3">
          {myProjects.length===0&&<p className="text-sm text-muted-foreground text-center py-12">No projects assigned to you yet.</p>}
          {myProjects.map((p,i)=>{
            const lead    = allUsers.find(u=>u.id===p.leadId);
            const pTasks  = tasks.filter(t=>t.projectId===p.id);
            const pBugs   = bugs.filter(b=>b.projectId===p.id&&b.status==="open");
            return (
              <motion.div key={p.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}} className="surface-elevated p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{p.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{p.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Client: <strong className="text-foreground">{p.client}</strong></span>
                      {p.deadline && <span>Deadline: <strong className="text-foreground">{new Date(p.deadline).toLocaleDateString("en-IN")}</strong></span>}
                      <span>{pTasks.length} tasks &middot; {p.members.length} members</span>
                      {pBugs.length>0&&<span className="text-red-500 font-medium">{pBugs.length} open bug{pBugs.length>1?"s":""}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {lead ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center"><span className="text-[8px] font-bold text-white">{lead.initials}</span></div>
                        <span className="text-muted-foreground">Lead: {lead.name}</span>
                      </div>
                    ) : (
                      <button onClick={()=>setAssignLeadTarget(p.id)} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                        <UserPlus size={11}/> Assign Lead
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {tab==="tasks"&&(
        <div className="surface-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Task","Project","Type","Priority","Assignee","Status",""].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {myTasks.map((t,i)=>{
                const assignee = t.assignee ?? allUsers.find(u=>u.id===t.assigneeId);
                const proj     = projects.find(p=>p.id===t.projectId);
                return (
                  <motion.tr key={t.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><p className="font-medium">{t.title}</p>{t.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{proj?.name}</td>
                    <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium capitalize">{t.type}</span></td>
                    <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full font-medium capitalize bg-muted text-muted-foreground">{t.priority}</span></td>
                    <td className="px-4 py-3">
                      {assignee ? (
                        <button onClick={()=>setReassignTask(t)} className="flex items-center gap-1.5 group" title="Click to reassign">
                          <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center"><span className="text-[8px] font-bold text-white">{assignee.initials}</span></div>
                          <span className="text-xs">{assignee.name}</span>
                          <RefreshCw size={10} className="text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <button onClick={()=>{ fetchAssignable(t.projectId); setAssignDevTarget({type:"task",id:t.id,projectId:t.projectId}); }} className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><UserPlus size={11}/>Assign</button>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${taskStatusCls[t.status]}`}>{t.status.replace("_"," ")}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={()=>openHistory(t)} title="Assignment history" className="p-1 rounded hover:bg-muted transition-colors">
                        <History size={12} className="text-muted-foreground" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
              {myTasks.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No tasks in your projects yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BUGS TAB ── */}
      {tab==="bugs"&&(
        <div className="surface-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Bug","Project","Severity","Reported By","Assigned To","Status",""].map(h=>(
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {myBugs.map((b,i)=>{
                const reporter  = allUsers.find(u=>u.id===b.reportedBy);
                const assignee  = allUsers.find(u=>u.id===b.assignedTo);
                const proj      = projects.find(p=>p.id===b.projectId);
                return (
                  <motion.tr key={b.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><p className="font-medium">{b.title}</p><p className="text-[11px] text-muted-foreground line-clamp-1">{b.description}</p></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{proj?.name}</td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${severityCls[b.severity]}`}>{b.severity}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{reporter?.name}</td>
                    <td className="px-4 py-3">
                      {assignee ? (
                        <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center"><span className="text-[8px] font-bold text-white">{assignee.initials}</span></div><span className="text-xs">{assignee.name}</span></div>
                      ) : (
                        <button onClick={()=>{ fetchAssignable(b.projectId); setAssignDevTarget({type:"bug",id:b.id,projectId:b.projectId}); }} className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><UserPlus size={11}/>Assign</button>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${bugStatusCls[b.status]}`}>{b.status.replace("_"," ")}</span></td>
                    <td/>
                  </motion.tr>
                );
              })}
              {myBugs.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No bugs reported for your projects.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Assign Lead modal ── */}
      {assignLeadTarget&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Assign Lead</h3>
              <button onClick={()=>setAssignLeadTarget(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
            </div>
            <div className="p-4 space-y-2">
              {leadUsers.length===0&&<p className="text-sm text-muted-foreground text-center py-4">No lead users available.</p>}
              {leadUsers.map(u=>(
                <button key={u.id} onClick={()=>handleAssignLead(u.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"><span className="text-[10px] font-bold text-white">{u.initials}</span></div>
                  <div><p className="text-sm font-medium">{u.name}</p><p className="text-[11px] text-muted-foreground">{u.email}</p></div>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_LABELS[u.role].cls}`}>{ROLE_LABELS[u.role].label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Assign Developer modal (hierarchical) ── */}
      {assignDevTarget&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === "Escape") setAssignDevTarget(null); }}>
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Assign Team Member</h3>
              <button onClick={()=>setAssignDevTarget(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
            </div>
            <div className="p-4 space-y-2">
              {getAssignableForProject(assignDevTarget.projectId).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No assignable members in this project.</p>
              )}
              {getAssignableForProject(assignDevTarget.projectId).map(u=>(
                <button key={u.id} onClick={()=>handleAssignDev(u.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"><span className="text-[10px] font-bold text-white">{u.initials}</span></div>
                  <div><p className="text-sm font-medium">{u.name}</p></div>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_LABELS[u.role].cls}`}>{ROLE_LABELS[u.role].label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Reassign Task modal ── */}
      <AnimatePresence>
        {reassignTask && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === "Escape") setReassignTask(null); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h3 className="font-semibold text-sm">Reassign Task</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[250px]">{reassignTask.title}</p>
                </div>
                <button onClick={() => setReassignTask(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
              </div>
              <div className="p-5 space-y-4">
                {reassignTask.assignee && (
                  <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                    <span className="text-[11px] text-muted-foreground">Currently:</span>
                    <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center"><span className="text-[8px] font-bold text-white">{reassignTask.assignee.initials}</span></div>
                    <span className="text-xs font-medium">{reassignTask.assignee.name}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Assign To</label>
                  <select autoFocus className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                    <option value="">Select team member…</option>
                    {getAssignableForProject(reassignTask.projectId).filter(u => u.id !== reassignTask.assigneeId).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role].label})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Note (optional)</label>
                  <textarea rows={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                    placeholder="Reason for reassignment…" value={reassignNote} onChange={e => setReassignNote(e.target.value)}/>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
                <button onClick={() => setReassignTask(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleReassign} disabled={!reassignTo || reassigning}
                  className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                  {reassigning ? "Reassigning…" : "Reassign"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Assignment History modal ── */}
      <AnimatePresence>
        {historyTask && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setHistoryTask(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2"><History size={14} /> Assignment History</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[300px]">{historyTask.title}</p>
                </div>
                <button onClick={() => setHistoryTask(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
              </div>
              <div className="p-5 max-h-[400px] overflow-y-auto">
                {loadingHistory ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
                ) : historyLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No assignment history found.</p>
                ) : (
                  <div className="space-y-4">
                    {historyLogs.map((log, i) => (
                      <div key={log.id} className="relative pl-6">
                        {i < historyLogs.length - 1 && <div className="absolute left-[7px] top-5 bottom-[-12px] w-px bg-border" />}
                        <div className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-medium">{log.assignedBy.name}</span>
                            <span className="text-muted-foreground">&rarr;</span>
                            <span className="font-medium">{log.assignedTo.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ROLE_LABELS[log.assignedTo.role].cls}`}>{ROLE_LABELS[log.assignedTo.role].label}</span>
                          </div>
                          {log.note && <p className="text-[11px] text-muted-foreground mt-0.5">{log.note}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {new Date(log.assignedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
