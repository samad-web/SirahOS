import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Eye, Play } from "lucide-react";
import { useProjects, TaskStatus } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";

const statusCls: Record<TaskStatus, string> = {
  todo:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_review:   "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  done:        "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const priorityCls: Record<string, string> = {
  low:      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  medium:   "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  high:     "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-600",
  critical: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const nextStatus: Record<TaskStatus, TaskStatus | null> = {
  todo:        "in_progress",
  in_progress: "in_review",
  in_review:   "done",
  done:        null,
};

const nextLabel: Record<TaskStatus, string> = {
  todo:        "Start",
  in_progress: "Submit for Review",
  in_review:   "Mark Done",
  done:        "",
};

const statusIcon: Record<TaskStatus, React.ElementType> = {
  todo:        Clock,
  in_progress: Play,
  in_review:   Eye,
  done:        CheckCircle2,
};

export function DeveloperProjectsView() {
  const { projects, tasks, updateTaskStatus } = useProjects();
  const { user } = useAuth();

  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  const myTasks   = tasks.filter(t => t.assigneeId === user?.id);
  const filtered  = filter === "all" ? myTasks : myTasks.filter(t => t.status === filter);

  const counts = {
    all:         myTasks.length,
    todo:        myTasks.filter(t => t.status === "todo").length,
    in_progress: myTasks.filter(t => t.status === "in_progress").length,
    in_review:   myTasks.filter(t => t.status === "in_review").length,
    done:        myTasks.filter(t => t.status === "done").length,
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Assigned", value: counts.all,         color: "text-primary" },
          { label: "In Progress",    value: counts.in_progress,  color: "text-blue-500" },
          { label: "In Review",      value: counts.in_review,    color: "text-purple-500" },
          { label: "Completed",      value: counts.done,         color: "text-emerald-500" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">{s.label}</span>
            <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["all", "todo", "in_progress", "in_review", "done"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors capitalize ${filter === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "All Tasks" : f.replace("_", " ")}
            <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="surface-elevated py-16 text-center">
            <CheckCircle2 size={32} className="text-muted-foreground/30 mx-auto mb-3" strokeWidth={1}/>
            <p className="text-sm text-muted-foreground">
              {filter === "done" ? "No completed tasks yet." : "No tasks in this status."}
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
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${priorityCls[task.priority]}`}>{task.priority}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{task.type}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{task.description}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${statusCls[task.status]}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    {next && (
                      <button onClick={() => updateTaskStatus(task.id, next)}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                        {task.status === "todo" && <Play size={11}/>}
                        {task.status === "in_progress" && <Eye size={11}/>}
                        {task.status === "in_review" && <CheckCircle2 size={11}/>}
                        {nextLabel[task.status]}
                      </button>
                    )}
                    {!next && (
                      <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                        <CheckCircle2 size={11}/> Completed
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
