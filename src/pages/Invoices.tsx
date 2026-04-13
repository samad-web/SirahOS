import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus, FileText, CheckCircle, Clock, AlertTriangle, AlertCircle,
  X, Trash2, Eye, Loader2, Download,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { invoicesApi, customersApi, type Invoice, type Customer } from "@/lib/api";
import { toCSV, downloadCSV, datedFilename, type CSVColumn } from "@/lib/csv";
import { toast } from "sonner";

interface FormLineItem { id: string; description: string; unitPrice: number; quantity: number; }

/** All currency math uses integer cents internally to avoid floating-point errors */
const getSubtotal = (items: { quantity: number; unitPrice: number }[]) =>
  items.reduce((s, i) => s + Math.round(i.quantity * i.unitPrice * 100), 0) / 100;
const getGSTAmt  = (sub: number, rate: number) => Math.round(sub * rate * 100 / 100) / 100;
const getTotal   = (sub: number, gst: number) => Math.round((sub + gst) * 100) / 100;
const getAmountPaid = (inv: Invoice) =>
  (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusCfg: Record<string, { label: string; cls: string }> = {
  PAID:    { label:"Paid",    cls:"bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  PENDING: { label:"Pending", cls:"bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  OVERDUE: { label:"Overdue", cls:"bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  PARTIAL: { label:"Partial", cls:"bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
};

const emptyForm = () => ({
  customerId:"", company:"", dueDate:"", gstRate:18, notes:"",
  paymentType: "FULL" as "FULL" | "EMI", emiMonths: 3,
  lineItems:[{ id:"1", description:"", unitPrice:0, quantity:1 }] as FormLineItem[],
});

export default function Invoices() {
  const qc = useQueryClient();
  const [filter, setFilter]           = useState<"all"|"PAID"|"PENDING"|"OVERDUE"|"PARTIAL">("all");
  const [search, setSearch]           = useState("");
  const [showCreate, setShowCreate]   = useState(false);
  const [view, setView]               = useState<Invoice | null>(null);
  const [form, setForm]               = useState(emptyForm());

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoicesApi.list().then(r => r.data),
  });
  const { data: customers = [], isLoading: loadingCust } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.list().then(r => r.data),
  });
  const loading = loadingInv || loadingCust;

  const createMut = useMutation({
    mutationFn: (payload: unknown) => invoicesApi.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => invoices.filter(inv => {
    const ok = filter === "all" || inv.status === filter;
    const q  = debouncedSearch.toLowerCase();
    const clientName = inv.customer?.name ?? "";
    const companyName = inv.customer?.company ?? "";
    return ok && (!q || clientName.toLowerCase().includes(q) || companyName.toLowerCase().includes(q) || inv.invoiceNumber.toLowerCase().includes(q));
  }), [invoices, filter, debouncedSearch]);

  const { totalBilled, totalCollected, totalPending, totalOverdue, overdueCount } = useMemo(() => {
    const billed = invoices.reduce((s,i) => { const sub=getSubtotal(i.items); return s+getTotal(sub,getGSTAmt(sub,i.gstRate)); },0);
    const collected = invoices.reduce((s,i) => s+getAmountPaid(i), 0);
    const overdue = invoices.filter(i=>i.status==="OVERDUE");
    const overdueAmt = overdue.reduce((s,i) => { const sub=getSubtotal(i.items); return s+getTotal(sub,getGSTAmt(sub,i.gstRate))-getAmountPaid(i); },0);
    return { totalBilled: billed, totalCollected: collected, totalPending: billed - collected, totalOverdue: overdueAmt, overdueCount: overdue.length };
  }, [invoices]);

  const handleExport = () => {
    const columns: CSVColumn<Invoice>[] = [
      { header: "Invoice #",      value: i => i.invoiceNumber },
      { header: "Customer",       value: i => i.customer?.name ?? "" },
      { header: "Company",        value: i => i.customer?.company ?? "" },
      { header: "Email",          value: i => i.customer?.email ?? "" },
      { header: "Status",         value: i => i.status },
      { header: "Payment Type",   value: i => i.paymentType },
      { header: "GST Rate (%)",   value: i => i.gstRate },
      { header: "Subtotal",       value: i => getSubtotal(i.items) },
      { header: "GST Amount",     value: i => getGSTAmt(getSubtotal(i.items), i.gstRate) },
      { header: "Total",          value: i => { const s = getSubtotal(i.items); return getTotal(s, getGSTAmt(s, i.gstRate)); } },
      { header: "Amount Paid",    value: i => getAmountPaid(i) },
      { header: "Due Date",       value: i => i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : "" },
      { header: "Created",        value: i => new Date(i.createdAt).toISOString().slice(0, 10) },
    ];
    downloadCSV(toCSV(filtered, columns), datedFilename("invoices"));
    toast.success(`Exported ${filtered.length} invoice${filtered.length === 1 ? "" : "s"}`);
  };

  const addItem = () => setForm(f=>({...f, lineItems:[...f.lineItems,{id:Date.now().toString(),description:"",unitPrice:0,quantity:1}]}));
  const removeItem = (id:string) => setForm(f=>({...f, lineItems:f.lineItems.filter(i=>i.id!==id)}));
  const editItem = (id:string, field:keyof FormLineItem, val:string|number) =>
    setForm(f=>({...f, lineItems:f.lineItems.map(i=>i.id===id?{...i,[field]:val}:i)}));

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync({
        customerId: form.customerId,
        gstRate: form.gstRate,
        paymentType: form.paymentType,
        emiMonths: form.paymentType === "EMI" ? form.emiMonths : undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
        items: form.lineItems.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
      setShowCreate(false);
      setForm(emptyForm());
      toast.success("Invoice created successfully");
    } catch {
      toast.error("Failed to create invoice");
    }
  };

  const fSub=getSubtotal(form.lineItems), fGST=getGSTAmt(fSub,form.gstRate), fTotal=getTotal(fSub,fGST);
  const filters = [
    {key:"all" as const,label:"All"},
    {key:"PAID" as const,label:"Paid"},
    {key:"PENDING" as const,label:"Pending"},
    {key:"OVERDUE" as const,label:"Overdue"},
    {key:"PARTIAL" as const,label:"Partial"},
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search invoices…" search={search} onSearch={setSearch} />

        <div className="p-6 space-y-5 max-w-[1400px]">
          {/* Overdue alert banner */}
          {!loading && overdueCount > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">
                <span className="font-semibold">{overdueCount} invoice{overdueCount > 1 ? "s" : ""} overdue</span>
                {" "}&mdash; {fmt(totalOverdue)} outstanding past due date.
              </p>
              <button onClick={() => setFilter("OVERDUE")} className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline whitespace-nowrap">
                View Overdue
              </button>
            </motion.div>
          )}

          {/* Title */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Invoices</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage billing, GST, and payment tracking.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
                aria-label="Export invoices as CSV"
              >
                <Download size={15} aria-hidden /> Export CSV
              </button>
              <button onClick={()=>setShowCreate(true)} className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm">
                <Plus size={15} aria-hidden /> New Invoice
              </button>
            </div>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label:"Total Invoiced", value:fmt(totalBilled),    icon:FileText,      color:"text-primary" },
                  { label:"Collected",      value:fmt(totalCollected),  icon:CheckCircle,   color:"text-emerald-500" },
                  { label:"Pending",        value:fmt(totalPending),    icon:Clock,         color:"text-amber-500" },
                  { label:"Overdue",        value:fmt(totalOverdue),    icon:AlertTriangle, color:"text-red-500" },
                ].map(stat=>(
                  <motion.div key={stat.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                      <stat.icon size={15} className={stat.color} strokeWidth={1.5} />
                    </div>
                    <span className="text-xl font-bold font-mono tabular-nums">{stat.value}</span>
                  </motion.div>
                ))}
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 border-b border-border">
                {filters.map(f=>(
                  <button key={f.key} onClick={()=>setFilter(f.key)} className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${filter===f.key?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {f.label}
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {f.key==="all"?invoices.length:invoices.filter(i=>i.status===f.key).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="surface-elevated overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Invoice #","Client","Date","Due Date","Subtotal","GST","Total","Type","Paid","Balance","Status",""].map(h=>(
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((inv,i)=>{
                        const sub=getSubtotal(inv.items), gst=getGSTAmt(sub,inv.gstRate), total=getTotal(sub,gst), amtPaid=getAmountPaid(inv), bal=total-amtPaid;
                        const st=statusCfg[inv.status] ?? statusCfg.PENDING;
                        return (
                          <motion.tr key={inv.id} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.15}} onClick={()=>setView(inv)} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{inv.invoiceNumber}</td>
                            <td className="px-4 py-3"><p className="font-medium">{inv.customer?.name ?? "—"}</p><p className="text-[11px] text-muted-foreground">{inv.customer?.company ?? ""}</p></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-CA") : "—"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-CA") : "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs">{fmt(sub)}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmt(gst)} <span className="text-[10px]">({inv.gstRate}%)</span></td>
                            <td className="px-4 py-3 font-mono text-xs font-semibold">{fmt(total)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${inv.paymentType==="EMI"?"bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400":"bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"}`}>
                                {inv.paymentType==="EMI"?`EMI ×${inv.emiMonths}`:"Full"}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">{fmt(amtPaid)}</td>
                            <td className="px-4 py-3 font-mono text-xs text-red-500">{bal>0?fmt(bal):"—"}</td>
                            <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
                            <td className="px-4 py-3">
                              <button onClick={()=>setView(inv)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><Eye size={13} /></button>
                            </td>
                          </motion.tr>
                        );
                      })}
                      {filtered.length===0&&(
                        <tr><td colSpan={12} className="px-4 py-16 text-center">
                          <FileText size={40} className="mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
                          <p className="text-sm font-medium text-muted-foreground">No invoices found</p>
                          <p className="text-xs text-muted-foreground/70 mt-1 mb-3">{search ? "Try adjusting your search." : "Create your first invoice to get started."}</p>
                          {!search && <button onClick={()=>setShowCreate(true)} className="text-xs text-primary font-semibold hover:underline">+ New Invoice</button>}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ─── Create Invoice Modal ─── */}
      {showCreate&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === "Escape") setShowCreate(false); }}>
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-semibold text-base">New Invoice</h3>
              <button onClick={()=>setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5 field-required">Client</label>
                  <select autoFocus className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.customerId} onChange={e=>{
                      const c = customers.find(c=>c.id===e.target.value);
                      setForm(f=>({...f, customerId:e.target.value, company:c?.company??""}));
                    }}>
                    <option value="">Select client…</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name} — {c.company ?? ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Company</label>
                  <input className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 read-only:opacity-60" placeholder="Auto-filled from client"
                    value={form.company} readOnly />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Due Date</label>
                  <input type="date" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">GST Rate</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.gstRate} onChange={e=>setForm(f=>({...f,gstRate:Number(e.target.value)}))}>
                    {[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Payment Type</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={form.paymentType} onChange={e=>setForm(f=>({...f,paymentType:e.target.value as "FULL"|"EMI"}))}>
                    <option value="FULL">Full</option>
                    <option value="EMI">EMI</option>
                  </select>
                </div>
              </div>
              {form.paymentType==="EMI"&&(
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">EMI Months</label>
                    <input type="number" min={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                      value={form.emiMonths} onChange={e=>setForm(f=>({...f,emiMonths:Number(e.target.value)}))} />
                  </div>
                </div>
              )}
              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Line Items</label>
                  <button onClick={addItem} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"><Plus size={12}/>Add item</button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <span className="col-span-5">Description</span><span className="col-span-2">Qty</span><span className="col-span-4">Unit Price (₹)</span>
                  </div>
                  {form.lineItems.map(item=>(
                    <div key={item.id} className="grid grid-cols-12 gap-2">
                      <input className="col-span-5 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20" placeholder="Service description"
                        value={item.description} onChange={e=>editItem(item.id,"description",e.target.value)} />
                      <input type="number" min={1} className="col-span-2 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                        value={item.quantity} onChange={e=>editItem(item.id,"quantity",Number(e.target.value))} />
                      <input type="number" min={0} className="col-span-4 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                        value={item.unitPrice} onChange={e=>editItem(item.id,"unitPrice",Number(e.target.value))} />
                      <button onClick={()=>removeItem(item.id)} disabled={form.lineItems.length===1}
                        className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-30"><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
              </div>
              {/* Totals */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{fmt(fSub)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>GST ({form.gstRate}%)</span><span className="font-mono">{fmt(fGST)}</span></div>
                <div className="flex justify-between font-bold border-t border-border pt-2"><span>Total</span><span className="font-mono">{fmt(fTotal)}</span></div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Notes (optional)</label>
                <textarea rows={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none" placeholder="Payment instructions…"
                  value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={()=>setShowCreate(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!form.customerId||form.lineItems.some(i=>!i.description||!i.unitPrice)||createMut.isPending}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {createMut.isPending ? "Creating…" : "Create Invoice"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── View Invoice Modal ─── */}
      {view&&(()=>{
        const sub=getSubtotal(view.items), gst=getGSTAmt(sub,view.gstRate), total=getTotal(sub,gst), amtPaid=getAmountPaid(view), bal=total-amtPaid;
        const st=statusCfg[view.status] ?? statusCfg.PENDING;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div><h3 className="font-semibold">{view.invoiceNumber}</h3><p className="text-xs text-muted-foreground mt-0.5">{view.customer?.company ?? ""}</p></div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                  <button onClick={()=>setView(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16}/></button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-[11px] text-muted-foreground mb-0.5">Client</p><p className="font-medium">{view.customer?.name ?? "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground mb-0.5">Due Date</p><p className="font-medium">{view.dueDate ? new Date(view.dueDate).toLocaleDateString("en-CA") : "—"}</p></div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
                  <div className="space-y-1.5">
                    {view.items.map(item=>(
                      <div key={item.id} className="flex items-center justify-between text-sm bg-muted/40 rounded-xl px-3 py-2">
                        <span>{item.description} {item.quantity > 1 && <span className="text-muted-foreground text-xs">×{item.quantity}</span>}</span>
                        <span className="font-mono font-medium">{fmt(item.quantity * item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{fmt(sub)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>GST ({view.gstRate}%)</span><span className="font-mono">{fmt(gst)}</span></div>
                  <div className="flex justify-between font-bold border-t border-border pt-2"><span>Total</span><span className="font-mono">{fmt(total)}</span></div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Paid</span><span className="font-mono">{fmt(amtPaid)}</span></div>
                  {bal>0&&<div className="flex justify-between text-red-500 font-semibold"><span>Balance Due</span><span className="font-mono">{fmt(bal)}</span></div>}
                </div>
                {view.paymentType==="EMI"&&view.emiMonths&&(
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">EMI Schedule</p>
                    <div className="space-y-1.5">
                      {Array.from({length:view.emiMonths}).map((_,idx)=>{
                        const amt=Math.ceil(total/view.emiMonths!);
                        const paid=amtPaid>=amt*(idx+1);
                        const partial=!paid&&amtPaid>amt*idx;
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm bg-muted/40 rounded-xl px-3 py-2">
                            <span className="text-muted-foreground">Installment {idx+1}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{fmt(amt)}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${paid?"bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400":partial?"bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400":"bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                {paid?"Paid":partial?"Partial":"Pending"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {view.notes&&<div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p><p className="text-sm text-muted-foreground">{view.notes}</p></div>}
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}
