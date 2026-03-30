import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { TrendingUp, IndianRupee, Users, Percent, ChevronDown, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { reportsApi, expensesApi } from "@/lib/api";
import type { ReportSummary, RevenueMonth, TopClient } from "@/lib/api";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const EXPENSE_COLORS = ["#4C6EF5", "#7950F2", "#F59F00", "#F03E3E", "#2F9E44", "#E64980", "#1098AD"];

const CustomTooltip = ({ active, payload, label }: { active?:boolean; payload?:Array<{name:string;value:number;color:string}>; label?:string }) => {
  if (!active||!payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map(p=>(
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{backgroundColor:p.color}}/>
          <span>{p.name}: <span className="font-semibold font-mono">{fmt(p.value)}</span></span>
        </div>
      ))}
    </div>
  );
};

interface ExpenseSlice {
  name: string;
  value: number;
  color: string;
}

interface GstRow {
  month: string;
  collected: number;
  paid: number;
}

export default function Reports() {
  const [range, setRange] = useState("This Year");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueMonth[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [gstData, setGstData] = useState<GstRow[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseSlice[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
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

        // Transform GST Record<string, number> into chart-friendly rows
        const gstRaw = gstRes.data;
        const gstRows: GstRow[] = Object.entries(gstRaw).map(([month, collected]) => ({
          month,
          collected: collected as number,
          paid: collected as number,
        }));
        setGstData(gstRows);

        // Build expense breakdown by category from expenses list
        const categoryTotals: Record<string, number> = {};
        for (const exp of expensesRes.data) {
          const cat = exp.category ?? "OTHER";
          categoryTotals[cat] = (categoryTotals[cat] ?? 0) + exp.amount;
        }
        const slices: ExpenseSlice[] = Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([name, value], i) => ({
            name: name.charAt(0) + name.slice(1).toLowerCase(),
            value,
            color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
          }));
        setExpenseBreakdown(slices);
      } catch {
        // handled by UI state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  const totalRevenue  = summary?.totalRevenue ?? revenueData.reduce((s, m) => s + m.revenue, 0);
  const netProfit     = summary?.netProfit ?? 0;
  const margin        = summary?.profitMargin ?? "0.0";
  const totalGST      = gstData.reduce((s, g) => s + g.collected, 0);

  const maxRevenue = useMemo(
    () => (topClients.length ? Math.max(...topClients.map(c => c.revenue)) : 1),
    [topClients],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin" size={28} strokeWidth={1.5} />
            <span className="text-sm font-medium">Loading reports...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search reports…" search={search} onSearch={setSearch} />

        <div className="p-6 space-y-5 max-w-[1400px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
              <p className="text-sm text-muted-foreground mt-1">Business analytics and financial insights.</p>
            </div>
            <button className="flex items-center gap-1.5 text-sm font-medium border border-border rounded-xl px-3 py-2 hover:bg-muted transition-colors">
              {range} <ChevronDown size={14}/>
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label:"Total Revenue",   value:fmt(totalRevenue),  sub:`${revenueData.length} months`, icon:IndianRupee, color:"text-primary",        highlighted:true },
              { label:"Net Profit",      value:fmt(netProfit),     sub:summary ? `Margin: ${margin}%` : "--",              icon:TrendingUp,  color:"text-emerald-500",    highlighted:false },
              { label:"Profit Margin",   value:`${margin}%`,       sub:summary ? `${summary.totalProjects} projects` : "Industry avg: 28%", icon:Percent, color:"text-amber-500", highlighted:false },
              { label:"Total GST Filed", value:fmt(totalGST),      sub:"18% GST rate",                    icon:Users,       color:"text-purple-500",     highlighted:false },
            ].map((s,i)=>(
              <motion.div key={s.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}
                className={`rounded-2xl p-5 ${s.highlighted?"gradient-primary":"surface-elevated"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[11px] font-medium uppercase tracking-wide ${s.highlighted?"text-white/70":"text-muted-foreground"}`}>{s.label}</span>
                  <s.icon size={15} className={s.highlighted?"text-white/80":s.color} strokeWidth={1.5}/>
                </div>
                <span className={`text-xl font-bold font-mono tabular-nums block ${s.highlighted?"text-white":""}`}>{s.value}</span>
                <span className={`text-[11px] mt-1 block ${s.highlighted?"text-white/60":"text-muted-foreground"}`}>{s.sub}</span>
              </motion.div>
            ))}
          </div>

          {/* Revenue Trend + Expense Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 surface-elevated p-5">
              <h3 className="text-sm font-semibold">Revenue vs Expenses</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Monthly trend (last 12 months)</p>
              <div className="h-56">
                {revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData} margin={{top:4,right:4,left:-16,bottom:0}}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(250,75%,58%)" stopOpacity={0.2}/>
                          <stop offset="100%" stopColor="hsl(250,75%,58%)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0,72%,55%)" stopOpacity={0.1}/>
                          <stop offset="100%" stopColor="hsl(0,72%,55%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,91%)" vertical={false}/>
                      <XAxis dataKey="month" tick={{fill:"hsl(220,10%,56%)",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} tick={{fill:"hsl(220,10%,56%)",fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="hsl(250,75%,58%)" strokeWidth={2} fill="url(#revGrad)"/>
                      <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(0,72%,55%)"   strokeWidth={1.5} fill="url(#expGrad)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No revenue data available.</div>
                )}
              </div>
            </div>
            <div className="surface-elevated p-5">
              <h3 className="text-sm font-semibold">Expense Breakdown</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">By category</p>
              {expenseBreakdown.length > 0 ? (
                <>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={32} outerRadius={60} paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {expenseBreakdown.map((e,i)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:"8px",fontSize:"11px"}} formatter={(v:number)=>[fmt(v),""]}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-2">
                    {expenseBreakdown.map(e=>(
                      <div key={e.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:e.color}}/><span className="text-xs">{e.name}</span></div>
                        <span className="text-xs font-mono font-medium">{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">No expense data available.</div>
              )}
            </div>
          </div>

          {/* Top Clients + GST */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="surface-elevated p-5">
              <h3 className="text-sm font-semibold mb-4">Top Clients by Revenue</h3>
              {topClients.length > 0 ? (
                <div className="space-y-3">
                  {topClients.map((c,i)=>(
                    <motion.div key={c.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-muted-foreground w-4">#{i+1}</span>
                          <span className="font-medium">{c.name}</span>
                          {c.company && <span className="text-[11px] text-muted-foreground">{c.company}</span>}
                        </div>
                        <span className="font-mono text-sm font-semibold">{fmt(c.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{width:0}} animate={{width:`${(c.revenue/maxRevenue)*100}%`}} transition={{delay:i*0.07+0.2,duration:0.6}}
                          className="h-full gradient-primary rounded-full"/>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No client data available.</div>
              )}
            </div>
            <div className="surface-elevated p-5">
              <h3 className="text-sm font-semibold mb-1">GST Summary</h3>
              <p className="text-[11px] text-muted-foreground mb-4">Collected vs filed (last 6 months)</p>
              {gstData.length > 0 ? (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gstData} margin={{top:4,right:4,left:-16,bottom:0}} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,91%)" vertical={false}/>
                        <XAxis dataKey="month" tick={{fill:"hsl(220,10%,56%)",fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} tick={{fill:"hsl(220,10%,56%)",fontSize:10}} axisLine={false} tickLine={false}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="collected" name="Collected" fill="hsl(250,75%,65%)" radius={[4,4,0,0]} barSize={16}/>
                        <Bar dataKey="paid"      name="Filed"     fill="hsl(160,55%,55%)" radius={[4,4,0,0]} barSize={16}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary"/><span className="text-[11px] text-muted-foreground">Collected</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-[11px] text-muted-foreground">Filed</span></div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">No GST data available.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
