import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, Users, UserCheck, UserX, Shield,
  X, Mail, Pencil, Trash2, ChevronDown,
} from "lucide-react";
import { usersApi, AppUser, UserRole, CreateUserPayload } from "@/lib/api";
import { ROLE_LABELS } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { toast } from "sonner";

const ROLES: UserRole[] = ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER", "EDITOR", "DIGITAL_MARKETER"];

const emptyForm = (): CreateUserPayload & { reportsToId: string } => ({
  name: "", email: "", password: "", role: "DEVELOPER" as UserRole, reportsToId: "",
});

type EditForm = { name: string; email: string; role: UserRole; reportsToId: string };

export default function Employees() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  // Edit modal
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", role: "DEVELOPER", reportsToId: "" });
  const [editError, setEditError] = useState("");

  // Delete confirmation
  const [deleteUser, setDeleteUser] = useState<AppUser | null>(null);

  // Role-switch confirmation
  const [roleSwitch, setRoleSwitch] = useState<{ emp: AppUser; newRole: UserRole } | null>(null);

  // Focus traps for the four modals. useFocusTrap returns a ref that must
  // be attached to the modal root div (or a noop ref when inactive).
  const addModalRef    = useFocusTrap<HTMLDivElement>(showAdd,           () => { setShowAdd(false); setError(""); });
  const editModalRef   = useFocusTrap<HTMLDivElement>(!!editUser,        () => { setEditUser(null); setEditError(""); });
  const roleModalRef   = useFocusTrap<HTMLDivElement>(!!roleSwitch,      () => setRoleSwitch(null));
  const deleteModalRef = useFocusTrap<HTMLDivElement>(!!deleteUser,      () => setDeleteUser(null));

  const qc = useQueryClient();
  const { data: employees = [], isLoading: loading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => usersApi.list().then(r => r.data),
  });

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => employees.filter(e => {
    const q = debouncedSearch.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
  }), [employees, debouncedSearch]);

  const { activeCount, inactiveCount, adminCount } = useMemo(() => ({
    activeCount: employees.filter(e => e.status === "ACTIVE").length,
    inactiveCount: employees.filter(e => e.status === "INACTIVE").length,
    adminCount: employees.filter(e => e.role === "ADMIN").length,
  }), [employees]);

  // ─── Add ────────────────────────────────────────────────────────────────────

  const addMut = useMutation({
    mutationFn: (p: CreateUserPayload) => usersApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const handleAdd = async () => {
    setError("");
    try {
      const payload: CreateUserPayload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.reportsToId ? { reportsToId: form.reportsToId } : {}),
      };
      await addMut.mutateAsync(payload);
      setShowAdd(false);
      setForm(emptyForm());
      toast.success("Employee added successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to add employee";
      setError(msg);
    }
  };

  // ─── Edit ───────────────────────────────────────────────────────────────────

  const openEdit = (emp: AppUser) => {
    setEditUser(emp);
    setEditForm({
      name: emp.name,
      email: emp.email,
      role: emp.role,
      reportsToId: emp.reportsToId ?? "",
    });
    setEditError("");
  };

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => usersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const handleEdit = async () => {
    if (!editUser) return;
    setEditError("");
    try {
      const data: Record<string, unknown> = {};
      if (editForm.name !== editUser.name) data.name = editForm.name;
      if (editForm.email !== editUser.email) data.email = editForm.email;
      if (editForm.role !== editUser.role) data.role = editForm.role;
      const newReportsTo = editForm.reportsToId || null;
      if (newReportsTo !== (editUser.reportsToId ?? null)) data.reportsToId = newReportsTo;

      if (Object.keys(data).length === 0) {
        setEditUser(null);
        return;
      }
      await editMut.mutateAsync({ id: editUser.id, data });
      setEditUser(null);
      toast.success("Employee updated successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to update employee";
      setEditError(msg);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["employees"] });
      const prev = qc.getQueryData<AppUser[]>(["employees"]);
      qc.setQueryData<AppUser[]>(["employees"], old => old?.filter(e => e.id !== id));
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData(["employees"], context.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      await deleteMut.mutateAsync(deleteUser.id);
      setDeleteUser(null);
      toast.success("Employee deleted successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to delete employee";
      toast.error(msg);
    }
  };

  // ─── Inline Role Switch ─────────────────────────────────────────────────────

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => usersApi.update(id, { role }),
    onMutate: async ({ id, role }) => {
      await qc.cancelQueries({ queryKey: ["employees"] });
      const prev = qc.getQueryData<AppUser[]>(["employees"]);
      qc.setQueryData<AppUser[]>(["employees"], old =>
        old?.map(e => e.id === id ? { ...e, role } : e)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(["employees"], context.prev);
      toast.error("Failed to update role");
    },
    onSuccess: () => toast.success("Role updated"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const handleRoleSwitch = (emp: AppUser, newRole: UserRole) => {
    if (newRole === emp.role) return;
    // Stage the change — actual mutation runs after confirmation.
    setRoleSwitch({ emp, newRole });
  };

  const confirmRoleSwitch = () => {
    if (!roleSwitch) return;
    roleMut.mutate({ id: roleSwitch.emp.id, role: roleSwitch.newRole });
    setRoleSwitch(null);
  };

  // ─── Toggle Status ──────────────────────────────────────────────────────────

  const toggleMut = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: AppUser["status"] }) => usersApi.updateStatus(id, newStatus),
    onMutate: async ({ id, newStatus }) => {
      await qc.cancelQueries({ queryKey: ["employees"] });
      const prev = qc.getQueryData<AppUser[]>(["employees"]);
      qc.setQueryData<AppUser[]>(["employees"], old =>
        old?.map(e => e.id === id ? { ...e, status: newStatus } : e)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(["employees"], context.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const toggleStatus = async (emp: AppUser) => {
    const newStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await toggleMut.mutateAsync({ id: emp.id, newStatus });
      toast.success(`Employee ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const initials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  // Managers for "reports to" dropdown
  const managers = useMemo(() => employees.filter(e => e.status === "ACTIVE" && ["ADMIN", "PROJECT_MANAGER", "LEAD"].includes(e.role)), [employees]);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search employees…" search={search} onSearch={setSearch} />

        <div className="p-6 space-y-5 max-w-[1400px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Employees</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage team members, roles, and access.</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm">
              <Plus size={15} /> Add Employee
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Employees", value: employees.length, icon: Users, color: "text-primary" },
              { label: "Active", value: activeCount, icon: UserCheck, color: "text-emerald-500" },
              { label: "Inactive", value: inactiveCount, icon: UserX, color: "text-red-500" },
              { label: "Admins", value: adminCount, icon: Shield, color: "text-violet-500" },
            ].map(stat => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                  <stat.icon size={15} className={stat.color} strokeWidth={1.5} />
                </div>
                <span className="text-xl font-bold font-mono tabular-nums">{stat.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Table */}
          <div className="surface-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Employee", "Email", "Role", "Reports To", "Status", "Joined", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-4"><div className="h-4 bg-muted rounded-lg animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.map((emp) => {
                    const { label: roleLbl, cls: roleCls } = ROLE_LABELS[emp.role];
                    const isSelf = emp.id === currentUser?.id;
                    // Role can only be changed by the person the user reports to,
                    // or by a Super Admin (who can change anyone).
                    const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
                    const isReportsTo = emp.reportsToId === currentUser?.id;
                    const canChangeRole = !isSelf && (isSuperAdmin || isReportsTo);
                    return (
                      <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{duration:0.15}} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-white">{emp.initials || initials(emp.name)}</span>
                            </div>
                            <div>
                              <p className="font-medium">{emp.name}</p>
                              {isSelf && <span className="text-[10px] text-muted-foreground">(You)</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={10} />{emp.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative inline-block">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${roleCls} ${
                                canChangeRole ? "cursor-pointer hover:ring-2 hover:ring-primary/20 transition" : "opacity-60"
                              }`}
                              title={isSelf ? "You cannot change your own role" : !canChangeRole ? "Only the person this user reports to can change their role" : "Click to change role"}
                            >
                              {roleLbl}
                              {canChangeRole && <ChevronDown size={10} strokeWidth={2.5} />}
                            </span>
                            {canChangeRole && (
                              <select
                                aria-label={`Change role for ${emp.name}`}
                                disabled={roleMut.isPending}
                                value={emp.role}
                                onChange={e => handleRoleSwitch(emp, e.target.value as UserRole)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              >
                                {ROLES.map(r => (
                                  <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {emp.reportsTo ? emp.reportsTo.name : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => !isSelf && toggleStatus(emp)}
                            disabled={isSelf}
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                              emp.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                            } ${isSelf ? "cursor-default opacity-60" : "cursor-pointer"}`}
                          >
                            {emp.status === "ACTIVE" ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(emp)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Edit employee"
                            >
                              <Pencil size={13} />
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => setDeleteUser(emp)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500"
                                title="Delete employee"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-16 text-center">
                      <Users size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
                      <p className="text-sm font-medium text-muted-foreground">No employees found</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 mb-3">{search ? "Try adjusting your search." : "Add your first employee to get started."}</p>
                      {!search && <button onClick={() => setShowAdd(true)} className="text-xs text-primary font-semibold hover:underline">+ Add Employee</button>}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Add Employee Modal ─── */}
      {showAdd && (
        <div ref={addModalRef} role="dialog" aria-modal="true" aria-labelledby="add-employee-title" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 id="add-employee-title" className="font-semibold">Add Employee</h3>
              <button onClick={() => { setShowAdd(false); setError(""); }} aria-label="Close add employee dialog" className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} aria-hidden /></button>
            </div>
            <div className="p-6 space-y-4">
              {([
                { label: "Full Name", field: "name" as const, ph: "Employee name", type: "text" },
                { label: "Email", field: "email" as const, ph: "employee@company.com", type: "email" },
                { label: "Password", field: "password" as const, ph: "Min 8 characters", type: "password" },
              ]).map(({ label, field, ph, type }, idx) => (
                <div key={field}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">{label}</label>
                  <input type={type} autoFocus={idx === 0} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    placeholder={ph} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}

              {/* Role select */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Role</label>
                <div className="relative">
                  <select
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 appearance-none cursor-pointer"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Reports To */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Reports To</label>
                <div className="relative">
                  <select
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 appearance-none cursor-pointer"
                    value={form.reportsToId}
                    onChange={e => setForm(f => ({ ...f, reportsToId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role].label})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                  {error}
                </motion.p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => { setShowAdd(false); setError(""); }} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleAdd}
                disabled={addMut.isPending || !form.name || !form.email || !form.password || form.password.length < 8}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {addMut.isPending ? "Adding…" : "Add Employee"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Edit Employee Modal ─── */}
      {editUser && (
        <div ref={editModalRef} role="dialog" aria-modal="true" aria-labelledby="edit-employee-title" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 id="edit-employee-title" className="font-semibold">Edit Employee</h3>
              <button onClick={() => { setEditUser(null); setEditError(""); }} aria-label="Close edit employee dialog" className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} aria-hidden /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Full Name</label>
                <input type="text" autoFocus className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="Employee name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Email</label>
                <input type="email" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="employee@company.com" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Role</label>
                <div className="relative">
                  <select
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 appearance-none cursor-pointer"
                    value={editForm.role}
                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Reports To</label>
                <div className="relative">
                  <select
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 appearance-none cursor-pointer"
                    value={editForm.reportsToId}
                    onChange={e => setEditForm(f => ({ ...f, reportsToId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {managers.filter(m => m.id !== editUser.id).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role].label})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {editError && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                  {editError}
                </motion.p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => { setEditUser(null); setEditError(""); }} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleEdit}
                disabled={editMut.isPending || !editForm.name || !editForm.email}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {editMut.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Role Switch Confirmation Modal ─── */}
      {roleSwitch && (() => {
        const fromLabel = ROLE_LABELS[roleSwitch.emp.role].label;
        const toLabel = ROLE_LABELS[roleSwitch.newRole].label;
        const isPrivilegedChange =
          roleSwitch.emp.role === "ADMIN" ||
          roleSwitch.newRole === "ADMIN" ||
          roleSwitch.emp.role === "SUPER_ADMIN" ||
          roleSwitch.newRole === "SUPER_ADMIN";
        return (
          <div ref={roleModalRef} role="dialog" aria-modal="true" aria-labelledby="role-switch-title" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-6 space-y-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${isPrivilegedChange ? "bg-amber-50 dark:bg-amber-900/20" : "bg-primary/10"}`} aria-hidden>
                  <Shield size={20} className={isPrivilegedChange ? "text-amber-500" : "text-primary"} />
                </div>
                <div className="text-center">
                  <h3 id="role-switch-title" className="font-semibold text-lg">Change Role</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Change <span className="font-medium text-foreground">{roleSwitch.emp.name}</span>'s role from{" "}
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_LABELS[roleSwitch.emp.role].cls}`}>{fromLabel}</span>{" "}
                    to{" "}
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_LABELS[roleSwitch.newRole].cls}`}>{toLabel}</span>?
                  </p>
                  {isPrivilegedChange && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                      This affects administrative privileges. Double-check before confirming.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
                <button onClick={() => setRoleSwitch(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
                <button onClick={confirmRoleSwitch}
                  disabled={roleMut.isPending}
                  className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                  {roleMut.isPending ? "Updating…" : "Change Role"}
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteUser && (
        <div ref={deleteModalRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-employee-title" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto" aria-hidden>
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div className="text-center">
                <h3 id="delete-employee-title" className="font-semibold text-lg">Delete Employee</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Are you sure you want to delete <span className="font-medium text-foreground">{deleteUser.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setDeleteUser(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleDelete}
                disabled={deleteMut.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
