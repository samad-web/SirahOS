import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Users, UserCheck, UserX, Clock,
  ArrowUpRight, Calendar, Briefcase,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { leadsApi, type AdLead } from "@/lib/api";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const ATTENDANCE_COLORS: Record<string, string> = {
  attended:  "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  no_show:   "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending:   "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  cancelled: "bg-muted text-muted-foreground",
};

function fmtMeeting(dt: string | null) {
  if (!dt) return null;
  return new Date(dt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [lpName, setLpName] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["leads", search, attendanceStatus, businessType, lpName, page],
    queryFn: () =>
      leadsApi.list({
        search: search || undefined,
        attendance_status: attendanceStatus || undefined,
        business_type: businessType || undefined,
        lp_name: lpName || undefined,
        page,
        limit,
      }).then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ["leads-stats"],
    queryFn: () => leadsApi.stats().then((r) => r.data),
  });

  const { data: filters } = useQuery({
    queryKey: ["leads-filters"],
    queryFn: () => leadsApi.filters().then((r) => r.data),
  });

  const leads: AdLead[] = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
            {/* Header */}
            <motion.div variants={item}>
              <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
              <p className="text-sm text-muted-foreground">Leads from your ad campaigns</p>
            </motion.div>

            {/* Summary Cards */}
            <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Leads", value: stats?.total ?? "—", icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
                { label: "Attended", value: stats?.attended ?? "—", icon: UserCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/30" },
                { label: "No Show", value: stats?.no_show ?? "—", icon: UserX, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30" },
                { label: "Pending", value: stats?.pending ?? "—", icon: Clock, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/30" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                      <p className={`mt-1.5 text-2xl font-bold ${c.color}`}>{c.value}</p>
                    </div>
                    <div className={`rounded-full p-2.5 ${c.bg}`}>
                      <c.icon className={`h-5 w-5 ${c.color}`} />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Filters + Table */}
            <motion.div variants={item} className="rounded-xl border bg-card shadow-sm">
              {/* Filters */}
              <div className="border-b p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search by name, email, phone..."
                      className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <select value={attendanceStatus} onChange={(e) => { setAttendanceStatus(e.target.value); setPage(1); }} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="">All Attendance</option>
                    {(filters?.attendanceStatuses ?? []).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                  <select value={businessType} onChange={(e) => { setBusinessType(e.target.value); setPage(1); }} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="">All Business Types</option>
                    {(filters?.businessTypes ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={lpName} onChange={(e) => { setLpName(e.target.value); setPage(1); }} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="">All Landing Pages</option>
                    {(filters?.lpNames ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Name</th>
                      <th className="px-5 py-3 text-left font-medium">Contact</th>
                      <th className="px-5 py-3 text-left font-medium">Business Type</th>
                      <th className="px-5 py-3 text-left font-medium">Meeting</th>
                      <th className="px-5 py-3 text-left font-medium">Attendance</th>
                      <th className="px-5 py-3 text-left font-medium">Landing Page</th>
                      <th className="px-5 py-3 text-left font-medium">Added</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            {Array.from({ length: 8 }).map((__, j) => (
                              <td key={j} className="px-5 py-3"><div className="h-4 rounded bg-muted" /></td>
                            ))}
                          </tr>
                        ))
                      : leads.map((lead) => {
                          const ac = ATTENDANCE_COLORS[lead.attendance_status || ""] || ATTENDANCE_COLORS.pending;
                          return (
                            <tr key={lead.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                              <td className="px-5 py-3 font-medium">{lead.name}</td>
                              <td className="px-5 py-3">
                                <div className="space-y-0.5 text-xs text-muted-foreground">
                                  <p>{lead.email}</p>
                                  <p>{lead.full_phone || `${lead.country_code} ${lead.phone}`}</p>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center gap-1.5 text-xs">
                                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                  {lead.business_type}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                {lead.meeting_time ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {fmtMeeting(lead.meeting_time)}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ac}`}>
                                  {(lead.attendance_status || "pending").replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{lead.lp_name || "—"}</td>
                              <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(lead.created_at).toLocaleDateString("en-IN")}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>

                {!isLoading && leads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Users className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium">No leads found</p>
                    <p className="text-xs mt-1">Leads from your ads will appear here</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Pagination */}
            {total > limit && (
              <motion.div variants={item} className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 hover:bg-muted">Previous</button>
                  <button disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 hover:bg-muted">Next</button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
