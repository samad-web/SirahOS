import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Eye, PenLine, FileText } from "lucide-react";
import { useProjects, TaskStatus } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";

// Editor-facing view: frames TODO/IN_PROGRESS/IN_REVIEW/DONE as a content
// pipeline (Draft → Writing → Review → Published). Reuses the task/status
// model without inventing a new backend schema.

const statusCls: Record<TaskStatus, string> = {
  TODO:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  IN_PROGRESS: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  IN_REVIEW:   "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  DONE:        "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// Editor-specific labels mapped on top of generic task statuses
const editorLabel: Record<TaskStatus, string> = {
  TODO:        "Draft",
  IN_PROGRESS: "Writing",
  IN_REVIEW:   "In Review",
  DONE:        "Published",
};

const nextStatus: Record<TaskStatus, TaskStatus | null> = {
  TODO:        "IN_PROGRESS",
  IN_PROGRESS: "IN_REVIEW",
  IN_REVIEW:   "DONE",
  DONE:        null,
};

const nextLabel: Record<TaskStatus, string> = {
  TODO:        "Start Writing",
  IN_PROGRESS: "Submit for Review",
  IN_REVIEW:   "Mark Published",
  DONE:        "",
};

const statusIcon: Record<TaskStatus, React.ElementType> = {
  TODO:        FileText,
  IN_PROGRESS: PenLine,
  IN_REVIEW:   Eye,
  DONE:        CheckCircle2,
};

const priorityCls: Record<string, string> = {
  LOW:      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM:   "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  HIGH:     "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-600",
  CRITICAL: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export function EditorProjectsView() {
  const { projects, tasks, updateTaskStatus } = useProjects();
  const { user } = useAuth();

  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  const myTasks  = tasks.filter(t => t.assigneeId === user?.id);
  const filtered = filter === "all" ? myTasks : myTasks.filter(t => t.status === filter);

  const counts = {
    all:         myTasks.length,
    TODO:        myTasks.filter(t => t.status === "TODO").length,
    IN_PROGRESS: myTasks.filter(t => t.status === "IN_PROGRESS").length,
    IN_REVIEW:   myTasks.filter(t => t.status === "IN_REVIEW").length,
    DONE:        myTasks.filter(t => t.status === "DONE").length,
  };

  return (
    <div className="space-y-5">
      {/* Stats — content pipeline framing */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Drafts",    value: counts.TODO,        color: "text-muted-foreground" },
          { label: "Writing",   value: counts.IN_PROGRESS, color: "text-indigo-500" },
          { label: "In Review", value: counts.IN_REVIEW,   color: "text-purple-500" },
          { label: "Published", value: counts.DONE,        color: "text-emerald-500" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">{s.label}</span>
            <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["all", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${filter === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "All Pieces" : editorLabel[f]}
            <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="surface-elevated py-16 text-center">
            <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" strokeWidth={1}/>
            <p className="text-sm text-muted-foreground">
              {filter === "DONE" ? "No published pieces yet." : "Nothing in this stage of the pipeline."}
            </p>
          </div>
        )}
        {filtered.map((task, i) => {
          const proj   = projects.find(p => p.id === task.projectId);
          const Icon   = statusIcon[task.status];
          const next   = nextStatus[task.status];
          return (
            <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="surface-elevated p-5">
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${statusCls[task.status]}`}>
                  <Icon size={14}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <h3 className="font-medium text-sm">{task.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{proj?.name} · {task.id}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${priorityCls[task.priority]}`}>{task.priority.toLowerCase()}</span>
                    </div>
                  </div>
                  {task.description && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{task.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusCls[task.status]}`}>
                      {editorLabel[task.status]}
                    </span>
                    {next && (
                      <button onClick={() => updateTaskStatus(task.id, next)}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                        {task.status === "TODO" && <PenLine size={11}/>}
                        {task.status === "IN_PROGRESS" && <Eye size={11}/>}
                        {task.status === "IN_REVIEW" && <CheckCircle2 size={11}/>}
                        {nextLabel[task.status]}
                      </button>
                    )}
                    {!next && (
                      <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                        <CheckCircle2 size={11}/> Published
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
