import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";

const invoices = [
  { id: "INV-1024", customer: "Apex Trading Co.", amount: "₹45,000", date: "15 Mar", status: "Paid" },
  { id: "INV-1023", customer: "Sharma Electronics", amount: "₹12,800", date: "14 Mar", status: "Pending" },
  { id: "INV-1022", customer: "Metro Distributors", amount: "₹78,500", date: "13 Mar", status: "Overdue" },
  { id: "INV-1021", customer: "Sunrise Textiles", amount: "₹23,400", date: "12 Mar", status: "Paid" },
  { id: "INV-1020", customer: "Global Imports Ltd.", amount: "₹1,56,000", date: "11 Mar", status: "Pending" },
  { id: "INV-1019", customer: "Patel & Sons", amount: "₹8,900", date: "10 Mar", status: "Paid" },
];

const statusStyles: Record<string, string> = {
  Paid: "bg-[hsl(var(--money-in)/0.1)] text-money-in",
  Pending: "bg-[hsl(var(--warning)/0.1)] text-warning",
  Overdue: "bg-[hsl(var(--money-out)/0.1)] text-money-out",
  Draft: "bg-muted text-muted-foreground",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const row = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export function InvoiceTable() {
  return (
    <div className="surface-elevated overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">Recent Invoices</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{invoices.length} invoices this month</p>
        </div>
        <button className="text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-accent">
          View all
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="text-right px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-center px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {invoices.map((inv) => (
              <motion.tr
                key={inv.id}
                variants={row}
                className="border-t border-border/40 hover:bg-muted/20 transition-colors cursor-pointer h-12"
              >
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{inv.id}</td>
                <td className="px-5 py-3 text-[13px] font-medium">{inv.customer}</td>
                <td className="px-5 py-3 text-right font-mono text-[13px] tabular-nums font-medium">{inv.amount}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs">{inv.date}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusStyles[inv.status]}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-3">
                  <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <MoreHorizontal size={14} className="text-muted-foreground" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
