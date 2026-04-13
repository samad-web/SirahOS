import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ListTodo, Search, Users, UserCheck, AlertTriangle, CheckCircle2,
  X, Filter, ChevronDown, CheckSquare, Square, Loader2,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { tasksApi, usersApi, projectsApi, type Task, type TaskFilters, type AppUser } from "@/lib/api";
import { toast } from "sonner";

// ─── Styling maps (uppercase enum values from backend) ─────────────────────

const STATUS_CFG: Record<Task["status"], { label: string; cls: string }> = {
  TODO:        { label: "To Do",       cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  IN_REVIEW:   { label: "In Review",   cls: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  DONE:        { label: "Done",        cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const PRIORITY_CFG: Record<Task["priority"], { label: string; cls: string }> = {
  LOW:      { label: "Low",      cls: "bg-gray-50 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400" },
  MEDIUM:   { label: "Medium",   cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  HIGH:     { label: "High",     cls: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  CRITICAL: { label: "Critical", cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

const UNASSIGNED = "unassigned";

// ─── Component ──────────────────────────────────────────────────────────────

export default function Tasks() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filters (synced to URL so the dashboard widget can deep-link) ─────────
  const assigneeFilter = searchParams.get("assigneeId") ?? "";
  const statusFilter   = (searchParams.get("status") ?? "") as Task["status"] | "";
  const priorityFilter = (searchParams.get("priority") ?? "") as Task["priority"] | "";
  const projectFilter  = searchParams.get("projectId") ?? "";
  const searchTerm     = searchParams.get("search") ?? "";

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const filters: TaskFilters = useMemo(() => ({
    assigneeId: assigneeFilter || undefined,
    status:     statusFilter   || undefined,
    priority:   priorityFilter || undefined,
    projectId:  projectFilter  || undefined,
    search:     searchTerm     || undefined,
    limit:      200,
  }), [assigneeFilter, statusFilter, priorityFilter, projectFilter, searchTerm]);

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["tasks", "cross-project", filters],
    queryFn: () => tasksApi.listAll(filters).then(r => r.data),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list().then(r => r.data),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list().then(r => r.data),
  });

  // Assignable users = anyone except SUPER_ADMIN (who shouldn't receive work)
  const assignables = useMemo(
    () => allUsers.filter(u => u.role !== "SUPER_ADMIN" && u.status === "ACTIVE"),
    [allUsers]
  );

  // ── View mode: list vs. "my team" (grouped by assignee) ───────────────────
  type ViewMode = "list" | "team";
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const unassigned = tasks.filter(t => !t.assigneeId).length;
    const done = tasks.filter(t => t.status === "DONE").length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE").length;
    return { total, unassigned, done, overdue };
  }, [tasks]);

  // Group by assignee for "My Team" view
  const grouped = useMemo(() => {
    const map = new Map<string, { user: Pick<AppUser, "id" | "name" | "role" | "initials"> | null; tasks: Task[] }>();
    for (const t of tasks) {
      const key = t.assignee?.id ?? UNASSIGNED;
      if (!map.has(key)) {
        map.set(key, {
          user: t.assignee ? { id: t.assignee.id, name: t.assignee.name, role: t.assignee.role, initials: t.assignee.initials } : null,
          tasks: [],
        });
      }
      map.get(key)!.tasks.push(t);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a === UNASSIGNED ? -1 : b === UNASSIGNED ? 1 : 0);
  }, [tasks]);

  // ── Selection state (for bulk assign) ─────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = tasks.length > 0 && tasks.every(t => selectedIds.has(t.id));
  const anySelected = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(tasks.map(t => t.id)));
  };
  // Reset selection when filters change
  useEffect(() => { setSelectedIds(new Set()); }, [filters]);

  // ── Inline reassign ───────────────────────────────────────────────────────
  const [reassigningTaskId, setReassigningTaskId] = useState<string | null>(null);

  const reassignMut = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) =>
      tasksApi.reassign(id, { assigned_to: assigneeId }),
    onMutate: async ({ id, assigneeId }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshot = qc.getQueryData<Task[]>(["tasks", "cross-project", filters]);
      const newAssignee = allUsers.find(u => u.id === assigneeId);
      qc.setQueryData<Task[]>(["tasks", "cross-project", filters], old =>
        old?.map(t => t.id === id ? { ...t, assigneeId, assignee: newAssignee ? { id: newAssignee.id, name: newAssignee.name, initials: newAssignee.initials ?? "", role: newAssignee.role } : undefined } : t)
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(["tasks", "cross-project", filters], ctx.snapshot);
      toast.error("Failed to reassign task");
    },
    onSuccess: () => { toast.success("Task reassigned"); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setReassigningTaskId(null); },
  });

  // ── Bulk assign ───────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkNote, setBulkNote] = useState("");

  const bulkAssignMut = useMutation({
    mutationFn: ({ taskIds, assigneeId, note }: { taskIds: string[]; assigneeId: string; note?: string }) =>
      tasksApi.bulkAssign(taskIds, assigneeId, note),
    onSuccess: (res) => {
      toast.success(`Assigned ${res.data.updated} task${res.data.updated === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
      setBulkOpen(false);
      setBulkAssigneeId("");
      setBulkNote("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to bulk-assign";
      toast.error(msg);
    },
  });

  const handleBulkAssign = () => {
    if (!bulkAssigneeId || selectedIds.size === 0) return;
    bulkAssignMut.mutate({ taskIds: Array.from(selectedIds), assigneeId: bulkAssigneeId, note: bulkNote || undefined });
  };

  // ── Render a single task row ──────────────────────────────────────────────
  const TaskRow = ({ task }: { task: Task }) => {
    const isSelected = selectedIds.has(task.id);
    const isReassigning = reassigningTaskId === task.id;
    const statusCfg   = STATUS_CFG[task.status];
    const priorityCfg = PRIORITY_CFG[task.priority];
    const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";

    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
        className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
          isSelected ? "border-primary bg-primary/5" : "border-border/50 hover:border-border hover:bg-muted/30"
        }`}>
        <button onClick={() => toggleSelect(task.id)} className="flex-shrink-0" aria-label="Select task">
          {isSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted-foreground/50 hover:text-primary" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{task.title}</p>
            {overdue && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" aria-label="Overdue" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
            <button
              onClick={() => navigate(`/projects?project=${task.projectId}`)}
              className="hover:text-primary hover:underline truncate max-w-[180px]">
              {task.project?.name ?? "—"}
            </button>
            {task.dueDate && (
              <>
                <span>·</span>
                <span className={overdue ? "text-red-500 font-medium" : ""}>
                  Due {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </>
            )}
          </div>
        </div>

        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityCfg.cls}`}>{priorityCfg.label}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.cls}`}>{statusCfg.label}</span>

        {/* Inline reassign dropdown */}
        <div className="relative flex-shrink-0 w-[140px]">
          <select
            value={task.assigneeId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val && val !== task.assigneeId) {
                setReassigningTaskId(task.id);
                reassignMut.mutate({ id: task.id, assigneeId: val });
              }
            }}
            disabled={isReassigning}
            className="w-full text-xs bg-muted rounded-lg px-2 py-1.5 outline-none focus:ring-2 ring-primary/20 appearance-none pr-6 cursor-pointer">
            {!task.assigneeId && <option value="">Unassigned</option>}
            {assignables.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {isReassigning
            ? <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none" />
            : <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />}
        </div>
      </motion.div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const activeFilterCount = [assigneeFilter, statusFilter, priorityFilter, projectFilter, searchTerm].filter(Boolean).length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader
          placeholder="Search tasks…"
          search={searchTerm}
          onSearch={(val) => setFilter("search", val)}
        />

        <div className="p-6 space-y-5 max-w-[1400px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
              <p className="text-sm text-muted-foreground mt-1">Cross-project task management and assignment.</p>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <button onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                All Tasks
              </button>
              <button onClick={() => setViewMode("team")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === "team" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                My Team
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total",      value: stats.total,      icon: ListTodo,     color: "text-primary" },
              { label: "Unassigned", value: stats.unassigned, icon: Users,        color: "text-amber-500",
                onClick: () => setFilter("assigneeId", assigneeFilter === UNASSIGNED ? "" : UNASSIGNED) },
              { label: "Completed",  value: stats.done,       icon: CheckCircle2, color: "text-emerald-500" },
              { label: "Overdue",    value: stats.overdue,    icon: AlertTriangle, color: "text-red-500" },
            ].map(stat => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={stat.onClick}
                className={`surface-elevated p-5 ${stat.onClick ? "cursor-pointer hover:ring-2 ring-primary/20 transition-all" : ""} ${
                  stat.label === "Unassigned" && assigneeFilter === UNASSIGNED ? "ring-2 ring-primary" : ""
                }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                  <stat.icon size={15} className={stat.color} strokeWidth={1.5} />
                </div>
                <span className="text-xl font-bold font-mono tabular-nums">{stat.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="surface-elevated p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-muted-foreground flex-shrink-0" />

              <select value={projectFilter} onChange={e => setFilter("projectId", e.target.value)}
                className="text-xs bg-muted rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-primary/20">
                <option value="">All projects</option>
                {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <select value={assigneeFilter} onChange={e => setFilter("assigneeId", e.target.value)}
                className="text-xs bg-muted rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-primary/20">
                <option value="">All assignees</option>
                <option value={UNASSIGNED}>Unassigned</option>
                {assignables.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>

              <select value={statusFilter} onChange={e => setFilter("status", e.target.value)}
                className="text-xs bg-muted rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-primary/20">
                <option value="">All statuses</option>
                {(Object.keys(STATUS_CFG) as Task["status"][]).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
              </select>

              <select value={priorityFilter} onChange={e => setFilter("priority", e.target.value)}
                className="text-xs bg-muted rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-primary/20">
                <option value="">All priorities</option>
                {(Object.keys(PRIORITY_CFG) as Task["priority"][]).map(p => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
              </select>

              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1 ml-auto">
                  <X size={12} /> Clear ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Selection toolbar */}
            {tasks.length > 0 && (
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  {allSelected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
                {anySelected && (
                  <>
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                    <button onClick={() => setBulkOpen(true)}
                      className="ml-auto flex items-center gap-1.5 gradient-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
                      <UserCheck size={13} /> Bulk assign
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Task list / My Team grouped view */}
          {loadingTasks ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="surface-elevated p-12 text-center">
              <ListTodo size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
              <p className="text-sm font-medium text-muted-foreground">No tasks found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {activeFilterCount > 0 ? "Try adjusting your filters." : "Create tasks from the Projects page."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {tasks.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([key, { user, tasks: userTasks }]) => (
                <div key={key} className="surface-elevated overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-white">
                        {user ? (user.initials || user.name.slice(0, 2).toUpperCase()) : "?"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{user ? user.name : "Unassigned"}</p>
                      {user && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_LABELS[user.role].cls}`}>
                          {ROLE_LABELS[user.role].label}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {userTasks.length} task{userTasks.length === 1 ? "" : "s"}
                      {" · "}
                      {userTasks.filter(t => t.status === "DONE").length} done
                    </span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {userTasks.map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ─── Bulk Assign Modal ─── */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">Bulk assign {selectedIds.size} task{selectedIds.size === 1 ? "" : "s"}</h3>
              <button onClick={() => setBulkOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Assign to</label>
                <select
                  autoFocus
                  value={bulkAssigneeId}
                  onChange={e => setBulkAssigneeId(e.target.value)}
                  className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20">
                  <option value="">Select a user…</option>
                  {assignables.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({ROLE_LABELS[u.role].label})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Note (optional)</label>
                <textarea
                  rows={2}
                  value={bulkNote}
                  onChange={e => setBulkNote(e.target.value)}
                  placeholder="Why are these being reassigned?"
                  className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none" />
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <Search size={12} className="flex-shrink-0 mt-0.5" />
                <span>You can only assign to users you have permission over. If any task fails the permission check, the entire batch is rejected.</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setBulkOpen(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssigneeId || bulkAssignMut.isPending}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {bulkAssignMut.isPending ? "Assigning…" : `Assign ${selectedIds.size} task${selectedIds.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Prevent the unused variable warning since currentUser is reserved for future "assign to self" button */}
      <span className="hidden">{currentUser?.id}</span>
    </div>
  );
}
