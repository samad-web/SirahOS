import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, AlertCircle } from "lucide-react";

const activities = [
  { type: "in", text: "Payment received from Apex Trading", amount: "₹45,000", time: "2m ago" },
  { type: "out", text: "Expense: Office supplies", amount: "₹3,200", time: "1h ago" },
  { type: "alert", text: "INV-1022 overdue by 3 days", amount: "₹78,500", time: "3h ago" },
  { type: "in", text: "Payment received from Patel & Sons", amount: "₹8,900", time: "5h ago" },
  { type: "out", text: "Salary disbursement - March", amount: "₹1,20,000", time: "1d ago" },
];

const icons = {
  in: ArrowDownLeft,
  out: ArrowUpRight,
  alert: AlertCircle,
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
};

const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring", bounce: 0 } },
};

export function ActivityFeed() {
  return (
    <div className="surface-elevated rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="divide-y divide-border/50">
        {activities.map((act, i) => {
          const Icon = icons[act.type as keyof typeof icons];
          return (
            <motion.div key={i} variants={item} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5 ledge-transition">
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  act.type === "in"
                    ? "bg-money-in/10"
                    : act.type === "out"
                    ? "bg-money-out/10"
                    : "bg-warning/10"
                }`}
              >
                <Icon
                  size={14}
                  strokeWidth={1.5}
                  className={
                    act.type === "in"
                      ? "text-money-in"
                      : act.type === "out"
                      ? "text-money-out"
                      : "text-warning"
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{act.text}</p>
                <p className="text-xs text-muted-foreground">{act.time}</p>
              </div>
              <span
                className={`font-mono text-sm tabular-nums flex-shrink-0 ${
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
