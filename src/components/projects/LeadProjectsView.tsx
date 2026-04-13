import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, UserPlus, ListTodo, History, RefreshCw, Search } from "lucide-react";
import { useProjects, Task, TaskStatus, TaskPriority, TaskType } from "@/contexts/ProjectContext";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { tasksApi, type AssignableUser, type TaskAssignmentLog } from "@/lib/api";
import { toast } from "sonner";

type Tab = "board" | "team" | "bugs";

const COLUMNS: { status: TaskStatus; label: string; cls: string }[] = [
  { status: "TODO",        label: "To Do",       cls: "border-t-gray-300 dark:border-t-gray-600" },
  { status: "IN_PROGRESS", label: "In Progress",  cls: "border-t-blue-400" },
  { status: "IN_REVIEW",   label: "In Review",    cls: "border-t-purple-400" },
  { status: "DONE",        label: "Done",         cls: "border-t-emerald-400" },
];

const priorityCls: Record<TaskPriority, string> = {
  LOW:      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM:   "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  HIGH:     "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-600",
  CRITICAL: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const bugStatusCls: Record<string, string> = {
  OPEN:        "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  ASSIGNED:    "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  IN_PROGRESS: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  IN_REVIEW:   "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  VERIFIED:    "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
  CLOSED:      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const severityCls: Record<string, string> = {
  LOW:      "bg-gray-100 text-gray-500",
  MEDIUM:   "bg-amber-50 text-amber-600",
  HIGH:     "bg-orange-50 text-orange-600",
  CRITICAL: "bg-red-50 text-red-600",
};

export function LeadProjectsView() {
  const { projects, tasks, bugs, createTask, assignTask, updateTaskStatus, addMember, removeMember } = useProjects();
  const { user, allUsers } = useAuth();

  const [tab, setTab] = useState<Tab>("board");
  const [showCreate, setShowCreate] = useState(false);
  const [assignMemberTarget, setAssignMemberTarget] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<{
    title: string; description: string; type: TaskType; priority: TaskPriority; assigneeId: string;
  }>({ title: "", description: "", type: "TASK", priority: "MEDIUM", assigneeId: "" });

  // Assignable users from API (hierarchical)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  // Reassign modal state
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // Assignment history modal
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [historyLogs, setHistoryLogs] = useState<TaskAssignmentLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const myProject = projects.find(p => p.leadId === user?.id);

  // Fetch assignable users when project is known
  useEffect(() => {
    if (!myProject) return;
    tasksApi.assignableUsers(myProject.id).then(r => setAssignableUsers(r.data)).catch(() => {});
  }, [myProject?.id]);

  if (!myProject) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ListTodo size={36} className="text-muted-foreground/40 mb-3" strokeWidth={1}/>
        <p className="text-sm text-muted-foreground">You haven't been assigned as Lead on any project yet.</p>
      </div>
    );
  }

  const projectTasks = tasks.filter(t => t.projectId === myProject.id);
  const projectBugs  = bugs.filter(b => b.projectId === myProject.id);
  const members      = allUsers.filter(u => myProject.members.some(m => m.user.id === u.id));
  const availableMembers = allUsers.filter(u =>
    (u.role === "DEVELOPER" || u.role === "TESTER" || u.role === "EDITOR" || u.role === "DIGITAL_MARKETER") && !myProject.members.some(m => m.user.id === u.id)
  );
  const openBugs = projectBugs.filter(b => b.status === "OPEN").length;

  const handleCreateTask = async () => {
    try {
      await createTask({
        projectId: myProject.id,
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        priority: taskForm.priority,
        assigneeId: taskForm.assigneeId || undefined,
      });
      toast.success("Task created");
      setShowCreate(false);
      setTaskForm({ title: "", description: "", type: "TASK", priority: "MEDIUM", assigneeId: "" });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create task";
      toast.error(msg);
    }
  };

  const handleReassign = async () => {
    if (!reassignTask || !reassignTo) return;
    setReassigning(true);
    try {
      await tasksApi.reassign(reassignTask.id, { assigned_to: reassignTo, note: reassignNote || undefined });
      toast.success("Task reassigned");
      setReassignTask(null);
      setReassignTo("");
      setReassignNote("");
      // Refresh tasks
      await assignTask(reassignTask.id, reassignTo);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Permission denied";
      toast.error(msg);
    } finally {
      setReassigning(false);
    }
  };

  const openHistory = async (task: Task) => {
    setHistoryTask(task);
    setLoadingHistory(true);
    try {
      const { data } = await tasksApi.history(task.id);
      setHistoryLogs(data);
    } catch { setHistoryLogs([]); }
    finally { setLoadingHistory(false); }
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "board", label: "Task Board",  badge: projectTasks.filter(t => t.status !== "DONE").length },
    { key: "team",  label: "Team",        badge: members.length },
    { key: "bugs",  label: "Bug Reports", badge: openBugs > 0 ? openBugs : undefined },
  ];

  return (
    <div className="space-y-5">
      {/* Project header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-base">{myProject.name}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{myProject.description}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Client: <strong className="text-foreground">{myProject.client}</strong></span>
              {myProject.deadline && <span>Deadline: <strong className="text-foreground">{new Date(myProject.deadline).toLocaleDateString("en-IN")}</strong></span>}
              <span>{projectTasks.length} tasks &middot; {members.length} members</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 flex-shrink-0">
            {[
              { label: "Total Tasks",   value: projectTasks.length,                            color: "text-primary" },
              { label: "In Progress",   value: projectTasks.filter(t=>t.status==="IN_PROGRESS").length, color: "text-blue-500" },
              { label: "Open Bugs",     value: openBugs,                                        color: "text-red-500" },
            ].map(s => (
              <div key={s.label} className="bg-muted rounded-xl p-3 text-center min-w-[72px]">
                <span className={`text-xl font-bold font-mono block ${s.color}`}>{s.value}</span>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tab nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              {t.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${t.key === "bugs" && openBugs > 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
        {tab === "board" && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
            <Plus size={13}/> New Task
          </button>
        )}
        {tab === "team" && (
          <button onClick={() => setAssignMemberTarget(myProject.id)} className="flex items-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
            <UserPlus size={13}/> Add Member
          </button>
        )}
      </div>

      {/* ── BOARD TAB ── */}
      {tab === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = projectTasks.filter(t => t.status === col.status);
            return (
              <div key={col.status} className={`surface-elevated border-t-2 ${col.cls} rounded-2xl overflow-hidden`}>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold">{col.label}</span>
                  <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {colTasks.map((task, i) => {
                    const assignee = task.assignee ?? allUsers.find(u => u.id === task.assigneeId);
                    return (
                      <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="bg-background border border-border rounded-xl p-3 space-y-2 group">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium leading-snug flex-1">{task.title}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${priorityCls[task.priority]}`}>{task.priority.toLowerCase()}</span>
                        </div>
                        {task.description && <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>}
                        <div className="flex items-center justify-between">
                          {assignee ? (
                            <button onClick={() => setReassignTask(task)} className="flex items-center gap-1 hover:opacity-70 transition-opacity" title="Click to reassign">
                              <div className="w-4 h-4 rounded-full gradient-primary flex items-center justify-center flex-shrink-0"><span className="text-[7px] font-bold text-white">{assignee.initials}</span></div>
                              <span className="text-[10px] text-muted-foreground">{assignee.name?.split(" ")[0]}</span>
                              <RefreshCw size={9} className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <button onClick={() => setReassignTask(task)} className="text-[10px] text-primary/70 italic hover:underline">Unassigned</button>
                          )}
                          <div className="flex items-center gap-1">
                            <button onClick={() => openHistory(task)} title="Assignment history" className="p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                              <History size={10} className="text-muted-foreground" />
                            </button>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{task.type.toLowerCase()}</span>
                          </div>
                        </div>
                        {/* Status advance */}
                        {col.status !== "DONE" && (
                          <button onClick={() => {
                            const next: Record<TaskStatus, TaskStatus> = { TODO: "IN_PROGRESS", IN_PROGRESS: "IN_REVIEW", IN_REVIEW: "DONE", DONE: "DONE" };
                            updateTaskStatus(task.id, next[task.status]);
                          }} className="w-full text-[10px] text-primary font-medium hover:underline text-left pt-1">
                            &rarr; Move to {COLUMNS[COLUMNS.findIndex(c => c.status === col.status) + 1]?.label}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <p className="text-[11px] text-muted-foreground/50 text-center pt-8">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TEAM TAB ── */}
      {tab === "team" && (
        <div className="surface-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Member", "Role", "Email", "Active Tasks", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {members.map((m, i) => {
                const taskCount = projectTasks.filter(t => t.assigneeId === m.id && t.status !== "DONE").length;
                return (
                  <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0"><span className="text-[9px] font-bold text-white">{m.initials}</span></div>
                        <span className="font-medium text-sm">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_LABELS[m.role].cls}`}>{ROLE_LABELS[m.role].label}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono font-medium ${taskCount >= 5 ? "text-red-500" : "text-foreground"}`}>{taskCount}</span>
                      {taskCount >= 5 && <span className="text-[10px] text-red-400 ml-1">High workload</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeMember(myProject.id, m.id)} className="text-[11px] text-red-500 font-medium hover:underline">Remove</button>
                    </td>
                  </motion.tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No team members added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BUGS TAB ── */}
      {tab === "bugs" && (
        <div className="surface-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Bug", "Severity", "Reported By", "Assigned To", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {projectBugs.map((b, i) => {
                const reporter = allUsers.find(u => u.id === b.reportedById);
                const assignee = allUsers.find(u => u.id === b.assignedToId);
                return (
                  <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><p className="font-medium">{b.title}</p><p className="text-[11px] text-muted-foreground line-clamp-1">{b.description}</p></td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${severityCls[b.severity]}`}>{b.severity.toLowerCase()}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{reporter?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center"><span className="text-[8px] font-bold text-white">{assignee.initials}</span></div>
                          <span className="text-xs">{assignee.name}</span>
                        </div>
                      ) : <span className="text-[11px] text-muted-foreground/60 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${bugStatusCls[b.status]}`}>{b.status.replace("_", " ").toLowerCase()}</span></td>
                  </motion.tr>
                );
              })}
              {projectBugs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No bugs reported yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Task modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === "Escape") setShowCreate(false); }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Create Task</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Title</label>
                <input autoFocus className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="Task title…" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}/>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Description</label>
                <textarea rows={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                  placeholder="Brief description…" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Type</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={taskForm.type} onChange={e => setTaskForm(f => ({ ...f, type: e.target.value as TaskType }))}>
                    {(["TASK","FEATURE","BUG","IMPROVEMENT"] as const).map(v => <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Priority</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
                    {(["LOW","MEDIUM","HIGH","CRITICAL"] as const).map(v => <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Assign To</label>
                <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  value={taskForm.assigneeId} onChange={e => setTaskForm(f => ({ ...f, assigneeId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {assignableUsers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role].label})</option>
                  ))}
                </select>
                {assignableUsers.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">No assignable members in this project yet.</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleCreateTask} disabled={!taskForm.title}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                Create Task
              </button>
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
                    <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white">{reassignTask.assignee.initials}</span>
                    </div>
                    <span className="text-xs font-medium">{reassignTask.assignee.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-auto ${ROLE_LABELS[reassignTask.assignee.role].cls}`}>{ROLE_LABELS[reassignTask.assignee.role].label}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Assign To</label>
                  <select autoFocus className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                    <option value="">Select team member…</option>
                    {assignableUsers.filter(u => u.id !== reassignTask.assigneeId).map(m => (
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
                        {/* Timeline line */}
                        {i < historyLogs.length - 1 && (
                          <div className="absolute left-[7px] top-5 bottom-[-12px] w-px bg-border" />
                        )}
                        {/* Timeline dot */}
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

      {/* ── Add Member modal ── */}
      {assignMemberTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Add Team Member</h3>
              <button onClick={() => setAssignMemberTarget(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
            </div>
            <div className="p-4 space-y-2">
              {availableMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All developers/testers are already on this project.</p>}
              {availableMembers.map(m => (
                <button key={m.id} onClick={() => { addMember(myProject.id, m.id); setAssignMemberTarget(null); toast.success(`${m.name} added to team`); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"><span className="text-[10px] font-bold text-white">{m.initials}</span></div>
                  <div><p className="text-sm font-medium">{m.name}</p><p className="text-[11px] text-muted-foreground">{m.email}</p></div>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_LABELS[m.role].cls}`}>{ROLE_LABELS[m.role].label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
