import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, AlertCircle } from "lucide-react";

const activities = [
  { type: "in", text: "Payment from Apex Trading", amount: "₹45,000", time: "2m" },
  { type: "out", text: "Office supplies", amount: "₹3,200", time: "1h" },
  { type: "alert", text: "INV-1022 overdue", amount: "₹78,500", time: "3h" },
  { type: "in", text: "Payment from Patel & Sons", amount: "₹8,900", time: "5h" },
  { type: "out", text: "Salary — March", amount: "₹1,20,000", time: "1d" },
];

const icons = { in: ArrowDownLeft, out: ArrowUpRight, alert: AlertCircle };

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export function ActivityFeed() {
  return (
    <div className="surface-elevated">
      <div className="px-5 py-4">
        <h2 className="text-sm font-medium">Activity</h2>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="divide-y divide-border/60">
        {activities.map((act, i) => {
          const Icon = icons[act.type as keyof typeof icons];
          return (
            <motion.div key={i} variants={item} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors">
              <Icon
                size={14}
                strokeWidth={1.5}
                className={
                  act.type === "in" ? "text-money-in" : act.type === "out" ? "text-money-out" : "text-warning"
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate">{act.text}</p>
              </div>
              <span className="text-xs text-muted-foreground">{act.time}</span>
              <span
                className={`font-mono text-[13px] tabular-nums ${
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
