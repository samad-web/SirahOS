import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";

const ROLES: UserRole[] = ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER"];

const emptyForm = (): CreateUserPayload & { reportsToId: string } => ({
  name: "", email: "", password: "", role: "DEVELOPER" as UserRole, reportsToId: "",
});

type EditForm = { name: string; email: string; role: UserRole; reportsToId: string };

export default function Employees() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Edit modal
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", role: "DEVELOPER", reportsToId: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirmation
  const [deleteUser, setDeleteUser] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await usersApi.list();
      setEmployees(data);
    } catch { /* silently fail */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const debouncedSearch = useDebounce(search, 300);
  const filtered = employees.filter(e => {
    const q = debouncedSearch.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
  });

  const activeCount = employees.filter(e => e.status === "ACTIVE").length;
  const inactiveCount = employees.filter(e => e.status === "INACTIVE").length;
  const adminCount = employees.filter(e => e.role === "ADMIN").length;

  // ─── Add ────────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload: CreateUserPayload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.reportsToId ? { reportsToId: form.reportsToId } : {}),
      };
      await usersApi.create(payload);
      await fetchEmployees();
      setShowAdd(false);
      setForm(emptyForm());
      toast.success("Employee added successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to add employee";
      setError(msg);
    } finally { setSubmitting(false); }
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

  const handleEdit = async () => {
    if (!editUser) return;
    setEditSubmitting(true);
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
      await usersApi.update(editUser.id, data);
      await fetchEmployees();
      setEditUser(null);
      toast.success("Employee updated successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to update employee";
      setEditError(msg);
    } finally { setEditSubmitting(false); }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteUser.id);
      await fetchEmployees();
      setDeleteUser(null);
      toast.success("Employee deleted successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to delete employee";
      toast.error(msg);
    } finally { setDeleting(false); }
  };

  // ─── Toggle Status ──────────────────────────────────────────────────────────

  const toggleStatus = async (emp: AppUser) => {
    const newStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await usersApi.updateStatus(emp.id, newStatus);
      await fetchEmployees();
      toast.success(`Employee ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const initials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  // Managers for "reports to" dropdown
  const managers = employees.filter(e => e.status === "ACTIVE" && ["ADMIN", "PROJECT_MANAGER", "LEAD"].includes(e.role));

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
                  ) : filtered.map((emp, i) => {
                    const { label: roleLbl, cls: roleCls } = ROLE_LABELS[emp.role];
                    const isSelf = emp.id === currentUser?.id;
                    return (
                      <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
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
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${roleCls}`}>{roleLbl}</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">Add Employee</h3>
              <button onClick={() => { setShowAdd(false); setError(""); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
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
                disabled={submitting || !form.name || !form.email || !form.password || form.password.length < 8}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {submitting ? "Adding…" : "Add Employee"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Edit Employee Modal ─── */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">Edit Employee</h3>
              <button onClick={() => { setEditUser(null); setEditError(""); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
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
                disabled={editSubmitting || !editForm.name || !editForm.email}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {editSubmitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Delete Employee</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Are you sure you want to delete <span className="font-medium text-foreground">{deleteUser.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setDeleteUser(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
