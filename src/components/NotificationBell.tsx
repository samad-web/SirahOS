import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, Clock, FileText, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { invoicesApi, type Invoice } from "@/lib/api";

interface AlertItem {
  id: string;
  type: "overdue" | "pending" | "info" | "success";
  title: string;
  description: string;
  route?: string;
}

const typeCfg = {
  overdue: { bg: "bg-red-50 dark:bg-red-900/20", icon: AlertTriangle, iconColor: "text-red-500" },
  pending: { bg: "bg-amber-50 dark:bg-amber-900/20", icon: Clock, iconColor: "text-amber-500" },
  info:    { bg: "bg-blue-50 dark:bg-blue-900/20", icon: FileText, iconColor: "text-blue-500" },
  success: { bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: CheckCircle, iconColor: "text-emerald-500" },
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch invoice data for alerts
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", "notifications"],
    queryFn: () => invoicesApi.list().then(r => r.data as Invoice[]),
    staleTime: 60_000,
  });

  const alerts: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = [];

    const overdue = invoices.filter(i => i.status === "OVERDUE");
    const pending = invoices.filter(i => i.status === "PENDING");
    const partial = invoices.filter(i => i.status === "PARTIAL");

    if (overdue.length > 0) {
      const total = overdue.reduce((s, i) => {
        const sub = (i.items ?? []).reduce((a, it) => a + it.quantity * it.unitPrice, 0);
        const gst = Math.round(sub * i.gstRate / 100);
        const paid = (i.payments ?? []).reduce((a, p) => a + p.amount, 0);
        return s + sub + gst - paid;
      }, 0);
      items.push({
        id: "overdue",
        type: "overdue",
        title: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""}`,
        description: `₹${total.toLocaleString("en-IN")} outstanding`,
        route: "/invoices",
      });
    }

    if (pending.length > 0) {
      items.push({
        id: "pending",
        type: "pending",
        title: `${pending.length} pending invoice${pending.length > 1 ? "s" : ""}`,
        description: "Awaiting payment",
        route: "/invoices",
      });
    }

    if (partial.length > 0) {
      items.push({
        id: "partial",
        type: "info",
        title: `${partial.length} partially paid`,
        description: "Invoices with remaining balance",
        route: "/invoices",
      });
    }

    if (invoices.length > 0 && overdue.length === 0 && pending.length === 0) {
      items.push({
        id: "all-clear",
        type: "success",
        title: "All invoices settled",
        description: "No outstanding payments",
      });
    }

    return items;
  }, [invoices]);

  const badgeCount = alerts.filter(a => a.type === "overdue" || a.type === "pending").length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-muted transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={15} strokeWidth={1.5} className="text-muted-foreground" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">{badgeCount}</span>
          </span>
        )}
        {badgeCount === 0 && alerts.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="text-sm font-semibold">Notifications</h4>
              {alerts.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{alerts.length}</span>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell size={28} className="mx-auto mb-2 text-muted-foreground/20" strokeWidth={1} />
                  <p className="text-sm text-muted-foreground">All clear — no notifications</p>
                </div>
              ) : (
                alerts.map(alert => {
                  const cfg = typeCfg[alert.type];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={alert.id}
                      onClick={() => {
                        if (alert.route) navigate(alert.route);
                        setOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon size={14} className={cfg.iconColor} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{alert.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
                        </div>
                        {alert.route && (
                          <span className="text-[10px] text-primary font-medium flex-shrink-0 mt-1">&rarr;</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
