import { useState } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { Building2, Receipt, BellRing, Palette, Save, Check, Users, Plus, X, DatabaseZap, Trash2, Loader2, AlertTriangle, Banknote, IndianRupee } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS, Role } from "@/contexts/AuthContext";
import { adminApi, finesApi } from "@/lib/api";
import type { Fine, FineSummary } from "@/lib/api";

type Tab = "company" | "tax" | "notifications" | "appearance" | "users" | "fines" | "data";

interface CompanySettings {
  name: string; address: string; city: string; state: string; pincode: string;
  gstin: string; email: string; phone: string; website: string; invoicePrefix: string;
}
interface TaxSettings {
  defaultGSTRate: number; roundOff: boolean; showHSN: boolean; taxInclusive: boolean;
  gstCategory: string;
}
interface NotifSettings {
  paymentReminder: boolean; reminderDays: number; overdueAlert: boolean;
  newInvoiceAlert: boolean; emailNotifs: boolean; dashboardAlerts: boolean;
}


export default function SettingsPage() {
  const { user: currentUser, allUsers, addUser, toggleStatus } = useAuth();
  const isAdmin = currentUser?.role === "ADMIN";

  const [tab, setTab]   = useState<Tab>("company");
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  const SETTINGS_KEY = "bf_settings";

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    } catch { return {}; }
  }

  const stored = loadSettings();

  const [company, setCompany] = useState<CompanySettings>({
    name:"", address:"", city:"", state:"", pincode:"",
    gstin:"", email:"", phone:"", website:"", invoicePrefix:"INV",
    ...stored.company,
  });

  const [tax, setTax] = useState<TaxSettings>({
    defaultGSTRate:18, roundOff:true, showHSN:false,
    taxInclusive:false, gstCategory:"Regular",
    ...stored.tax,
  });

  const [notif, setNotif] = useState<NotifSettings>({
    paymentReminder:true, reminderDays:3, overdueAlert:true,
    newInvoiceAlert:true, emailNotifs:true, dashboardAlerts:true,
    ...stored.notif,
  });

  const [theme, setTheme]   = useState(stored.theme ?? "system");
  const [accent, setAccent] = useState(stored.accent ?? "purple");

  // Users tab (admin only)
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name:"", email:"", password:"", role:"DEVELOPER" as Role, reportsToId:"" });
  const managers = allUsers.filter(u => ["ADMIN","PROJECT_MANAGER","LEAD"].includes(u.role) && u.status === "ACTIVE");

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ company, tax, notif, theme, accent }));
    setSaved(true);
    toast.success("Settings saved");
    setTimeout(()=>setSaved(false), 2000);
  };

  const ToggleSwitch = ({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) => (
    <button onClick={()=>onChange(!value)}
      className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 ${value?"gradient-primary":"bg-muted"}`}
      style={{height:"22px"}}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all shadow-sm ${value?"left-[22px]":"left-[3px]"}`}/>
    </button>
  );

  const Field = ({ label, value, onChange, type="text", placeholder="" }: {
    label:string; value:string; onChange:(v:string)=>void; type?:string; placeholder?:string;
  }) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
      <input type={type} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
        placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} />
    </div>
  );

  const handleAddUser = () => {
    if (!newUser.password) return;
    addUser({
      name: newUser.name, email: newUser.email, role: newUser.role, password: newUser.password,
      ...(newUser.reportsToId ? { reportsToId: newUser.reportsToId } : {}),
    });
    setShowAddUser(false);
    setNewUser({ name:"", email:"", password:"", role:"DEVELOPER", reportsToId:"" });
  };

  const tabs: {key:Tab;label:string;icon:typeof Building2}[] = [
    {key:"company",       label:"Company",       icon:Building2},
    {key:"tax",           label:"Tax & GST",     icon:Receipt},
    {key:"notifications", label:"Notifications", icon:BellRing},
    {key:"appearance",    label:"Appearance",    icon:Palette},
    ...(isAdmin ? [
      {key:"users" as Tab, label:"Users", icon:Users},
      {key:"fines" as Tab, label:"Fines", icon:Banknote},
      {key:"data" as Tab, label:"Data Management", icon:DatabaseZap},
    ] : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search settings…" search={search} onSearch={setSearch} />

        <div className="p-6 space-y-5 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure your company, tax, and notification preferences.</p>
            </div>
            <button onClick={handleSave}
              className="flex items-center gap-2 gradient-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm">
              {saved?<><Check size={15}/> Saved</>:<><Save size={15}/> Save Changes</>}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {tabs.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab===t.key?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>
                <t.icon size={13}/>{t.label}
              </button>
            ))}
          </div>

          {/* ─── COMPANY ─── */}
          {tab==="company"&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-4">Business Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Company Name" value={company.name} onChange={v=>setCompany(c=>({...c,name:v}))} placeholder="Your company name"/>
                  </div>
                  <div className="col-span-2">
                    <Field label="Address" value={company.address} onChange={v=>setCompany(c=>({...c,address:v}))} placeholder="Street address"/>
                  </div>
                  <Field label="City"    value={company.city}    onChange={v=>setCompany(c=>({...c,city:v}))}    placeholder="City"/>
                  <Field label="State"   value={company.state}   onChange={v=>setCompany(c=>({...c,state:v}))}   placeholder="State"/>
                  <Field label="PIN Code" value={company.pincode} onChange={v=>setCompany(c=>({...c,pincode:v}))} placeholder="PIN code"/>
                  <Field label="GSTIN"   value={company.gstin}   onChange={v=>setCompany(c=>({...c,gstin:v}))}   placeholder="15 digit GSTIN"/>
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold mb-4">Contact Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email"   value={company.email}   onChange={v=>setCompany(c=>({...c,email:v}))}   type="email" placeholder="company@email.com"/>
                  <Field label="Phone"   value={company.phone}   onChange={v=>setCompany(c=>({...c,phone:v}))}   type="tel"   placeholder="+91 XXXXX XXXXX"/>
                  <Field label="Website" value={company.website} onChange={v=>setCompany(c=>({...c,website:v}))} placeholder="www.yourcompany.com"/>
                  <Field label="Invoice Number Prefix" value={company.invoicePrefix} onChange={v=>setCompany(c=>({...c,invoicePrefix:v}))} placeholder="INV"/>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── TAX & GST ─── */}
          {tab==="tax"&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-6 space-y-5">
              <h3 className="text-sm font-semibold mb-2">GST Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Default GST Rate</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={tax.defaultGSTRate} onChange={e=>setTax(t=>({...t,defaultGSTRate:Number(e.target.value)}))}>
                    {[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">GST Registration Type</label>
                  <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={tax.gstCategory} onChange={e=>setTax(t=>({...t,gstCategory:e.target.value}))}>
                    {["Regular","Composition","Unregistered"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="border-t border-border pt-5 space-y-4">
                {([
                  {label:"Round off invoice totals",       sub:"Round amounts to nearest rupee",                   key:"roundOff"      as const},
                  {label:"Show HSN/SAC codes on invoices", sub:"Display HSN codes for goods and services",         key:"showHSN"       as const},
                  {label:"Tax inclusive pricing",          sub:"Product prices include GST in display",            key:"taxInclusive"  as const},
                ] as {label:string;sub:string;key:keyof TaxSettings}[]).map(({label,sub,key})=>(
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
                    </div>
                    <ToggleSwitch value={tax[key] as boolean} onChange={v=>setTax(t=>({...t,[key]:v}))}/>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── NOTIFICATIONS ─── */}
          {tab==="notifications"&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-6 space-y-5">
              <h3 className="text-sm font-semibold">Payment Reminders</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable payment reminders</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Get notified before invoices are due</p>
                </div>
                <ToggleSwitch value={notif.paymentReminder} onChange={v=>setNotif(n=>({...n,paymentReminder:v}))}/>
              </div>
              {notif.paymentReminder&&(
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Remind me (days before due date)</label>
                  <select className="w-48 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                    value={notif.reminderDays} onChange={e=>setNotif(n=>({...n,reminderDays:Number(e.target.value)}))}>
                    {[1,2,3,5,7,14].map(d=><option key={d} value={d}>{d} day{d!==1?"s":""} before</option>)}
                  </select>
                </div>
              )}
              <div className="border-t border-border pt-5 space-y-4">
                <h3 className="text-sm font-semibold">Alert Channels</h3>
                {([
                  {label:"Dashboard alerts",        sub:"Show alerts in the dashboard header",      key:"dashboardAlerts"  as const},
                  {label:"Email notifications",     sub:"Receive alerts at your registered email",  key:"emailNotifs"      as const},
                  {label:"Overdue invoice alerts",  sub:"Notify when an invoice becomes overdue",   key:"overdueAlert"     as const},
                  {label:"New invoice confirmation",sub:"Confirm when a new invoice is created",    key:"newInvoiceAlert"  as const},
                ] as {label:string;sub:string;key:keyof NotifSettings}[]).map(({label,sub,key})=>(
                  <div key={key} className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">{label}</p><p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p></div>
                    <ToggleSwitch value={notif[key] as boolean} onChange={v=>setNotif(n=>({...n,[key]:v}))}/>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── APPEARANCE ─── */}
          {tab==="appearance"&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="surface-elevated p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Theme</h3>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    {key:"light", label:"Light",  bg:"bg-white border-border",          dot:"bg-gray-200"},
                    {key:"dark",  label:"Dark",   bg:"bg-gray-900 border-gray-700",     dot:"bg-gray-700"},
                    {key:"system",label:"System", bg:"bg-gradient-to-br from-white to-gray-900 border-border", dot:"bg-gray-400"},
                  ] as {key:string;label:string;bg:string;dot:string}[]).map(t=>(
                    <button key={t.key} onClick={()=>setTheme(t.key)}
                      className={`border rounded-2xl p-4 text-left transition-all ${theme===t.key?"border-primary ring-2 ring-primary/20":"border-border hover:border-primary/30"}`}>
                      <div className={`h-10 rounded-xl mb-2 ${t.bg} border flex items-center justify-center`}>
                        <div className={`w-4 h-4 rounded-full ${t.dot}`}/>
                      </div>
                      <p className="text-xs font-semibold">{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold mb-3">Accent Color</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  {([
                    {key:"purple", label:"Purple", color:"bg-violet-500"},
                    {key:"blue",   label:"Blue",   color:"bg-blue-500"},
                    {key:"emerald",label:"Green",  color:"bg-emerald-500"},
                    {key:"rose",   label:"Rose",   color:"bg-rose-500"},
                    {key:"amber",  label:"Amber",  color:"bg-amber-500"},
                  ] as {key:string;label:string;color:string}[]).map(a=>(
                    <button key={a.key} onClick={()=>setAccent(a.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${accent===a.key?"border-primary bg-accent":""}`}>
                      <div className={`w-3.5 h-3.5 rounded-full ${a.color}`}/>{a.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-5 space-y-4">
                <h3 className="text-sm font-semibold">Display</h3>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Compact mode</p><p className="text-[11px] text-muted-foreground mt-0.5">Reduce spacing for denser layouts</p></div>
                  <ToggleSwitch value={false} onChange={()=>{}}/>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Animations</p><p className="text-[11px] text-muted-foreground mt-0.5">Enable motion and transitions</p></div>
                  <ToggleSwitch value={true} onChange={()=>{}}/>
                </div>
              </div>
            </motion.div>
          )}
          {/* ─── USERS ─── */}
          {tab==="users"&&isAdmin&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{allUsers.length} registered users</p>
                <button onClick={()=>setShowAddUser(true)} className="flex items-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
                  <Plus size={13}/> Add User
                </button>
              </div>
              <div className="surface-elevated overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    {["User","Email","Role","Reports To","Status",""].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {allUsers.map((u,i)=>(
                      <motion.tr key={u.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0"><span className="text-[9px] font-bold text-white">{u.initials}</span></div>
                            <span className="font-medium">{u.name}</span>
                            {u.id===currentUser?.id&&<span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">You</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_LABELS[u.role].cls}`}>{ROLE_LABELS[u.role].label}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{u.reportsTo ? u.reportsTo.name : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${u.status==="ACTIVE"?"bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{u.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {u.id!==currentUser?.id&&(
                            <button onClick={()=>toggleStatus(u.id)} className={`text-[11px] font-medium hover:underline ${u.status==="ACTIVE"?"text-red-500":"text-emerald-600"}`}>
                              {u.status==="ACTIVE"?"Deactivate":"Activate"}
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add User modal */}
              {showAddUser&&(
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
                    <div className="flex items-center justify-between p-5 border-b border-border">
                      <h3 className="font-semibold text-sm">Add User</h3>
                      <button onClick={()=>setShowAddUser(false)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15}/></button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Full Name</label>
                        <input className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          placeholder="Full name" value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))}/>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
                        <input type="email" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          placeholder="user@company.com" value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))}/>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
                        <input type="password" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          placeholder="Minimum 6 characters" value={newUser.password} onChange={e=>setNewUser(u=>({...u,password:e.target.value}))}/>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Role</label>
                        <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value as Role}))}>
                          {(["ADMIN","PROJECT_MANAGER","LEAD","DEVELOPER","TESTER","EDITOR","DIGITAL_MARKETER"] as Role[]).map(r=>(
                            <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Reports To</label>
                        <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          value={newUser.reportsToId} onChange={e=>setNewUser(u=>({...u,reportsToId:e.target.value}))}>
                          <option value="">None (unassigned)</option>
                          {managers.map(m=>(
                            <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role].label})</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">Leave requests will be routed to this person for approval.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
                      <button onClick={()=>setShowAddUser(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
                      <button onClick={handleAddUser} disabled={!newUser.name||!newUser.email||!newUser.password||newUser.password.length<6}
                        className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                        Add User
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
          {/* ─── FINES ─── */}
          {tab==="fines"&&isAdmin&&(
            <FinesTab />
          )}

          {/* ─── DATA MANAGEMENT ─── */}
          {tab==="data"&&isAdmin&&(
            <DataManagementTab />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Data Management Tab ─────────────────────────────────────────────────────

interface PurgeItem {
  key: string;
  label: string;
  description: string;
  action: () => Promise<unknown>;
}

function DataManagementTab() {
  const [loading, setLoading] = useState<string|null>(null);
  const [confirm, setConfirm] = useState<string|null>(null);

  const items: PurgeItem[] = [
    { key:"customers", label:"Customers & Invoices", description:"All customers, invoices, invoice items, and payments", action: adminApi.purgeCustomers },
    { key:"projects",  label:"Projects & Tasks",     description:"All projects, tasks, bug reports, and team assignments", action: adminApi.purgeProjects },
    { key:"ledger",    label:"Ledger Entries",        description:"All accounting ledger entries", action: adminApi.purgeLedger },
    { key:"expenses",  label:"Expenses",              description:"All expense records", action: adminApi.purgeExpenses },
    { key:"notes",     label:"Notes",                 description:"All notes and lead notes", action: adminApi.purgeNotes },
    { key:"attendance",label:"Attendance & Leaves",   description:"All attendance, leave requests, balances, and summaries", action: adminApi.purgeAttendance },
    { key:"all",       label:"All Data",              description:"Everything above — deletes all data except user accounts", action: adminApi.purgeAll },
  ];

  const handlePurge = async (item: PurgeItem) => {
    setLoading(item.key);
    setConfirm(null);
    try {
      await item.action();
      toast.success(`${item.label} deleted successfully`);
    } catch {
      toast.error(`Failed to delete ${item.label.toLowerCase()}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-400">These actions are <span className="font-semibold">irreversible</span>. Deleted data cannot be recovered.</p>
      </div>

      <div className="surface-elevated overflow-hidden divide-y divide-border">
        {items.map(item => (
          <div key={item.key} className={`flex items-center justify-between px-5 py-4 ${item.key==="all"?"bg-red-50/50 dark:bg-red-900/10":""}`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${item.key==="all"?"text-red-600 dark:text-red-400":""}`}>{item.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {confirm===item.key ? (
                <>
                  <button onClick={()=>setConfirm(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button onClick={()=>handlePurge(item)} disabled={loading!==null}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40">
                    {loading===item.key ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                    Confirm Delete
                  </button>
                </>
              ) : (
                <button onClick={()=>setConfirm(item.key)} disabled={loading!==null}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 ${
                    item.key==="all"
                      ? "border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                  <Trash2 size={12}/> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Fines Tab ──────────────────────────────────────────────────────────────

function FinesTab() {
  const { allUsers } = useAuth();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Non-admin users that can be fined
  const fineable = allUsers.filter(u => u.role !== "ADMIN" && u.status === "ACTIVE");

  const { data: summary } = useQuery<FineSummary>({
    queryKey: ["fines", "summary"],
    queryFn: () => finesApi.summary().then(r => r.data),
    staleTime: 30_000,
  });

  const { data: fines = [], isLoading } = useQuery<Fine[]>({
    queryKey: ["fines", "all"],
    queryFn: () => finesApi.list().then(r => r.data),
    staleTime: 30_000,
  });

  const handleAdd = async () => {
    if (!selectedUser || !amount || !reason.trim()) return;
    setSubmitting(true);
    try {
      await finesApi.create({ userId: selectedUser, amount: parseFloat(amount), reason: reason.trim() });
      toast.success("Fine added");
      setShowAdd(false);
      setSelectedUser("");
      setAmount("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["fines"] });
    } catch {
      toast.error("Failed to add fine");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePaid = async (fine: Fine) => {
    setTogglingId(fine.id);
    try {
      await finesApi.togglePaid(fine.id, !fine.paid);
      queryClient.invalidateQueries({ queryKey: ["fines"] });
    } catch {
      toast.error("Failed to update fine");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await finesApi.delete(id);
      toast.success("Fine removed");
      queryClient.invalidateQueries({ queryKey: ["fines"] });
    } catch {
      toast.error("Failed to delete fine");
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Fines", value: fmt(summary.totalAmount), color: "text-red-500" },
            { label: "Paid", value: fmt(summary.totalPaid), color: "text-emerald-500" },
            { label: "Unpaid", value: fmt(summary.totalUnpaid), color: "text-amber-500" },
          ].map(c => (
            <div key={c.label} className="surface-elevated p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className={`text-xl font-bold font-mono mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{fines.length} fine{fines.length !== 1 ? "s" : ""} total</p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 gradient-primary text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
          <Plus size={13} /> Add Fine
        </button>
      </div>

      {/* Per-user breakdown */}
      {summary && summary.byUser.length > 0 && (
        <div className="surface-elevated p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={14} /> Fines by User</h3>
          <div className="space-y-3">
            {summary.byUser.map(entry => (
              <div key={entry.user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-white">{entry.user.initials}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">{entry.user.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{entry.count} fine{entry.count !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-red-500">{fmt(entry.total)}</span>
                  {entry.paid > 0 && <span className="text-emerald-500">{fmt(entry.paid)} paid</span>}
                  {entry.unpaid > 0 && <span className="text-amber-500">{fmt(entry.unpaid)} due</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fines list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : fines.length === 0 ? (
        <div className="surface-elevated p-8 text-center">
          <IndianRupee size={24} className="mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No fines recorded yet.</p>
        </div>
      ) : (
        <div className="surface-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["User", "Reason", "Amount", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fines.map((fine, i) => (
                <motion.tr key={fine.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] font-bold text-white">{fine.user.initials}</span>
                      </div>
                      <span className="font-medium text-xs">{fine.user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{fine.reason}</td>
                  <td className="px-4 py-3 text-xs font-mono font-semibold text-red-500">{fmt(fine.amount)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleTogglePaid(fine)} disabled={togglingId === fine.id}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                        fine.paid
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100"
                      }`}>
                      {togglingId === fine.id ? "..." : fine.paid ? "Paid" : "Unpaid"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">
                    {new Date(fine.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(fine.id)} className="text-[11px] text-red-500 font-medium hover:underline">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Fine modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-sm">Add Fine</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-muted"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">User</label>
                <select className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                  <option value="">Select user...</option>
                  {fineable.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role].label})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Amount (₹)</label>
                <input type="number" min="1" step="1" className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                  placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Reason</label>
                <textarea rows={2} className="w-full bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                  placeholder="Reason for fine..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleAdd}
                disabled={submitting || !selectedUser || !amount || parseFloat(amount) <= 0 || !reason.trim()}
                className="px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : "Add Fine"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
