import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, Receipt, TrendingDown, Wallet, CalendarDays,
  X, Trash2,
} from "lucide-react";
import { expensesApi, Expense, ExpenseCategory } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const CATEGORIES: { key: ExpenseCategory; label: string; cls: string }[] = [
  { key: "OFFICE",    label: "Office",    cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { key: "SOFTWARE",  label: "Software",  cls: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
  { key: "TRAVEL",    label: "Travel",    cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  { key: "SALARY",    label: "Salary",    cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { key: "MARKETING", label: "Marketing", cls: "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" },
  { key: "UTILITIES", label: "Utilities", cls: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
  { key: "OTHER",     label: "Other",     cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
];
const catMap = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const PAYMENT_METHODS = ["cash", "bank_transfer", "UPI", "card", "other"];

const emptyForm = () => ({
  date: new Date().toISOString().split("T")[0],
  description: "", amount: "", category: "OTHER" as ExpenseCategory,
  paymentMethod: "cash", receiptNotes: "",
});

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(async () => {
    try { const { data } = await expensesApi.list(); setExpenses(data); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const debouncedSearch = useDebounce(search, 300);
  const filtered = expenses.filter(e => {
    const q = debouncedSearch.toLowerCase();
    return !q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
  });

  const totalAll     = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth    = expenses.filter(e => {
    const d = new Date(e.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s, e) => s + e.amount, 0);
  const topCategory  = (() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? `${catMap[sorted[0][0] as ExpenseCategory]?.label ?? sorted[0][0]}` : "—";
  })();

  const handleAdd = async () => {
    setSubmitting(true); setError("");
    try {
      await expensesApi.create({
        date: form.date, description: form.description,
        amount: parseFloat(form.amount) || 0, category: form.category,
        paymentMethod: form.paymentMethod,
        receiptNotes: form.receiptNotes || undefined,
      });
      await fetch();
      setShowAdd(false); setForm(emptyForm());
      toast.success("Expense added successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to add expense";
      setError(msg);
    } finally { setSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expensesApi.delete(deleteTarget);
      setExpenses(prev => prev.filter(e => e.id !== deleteTarget));
      toast.success("Expense deleted");
    } catch { toast.error("Failed to delete expense"); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search expenses…" search={search} onSearch={setSearch} />

        <div className="p-6 space-y-5 max-w-[1400px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
              <p className="text-sm text-muted-foreground mt-1">Track and manage all business expenses.</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm">
              <Plus size={15} /> Add Expense
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Expenses", value: fmt(totalAll),   icon: Receipt,      color: "text-primary" },
              { label: "This Month",     value: fmt(thisMonth),  icon: CalendarDays,  color: "text-amber-500" },
              { label: "Top Category",   value: topCategory,     icon: TrendingDown,  color: "text-red-500" },
              { label: "Total Records",  value: expenses.length, icon: Wallet,        color: "text-blue-500" },
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
                    {["Date", "Description", "Amount", "Category", "Payment", "Notes", ""].map(h => (
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
                  ) : filtered.map((e, i) => {
                    const cat = catMap[e.category] ?? catMap.OTHER;
                    return (
                      <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 font-medium">{e.description}</td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-red-500">{fmt(e.amount)}</td>
                        <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{e.paymentMethod.replace("_", " ")}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{e.receiptNotes || "—"}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDeleteTarget(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-16 text-center">
                      <Receipt size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
                      <p className="text-sm font-medium text-muted-foreground">No expenses found</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 mb-3">{search ? "Try adjusting your search." : "Track your first expense."}</p>
                      {!search && <button onClick={() => setShowAdd(true)} className="text-xs text-primary font-semibold hover:underline">+ Add Expense</button>}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Add Expense Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">Add Expense</h3>
              <button onClick={() => { setShowAdd(false); setError(""); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Date</label>
                  <input type="date" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Amount (₹)</label>
                  <input type="number" min={0} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Description</label>
                <input className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="Office supplies, software license, etc." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Category</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Payment Method</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Receipt Notes (optional)</label>
                <textarea rows={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                  placeholder="Receipt reference, vendor info…" value={form.receiptNotes} onChange={e => setForm(f => ({ ...f, receiptNotes: e.target.value }))} />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => { setShowAdd(false); setError(""); }} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleAdd} disabled={submitting || !form.description || !form.amount}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {submitting ? "Adding…" : "Add Expense"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Delete Expense</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Are you sure you want to delete <span className="font-medium text-foreground">{expenses.find(e => e.id === deleteTarget)?.description || "this expense"}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
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
