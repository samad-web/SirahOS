import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, Users, UserCheck,
  X, Mail, Phone, CreditCard, CalendarClock,
  StickyNote, Save, Loader2,
} from "lucide-react";
import { customersApi, Customer } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const emptyForm = () => ({
  name: "", company: "", email: "", phone: "", gstin: "",
  paymentType: "FULL" as "FULL" | "EMI",
  totalAmount: "", monthlyEmi: "",
});

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  // Detail / Notes panel
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const { data } = await customersApi.list();
      setCustomers(data);
    } catch { /* silently fail */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const debouncedSearch = useDebounce(search, 300);
  const filtered = customers.filter(c => {
    const q = debouncedSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.company ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const activeCount  = customers.filter(c => c.status === "ACTIVE").length;
  const emiCount     = customers.filter(c => c.paymentType === "EMI").length;

  // Auto-calculate total months
  const totalAmt   = parseFloat(form.totalAmount) || 0;
  const monthlyAmt = parseFloat(form.monthlyEmi) || 0;
  const calcMonths = totalAmt > 0 && monthlyAmt > 0 ? Math.ceil(totalAmt / monthlyAmt) : 0;

  const handleAdd = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        company: form.company || undefined,
        phone: form.phone || undefined,
        gstin: form.gstin || undefined,
        paymentType: form.paymentType,
      };
      if (form.paymentType === "EMI") {
        payload.totalAmount = totalAmt;
        payload.monthlyEmi = monthlyAmt;
      }
      await customersApi.create(payload);
      await fetchCustomers();
      setShowAdd(false);
      setForm(emptyForm());
      toast.success("Customer added successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to add customer";
      setError(msg);
    } finally { setSubmitting(false); }
  };

  const openCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setNotesValue(c.notes ?? "");
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    setNotesSaving(true);
    try {
      await customersApi.update(selectedCustomer.id, { notes: notesValue || null });
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, notes: notesValue || undefined } : c));
      setSelectedCustomer(prev => prev ? { ...prev, notes: notesValue || undefined } : null);
      toast.success("Notes saved");
    } catch { toast.error("Failed to save notes"); }
    finally { setNotesSaving(false); }
  };

  const initials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search customers…" search={search} onSearch={setSearch} />

        <div className="p-6 space-y-5 max-w-[1400px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage client relationships and billing history.</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm">
              <Plus size={15} /> Add Customer
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Customers", value: customers.length, icon: Users, color: "text-primary" },
              { label: "Active Clients", value: activeCount, icon: UserCheck, color: "text-emerald-500" },
              { label: "Full Payment", value: customers.length - emiCount, icon: CreditCard, color: "text-blue-500" },
              { label: "Installment", value: emiCount, icon: CalendarClock, color: "text-amber-500" },
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
                    {["Customer", "Contact", "GSTIN", "Type", "EMI Details", "Status", "Since", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-4"><div className="h-4 bg-muted rounded-lg animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.map((c, i) => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-white">{initials(c.name)}</span>
                          </div>
                          <div><p className="font-medium">{c.name}</p><p className="text-[11px] text-muted-foreground">{c.company}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={10} />{c.email}</span>
                          {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.gstin || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c.paymentType === "EMI" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"}`}>
                          {c.paymentType === "EMI" ? "Installment" : "Full Payment"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.paymentType === "EMI" && c.monthlyEmi ? (
                          <div className="text-xs">
                            <p className="font-mono font-medium">{fmt(c.monthlyEmi)}<span className="text-muted-foreground">/mo</span></p>
                            <p className="text-muted-foreground">{c.totalMonths} months &middot; {fmt(c.totalAmount ?? 0)} total</p>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {c.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openCustomer(c)} title="View details & notes" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <StickyNote size={13} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-16 text-center">
                      <Users size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
                      <p className="text-sm font-medium text-muted-foreground">No customers found</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 mb-3">{search ? "Try adjusting your search." : "Add your first customer to get started."}</p>
                      {!search && <button onClick={() => setShowAdd(true)} className="text-xs text-primary font-semibold hover:underline">+ Add Customer</button>}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Add Customer Modal ─── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold">Add Customer</h3>
              <button onClick={() => { setShowAdd(false); setError(""); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Basic info */}
              {([
                { label: "Full Name", field: "name", ph: "Customer name", type: "text", required: true },
                { label: "Company", field: "company", ph: "Company name", type: "text", required: false },
                { label: "Email", field: "email", ph: "customer@company.com", type: "email", required: true },
                { label: "Phone", field: "phone", ph: "+91 XXXXX XXXXX", type: "tel", required: false },
                { label: "Client GSTIN", field: "gstin", ph: "15 digit GSTIN", type: "text", required: false },
              ] as { label: string; field: keyof typeof form; ph: string; type: string; required: boolean }[]).map(({ label, field, ph, type, required }, idx) => (
                <div key={field}>
                  <label className={`text-xs font-medium text-muted-foreground block mb-1.5 ${required ? "field-required" : ""}`}>{label}</label>
                  <input type={type} autoFocus={idx === 0} className={`w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 ${field === "gstin" ? "uppercase tracking-wide" : ""}`}
                    placeholder={ph} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: field === "gstin" ? e.target.value.toUpperCase() : e.target.value }))} />
                </div>
              ))}

              {/* Payment type toggle */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">Payment Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: "FULL" as const, label: "Full Payment", desc: "One-time billing", icon: CreditCard },
                    { key: "EMI" as const, label: "Installment", desc: "Monthly payments", icon: CalendarClock },
                  ]).map(opt => (
                    <button key={opt.key} type="button" onClick={() => setForm(f => ({ ...f, paymentType: opt.key }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${form.paymentType === opt.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <opt.icon size={18} className={form.paymentType === opt.key ? "text-primary" : "text-muted-foreground"} />
                      <div>
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* EMI fields */}
              {form.paymentType === "EMI" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 overflow-hidden">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">Total Amount (₹)</label>
                      <input type="number" min={0} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                        placeholder="100000" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">Monthly EMI (₹)</label>
                      <input type="number" min={0} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                        placeholder="10000" value={form.monthlyEmi} onChange={e => setForm(f => ({ ...f, monthlyEmi: e.target.value }))} />
                    </div>
                  </div>
                  {calcMonths > 0 && (
                    <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Auto-calculated duration</p>
                        <p className="text-lg font-bold font-mono mt-0.5">{calcMonths} <span className="text-sm font-normal text-muted-foreground">months</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Monthly payment</p>
                        <p className="text-sm font-semibold font-mono mt-0.5">{fmt(monthlyAmt)}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

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
                disabled={submitting || !form.name || !form.email || (form.paymentType === "EMI" && (!totalAmt || !monthlyAmt))}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {submitting ? "Adding…" : "Add Customer"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Customer Detail / Notes Panel ─── */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{initials(selectedCustomer.name)}</span>
                </div>
                <div>
                  <h3 className="font-semibold">{selectedCustomer.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.company || selectedCustomer.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Email</p>
                  <p className="text-sm mt-0.5 flex items-center gap-1"><Mail size={12} className="text-muted-foreground" />{selectedCustomer.email}</p>
                </div>
                {selectedCustomer.phone && (
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Phone</p>
                    <p className="text-sm mt-0.5 flex items-center gap-1"><Phone size={12} className="text-muted-foreground" />{selectedCustomer.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Payment Type</p>
                  <p className="text-sm mt-0.5">{selectedCustomer.paymentType === "EMI" ? "Installment" : "Full Payment"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selectedCustomer.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {selectedCustomer.status === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                </div>
                {selectedCustomer.gstin && (
                  <div className="col-span-2">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">GSTIN</p>
                    <p className="text-sm mt-0.5 font-mono">{selectedCustomer.gstin}</p>
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div>
                <label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                  <StickyNote size={13} /> Notes
                </label>
                <textarea
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20 resize-none min-h-[120px] placeholder:text-muted-foreground"
                  placeholder="Add notes about this customer…"
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setSelectedCustomer(null)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Close</button>
              <button onClick={handleSaveNotes} disabled={notesSaving || notesValue === (selectedCustomer.notes ?? "")}
                className="flex items-center gap-1.5 px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {notesSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Notes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
