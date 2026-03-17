import { motion } from "framer-motion";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0, duration: 0.5 } },
};

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  return (
    <motion.div variants={item} className="surface-elevated p-5 hover:shadow-md transition-shadow duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
        <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <Icon size={15} strokeWidth={1.5} className="text-primary" />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-2xl font-semibold tracking-tight font-mono tabular-nums">{value}</span>
        {change && (
          <div className="flex items-center gap-1">
            {changeType === "positive" ? (
              <ArrowUpRight size={12} className="text-money-in" />
            ) : changeType === "negative" ? (
              <ArrowDownRight size={12} className="text-money-out" />
            ) : null}
            <span
              className={`text-[11px] font-medium ${
                changeType === "positive" ? "text-money-in" : changeType === "negative" ? "text-money-out" : "text-muted-foreground"
              }`}
            >
              {change}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
