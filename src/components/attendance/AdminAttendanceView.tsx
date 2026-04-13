import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays, Users, ClipboardList, Wallet,
  CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
  Plus, AlertCircle,
} from "lucide-react";
import { attendanceApi, leavesApi, AttendanceStatus, LeaveStatus, LeaveType } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTENDANCE_META: Record<AttendanceStatus, { label: string; cls: string; dot: string }> = {
  PRESENT: { label: "Present",  cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
  ABSENT:  { label: "Absent",   cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",                  dot: "bg-red-500"     },
  HALFDAY: { label: "Half Day", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",           dot: "bg-amber-500"   },
  WFH:     { label: "WFH",      cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",               dot: "bg-blue-500"    },
};

const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; cls: string; icon: React.ElementType; dot?: string }> = {
  REQUESTED:  { label: "Requested",  cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",           icon: Clock         },
  IN_PROCESS: { label: "In Process", cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",     icon: AlertCircle   },
  APPROVED:   { label: "Approved",   cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  REJECTED:   { label: "Rejected",   cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",             icon: XCircle       },
};

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned", UNPAID: "Unpaid",
};

type Tab = "attendance" | "leaves" | "balances";

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminAttendanceView() {
  const { allUsers } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab]               = useState<Tab>("attendance");
  const [selectedUser, setSelected] = useState<string>("all");
  const [leaveFilter, setLeaveFilter] = useState<LeaveStatus | "all">("all");
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceForm, setBalanceForm] = useState({ userId: "", leaveType: "CASUAL" as LeaveType, total: 12, year: new Date().getFullYear() });

  // Month navigation
  const today = new Date();
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });

  const prevMonth = () => setViewDate(d => {
    const m = d.month === 1 ? 12 : d.month - 1;
    return { year: m === 12 ? d.year - 1 : d.year, month: m };
  });
  const nextMonth = () => setViewDate(d => {
    const m = d.month === 12 ? 1 : d.month + 1;
    return { year: m === 1 ? d.year + 1 : d.year, month: m };
  });

  const monthLabel = new Date(viewDate.year, viewDate.month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", selectedUser, viewDate.year, viewDate.month],
    queryFn: () => attendanceApi.list({
      userId: selectedUser !== "all" ? selectedUser : undefined,
      year: viewDate.year, month: viewDate.month,
    }).then(r => r.data),
    enabled: tab === "attendance",
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves", leaveFilter],
    queryFn: () => leavesApi.list(leaveFilter !== "all" ? { status: leaveFilter } : {}).then(r => r.data),
    enabled: tab === "leaves",
  });

  const { data: allBalances = [] } = useQuery({
    queryKey: ["leave-balances-all"],
    queryFn: () => leavesApi.allBalances().then(r => r.data),
    enabled: tab === "balances",
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const reviewMut = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: "IN_PROCESS" | "APPROVED" | "REJECTED"; note?: string }) =>
      leavesApi.review(id, { status, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves"] }),
  });

  const assignBalanceMut = useMutation({
    mutationFn: (data: typeof balanceForm) => leavesApi.assignBalance(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-balances-all"] });
      setShowBalanceModal(false);
    },
  });

  // ── Derived attendance data ──────────────────────────────────────────────────
  // Build a map: date-string → { userId → status }
  const daysInMonth = new Date(viewDate.year, viewDate.month, 0).getDate();
  const attendanceMap: Record<string, Record<string, AttendanceStatus>> = {};
  attendance.forEach(a => {
    const day = new Date(a.date).getDate();
    if (!attendanceMap[day]) attendanceMap[day] = {};
    attendanceMap[day][a.userId] = a.status;
  });

  const displayUsers = selectedUser === "all"
    ? allUsers
    : allUsers.filter(u => u.id === selectedUser);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "attendance", label: "Attendance",     icon: CalendarDays },
    { key: "leaves",     label: "Leave Requests", icon: ClipboardList },
    { key: "balances",   label: "Leave Balances", icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Employees", value: allUsers.length,                          color: "text-primary" },
          { label: "Present Today",   value: attendance.filter(a => {
            const d = new Date(a.date); const t = new Date();
            return d.toDateString() === t.toDateString() && a.status === "PRESENT";
          }).length, color: "text-emerald-500" },
          { label: "On Leave Today",  value: leaves.filter(l => {
            const now = new Date(); const s = new Date(l.startDate); const e = new Date(l.endDate);
            return l.status === "APPROVED" && now >= s && now <= e;
          }).length, color: "text-amber-500" },
          { label: "Pending Leaves",  value: leaves.filter(l => l.status === "REQUESTED" || l.status === "IN_PROCESS").length, color: "text-blue-500" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">{s.label}</span>
            <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-2.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ATTENDANCE TAB ── */}
      {tab === "attendance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {/* User filter */}
            <select
              value={selectedUser} onChange={e => setSelected(e.target.value)}
              className="bg-muted text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 ring-primary/20">
              <option value="all">All Employees</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {/* Month navigator */}
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold min-w-[140px] text-center">{monthLabel}</span>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px]">
            {(Object.entries(ATTENDANCE_META) as [AttendanceStatus, typeof ATTENDANCE_META[AttendanceStatus]][]).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                {v.label}
              </span>
            ))}
          </div>

          {/* Attendance table */}
          <div className="surface-elevated overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium w-40">Employee</th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <th key={day} className="px-1.5 py-3 text-center text-muted-foreground font-medium min-w-[28px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((u, ri) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ri * 0.03 }}
                    className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-white">{u.initials}</span>
                        </div>
                        <div>
                          <p className="font-medium text-[11px]">{u.name}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_LABELS[u.role].cls}`}>
                            {ROLE_LABELS[u.role].label}
                          </span>
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const status = attendanceMap[day]?.[u.id];
                      return (
                        <td key={day} className="px-1 py-3 text-center">
                          {status ? (
                            <span title={ATTENDANCE_META[status].label}
                              className={`inline-block w-2 h-2 rounded-full ${ATTENDANCE_META[status].dot}`} />
                          ) : (
                            <span className="inline-block w-2 h-2 rounded-full bg-border" />
                          )}
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {displayUsers.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Users size={32} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
                No employees found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LEAVES TAB ── */}
      {tab === "leaves" && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {(["all", "REQUESTED", "IN_PROCESS", "APPROVED", "REJECTED"] as const).map(s => (
              <button key={s} onClick={() => setLeaveFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${leaveFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {s === "all" ? "All" : LEAVE_STATUS_META[s].label}
                {s !== "all" && <span className="ml-1.5 opacity-60">{leaves.filter(l => l.status === s).length}</span>}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {leaves.length === 0 && (
              <div className="surface-elevated py-12 text-center text-sm text-muted-foreground">
                <ClipboardList size={32} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
                No leave requests found.
              </div>
            )}
            {leaves.map((leave, i) => {
              const meta = LEAVE_STATUS_META[leave.status];
              const Icon = meta.icon;
              const canReview = leave.status === "REQUESTED" || leave.status === "IN_PROCESS";
              return (
                <motion.div key={leave.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="surface-elevated p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">{leave.user.initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="font-semibold text-sm">{leave.user.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_LABELS[leave.user.role].cls}`}>
                            {ROLE_LABELS[leave.user.role].label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            {LEAVE_TYPE_LABELS[leave.leaveType]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {" – "}
                          {new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{leave.reason}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}>
                        <Icon size={10} />
                        {meta.label}
                      </span>
                      {canReview && (
                        <div className="flex gap-2">
                          {leave.status === "REQUESTED" && (
                            <button onClick={() => reviewMut.mutate({ id: leave.id, status: "IN_PROCESS" })}
                              className="text-xs px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors">
                              Mark In Process
                            </button>
                          )}
                          <button onClick={() => reviewMut.mutate({ id: leave.id, status: "APPROVED" })}
                            className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors">
                            Approve
                          </button>
                          <button onClick={() => reviewMut.mutate({ id: leave.id, status: "REJECTED" })}
                            className="text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors">
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Timeline */}
                  {leave.timeline.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex gap-4 flex-wrap">
                        {leave.timeline.map((tl) => {
                          const tlMeta = LEAVE_STATUS_META[tl.status];
                          return (
                            <div key={tl.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className={`w-1.5 h-1.5 rounded-full ${tlMeta.dot ?? "bg-muted-foreground"}`} />
                              <span className="font-medium">{tlMeta.label}</span>
                              <span>by {tl.reviewer.name}</span>
                              <span>·</span>
                              <span>{new Date(tl.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              {tl.note && <span className="italic">"{tl.note}"</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BALANCES TAB ── */}
      {tab === "balances" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowBalanceModal(true)}
              className="flex items-center gap-2 gradient-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus size={14} /> Assign Leave Quota
            </button>
          </div>

          <div className="surface-elevated overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Employee</th>
                  {(["CASUAL", "SICK", "EARNED", "UNPAID"] as LeaveType[]).map(lt => (
                    <th key={lt} className="text-center px-4 py-3 text-muted-foreground font-medium">{LEAVE_TYPE_LABELS[lt]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allBalances.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white">{u.initials}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_LABELS[u.role].cls}`}>
                            {ROLE_LABELS[u.role].label}
                          </span>
                        </div>
                      </div>
                    </td>
                    {(["CASUAL", "SICK", "EARNED", "UNPAID"] as LeaveType[]).map(lt => {
                      const bal = u.leaveBalances.find(b => b.leaveType === lt);
                      if (!bal) return (
                        <td key={lt} className="px-4 py-3 text-center text-muted-foreground text-xs">—</td>
                      );
                      const remaining = bal.total - bal.used;
                      return (
                        <td key={lt} className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold text-sm">{remaining}</span>
                            <span className="text-[10px] text-muted-foreground">/ {bal.total} remaining</span>
                            <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${remaining > 0 ? "bg-emerald-500" : "bg-red-500"}`}
                                style={{ width: `${bal.total > 0 ? ((remaining / bal.total) * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ASSIGN BALANCE MODAL ── */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-semibold text-base mb-4">Assign Leave Quota</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Employee</label>
                <select value={balanceForm.userId} onChange={e => setBalanceForm(f => ({ ...f, userId: e.target.value }))}
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20">
                  <option value="">Select employee…</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role].label})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Leave Type</label>
                <select value={balanceForm.leaveType} onChange={e => setBalanceForm(f => ({ ...f, leaveType: e.target.value as LeaveType }))}
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20">
                  {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Days</label>
                  <input type="number" min={1} max={365} value={balanceForm.total}
                    onChange={e => setBalanceForm(f => ({ ...f, total: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Year</label>
                  <input type="number" min={2020} max={2099} value={balanceForm.year}
                    onChange={e => setBalanceForm(f => ({ ...f, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowBalanceModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                disabled={!balanceForm.userId || assignBalanceMut.isPending}
                onClick={() => assignBalanceMut.mutate(balanceForm)}
                className="flex-1 gradient-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {assignBalanceMut.isPending ? "Saving…" : "Assign Quota"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Small helper for timeline dot (not exported)
declare module "@/lib/api" {}

const LEAVE_STATUS_DOT: Record<LeaveStatus, string> = {
  REQUESTED:  "bg-gray-400",
  IN_PROCESS: "bg-amber-500",
  APPROVED:   "bg-emerald-500",
  REJECTED:   "bg-red-500",
};

// Patch the dot onto LEAVE_STATUS_META at runtime
Object.keys(LEAVE_STATUS_META).forEach(k => {
  (LEAVE_STATUS_META as Record<string, { dot?: string }>)[k].dot = LEAVE_STATUS_DOT[k as LeaveStatus];
});
