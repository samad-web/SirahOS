/**
 * Quick Assign Task — a global modal for admin/PM/lead to assign a task to
 * any user without creating a project first.
 *
 * Mounted once via AppSidebar. Opened via the sidebar "Assign Task" button.
 * The task lands in an auto-created "General Tasks" project on the backend,
 * and appears immediately in the assignee's "My Tasks" view.
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Send, CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { tasksApi, usersApi, type QuickTaskPayload, type AppUser, type Task } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { can, ADMIN_ROLES } from "@/lib/permissions";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

const TYPES: { value: Task["type"]; label: string }[] = [
  { value: "TASK",        label: "Task" },
  { value: "FEATURE",     label: "Feature" },
  { value: "BUG",         label: "Bug" },
  { value: "IMPROVEMENT", label: "Improvement" },
];

const PRIORITIES: { value: Task["priority"]; label: string; cls: string }[] = [
  { value: "LOW",      label: "Low",      cls: "text-gray-500" },
  { value: "MEDIUM",   label: "Medium",   cls: "text-amber-500" },
  { value: "HIGH",     label: "High",     cls: "text-orange-500" },
  { value: "CRITICAL", label: "Critical", cls: "text-red-500" },
];

const emptyForm = () => ({
  title: "",
  description: "",
  assigneeId: "",
  type: "TASK" as Task["type"],
  priority: "MEDIUM" as Task["priority"],
  dueDate: undefined as Date | undefined,
});

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuickAssignTask({ open, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const modalRef = useFocusTrap<HTMLDivElement>(open, onClose);

  // Fetch users directly when the modal opens — don't rely on allUsers
  // from context which may not have populated yet.
  useEffect(() => {
    if (!open || !user) return;
    setLoadingUsers(true);
    usersApi
      .assignable()
      .then(({ data }) => {
        // The /users/assignable endpoint already filters for ACTIVE users
        // server-side, so no need to check status here — just exclude self.
        setUsers(data.filter((u: AppUser) => u.id !== user.id));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [open, user]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setError("");
      setUserSearch("");
    }
  }, [open]);

  // Role-aware labels
  const isAdmin = user ? (ADMIN_ROLES as readonly string[]).includes(user.role) : false;
  const assignLabel = isAdmin ? "Select employee" : "Select team member";
  const subtitle = isAdmin
    ? "Assign a task to any employee — no project needed."
    : "Assign a task to a team member — no project needed.";

  // Filter users by search query
  const filteredUsers = userSearch.trim()
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.role.toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  const selectedUser = users.find((u) => u.id === form.assigneeId);

  const createMut = useMutation({
    mutationFn: (payload: QuickTaskPayload) => tasksApi.quick(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task assigned");
      setForm(emptyForm());
      setError("");
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to create task";
      setError(msg);
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!form.assigneeId) {
      setError(isAdmin ? "Select an employee to assign the task to" : "Select a team member to assign the task to");
      return;
    }
    createMut.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      assigneeId: form.assigneeId,
      type: form.type,
      priority: form.priority,
      dueDate: form.dueDate ? form.dueDate.toISOString() : undefined,
    });
  };

  if (!user || !can.assignTasks(user.role)) return null;
  if (!open) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-assign-title"
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 id="quick-assign-title" className="font-semibold">
              Assign Task
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* ─── Assign to ─���─ */}
          <div>
            <label
              className="text-xs font-medium text-muted-foreground block mb-1.5 field-required"
            >
              {assignLabel}
            </label>

            {/* Selected user preview */}
            {selectedUser && (
              <div className="flex items-center gap-2.5 bg-muted/50 border border-border rounded-xl px-3 py-2 mb-2">
                <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-white">
                    {selectedUser.initials || selectedUser.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedUser.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{selectedUser.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_LABELS[selectedUser.role].cls}`}>
                  {ROLE_LABELS[selectedUser.role].label}
                </span>
                <button
                  onClick={() => setForm((f) => ({ ...f, assigneeId: "" }))}
                  className="p-1 rounded-lg hover:bg-muted"
                  aria-label="Clear selection"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            )}

            {/* User search + list picker */}
            {!selectedUser && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                  <Search size={13} className="text-muted-foreground flex-shrink-0" aria-hidden />
                  <input
                    type="text"
                    className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground/60"
                    placeholder={`Search ${isAdmin ? "employees" : "team members"}…`}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingUsers ? (
                    <div className="px-3 py-6 text-center">
                      <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
                      <p className="text-xs text-muted-foreground mt-2">Loading…</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                      {userSearch ? "No matches found." : `No ${isAdmin ? "employees" : "team members"} available.`}
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setForm((f) => ({ ...f, assigneeId: u.id }));
                          setUserSearch("");
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-[8px] font-bold text-white">
                            {u.initials || u.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${ROLE_LABELS[u.role].cls}`}>
                          {ROLE_LABELS[u.role].label}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── Title ─── */}
          <div>
            <label
              htmlFor="qa-title"
              className="text-xs font-medium text-muted-foreground block mb-1.5 field-required"
            >
              Task title
            </label>
            <input
              id="qa-title"
              className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
              placeholder="What needs to be done?"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* ─── Description ─── */}
          <div>
            <label
              htmlFor="qa-desc"
              className="text-xs font-medium text-muted-foreground block mb-1.5"
            >
              Description
            </label>
            <textarea
              id="qa-desc"
              rows={2}
              className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
              placeholder="Details, context, links…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* ─── Type + Priority + Due date ─── */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="qa-type"
                className="text-xs font-medium text-muted-foreground block mb-1.5"
              >
                Type
              </label>
              <select
                id="qa-type"
                className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Task["type"] }))}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="qa-priority"
                className="text-xs font-medium text-muted-foreground block mb-1.5"
              >
                Priority
              </label>
              <select
                id="qa-priority"
                className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Task["priority"] }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Due date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 flex items-center gap-2 text-left ${
                      form.dueDate ? "text-foreground" : "text-muted-foreground/60"
                    }`}
                  >
                    <CalendarIcon size={13} className="flex-shrink-0" aria-hidden />
                    <span className="truncate">
                      {form.dueDate ? format(form.dueDate, "d MMM yyyy") : "Pick date"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.dueDate}
                    onSelect={(date) => setForm((f) => ({ ...f, dueDate: date ?? undefined }))}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="rounded-xl border-0"
                  />
                  {form.dueDate && (
                    <div className="px-3 pb-3">
                      <button
                        onClick={() => setForm((f) => ({ ...f, dueDate: undefined }))}
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        Clear date
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2"
              role="alert"
            >
              {error}
            </motion.p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMut.isPending || !form.title.trim() || !form.assigneeId}
            className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
          >
            {createMut.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Assigning…
              </span>
            ) : (
              <>
                <Send size={14} aria-hidden /> Assign Task
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
