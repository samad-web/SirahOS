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
  Paid: "text-money-in",
  Pending: "text-warning",
  Overdue: "text-money-out",
  Draft: "text-muted-foreground",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const row = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export function InvoiceTable() {
  return (
    <div className="surface-elevated overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-medium">Recent Invoices</h2>
        <button className="text-xs text-primary hover:underline">View all</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-border">
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Invoice</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="text-right px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-right px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {invoices.map((inv) => (
              <motion.tr
                key={inv.id}
                variants={row}
                className="border-t border-border/60 hover:bg-muted/50 transition-colors cursor-pointer h-11"
              >
                <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{inv.id}</td>
                <td className="px-5 py-2.5 text-[13px]">{inv.customer}</td>
                <td className="px-5 py-2.5 text-right font-mono text-[13px] tabular-nums">{inv.amount}</td>
                <td className="px-5 py-2.5 text-muted-foreground text-xs">{inv.date}</td>
                <td className="px-5 py-2.5 text-right">
                  <span className={`text-xs font-medium ${statusStyles[inv.status]}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-3">
                  <button className="p-1 rounded-md hover:bg-muted transition-colors">
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
