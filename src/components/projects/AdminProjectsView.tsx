import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, UserCheck, FolderKanban, CheckCircle2, AlertCircle, ListTodo, History, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProjects, ProjectStatus, Task, TaskStatus, TaskPriority, TaskType } from "@/contexts/ProjectContext";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { tasksApi, type AssignableUser, type TaskAssignmentLog } from "@/lib/api";
import { OngoingProjects } from "@/components/OngoingProjects";
import { toast } from "sonner";

const statusCls: Record<ProjectStatus, string> = {
  ACTIVE:    "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  PAUSED:    "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  REVIEW:    "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  PLANNING:  "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
};

const COLUMNS: { status: TaskStatus; label: string; cls: string }[] = [
  { status: "TODO",        label: "To Do",        cls: "border-t-gray-300 dark:border-t-gray-600" },
  { status: "IN_PROGRESS", label: "In Progress",  cls: "border-t-blue-400" },
  { status: "IN_REVIEW",   label: "In Review",    cls: "border-t-purple-400" },
  { status: "DONE",        label: "Done",         cls: "border-t-emerald-400" },
];

const priorityCls: Record<string, string> = {
  LOW:      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM:   "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  HIGH:     "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-600",
  CRITICAL: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export function AdminProjectsView() {
  const navigate = useNavigate();
  const { projects, tasks, assignPM, createProject, createTask, assignTask, updateTaskStatus } = useProjects();
  const { allUsers } = useAuth();

  const [assignTarget, setAssignTarget] = useState<string | null>(null);  // project id for PM assignment
  const [showCreate,   setShowCreate]   = useState(false);
  const [form, setForm] = useState({ name:"", client:"", description:"", deadline:"", pmId:"" });

  // Task management state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState<{
    title: string; description: string; type: TaskType; priority: TaskPriority; assigneeId: string;
  }>({ title: "", description: "", type: "TASK", priority: "MEDIUM", assigneeId: "" });

  // Assignable users for selected project
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

  // Task search
  const [taskSearch, setTaskSearch] = useState("");

  const pmUsers   = allUsers.filter(u => u.role === "PROJECT_MANAGER");
  const noPM      = projects.filter(p => !p.pmId);
  const active    = projects.filter(p => p.status === "ACTIVE").length;
  const completed = projects.filter(p => p.status === "COMPLETED").length;

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectTasks = selectedProjectId
    ? tasks.filter(t => t.projectId === selectedProjectId)
    : [];
  const filteredTasks = taskSearch
    ? projectTasks.filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase()))
    : projectTasks;

  // Fetch assignable users when selected project changes
  useEffect(() => {
    if (!selectedProjectId) { setAssignableUsers([]); return; }
    tasksApi.assignableUsers(selectedProjectId).then(r => setAssignableUsers(r.data)).catch(() => setAssignableUsers([]));
  }, [selectedProjectId]);

  const handleAssignPM = (pmId: string) => {
    if (assignTarget) { assignPM(assignTarget, pmId); setAssignTarget(null); }
  };

  const handleCreate = () => {
    createProject({
      name:form.name, client:form.client, description:form.description,
      deadline:form.deadline, pmId:form.pmId||undefined,
    });
    setShowCreate(false);
    setForm({ name:"", client:"", description:"", deadline:"", pmId:"" });
  };

  const handleCreateTask = async () => {
    if (!selectedProjectId) return;
    try {
      await createTask({
        projectId: selectedProjectId,
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        priority: taskForm.priority,
        assigneeId: taskForm.assigneeId || undefined,
      });
      toast.success("Task created");
      setShowCreateTask(false);
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
      // Refresh tasks via context
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

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Total Projects",     value:projects.length,  icon:FolderKanban,  color:"text-primary" },
          { label:"Active",             value:active,           icon:CheckCircle2,  color:"text-emerald-500" },
          { label:"Awaiting PM",        value:noPM.length,      icon:AlertCircle,   color:"text-amber-500" },
          { label:"Completed",          value:completed,        icon:UserCheck,     color:"text-blue-500" },
        ].map(s=>(
          <motion.div key={s.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
              <s.icon size={15} className={s.color} strokeWidth={1.5}/>
            </div>
            <span className="text-xl font-bold font-mono">{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Unassigned PM banner */}
      {noPM.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0"/>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{noPM.length}</strong> project{noPM.length>1?"s":""} have no Project Manager assigned.
          </p>
        </div>
      )}

      {/* Project Manager Assignment Table */}
      <div className="surface-elevated overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold">All Projects</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Click a project row to manage its tasks. Assign Project Managers and track project health.</p>
          </div>
          <button onClick={()=>setShowCreate(true)} className="flex items-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
            <Plus size={13}/> New Project
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Project","Client","Status","Project Manager","Lead","Team","Deadline",""].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p,i)=>{
                const pm   = allUsers.find(u=>u.id===p.pmId);
                const lead = allUsers.find(u=>u.id===p.leadId);
                const isSelected = selectedProjectId === p.id;
                return (
                  <motion.tr key={p.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}
                    className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${isSelected ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
                    onClick={() => setSelectedProjectId(isSelected ? null : p.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isSelected && <ListTodo size={13} className="text-primary flex-shrink-0"/>}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.client}</td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${statusCls[p.status]}`}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      {pm ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center flex-shrink-0"><span className="text-[8px] font-bold text-white">{pm.initials}</span></div>
                          <span className="text-sm">{pm.name}</span>
                        </div>
                      ) : (
                        <button onClick={(e)=>{e.stopPropagation();setAssignTarget(p.id)}} className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline flex items-center gap-1">
                          <Plus size={11}/> Assign PM
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{lead ? lead.name : <span className="text-[11px] text-muted-foreground/60 italic">Not assigned</span>}</td>
                    <td className="px-4 py-3"><span className="text-sm font-mono">{p.members.length}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.deadline}</td>
                    <td className="px-4 py-3">
                      <button onClick={(e)=>{e.stopPropagation();setAssignTarget(p.id)}} className="text-[11px] text-primary font-medium hover:underline">
                        {pm ? "Reassign PM" : "Assign PM"}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Task Board for selected project ── */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
            {/* Task board header */}
            <div className="surface-elevated p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ListTodo size={16} className="text-primary"/>
                    <h3 className="font-semibold text-sm">Task Board — {selectedProject.name}</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {projectTasks.length} tasks &middot; {projectTasks.filter(t => t.status !== "DONE").length} active &middot; {selectedProject.members.length} members
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                    <input
                      type="text"
                      placeholder="Search tasks…"
                      className="bg-muted rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 ring-primary/20 w-48"
                      value={taskSearch}
                      onChange={e => setTaskSearch(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => navigate(`/tasks?projectId=${selectedProject.id}`)}
                    title="Open this project's tasks in the cross-project hub — filter, bulk-assign, reassign"
                    className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                    <UserCheck size={13}/> Bulk assign
                  </button>
                  <button onClick={() => setShowCreateTask(true)} className="flex items-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
                    <Plus size={13}/> New Task
                  </button>
                </div>
              </div>
            </div>

            {/* Kanban columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map(col => {
                const colTasks = filteredTasks.filter(t => t.status === col.status);
                return (
                  <div key={col.status} className={`surface-elevated border-t-2 ${col.cls} rounded-2xl overflow-hidden`}>
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-semibold">{col.label}</span>
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
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
                                const next: Record<string, TaskStatus> = { TODO: "IN_PROGRESS", IN_PROGRESS: "IN_REVIEW", IN_REVIEW: "DONE", DONE: "DONE" };
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed project table (existing component) */}
      <div className="surface-elevated p-5">
        <h3 className="text-sm font-semibold mb-4">Technical Details</h3>
        <OngoingProjects />
      </div>

      {/* Assign PM modal */}
      {assignTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Assign Project Manager</h3>
              <button onClick={()=>setAssignTarget(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
            </div>
            <div className="p-4 space-y-2">
              {pmUsers.map(pm=>(
                <button key={pm.id} onClick={()=>handleAssignPM(pm.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"><span className="text-[10px] font-bold text-white">{pm.initials}</span></div>
                  <div><p className="text-sm font-medium">{pm.name}</p><p className="text-[11px] text-muted-foreground">{pm.email}</p></div>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_LABELS[pm.role].cls}`}>{ROLE_LABELS[pm.role].label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Create Project</h3>
              <button onClick={()=>setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
            </div>
            <div className="p-5 space-y-4">
              {([
                {label:"Project Name",  field:"name",        ph:"E-Commerce Platform"},
                {label:"Client",        field:"client",      ph:"MegaMart"},
                {label:"Description",   field:"description", ph:"Brief description…"},
                {label:"Deadline",      field:"deadline",    ph:"",type:"date"},
              ] as {label:string;field:keyof typeof form;ph:string;type?:string}[]).map(({label,field,ph,type})=>(
                <div key={field}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
                  <input type={type||"text"} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    placeholder={ph} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Assign Project Manager</label>
                <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  value={form.pmId} onChange={e=>setForm(f=>({...f,pmId:e.target.value}))}>
                  <option value="">Select PM…</option>
                  {pmUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={()=>setShowCreate(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!form.name||!form.client}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                Create Project
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Create Task modal ── */}
      {showCreateTask && selectedProjectId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === "Escape") setShowCreateTask(false); }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-semibold text-sm">Create Task</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{selectedProject?.name}</p>
              </div>
              <button onClick={() => setShowCreateTask(false)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
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
                  <p className="text-[10px] text-muted-foreground mt-1">No assignable members in this project yet. Add members to the project first.</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setShowCreateTask(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
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
                        {i < historyLogs.length - 1 && (
                          <div className="absolute left-[7px] top-5 bottom-[-12px] w-px bg-border" />
                        )}
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
