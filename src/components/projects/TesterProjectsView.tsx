import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X, Bug, CheckSquare } from "lucide-react";
import { useProjects, BugSeverity, BugStatus } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "tasks" | "bugs";

const bugStatusCls: Record<BugStatus, string> = {
  open:        "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  assigned:    "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_review:   "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  verified:    "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
  closed:      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const severityCls: Record<BugSeverity, string> = {
  low:      "bg-gray-100 text-gray-500",
  medium:   "bg-amber-50 text-amber-600",
  high:     "bg-orange-50 text-orange-600",
  critical: "bg-red-50 text-red-600",
};

const taskStatusCls: Record<string, string> = {
  todo:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_review:   "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  done:        "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export function TesterProjectsView() {
  const { projects, tasks, bugs, reportBug, updateBugStatus } = useProjects();
  const { user } = useAuth();

  const [tab, setTab]         = useState<Tab>("tasks");
  const [showReport, setShowReport] = useState(false);
  const [bugForm, setBugForm] = useState<{
    title: string; description: string; severity: BugSeverity; taskId: string; projectId: string;
  }>({ title: "", description: "", severity: "medium", taskId: "", projectId: "" });

  // Tasks assigned to this tester
  const myTasks = tasks.filter(t => t.assigneeId === user?.id);

  // Bugs reported by this tester
  const myBugs  = bugs.filter(b => b.reportedBy === user?.id);
  const openCount = myBugs.filter(b => b.status === "open").length;

  // Projects this tester is a member of
  const myProjects = projects.filter(p => p.members.some(m => m.user.id === user?.id));

  // Tasks in those projects (for bug link dropdown)
  const availableTasks = tasks.filter(t => myProjects.some(p => p.id === t.projectId));

  const handleReport = () => {
    reportBug({
      projectId:  bugForm.projectId || (myProjects[0]?.id ?? ""),
      taskId:     bugForm.taskId || null,
      title:      bugForm.title,
      description: bugForm.description,
      severity:   bugForm.severity,
      status:     "open",
      reportedBy: user!.id,
      assignedTo: null,
    });
    setShowReport(false);
    setBugForm({ title: "", description: "", severity: "medium", taskId: "", projectId: "" });
  };

  const tabs = [
    { key: "tasks" as Tab, label: "My Tasks",      badge: myTasks.length },
    { key: "bugs"  as Tab, label: "Reported Bugs", badge: openCount > 0 ? openCount : undefined },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Assigned Tasks", value: myTasks.length,                                       color: "text-primary" },
          { label: "Bugs Reported",  value: myBugs.length,                                        color: "text-red-500" },
          { label: "Bugs Verified",  value: myBugs.filter(b => b.status === "verified").length,   color: "text-teal-500" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">{s.label}</span>
            <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Tabs + action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              {t.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${t.key === "bugs" && openCount > 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
        {tab === "bugs" && (
          <button onClick={() => setShowReport(true)} className="flex items-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
            <Plus size={13}/> Report Bug
          </button>
        )}
      </div>

      {/* ── TASKS TAB ── */}
      {tab === "tasks" && (
        <div className="space-y-3">
          {myTasks.length === 0 && (
            <div className="surface-elevated py-16 text-center">
              <CheckSquare size={32} className="text-muted-foreground/30 mx-auto mb-3" strokeWidth={1}/>
              <p className="text-sm text-muted-foreground">No tasks assigned to you yet.</p>
            </div>
          )}
          {myTasks.map((task, i) => {
            const proj = projects.find(p => p.id === task.projectId);
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="surface-elevated p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-sm">{task.title}</h3>
                      <span className="text-[10px] text-muted-foreground font-mono">{task.id}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">{proj?.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${taskStatusCls[task.status]}`}>{task.status.replace("_", " ")}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{task.type} · {task.priority}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── BUGS TAB ── */}
      {tab === "bugs" && (
        <div className="space-y-3">
          {myBugs.length === 0 && (
            <div className="surface-elevated py-16 text-center">
              <Bug size={32} className="text-muted-foreground/30 mx-auto mb-3" strokeWidth={1}/>
              <p className="text-sm text-muted-foreground">No bugs reported yet. Use "Report Bug" to log an issue.</p>
            </div>
          )}
          {myBugs.map((bug, i) => {
            const proj     = projects.find(p => p.id === bug.projectId);
            const linkedTask = tasks.find(t => t.id === bug.taskId);
            return (
              <motion.div key={bug.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="surface-elevated p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-sm">{bug.title}</h3>
                      <span className="text-[10px] text-muted-foreground font-mono">{bug.id}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      {proj?.name}{linkedTask ? ` · linked to: ${linkedTask.title}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{bug.description}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${bugStatusCls[bug.status]}`}>{bug.status.replace("_", " ")}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${severityCls[bug.severity]}`}>{bug.severity}</span>
                      <span className="text-[10px] text-muted-foreground">Reported {bug.createdAt}</span>
                    </div>
                  </div>
                  {/* Allow tester to mark verified if in_review */}
                  {bug.status === "in_review" && (
                    <button onClick={() => updateBugStatus(bug.id, "verified")}
                      className="text-xs text-teal-600 font-semibold hover:underline flex-shrink-0">
                      Mark Verified
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Report Bug modal ── */}
      {showReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Report Bug</h3>
              <button onClick={() => setShowReport(false)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Project</label>
                <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  value={bugForm.projectId} onChange={e => setBugForm(f => ({ ...f, projectId: e.target.value, taskId: "" }))}>
                  <option value="">Select project…</option>
                  {myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Bug Title</label>
                <input className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="Short bug title…" value={bugForm.title} onChange={e => setBugForm(f => ({ ...f, title: e.target.value }))}/>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Description</label>
                <textarea rows={3} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                  placeholder="Steps to reproduce, expected vs actual behaviour…"
                  value={bugForm.description} onChange={e => setBugForm(f => ({ ...f, description: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Severity</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={bugForm.severity} onChange={e => setBugForm(f => ({ ...f, severity: e.target.value as BugSeverity }))}>
                    {["low","medium","high","critical"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Linked Task (optional)</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={bugForm.taskId} onChange={e => setBugForm(f => ({ ...f, taskId: e.target.value }))}>
                    <option value="">None</option>
                    {availableTasks
                      .filter(t => !bugForm.projectId || t.projectId === bugForm.projectId)
                      .map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setShowReport(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleReport} disabled={!bugForm.title || !bugForm.description}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                Submit Bug Report
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
