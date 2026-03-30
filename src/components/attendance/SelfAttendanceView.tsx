import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays, ClipboardList, CheckCircle2, XCircle, Clock,
  ChevronLeft, ChevronRight, Plus, AlertCircle, Wallet,
} from "lucide-react";
import { attendanceApi, leavesApi, AttendanceStatus, LeaveStatus, LeaveType } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; cls: string; dot: string }[] = [
  { value: "PRESENT", label: "Present",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400", dot: "bg-emerald-500" },
  { value: "ABSENT",  label: "Absent",   cls: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400",                          dot: "bg-red-500"     },
  { value: "HALFDAY", label: "Half Day", cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400",               dot: "bg-amber-500"   },
  { value: "WFH",     label: "WFH",      cls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400",                    dot: "bg-blue-500"    },
];

const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; cls: string; icon: React.ElementType }> = {
  REQUESTED:  { label: "Requested",  cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",               icon: Clock         },
  IN_PROCESS: { label: "In Process", cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",         icon: AlertCircle   },
  APPROVED:   { label: "Approved",   cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2  },
  REJECTED:   { label: "Rejected",   cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",                 icon: XCircle       },
};

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  CASUAL: "Casual Leave", SICK: "Sick Leave", EARNED: "Earned Leave", UNPAID: "Unpaid Leave",
};

type Tab = "attendance" | "leaves";

// ─── Component ────────────────────────────────────────────────────────────────

export function SelfAttendanceView() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("attendance");
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });

  // Leave request form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "CASUAL" as LeaveType,
    startDate: todayStr,
    endDate:   todayStr,
    reason:    "",
  });

  const prevMonth = () => setViewDate(d => {
    const m = d.month === 1 ? 12 : d.month - 1;
    return { year: m === 12 ? d.year - 1 : d.year, month: m };
  });
  const nextMonth = () => setViewDate(d => {
    const m = d.month === 12 ? 1 : d.month + 1;
    return { year: m === 1 ? d.year + 1 : d.year, month: m };
  });
  const monthLabel = new Date(viewDate.year, viewDate.month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const daysInMonth = new Date(viewDate.year, viewDate.month, 0).getDate();
  const firstDayOfWeek = new Date(viewDate.year, viewDate.month - 1, 1).getDay(); // 0=Sun

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", "self", user?.id, viewDate.year, viewDate.month],
    queryFn: () => attendanceApi.list({ userId: user?.id, year: viewDate.year, month: viewDate.month }).then(r => r.data),
    enabled: !!user,
  });

  const { data: summary } = useQuery({
    queryKey: ["attendance-summary", user?.id, viewDate.year, viewDate.month],
    queryFn: () => attendanceApi.summary({ userId: user?.id, year: viewDate.year, month: viewDate.month }).then(r => r.data),
    enabled: !!user,
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves", "self", user?.id],
    queryFn: () => leavesApi.list({ userId: user?.id }).then(r => r.data),
    enabled: !!user && tab === "leaves",
  });

  const { data: balance = [] } = useQuery({
    queryKey: ["leave-balance", user?.id],
    queryFn: () => leavesApi.balance({ userId: user?.id, year: viewDate.year }).then(r => r.data),
    enabled: !!user && tab === "leaves",
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const markMut = useMutation({
    mutationFn: (status: AttendanceStatus) =>
      attendanceApi.mark({ date: todayStr, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", "self"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });

  const leaveMut = useMutation({
    mutationFn: () => leavesApi.create(leaveForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves", "self"] });
      setShowLeaveForm(false);
      setLeaveForm({ leaveType: "CASUAL", startDate: todayStr, endDate: todayStr, reason: "" });
    },
  });

  // Build day-to-status map
  const dayMap: Record<number, AttendanceStatus> = {};
  attendance.forEach(a => { dayMap[new Date(a.date).getDate()] = a.status; });

  const todayStatus = dayMap[today.getDate()];

  // Days array for calendar grid (including empty cells for alignment)
  const calendarDays: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-5">
      {/* Today's mark attendance */}
      <div className="surface-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm">Today's Attendance</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {todayStatus && (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${ATTENDANCE_OPTIONS.find(o => o.value === todayStatus)?.cls}`}>
              {ATTENDANCE_OPTIONS.find(o => o.value === todayStatus)?.label}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ATTENDANCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => markMut.mutate(opt.value)}
              disabled={markMut.isPending}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                todayStatus === opt.value
                  ? `${opt.cls} border-current shadow-sm scale-105`
                  : "border-border text-muted-foreground hover:border-current " + opt.cls
              } disabled:opacity-60`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
              {opt.label}
              {todayStatus === opt.value && <CheckCircle2 size={11} />}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: "attendance" as Tab, label: "My Attendance", icon: CalendarDays },
          { key: "leaves"     as Tab, label: "My Leaves",     icon: ClipboardList },
        ]).map(t => (
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
          {/* Monthly stats */}
          {summary && (
            <div className="grid grid-cols-4 gap-3">
              {ATTENDANCE_OPTIONS.map(opt => (
                <motion.div key={opt.value} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-3 text-center">
                  <span className={`w-2 h-2 rounded-full inline-block mb-1.5 ${opt.dot}`} />
                  <p className="text-xl font-bold font-mono">{summary[opt.value]}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{opt.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Month navigator */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{monthLabel}</span>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                <ChevronLeft size={15} />
              </button>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="surface-elevated p-4">
            {/* Week day headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const status = dayMap[day];
                const isToday = day === today.getDate() && viewDate.month === today.getMonth() + 1 && viewDate.year === today.getFullYear();
                const opt = status ? ATTENDANCE_OPTIONS.find(o => o.value === status) : null;
                return (
                  <div key={day}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs transition-all ${
                      isToday ? "ring-2 ring-primary ring-offset-1" : ""
                    } ${opt ? opt.cls + " border border-current/20" : "bg-muted/30 text-muted-foreground"}`}
                  >
                    <span className="font-semibold text-[11px]">{day}</span>
                    {opt && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${opt.dot}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── LEAVES TAB ── */}
      {tab === "leaves" && (
        <div className="space-y-4">
          {/* Leave balance cards */}
          {balance.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {balance.map(b => {
                const remaining = b.total - b.used;
                return (
                  <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">{LEAVE_TYPE_LABELS[b.leaveType]}</p>
                    <p className="text-lg font-bold font-mono">{remaining}<span className="text-xs text-muted-foreground font-normal">/{b.total}</span></p>
                    <div className="w-full h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${remaining > 0 ? "bg-emerald-500" : "bg-red-500"}`}
                        style={{ width: `${b.total > 0 ? (remaining / b.total) * 100 : 0}%` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          {balance.length === 0 && (
            <div className="surface-elevated p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Wallet size={16} className="text-muted-foreground/50" />
              Leave quota not assigned yet. Contact your Project Manager or Admin.
            </div>
          )}

          {/* Action bar */}
          <div className="flex justify-end">
            <button onClick={() => setShowLeaveForm(true)}
              className="flex items-center gap-2 gradient-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus size={14} /> Apply for Leave
            </button>
          </div>

          {/* Leave list */}
          <div className="space-y-3">
            {leaves.length === 0 && (
              <div className="surface-elevated py-12 text-center text-sm text-muted-foreground">
                <ClipboardList size={32} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
                No leave requests yet.
              </div>
            )}
            {leaves.map((leave, i) => {
              const meta = LEAVE_STATUS_META[leave.status];
              const Icon = meta.icon;
              const days = Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
              return (
                <motion.div key={leave.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="surface-elevated p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {LEAVE_TYPE_LABELS[leave.leaveType]}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{days} day{days > 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-sm font-medium">
                        {new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{leave.reason}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${meta.cls}`}>
                      <Icon size={10} /> {meta.label}
                    </span>
                  </div>
                  {/* Timeline */}
                  {leave.timeline.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                      {leave.timeline.map(tl => (
                        <div key={tl.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={`w-1.5 h-1.5 rounded-full ${LEAVE_STATUS_META[tl.status].cls.includes("emerald") ? "bg-emerald-500" : LEAVE_STATUS_META[tl.status].cls.includes("red") ? "bg-red-500" : LEAVE_STATUS_META[tl.status].cls.includes("amber") ? "bg-amber-500" : "bg-gray-400"}`} />
                          <span className="font-medium capitalize">{LEAVE_STATUS_META[tl.status].label}</span>
                          <span>by {tl.reviewer.name}</span>
                          <span>·</span>
                          <span>{new Date(tl.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                          {tl.note && <span className="italic text-muted-foreground">"{tl.note}"</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LEAVE REQUEST MODAL ── */}
      {showLeaveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-semibold text-base mb-4">Apply for Leave</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Leave Type</label>
                <select value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value as LeaveType }))}
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20">
                  {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Start Date</label>
                  <input type="date" value={leaveForm.startDate}
                    onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">End Date</label>
                  <input type="date" value={leaveForm.endDate} min={leaveForm.startDate}
                    onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Reason</label>
                <textarea value={leaveForm.reason} rows={3}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Brief reason for leave…"
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLeaveForm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                disabled={!leaveForm.reason.trim() || leaveMut.isPending}
                onClick={() => leaveMut.mutate()}
                className="flex-1 gradient-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {leaveMut.isPending ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
