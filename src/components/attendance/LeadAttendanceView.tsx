import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, ClipboardList, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { attendanceApi, leavesApi, AttendanceStatus, LeaveStatus } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";

const ATTENDANCE_META: Record<AttendanceStatus, { label: string; dot: string }> = {
  PRESENT: { label: "Present",  dot: "bg-emerald-500" },
  ABSENT:  { label: "Absent",   dot: "bg-red-500"     },
  HALFDAY: { label: "Half Day", dot: "bg-amber-500"   },
  WFH:     { label: "WFH",      dot: "bg-blue-500"    },
};

const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; cls: string; icon: React.ElementType }> = {
  REQUESTED:  { label: "Requested",  cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",               icon: Clock         },
  IN_PROCESS: { label: "In Process", cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",         icon: AlertCircle   },
  APPROVED:   { label: "Approved",   cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2  },
  REJECTED:   { label: "Rejected",   cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",                 icon: XCircle       },
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned", UNPAID: "Unpaid",
};

type Tab = "attendance" | "leaves";

export function LeadAttendanceView() {
  const { user, allUsers } = useAuth();

  const [tab, setTab] = useState<Tab>("attendance");
  const today = new Date();
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [selectedUser, setSelected] = useState<string>("all");

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

  // API fetches — backend enforces that Lead only sees their team members
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", "lead", selectedUser, viewDate.year, viewDate.month],
    queryFn: () => attendanceApi.list({
      userId: selectedUser !== "all" ? selectedUser : undefined,
      year: viewDate.year, month: viewDate.month,
    }).then(r => r.data),
    enabled: tab === "attendance",
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves", "lead"],
    queryFn: () => leavesApi.list({}).then(r => r.data),
    enabled: tab === "leaves",
  });

  // Build attendance map
  const attendanceMap: Record<number, Record<string, AttendanceStatus>> = {};
  attendance.forEach(a => {
    const day = new Date(a.date).getDate();
    if (!attendanceMap[day]) attendanceMap[day] = {};
    attendanceMap[day][a.userId] = a.status;
  });

  // Display users: from attendance data (team members visible via API)
  const teamUsers = Array.from(
    new Map(attendance.map(a => [a.userId, a.user])).values()
  );
  const displayUsers = selectedUser === "all" ? teamUsers : teamUsers.filter(u => u.id === selectedUser);

  const myLeaves = leaves.filter(l => l.userId !== user?.id);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Team Members", value: teamUsers.length, color: "text-primary" },
          { label: "Present Today", value: attendance.filter(a => {
            const t = new Date(); const d = new Date(a.date);
            return d.toDateString() === t.toDateString() && a.status === "PRESENT";
          }).length, color: "text-emerald-500" },
          { label: "On Approved Leave", value: leaves.filter(l => {
            const now = new Date();
            return l.status === "APPROVED" && new Date(l.startDate) <= now && new Date(l.endDate) >= now;
          }).length, color: "text-amber-500" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">{s.label}</span>
            <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: "attendance" as Tab, label: "Team Attendance", icon: CalendarDays },
          { key: "leaves"     as Tab, label: "Team Leaves",     icon: ClipboardList },
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
          <div className="flex items-center justify-between">
            <select value={selectedUser} onChange={e => setSelected(e.target.value)}
              className="bg-muted text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 ring-primary/20">
              <option value="all">All Team Members</option>
              {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold min-w-[140px] text-center">{monthLabel}</span>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px]">
            {(Object.entries(ATTENDANCE_META) as [AttendanceStatus, typeof ATTENDANCE_META[AttendanceStatus]][]).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
              </span>
            ))}
          </div>

          <div className="surface-elevated overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium w-40">Member</th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <th key={day} className="px-1.5 py-3 text-center text-muted-foreground font-medium min-w-[28px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((u, ri) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ri * 0.04 }}
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
                      const s = attendanceMap[day]?.[u.id];
                      return (
                        <td key={day} className="px-1 py-3 text-center">
                          <span title={s ? ATTENDANCE_META[s].label : undefined}
                            className={`inline-block w-2 h-2 rounded-full ${s ? ATTENDANCE_META[s].dot : "bg-border"}`} />
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
                {displayUsers.length === 0 && (
                  <tr><td colSpan={daysInMonth + 1} className="py-10 text-center text-sm text-muted-foreground">
                    <Users size={28} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
                    No attendance data for this period.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LEAVES TAB (view-only for Lead) ── */}
      {tab === "leaves" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Viewing leave requests for your team members. Approval is handled by the Project Manager or Admin.</p>
          {myLeaves.length === 0 && (
            <div className="surface-elevated py-12 text-center text-sm text-muted-foreground">
              <ClipboardList size={32} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
              No leave requests from your team.
            </div>
          )}
          {myLeaves.map((leave, i) => {
            const meta = LEAVE_STATUS_META[leave.status];
            const Icon = meta.icon;
            return (
              <motion.div key={leave.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="surface-elevated p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-white">{leave.user.initials}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{leave.user.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_LABELS[leave.user.role].cls}`}>
                          {ROLE_LABELS[leave.user.role].label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {LEAVE_TYPE_LABELS[leave.leaveType]} ·{" "}
                        {new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{leave.reason}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${meta.cls}`}>
                    <Icon size={10} /> {meta.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
