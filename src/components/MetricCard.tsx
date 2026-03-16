import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  index?: number;
}

const item = {
  hidden: { y: 10, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", bounce: 0 } },
};

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon, index = 0 }: MetricCardProps) {
  return (
    <motion.div variants={item} className="surface-elevated rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
        <Icon size={16} strokeWidth={1.5} className="text-muted-foreground" />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold tracking-tight font-mono tabular-nums">{value}</span>
        {change && (
          <span
            className={`text-xs font-mono ${
              changeType === "positive"
                ? "text-money-in"
                : changeType === "negative"
                ? "text-money-out"
                : "text-muted-foreground"
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </motion.div>
  );
}
