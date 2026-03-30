import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Save, Pencil, FileText, Users,
  IndianRupee, TrendingUp, Loader2, Percent, AlertTriangle, Clock,
  Bell, X, ChevronLeft, ChevronRight, Banknote,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { reportsApi, customersApi, expensesApi, invoicesApi, finesApi } from "@/lib/api";
import type { ReportSummary, RevenueMonth, TopClient, Invoice, FineSummary } from "@/lib/api";
import { useNavigate } from "react-router-dom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fmt = (n: number | undefined | null) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonthLabel(year: number, month: number) {
  return `${MONTHS[month]} ${year}`;
}

const GST_STORAGE_KEY = "bf_gst_info";

interface GSTInfo {
  companyName: string; gstin: string; pan: string;
  address: string; state: string; stateCode: string; hsnSac: string;
}

const emptyGST: GSTInfo = { companyName: "", gstin: "", pan: "", address: "", state: "", stateCode: "", hsnSac: "" };

function loadGST(): GSTInfo {
  try { return { ...emptyGST, ...JSON.parse(localStorage.getItem(GST_STORAGE_KEY) ?? "{}") }; } catch { return emptyGST; }
}

const EXPENSE_COLORS = ["#4C6EF5", "#7950F2", "#F59F00", "#F03E3E", "#2F9E44", "#E64980", "#1098AD"];

interface ExpenseSlice { name: string; value: number; color: string; }
interface GstRow { month: string; collected: number; paid: number; }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span>{p.name}: <span className="font-semibold font-mono">{fmt(p.value)}</span></span>
        </div>
      ))}
    </div>
  );
};

// ─── Alert Item ───────────────────────────────────────────────────────────────

