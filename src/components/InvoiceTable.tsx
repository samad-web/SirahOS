import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";

const invoices = [
  { id: "INV-1024", customer: "Apex Trading Co.", amount: "₹45,000", date: "15 Mar 2026", status: "Paid", due: "" },
  { id: "INV-1023", customer: "Sharma Electronics", amount: "₹12,800", date: "14 Mar 2026", status: "Pending", due: "18 Mar" },
  { id: "INV-1022", customer: "Metro Distributors", amount: "₹78,500", date: "13 Mar 2026", status: "Overdue", due: "10 Mar" },
  { id: "INV-1021", customer: "Sunrise Textiles", amount: "₹23,400", date: "12 Mar 2026", status: "Paid", due: "" },
  { id: "INV-1020", customer: "Global Imports Ltd.", amount: "₹1,56,000", date: "11 Mar 2026", status: "Pending", due: "20 Mar" },
  { id: "INV-1019", customer: "Patel & Sons", amount: "₹8,900", date: "10 Mar 2026", status: "Paid", due: "" },
  { id: "INV-1018", customer: "QuickServe Foods", amount: "₹34,200", date: "09 Mar 2026", status: "Draft", due: "" },
];

const statusStyles: Record<string, string> = {
  Paid: "text-money-in bg-money-in/10",
  Pending: "text-warning bg-warning/10",
  Overdue: "text-money-out bg-money-out/10",
  Draft: "text-muted-foreground bg-muted",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const row = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, bounce: 0 } },
};

export function InvoiceTable() {
  return (
    <div className="surface-elevated rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold tracking-tight">Recent Invoices</h2>
        <button className="text-xs text-primary hover:underline">View all</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/50 sticky top-0">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {invoices.map((inv) => (
              <motion.tr
                key={inv.id}
                variants={row}
                className="border-b border-border/50 hover:bg-accent/5 ledge-transition h-11 cursor-pointer"
              >
                <td className="px-4 py-2 font-mono text-xs">{inv.id}</td>
                <td className="px-4 py-2">{inv.customer}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{inv.amount}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{inv.date}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusStyles[inv.status]}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-2">
                  <button className="p-1 rounded hover:bg-muted ledge-transition">
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
