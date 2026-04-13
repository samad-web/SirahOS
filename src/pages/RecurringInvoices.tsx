import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, X, Repeat, Pause, Play, Zap, Trash2, Calendar, CheckCircle2, PauseCircle, StopCircle,
} from "lucide-react";
import {
  recurringInvoicesApi,
  customersApi,
  type RecurringInvoice,
  type RecurringFrequency,
  type RecurringStatus,
  type CreateRecurringInvoicePayload,
} from "@/lib/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { toast } from "sonner";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const FREQ_OPTS: { value: RecurringFrequency; label: string }[] = [
  { value: "WEEKLY",    label: "Weekly"    },
  { value: "MONTHLY",   label: "Monthly"   },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY",    label: "Yearly"    },
];

const STATUS_META: Record<RecurringStatus, { label: string; cls: string; icon: React.ElementType }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  PAUSED: { label: "Paused", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",         icon: PauseCircle  },
  ENDED:  { label: "Ended",  cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",               icon: StopCircle   },
};

type NewItem = { description: string; quantity: string; unitPrice: string };

const emptyForm = () => ({
  name: "",
  customerId: "",
  frequency: "MONTHLY" as RecurringFrequency,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  gstRate: "18",
  dueDays: "15",
  notes: "",
  items: [{ description: "", quantity: "1", unitPrice: "" }] as NewItem[],
});

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function RecurringInvoices() {
  const qc = useQueryClient();

  const { data: recurring = [], isLoading } = useQuery({
    queryKey: ["recurring-invoices"],
    queryFn: () => recurringInvoicesApi.list().then(r => r.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.list().then(r => r.data),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const addModalRef = useFocusTrap<HTMLDivElement>(showAdd, () => { setShowAdd(false); setError(""); });

  const stats = useMemo(() => ({
    total:  recurring.length,
    active: recurring.filter(r => r.status === "ACTIVE").length,
    paused: recurring.filter(r => r.status === "PAUSED").length,
    // Estimated monthly billed value — normalizes all frequencies to a
    // per-month figure using simple weights. Good enough for a glance.
    mrr:    recurring.filter(r => r.status === "ACTIVE").reduce((s, r) => {
      const subtotal = r.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
      const withGst = subtotal * (1 + r.gstRate / 100);
      const perMonth =
        r.frequency === "WEEKLY"  ? withGst * 4.33 :
        r.frequency === "MONTHLY" ? withGst :
        r.frequency === "QUARTERLY" ? withGst / 3 :
        withGst / 12;
      return s + perMonth;
    }, 0),
  }), [recurring]);

  const createMut = useMutation({
    mutationFn: (p: CreateRecurringInvoicePayload) => recurringInvoicesApi.create(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-invoices"] });
      toast.success("Recurring invoice created");
    },
  });

  const pauseMut = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.pause(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring-invoices"] }); toast.success("Paused"); },
  });
  const resumeMut = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.resume(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring-invoices"] }); toast.success("Resumed"); },
  });
  const runMut = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.runNow(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring-invoices"] }); qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice generated"); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to run";
      toast.error(msg);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring-invoices"] }); toast.success("Ended"); },
  });

  const handleCreate = async () => {
    setError("");
    if (!form.name.trim() || !form.customerId || !form.startDate) {
      setError("Name, customer, and start date are required");
      return;
    }
    const items = form.items
      .map(i => ({
        description: i.description.trim(),
        quantity: parseInt(i.quantity, 10) || 0,
        unitPrice: parseFloat(i.unitPrice) || 0,
      }))
      .filter(i => i.description && i.quantity > 0 && i.unitPrice > 0);

    if (items.length === 0) {
      setError("Add at least one valid line item");
      return;
    }

    try {
      await createMut.mutateAsync({
        name: form.name.trim(),
        customerId: form.customerId,
        frequency: form.frequency,
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        gstRate: parseFloat(form.gstRate) || 0,
        dueDays: parseInt(form.dueDays, 10) || 15,
        notes: form.notes || undefined,
        items,
      });
      setShowAdd(false);
      setForm(emptyForm());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Create failed";
      setError(msg);
    }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: "", quantity: "1", unitPrice: "" }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: keyof NewItem, value: string) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search recurring invoices…" />

        <div className="p-6 space-y-5 max-w-[1400px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Recurring Invoices</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Templates that automatically generate invoices on a schedule.
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
              aria-label="Create new recurring invoice"
            >
              <Plus size={15} aria-hidden /> New Recurring
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Templates", value: String(stats.total),  icon: Repeat,       color: "text-primary"       },
              { label: "Active",          value: String(stats.active), icon: CheckCircle2, color: "text-emerald-500"   },
              { label: "Paused",          value: String(stats.paused), icon: PauseCircle,  color: "text-amber-500"     },
              { label: "Estimated MRR",   value: fmt(Math.round(stats.mrr)), icon: Zap,    color: "text-violet-500"    },
            ].map(s => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
                  <s.icon size={15} className={s.color} strokeWidth={1.5} aria-hidden />
                </div>
                <span className="text-xl font-bold font-mono tabular-nums">{s.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Table */}
          <div className="surface-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Name", "Customer", "Frequency", "Next Run", "Generated", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 bg-muted rounded-lg animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : recurring.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <Repeat size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} aria-hidden />
                        <p className="text-sm font-medium text-muted-foreground">No recurring invoices yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1 mb-3">Set up a template to bill a customer on a schedule.</p>
                        <button onClick={() => setShowAdd(true)} className="text-xs text-primary font-semibold hover:underline">+ New Recurring</button>
                      </td>
                    </tr>
                  ) : (
                    recurring.map((r: RecurringInvoice) => {
                      const meta = STATUS_META[r.status];
                      const Icon = meta.icon;
                      return (
                        <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium">{r.name}</p>
                            {r.notes && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{r.notes}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{r.customer?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-xs">{r.frequency.charAt(0) + r.frequency.slice(1).toLowerCase()}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Calendar size={11} aria-hidden /> {formatDate(r.nextRunAt)}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono tabular-nums">{r.generatedCount}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>
                              <Icon size={10} aria-hidden /> {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {r.status === "ACTIVE" && (
                                <>
                                  <button
                                    onClick={() => runMut.mutate(r.id)}
                                    disabled={runMut.isPending}
                                    className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors disabled:opacity-40"
                                    aria-label={`Generate invoice now for ${r.name}`}
                                    title="Generate now"
                                  >
                                    <Zap size={13} aria-hidden />
                                  </button>
                                  <button
                                    onClick={() => pauseMut.mutate(r.id)}
                                    disabled={pauseMut.isPending}
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={`Pause ${r.name}`}
                                    title="Pause"
                                  >
                                    <Pause size={13} aria-hidden />
                                  </button>
                                </>
                              )}
                              {r.status === "PAUSED" && (
                                <button
                                  onClick={() => resumeMut.mutate(r.id)}
                                  disabled={resumeMut.isPending}
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors"
                                  aria-label={`Resume ${r.name}`}
                                  title="Resume"
                                >
                                  <Play size={13} aria-hidden />
                                </button>
                              )}
                              {r.status !== "ENDED" && (
                                <button
                                  onClick={() => { if (confirm(`End recurring invoice "${r.name}"? Existing generated invoices will be kept.`)) deleteMut.mutate(r.id); }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                                  aria-label={`End ${r.name}`}
                                  title="End"
                                >
                                  <Trash2 size={13} aria-hidden />
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Create modal ─── */}
      {showAdd && (
        <div
          ref={addModalRef}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recurring-modal-title"
        >
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 id="recurring-modal-title" className="font-semibold">New Recurring Invoice</h3>
              <button onClick={() => { setShowAdd(false); setError(""); }} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close dialog">
                <X size={16} aria-hidden />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required" htmlFor="ri-name">Name</label>
                <input
                  id="ri-name"
                  autoFocus
                  className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="Acme monthly retainer"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required" htmlFor="ri-customer">Customer</label>
                <select
                  id="ri-customer"
                  className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  value={form.customerId}
                  onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                >
                  <option value="">Select a customer…</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required" htmlFor="ri-freq">Frequency</label>
                  <select
                    id="ri-freq"
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value as RecurringFrequency }))}
                  >
                    {FREQ_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required" htmlFor="ri-start">Start Date</label>
                  <input
                    id="ri-start"
                    type="date"
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5" htmlFor="ri-end">End Date (optional)</label>
                  <input
                    id="ri-end"
                    type="date"
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5" htmlFor="ri-gst">GST %</label>
                  <input
                    id="ri-gst"
                    type="number"
                    step="0.01"
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.gstRate}
                    onChange={e => setForm(f => ({ ...f, gstRate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5" htmlFor="ri-due">Due (days)</label>
                  <input
                    id="ri-due"
                    type="number"
                    className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.dueDays}
                    onChange={e => setForm(f => ({ ...f, dueDays: e.target.value }))}
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Line Items</span>
                  <button onClick={addItem} className="text-[11px] text-primary font-semibold hover:underline" aria-label="Add line item">
                    + Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {form.items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-center">
                      <input
                        className="bg-muted rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 ring-primary/20"
                        placeholder="Description"
                        value={it.description}
                        onChange={e => updateItem(idx, "description", e.target.value)}
                        aria-label={`Item ${idx + 1} description`}
                      />
                      <input
                        type="number"
                        className="bg-muted rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 ring-primary/20"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={e => updateItem(idx, "quantity", e.target.value)}
                        aria-label={`Item ${idx + 1} quantity`}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="bg-muted rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 ring-primary/20"
                        placeholder="Unit price"
                        value={it.unitPrice}
                        onChange={e => updateItem(idx, "unitPrice", e.target.value)}
                        aria-label={`Item ${idx + 1} unit price`}
                      />
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={form.items.length === 1}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                        aria-label={`Remove item ${idx + 1}`}
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5" htmlFor="ri-notes">Notes</label>
                <textarea
                  id="ri-notes"
                  rows={2}
                  className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                  placeholder="Internal notes…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2" role="alert">
                  {error}
                </motion.p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => { setShowAdd(false); setError(""); }} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={createMut.isPending}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {createMut.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
