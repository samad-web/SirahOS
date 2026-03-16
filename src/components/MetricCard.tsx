import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, bounce: 0, duration: 0.4 } },
};

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  return (
    <motion.div variants={item} className="surface-elevated p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{title}</span>
        <Icon size={15} strokeWidth={1.5} className="text-muted-foreground/60" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-xl font-semibold tracking-tight font-mono tabular-nums">{value}</span>
        {change && (
          <span
            className={`text-[11px] font-mono mb-0.5 ${
              changeType === "positive" ? "text-money-in" : changeType === "negative" ? "text-money-out" : "text-muted-foreground"
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </motion.div>
  );
}
