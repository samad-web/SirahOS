import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, AlertCircle } from "lucide-react";

const activities = [
  { type: "in", text: "Payment from Apex Trading", amount: "₹45,000", time: "2m ago" },
  { type: "out", text: "Office supplies", amount: "₹3,200", time: "1h ago" },
  { type: "alert", text: "INV-1022 overdue", amount: "₹78,500", time: "3h ago" },
  { type: "in", text: "Payment from Patel & Sons", amount: "₹8,900", time: "5h ago" },
  { type: "out", text: "Salary — March", amount: "₹1,20,000", time: "1d ago" },
];

const icons = { in: ArrowDownLeft, out: ArrowUpRight, alert: AlertCircle };

const iconBg = {
  in: "bg-[hsl(var(--money-in)/0.1)]",
  out: "bg-[hsl(var(--money-out)/0.1)]",
  alert: "bg-[hsl(var(--warning)/0.1)]",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export function ActivityFeed() {
  return (
    <div className="surface-elevated h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Recent Activity</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Latest transactions</p>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="flex-1 divide-y divide-border/50">
        {activities.map((act, i) => {
          const Icon = icons[act.type as keyof typeof icons];
          return (
            <motion.div key={i} variants={item} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg[act.type as keyof typeof iconBg]}`}>
                <Icon
                  size={14}
                  strokeWidth={1.5}
                  className={
                    act.type === "in" ? "text-money-in" : act.type === "out" ? "text-money-out" : "text-warning"
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{act.text}</p>
                <p className="text-[11px] text-muted-foreground">{act.time}</p>
              </div>
              <span
                className={`font-mono text-[13px] tabular-nums font-medium ${
                  act.type === "in" ? "text-money-in" : act.type === "out" ? "text-money-out" : "text-warning"
                }`}
              >
                {act.type === "in" ? "+" : act.type === "out" ? "-" : ""}
                {act.amount}
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