interface AlertItem {
  id: string;
  type: "overdue" | "pending" | "info";
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gst, setGst] = useState<GSTInfo>(loadGST);
  const [editingGST, setEditingGST] = useState(false);
  const [gstSaved, setGstSaved] = useState(false);

  // ── Date range ──
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  // ── Notification center ──
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifs on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Reports data ──
  const [reportsLoading, setReportsLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueMonth[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [gstData, setGstData] = useState<GstRow[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseSlice[]>([]);

  const { data: customerCount = 0 } = useQuery({
    queryKey: ["customers", "count"],
    queryFn: () => customersApi.list().then(r => (r.data as unknown[]).length),
    staleTime: 5 * 60_000,
  });

  // Fines summary
  const { data: fineSummary } = useQuery<FineSummary>({
    queryKey: ["fines", "summary"],
    queryFn: () => finesApi.summary().then(r => r.data),
    staleTime: 60_000,
  });

  // Fetch all invoices for alerts
  const { data: allInvoices = [] } = useQuery({
    queryKey: ["invoices", "all"],
    queryFn: () => invoicesApi.list().then(r => r.data as Invoice[]),
    staleTime: 60_000,
  });

  const overdueInvoices = allInvoices.filter(i => i.status === "OVERDUE");
  const pendingInvoices = allInvoices.filter(i => i.status === "PENDING");
  const overdueCount = overdueInvoices.length;
  const pendingCount = pendingInvoices.length;

  // Build alerts
  const alerts: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = [];
    if (overdueCount > 0) {
      const total = overdueInvoices.reduce((s, i) => {
        const sub = (i.items ?? []).reduce((a, it) => a + it.quantity * it.unitPrice, 0);
        const gst = Math.round(sub * i.gstRate / 100);
        const paid = (i.payments ?? []).reduce((a, p) => a + p.amount, 0);
        return s + sub + gst - paid;
      }, 0);
      items.push({
        id: "overdue",
        type: "overdue",
        title: `${overdueCount} overdue invoice${overdueCount > 1 ? "s" : ""}`,
        description: `${fmt(total)} outstanding past due date`,
        action: () => navigate("/invoices"),
        actionLabel: "View Invoices",
      });
    }
    if (pendingCount > 0) {
      items.push({
        id: "pending",
        type: "pending",
        title: `${pendingCount} pending invoice${pendingCount > 1 ? "s" : ""}`,
        description: "Awaiting payment from clients",
        action: () => navigate("/invoices"),
        actionLabel: "View",
      });
    }
    if (customerCount > 0 && allInvoices.length === 0) {
      items.push({
        id: "no-invoices",
        type: "info",
        title: "No invoices yet",
        description: "You have customers but no invoices. Create your first invoice.",
        action: () => navigate("/invoices"),
        actionLabel: "Go to Invoices",
      });
    }
    return items;
  }, [overdueCount, pendingCount, customerCount, allInvoices.length]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setReportsLoading(true);
      try {
        const [summaryRes, revenueRes, clientsRes, gstRes, expensesRes] = await Promise.all([
          reportsApi.summary(),
          reportsApi.revenue(),
          reportsApi.topClients(),
          reportsApi.gst(),
          expensesApi.list(),
        ]);
        if (cancelled) return;

        setSummary(summaryRes.data);
        setRevenueData(revenueRes.data);
        setTopClients(clientsRes.data);

        const gstRaw = gstRes.data;
        setGstData(Object.entries(gstRaw).map(([month, collected]) => ({
          month, collected: collected as number, paid: collected as number,
        })));

        const categoryTotals: Record<string, number> = {};
        for (const exp of expensesRes.data) {
          const cat = exp.category ?? "OTHER";
          categoryTotals[cat] = (categoryTotals[cat] ?? 0) + exp.amount;
        }
        setExpenseBreakdown(
          Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value], i) => ({
              name: name.charAt(0) + name.slice(1).toLowerCase(),
              value,
              color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
            }))
        );
      } catch { /* ignore */ }
      finally { if (!cancelled) setReportsLoading(false); }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // Filter revenue data by selected month range (show up to selected month)
  const filteredRevenue = revenueData; // API returns monthly — we show all

  const totalRevenue = summary?.totalRevenue ?? 0;
  const netProfit = summary?.netProfit ?? 0;
  const margin = summary?.profitMargin ?? "0.0";
  const totalGST = gstData.reduce((s, g) => s + g.collected, 0);
  const maxRevenue = useMemo(() => (topClients.length ? Math.max(...topClients.map(c => c.revenue)) : 1), [topClients]);

  const saveGST = () => {
    localStorage.setItem(GST_STORAGE_KEY, JSON.stringify(gst));
    setEditingGST(false);
    setGstSaved(true);
    setTimeout(() => setGstSaved(false), 2000);
  };

  const alertTypeCfg = {
    overdue: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", icon: AlertTriangle, iconColor: "text-red-500" },
    pending: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", icon: Clock, iconColor: "text-amber-500" },
    info: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", icon: FileText, iconColor: "text-blue-500" },
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search…" />

        <div className="p-6 space-y-5 max-w-[1400px]">
          {/* Welcome + Month Selector */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Hello, {user?.name?.split(" ")[0] ?? "there"}!</h2>
              <p className="text-sm text-muted-foreground mt-1">Here's your business overview.</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={goPrev} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors" aria-label="Previous month">
                <ChevronLeft size={15} className="text-muted-foreground" />
              </button>
              <button
                onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); }}
                className={`flex items-center gap-1.5 text-sm font-medium border border-border rounded-xl px-3 py-2 hover:bg-muted transition-colors min-w-[120px] justify-center ${isCurrentMonth ? "bg-primary/5 border-primary/30 text-primary" : ""}`}>
                {getMonthLabel(viewYear, viewMonth)}
              </button>
              <button onClick={goNext} disabled={isCurrentMonth} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-30" aria-label="Next month">
                <ChevronRight size={15} className="text-muted-foreground" />
              </button>
              {/* Notification bell */}
              <div className="relative ml-2" ref={notifRef}>
                <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-xl border border-border hover:bg-muted transition-colors" aria-label="Notifications">
                  <Bell size={15} strokeWidth={1.5} className="text-muted-foreground" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">{alerts.length}</span>
                    </span>
                  )}
                </button>
                {/* Notification dropdown */}
                <AnimatePresence>
                  {showNotifs && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <h4 className="text-sm font-semibold">Notifications</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{alerts.length}</span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {alerts.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Bell size={24} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
                            <p className="text-sm text-muted-foreground">No notifications</p>
                          </div>
                        ) : (
                          alerts.map(alert => {
                            const cfg = alertTypeCfg[alert.type];
                            const Icon = cfg.icon;
                            return (
                              <div key={alert.id} className="px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start gap-3">
                                  <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                    <Icon size={14} className={cfg.iconColor} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold">{alert.title}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
                                    {alert.action && (
                                      <button onClick={() => { alert.action!(); setShowNotifs(false); }}
                                        className="text-[11px] text-primary font-semibold mt-1.5 hover:underline">
                                        {alert.actionLabel} &rarr;
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Alert banners */}
          {alerts.filter(a => a.type === "overdue").map(alert => {
            const cfg = alertTypeCfg[alert.type];
            const Icon = cfg.icon;
            return (
              <motion.div key={alert.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 ${cfg.bg} border ${cfg.border} rounded-xl px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity`}
                onClick={alert.action}>
                <Icon size={16} className={cfg.iconColor + " flex-shrink-0"} />
                <p className={`text-sm ${cfg.text}`}>
                  <span className="font-semibold">{alert.title}</span> &mdash; {alert.description}
                </p>
                <span className={`ml-auto text-xs font-semibold ${cfg.text} whitespace-nowrap`}>{alert.actionLabel} &rarr;</span>
              </motion.div>
            );
          })}

          {/* KPI Cards */}
          {reportsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { title: "Total Revenue", value: fmt(totalRevenue), icon: IndianRupee, color: "text-primary", sub: `${revenueData.length} months`, highlighted: true },
                  { title: "Net Profit", value: fmt(netProfit), icon: TrendingUp, color: "text-emerald-500", sub: `Margin: ${margin}%`, highlighted: false },
                  { title: "Customers", value: String(customerCount), icon: Users, color: "text-blue-500", sub: "registered clients", highlighted: false },
                  { title: "GST Filed", value: fmt(totalGST), icon: Percent, color: "text-purple-500", sub: "total collected", highlighted: false },
                  { title: "Total Fines", value: fmt(fineSummary?.totalAmount ?? 0), icon: Banknote, color: "text-red-500", sub: `${fmt(fineSummary?.totalPaid ?? 0)} paid`, highlighted: false },
                ].map(m => (
                  <motion.div key={m.title}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    className={`rounded-2xl p-5 ${m.highlighted ? "gradient-primary" : "surface-elevated"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[11px] font-medium uppercase tracking-wide ${m.highlighted ? "text-white/70" : "text-muted-foreground"}`}>{m.title}</span>
                      <m.icon size={15} className={m.highlighted ? "text-white/80" : m.color} strokeWidth={1.5} />
                    </div>
                    <p className={`text-2xl font-bold font-mono tabular-nums ${m.highlighted ? "text-white" : ""}`}>{m.value}</p>
                    <p className={`text-[11px] mt-1 ${m.highlighted ? "text-white/60" : "text-muted-foreground"}`}>{m.sub}</p>
                  </motion.div>
                ))}
              </motion.div>

              {/* Revenue Trend + Expense Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="lg:col-span-2 surface-elevated p-5">
                  <h3 className="text-sm font-semibold">Revenue vs Expenses</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Monthly trend</p>
                  <div className="h-56">
                    {filteredRevenue.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={filteredRevenue} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(250,75%,58%)" stopOpacity={0.2} />
                              <stop offset="100%" stopColor="hsl(250,75%,58%)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(0,72%,55%)" stopOpacity={0.1} />
                              <stop offset="100%" stopColor="hsl(0,72%,55%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,91%)" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill: "hsl(220,10%,56%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: "hsl(220,10%,56%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(250,75%,58%)" strokeWidth={2} fill="url(#revGrad)" />
                          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(0,72%,55%)" strokeWidth={1.5} fill="url(#expGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No revenue data available.</div>
                    )}
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="surface-elevated p-5">
                  <h3 className="text-sm font-semibold">Expense Breakdown</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">By category</p>
                  {expenseBreakdown.length > 0 ? (
                    <>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={32} outerRadius={60} paddingAngle={3} dataKey="value" strokeWidth={0}>
                              {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [fmt(v), ""]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-2">
                        {expenseBreakdown.map(e => (
                          <div key={e.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} /><span className="text-xs">{e.name}</span></div>
                            <span className="text-xs font-mono font-medium">{fmt(e.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">No expense data yet.</div>
                  )}
                </motion.div>
              </div>

              {/* Top Clients + GST Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                  className="surface-elevated p-5">
                  <h3 className="text-sm font-semibold mb-4">Top Clients by Revenue</h3>
                  {topClients.length > 0 ? (
                    <div className="space-y-3">
                      {topClients.map((c, i) => (
                        <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-muted-foreground w-4">#{i + 1}</span>
                              <span className="font-medium">{c.name}</span>
                              {c.company && <span className="text-[11px] text-muted-foreground">{c.company}</span>}
                            </div>
                            <span className="font-mono text-sm font-semibold">{fmt(c.revenue)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(c.revenue / maxRevenue) * 100}%` }} transition={{ delay: i * 0.07 + 0.2, duration: 0.6 }}
                              className="h-full gradient-primary rounded-full" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No client data available.</div>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                  className="surface-elevated p-5">
                  <h3 className="text-sm font-semibold mb-1">GST Summary</h3>
                  <p className="text-[11px] text-muted-foreground mb-4">Collected vs filed</p>
                  {gstData.length > 0 ? (
                    <>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={gstData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,91%)" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: "hsl(220,10%,56%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: "hsl(220,10%,56%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="collected" name="Collected" fill="hsl(250,75%,65%)" radius={[4, 4, 0, 0]} barSize={16} />
                            <Bar dataKey="paid" name="Filed" fill="hsl(160,55%,55%)" radius={[4, 4, 0, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-[11px] text-muted-foreground">Collected</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[11px] text-muted-foreground">Filed</span></div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">No GST data available.</div>
                  )}
                </motion.div>
              </div>
            </>
          )}

          {/* GST / Company Info */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="surface-elevated overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Building2 size={15} strokeWidth={2} className="text-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">GST & Company Information</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Used on invoices and billing documents</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gstSaved && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Saved!</span>}
                {editingGST ? (
                  <button onClick={saveGST} className="flex items-center gap-1.5 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
                    <Save size={12} /> Save
                  </button>
                ) : (
                  <button onClick={() => setEditingGST(true)} className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                )}
              </div>
            </div>
            <div className="p-5">
              {editingGST ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {([
                    { label: "Company / Trade Name", field: "companyName", ph: "Enter company name" },
                    { label: "GSTIN", field: "gstin", ph: "15 digit GSTIN" },
                    { label: "PAN", field: "pan", ph: "10 character PAN" },
                    { label: "State", field: "state", ph: "State name" },
                    { label: "State Code", field: "stateCode", ph: "Code" },
                    { label: "HSN / SAC Code", field: "hsnSac", ph: "HSN/SAC code" },
                  ] as { label: string; field: keyof GSTInfo; ph: string }[]).map(({ label, field, ph }) => (
                    <div key={field}>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
                      <input className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20" placeholder={ph}
                        value={gst[field]} onChange={e => setGst(prev => ({ ...prev, [field]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Registered Address</label>
                    <textarea rows={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                      placeholder="Enter registered address"
                      value={gst.address} onChange={e => setGst(prev => ({ ...prev, address: e.target.value }))} />
                  </div>
                </div>
              ) : (
                gst.gstin ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    {([
                      { label: "Company", value: gst.companyName },
                      { label: "GSTIN", value: gst.gstin },
                      { label: "PAN", value: gst.pan },
                      { label: "State", value: gst.state ? `${gst.state}${gst.stateCode ? ` (${gst.stateCode})` : ""}` : "" },
                      { label: "HSN / SAC", value: gst.hsnSac },
                      { label: "Address", value: gst.address },
                    ]).filter(i => i.value).map(i => (
                      <div key={i.label}>
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{i.label}</p>
                        <p className="text-sm font-medium">{i.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">No GST information configured yet.</p>
                    <button onClick={() => setEditingGST(true)} className="text-xs text-primary font-medium mt-2 hover:underline">Add company GST details</button>
                  </div>
                )
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Index;
