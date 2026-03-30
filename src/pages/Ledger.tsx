import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { TrendingUp, TrendingDown, IndianRupee, BookOpen, Plus, X, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ledgerApi, LedgerEntry } from "@/lib/api";
import { toast } from "sonner";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
type Tab = "overview"|"journal"|"pl"|"expenses";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Ledger() {
  const [tab, setTab]       = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState({ date:"", description:"", account:"", debit:"", credit:"" });

  // ─── Fetch ledger entries on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ledgerApi.list()
      .then(res => { if (!cancelled) setEntries(res.data); })
      .catch(() => { /* handled by UI state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ─── Compute P&L from entries ────────────────────────────────────────────────
  const plData = useMemo(() => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};

    for (const e of entries) {
      if (e.credit > 0) {
        incomeMap[e.account] = (incomeMap[e.account] || 0) + e.credit;
      }
      if (e.debit > 0) {
        expenseMap[e.account] = (expenseMap[e.account] || 0) + e.debit;
      }
    }

    return [
      ...Object.entries(incomeMap).map(([category, amount]) => ({ category, type: "income" as const, amount })),
      ...Object.entries(expenseMap).map(([category, amount]) => ({ category, type: "expense" as const, amount })),
    ];
  }, [entries]);

  // ─── Compute monthly breakdown ───────────────────────────────────────────────
  const monthlyPL = useMemo(() => {
    const monthMap: Record<string, { income: number; expense: number }> = {};

    for (const e of entries) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0 };
      monthMap[key].income += e.credit;
      monthMap[key].expense += e.debit;
    }

    return Object.keys(monthMap)
      .sort()
      .map(key => {
        const monthIdx = parseInt(key.split("-")[1], 10);
        return { month: MONTH_NAMES[monthIdx], income: monthMap[key].income, expense: monthMap[key].expense };
      });
  }, [entries]);

  // ─── Compute expense entries (debit > 0) ─────────────────────────────────────
  const expenseEntries = useMemo(() => {
    return entries
      .filter(e => e.debit > 0)
      .map(e => ({
        id: e.id,
        date: e.date,
        description: e.description,
        category: e.category || e.account,
        amount: e.debit,
        paid: e.status === "PAID",
      }));
  }, [entries]);

  const totalIncome  = plData.filter(d=>d.type==="income").reduce((s,d)=>s+d.amount,0);
  const totalExpense = plData.filter(d=>d.type==="expense").reduce((s,d)=>s+d.amount,0);
  const netProfit    = totalIncome - totalExpense;

  const filteredJournal = entries.filter(e => {
    const q = search.toLowerCase();
    return !q || e.description.toLowerCase().includes(q) || e.account.toLowerCase().includes(q) || e.ref.toLowerCase().includes(q);
  });

  const handleAddEntry = async () => {
    const payload = {
      date: newEntry.date,
      ref: "MAN-" + Date.now().toString().slice(-4),
      description: newEntry.description,
      account: newEntry.account,
      debit: Number(newEntry.debit) || 0,
      credit: Number(newEntry.credit) || 0,
      status: "PAID" as const,
    };
    try {
      const res = await ledgerApi.create(payload);
      setEntries(prev => [...prev, res.data]);
      toast.success("Journal entry added");
    } catch {
      toast.error("Failed to create entry");
    }
    setShowAdd(false);
    setNewEntry({ date:"", description:"", account:"", debit:"", credit:"" });
  };

  const tabs: {key:Tab;label:string}[] = [
    {key:"overview",label:"Overview"},
    {key:"journal",label:"Journal"},
    {key:"pl",label:"P&L"},
    {key:"expenses",label:"Expenses"},
  ];

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm font-medium">Loading ledger…</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search ledger…" search={search} onSearch={setSearch} />

        <div className="p-6 space-y-5 max-w-[1400px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Ledger</h2>
              <p className="text-sm text-muted-foreground mt-1">Accounting records, P&L, and expense tracking.</p>
            </div>
            {tab==="journal"&&(
              <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm">
                <Plus size={15}/> Add Entry
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {tabs.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)} className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${tab===t.key?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ─── OVERVIEW ─── */}
          {tab==="overview"&&(
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label:"Total Income",  value:fmt(totalIncome),  icon:TrendingUp,   color:"text-emerald-500" },
                  { label:"Total Expenses",value:fmt(totalExpense), icon:TrendingDown, color:"text-red-500" },
                  { label:"Net Profit",    value:fmt(netProfit),    icon:IndianRupee,  color:"text-primary" },
                  { label:"Profit Margin", value: totalIncome > 0 ? `${((netProfit/totalIncome)*100).toFixed(1)}%` : "0.0%", icon:BookOpen, color:"text-amber-500" },
                ].map(stat=>(
                  <motion.div key={stat.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                      <stat.icon size={15} className={stat.color} strokeWidth={1.5}/>
                    </div>
                    <span className="text-xl font-bold font-mono tabular-nums">{stat.value}</span>
                  </motion.div>
                ))}
              </div>
              {monthlyPL.length > 0 ? (
                <div className="surface-elevated p-5">
                  <h3 className="text-sm font-semibold mb-1">Monthly P&L</h3>
                  <p className="text-[11px] text-muted-foreground mb-4">Income vs Expenses</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyPL} margin={{top:4,right:4,left:-16,bottom:0}} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,91%)" vertical={false}/>
                        <XAxis dataKey="month" tick={{fill:"hsl(220,10%,56%)",fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} tick={{fill:"hsl(220,10%,56%)",fontSize:10}} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{backgroundColor:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:"12px",fontSize:"12px"}}
                          formatter={(v:number,name:string)=>[fmt(v),name==="income"?"Income":"Expenses"]}/>
                        <Bar dataKey="income"  fill="hsl(250,75%,65%)" radius={[4,4,0,0]} barSize={18}/>
                        <Bar dataKey="expense" fill="hsl(0,72%,65%)"   radius={[4,4,0,0]} barSize={18}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="surface-elevated p-8 text-center">
                  <p className="text-sm text-muted-foreground">No data available for the monthly P&L chart.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── JOURNAL ─── */}
          {tab==="journal"&&(
            <div className="surface-elevated overflow-hidden">
              {filteredJournal.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Date","Reference","Description","Account","Debit","Credit"].map(h=>(
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJournal.map((e,i)=>(
                        <motion.tr key={e.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{e.date}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{e.ref}</td>
                          <td className="px-4 py-3 text-sm">{e.description}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{e.account}</td>
                          <td className="px-4 py-3 font-mono text-sm text-emerald-600 dark:text-emerald-400">{e.debit>0?fmt(e.debit):"—"}</td>
                          <td className="px-4 py-3 font-mono text-sm text-red-500">{e.credit>0?fmt(e.credit):"—"}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-muted/30">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</td>
                        <td className="px-4 py-3 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(entries.reduce((s,e)=>s+e.debit,0))}</td>
                        <td className="px-4 py-3 font-mono text-sm font-bold text-red-500">{fmt(entries.reduce((s,e)=>s+e.credit,0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">{search ? "No entries match your search." : "No journal entries yet. Add one to get started."}</p>
                </div>
              )}
            </div>
          )}

          {/* ─── P&L ─── */}
          {tab==="pl"&&(
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="surface-elevated overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Income</h3>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">{fmt(totalIncome)}</span>
                </div>
                {plData.filter(d=>d.type==="income").length > 0 ? (
                  plData.filter(d=>d.type==="income").map((row,i)=>(
                    <motion.div key={row.category} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}} className="flex items-center justify-between px-5 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"/>
                        <span className="text-sm">{row.category}</span>
                      </div>
                      <span className="font-mono text-sm font-medium">{fmt(row.amount)}</span>
                    </motion.div>
                  ))
                ) : (
                  <div className="px-5 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No income entries found.</p>
                  </div>
                )}
              </div>
              <div className="surface-elevated overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Expenses</h3>
                  <span className="text-sm font-bold text-red-500 font-mono">{fmt(totalExpense)}</span>
                </div>
                {plData.filter(d=>d.type==="expense").length > 0 ? (
                  plData.filter(d=>d.type==="expense").map((row,i)=>(
                    <motion.div key={row.category} initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}} className="flex items-center justify-between px-5 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500"/>
                        <span className="text-sm">{row.category}</span>
                      </div>
                      <span className="font-mono text-sm font-medium">{fmt(row.amount)}</span>
                    </motion.div>
                  ))
                ) : (
                  <div className="px-5 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No expense entries found.</p>
                  </div>
                )}
              </div>
              <div className="lg:col-span-2 surface-elevated p-5">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">Net Profit / Loss</span>
                  <span className={`text-xl font-bold font-mono tabular-nums ${netProfit>=0?"text-emerald-600 dark:text-emerald-400":"text-red-500"}`}>{fmt(netProfit)}</span>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:`${totalIncome > 0 ? Math.min((netProfit/totalIncome)*100,100) : 0}%`}}/>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Profit margin: {totalIncome > 0 ? ((netProfit/totalIncome)*100).toFixed(1) : "0.0"}%</p>
              </div>
            </div>
          )}

          {/* ─── EXPENSES ─── */}
          {tab==="expenses"&&(
            <div className="surface-elevated overflow-hidden">
              {expenseEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Date","Description","Category","Amount","Status"].map(h=>(
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expenseEntries.map((e,i)=>(
                        <motion.tr key={e.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground">{e.date}</td>
                          <td className="px-4 py-3 font-medium">{e.description}</td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{e.category}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm font-semibold">{fmt(e.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${e.paid?"bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                              {e.paid?"Paid":"Pending"}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-muted/30">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total Expenses</td>
                        <td className="px-4 py-3 font-mono text-sm font-bold">{fmt(expenseEntries.reduce((s,e)=>s+e.amount,0))}</td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No expense entries found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── Add Journal Entry Modal ─── */}
      {showAdd&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">Add Journal Entry</h3>
              <button onClick={()=>setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-4">
              {([
                {label:"Date",        field:"date",        type:"date",   ph:""},
                {label:"Description", field:"description", type:"text",   ph:"Payment received"},
                {label:"Account",     field:"account",     type:"text",   ph:"Bank Account"},
                {label:"Debit (₹)",   field:"debit",       type:"number", ph:"0"},
                {label:"Credit (₹)",  field:"credit",      type:"number", ph:"0"},
              ] as {label:string;field:keyof typeof newEntry;type:string;ph:string}[]).map(({label,field,type,ph})=>(
                <div key={field}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
                  <input type={type} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    placeholder={ph} value={newEntry[field]} onChange={e=>setNewEntry(f=>({...f,[field]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={()=>setShowAdd(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleAddEntry} disabled={!newEntry.date||!newEntry.description||!newEntry.account}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                Add Entry
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
