import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User, Mail, Shield, Clock, Calendar, Key,
  Pencil, Save, X, Loader2, Check, Eye, EyeOff,
  FolderKanban, ListChecks, Users, AlertTriangle, Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth, ROLE_LABELS, ROUTE_ACCESS } from "@/contexts/AuthContext";
import { usersApi, finesApi } from "@/lib/api";
import type { UserProfile, Fine, FineUserSummary } from "@/lib/api";

// ─── Permission matrix by role ───────────────────────────────────────────────

const PERMISSION_GROUPS: { label: string; permissions: { name: string; roles: string[] }[] }[] = [
  {
    label: "Dashboard & Reports",
    permissions: [
      { name: "View dashboard & analytics", roles: ["ADMIN"] },
      { name: "View revenue reports", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Projects & Tasks",
    permissions: [
      { name: "Create projects", roles: ["ADMIN"] },
      { name: "Manage project teams", roles: ["ADMIN", "PROJECT_MANAGER", "LEAD"] },
      { name: "Create & assign tasks", roles: ["ADMIN", "PROJECT_MANAGER", "LEAD"] },
      { name: "View assigned tasks", roles: ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER"] },
      { name: "Report bugs", roles: ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER"] },
    ],
  },
  {
    label: "Billing & Finance",
    permissions: [
      { name: "Manage customers", roles: ["ADMIN"] },
      { name: "Create & edit invoices", roles: ["ADMIN"] },
      { name: "View ledger", roles: ["ADMIN"] },
      { name: "Manage expenses", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Administration",
    permissions: [
      { name: "Manage users", roles: ["ADMIN"] },
      { name: "Access settings", roles: ["ADMIN", "PROJECT_MANAGER"] },
      { name: "Purge data", roles: ["ADMIN"] },
      { name: "View leads", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Attendance & Leaves",
    permissions: [
      { name: "Mark own attendance", roles: ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER"] },
      { name: "View team attendance", roles: ["ADMIN", "PROJECT_MANAGER", "LEAD"] },
      { name: "Approve leave requests", roles: ["ADMIN", "PROJECT_MANAGER", "LEAD"] },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeSince(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

// ─── Accessible Routes ──────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/attendance": "Attendance",
  "/invoices": "Invoices",
  "/customers": "Customers",
  "/expenses": "Expenses",
  "/ledger": "Ledger",
  "/notes": "Notes",
  "/leads": "Leads",
  "/settings": "Settings",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Profile() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: () => usersApi.profile().then(r => r.data),
    staleTime: 60_000,
  });

  // Edit name
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // Change password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (profile) setNameValue(profile.name);
  }, [profile]);

  const role = profile?.role ?? authUser?.role ?? "DEVELOPER";
  const { label: roleLabel, cls: roleCls } = ROLE_LABELS[role];

  // Fines data (non-admin users see their own fines)
  const { data: fineSummary } = useQuery<FineUserSummary>({
    queryKey: ["fines", "my-summary"],
    queryFn: () => finesApi.mySummary().then(r => r.data),
    staleTime: 60_000,
    enabled: role !== "ADMIN",
  });

  const { data: myFines = [] } = useQuery<Fine[]>({
    queryKey: ["fines", "mine"],
    queryFn: () => finesApi.list().then(r => r.data),
    staleTime: 60_000,
    enabled: role !== "ADMIN",
  });

  const accessibleRoutes = Object.entries(ROUTE_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([path]) => ROUTE_LABELS[path] ?? path)
    .filter(Boolean);

  // Save name
  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue === profile?.name) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    try {
      await usersApi.updateProfile({ name: nameValue.trim() });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Name updated");
      setEditingName(false);
    } catch {
      toast.error("Failed to update name");
    } finally {
      setNameSaving(false);
    }
  };

  // Save password
  const handleSavePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwSaving(true);
    try {
      await usersApi.updateProfile({ currentPassword, newPassword });
      toast.success("Password changed successfully");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to change password";
      toast.error(msg);
    } finally {
      setPwSaving(false);
    }
  };

  // Stats
  const counts = profile?._count;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search..." />

        <div className="p-6 space-y-5 max-w-4xl">
          {isLoading ? (
            <div className="space-y-5 animate-pulse">
              {/* Header skeleton */}
              <div className="surface-elevated overflow-hidden">
                <div className="h-24 bg-muted" />
                <div className="px-6 pb-6 -mt-10">
                  <div className="flex items-end gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-muted border-4 border-background" />
                    <div className="flex-1 pb-1 space-y-2">
                      <div className="h-5 w-40 bg-muted rounded-lg" />
                      <div className="h-3 w-52 bg-muted rounded-lg" />
                    </div>
                    <div className="flex gap-2 pb-1">
                      <div className="h-6 w-20 bg-muted rounded-full" />
                      <div className="h-6 w-16 bg-muted rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left column skeletons */}
                <div className="lg:col-span-2 space-y-5">
                  <div className="surface-elevated p-5 space-y-4">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-muted flex-shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-2.5 w-16 bg-muted rounded" />
                            <div className="h-3.5 w-28 bg-muted rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="surface-elevated p-5 space-y-3">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-12 bg-muted rounded-xl" />
                  </div>
                </div>
                {/* Right column skeletons */}
                <div className="space-y-5">
                  <div className="surface-elevated p-5 space-y-3">
                    <div className="h-4 w-32 bg-muted rounded" />
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="h-3 w-24 bg-muted rounded" />
                        <div className="h-4 w-8 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="surface-elevated p-5 space-y-2">
                    <div className="h-4 w-36 bg-muted rounded" />
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-6 w-16 bg-muted rounded-lg" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : profile ? (
            <>
              {/* ─── Header Card ─── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated overflow-hidden">
                <div className="h-24 gradient-primary relative" />
                <div className="px-6 pb-6 -mt-10">
                  <div className="flex items-end gap-4">
                    <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center border-4 border-background shadow-lg flex-shrink-0">
                      <span className="text-2xl font-bold text-white">{profile.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2">
                        {editingName ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              className="text-xl font-bold bg-muted rounded-lg px-2 py-1 outline-none focus:ring-2 ring-primary/20"
                              value={nameValue}
                              onChange={e => setNameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                            />
                            <button onClick={handleSaveName} disabled={nameSaving} className="p-1.5 rounded-lg hover:bg-muted text-primary">
                              {nameSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button onClick={() => { setEditingName(false); setNameValue(profile.name); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h2 className="text-xl font-bold truncate">{profile.name}</h2>
                            <button onClick={() => setEditingName(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit name">
                              <Pencil size={13} />
                            </button>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${roleCls}`}>{roleLabel}</span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                        profile.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}>{profile.status.toLowerCase()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* ─── Left Column: Info + Security ─── */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Account Details */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="surface-elevated p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><User size={14} /> Account Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { icon: Mail, label: "Email", value: profile.email },
                        { icon: Shield, label: "Role", value: roleLabel },
                        { icon: Users, label: "Reports To", value: profile.reportsTo?.name ?? "None" },
                        { icon: Calendar, label: "Member Since", value: formatDate(profile.createdAt) },
                        { icon: Clock, label: "Last Updated", value: formatDateTime(profile.updatedAt) },
                        { icon: Clock, label: "Account Age", value: timeSince(profile.createdAt) },
                      ].map(item => (
                        <div key={item.label} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <item.icon size={14} className="text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{item.label}</p>
                            <p className="text-sm font-medium mt-0.5">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Security */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="surface-elevated p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Key size={14} /> Security</h3>
                      {!showPasswordForm && (
                        <button onClick={() => setShowPasswordForm(true)}
                          className="text-xs font-medium text-primary hover:underline">
                          Change Password
                        </button>
                      )}
                    </div>

                    {showPasswordForm ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Current Password</label>
                          <div className="relative">
                            <input
                              type={showCurrentPw ? "text" : "password"}
                              className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 pr-10"
                              value={currentPassword}
                              onChange={e => setCurrentPassword(e.target.value)}
                              placeholder="Enter current password"
                            />
                            <button onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1.5">New Password</label>
                          <div className="relative">
                            <input
                              type={showNewPw ? "text" : "password"}
                              className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 pr-10"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              placeholder="Minimum 6 characters"
                            />
                            <button onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Confirm New Password</label>
                          <input
                            type="password"
                            className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                          />
                          {confirmPassword && newPassword !== confirmPassword && (
                            <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> Passwords do not match</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={handleSavePassword}
                            disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                            className="flex items-center gap-1.5 gradient-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-40">
                            {pwSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Update Password
                          </button>
                          <button onClick={() => { setShowPasswordForm(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                            className="text-xs font-medium px-4 py-2 rounded-xl hover:bg-muted">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Password is set</p>
                          <p className="text-[11px] text-muted-foreground">You can change your password anytime</p>
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Permissions */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="surface-elevated p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Shield size={14} /> Permissions</h3>
                    <div className="space-y-4">
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                          <div className="space-y-1.5">
                            {group.permissions.map(perm => {
                              const hasAccess = perm.roles.includes(role);
                              return (
                                <div key={perm.name} className="flex items-center gap-2.5">
                                  <div className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 ${
                                    hasAccess
                                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                                      : "bg-gray-100 dark:bg-gray-800"
                                  }`}>
                                    {hasAccess
                                      ? <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                                      : <X size={10} className="text-gray-400 dark:text-gray-600" />
                                    }
                                  </div>
                                  <span className={`text-xs ${hasAccess ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                    {perm.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* ─── Right Column: Stats + Navigation Access ─── */}
                <div className="space-y-5">
                  {/* Activity Stats */}
                  {counts && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="surface-elevated p-5">
                      <h3 className="text-sm font-semibold mb-4">Activity Overview</h3>
                      <div className="space-y-3">
                        {[
                          { icon: ListChecks, label: "Assigned Tasks", value: counts.assignedTasks, color: "text-blue-500" },
                          { icon: ListChecks, label: "Created Tasks", value: counts.createdTasks, color: "text-violet-500" },
                          { icon: FolderKanban, label: "Projects (Member)", value: counts.projectMemberships, color: "text-emerald-500" },
                          ...(counts.managedProjects > 0 ? [{ icon: FolderKanban, label: "Projects (PM)", value: counts.managedProjects, color: "text-teal-500" }] : []),
                          ...(counts.leadProjects > 0 ? [{ icon: FolderKanban, label: "Projects (Lead)", value: counts.leadProjects, color: "text-cyan-500" }] : []),
                        ].map(stat => (
                          <div key={stat.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <stat.icon size={14} className={stat.color} />
                              <span className="text-xs text-muted-foreground">{stat.label}</span>
                            </div>
                            <span className="text-sm font-bold font-mono">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Fines (non-admin only) */}
                  {role !== "ADMIN" && fineSummary && fineSummary.totalCount > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="surface-elevated p-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Banknote size={14} className="text-red-500" /> Fines</h3>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center">
                          <p className="text-lg font-bold font-mono text-red-500">₹{fineSummary.totalAmount.toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold font-mono text-emerald-500">₹{fineSummary.totalPaid.toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-muted-foreground">Paid</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold font-mono text-amber-500">₹{fineSummary.totalUnpaid.toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-muted-foreground">Unpaid</p>
                        </div>
                      </div>
                      {myFines.length > 0 && (
                        <div className="space-y-2 border-t border-border pt-3">
                          {myFines.slice(0, 5).map(fine => (
                            <div key={fine.id} className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{fine.reason}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(fine.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className="text-xs font-mono font-semibold text-red-500">₹{fine.amount.toLocaleString("en-IN")}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                  fine.paid
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}>{fine.paid ? "Paid" : "Due"}</span>
                              </div>
                            </div>
                          ))}
                          {myFines.length > 5 && (
                            <p className="text-[10px] text-muted-foreground text-center pt-1">+{myFines.length - 5} more</p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Accessible Modules */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="surface-elevated p-5">
                    <h3 className="text-sm font-semibold mb-3">Accessible Modules</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {accessibleRoutes.map(name => (
                        <span key={name} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-primary/5 text-primary border border-primary/10">
                          {name}
                        </span>
                      ))}
                    </div>
                  </motion.div>

                  {/* Role Description */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="surface-elevated p-5">
                    <h3 className="text-sm font-semibold mb-2">Role Description</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {role === "ADMIN" && "Full system access. Can manage users, billing, projects, leads, and all administrative functions."}
                      {role === "PROJECT_MANAGER" && "Manages projects and teams. Can assign tasks, oversee project progress, approve leaves, and access settings."}
                      {role === "LEAD" && "Leads a team within projects. Can create and assign tasks to team members, and manage team attendance."}
                      {role === "DEVELOPER" && "Works on assigned tasks within projects. Can view project boards, report bugs, and mark attendance."}
                      {role === "TESTER" && "Tests deliverables and reports bugs. Can view project boards, create bug reports, and mark attendance."}
                    </p>
                  </motion.div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">Failed to load profile.</div>
          )}
        </div>
      </main>
    </div>
  );
}
