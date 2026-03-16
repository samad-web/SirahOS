import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

const data = [
  { month: "Oct", revenue: 185000, expenses: 120000 },
  { month: "Nov", revenue: 220000, expenses: 135000 },
  { month: "Dec", revenue: 310000, expenses: 180000 },
  { month: "Jan", revenue: 280000, expenses: 160000 },
  { month: "Feb", revenue: 340000, expenses: 190000 },
  { month: "Mar", revenue: 295000, expenses: 170000 },
];

const formatCurrency = (value: number) => `₹${(value / 1000).toFixed(0)}K`;

export function RevenueChart() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="surface-elevated p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-medium">Revenue vs Expenses</h2>
        <span className="text-[11px] text-muted-foreground">6 months</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(155, 50%, 38%)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(155, 50%, 38%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.1} />
                <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(230, 8%, 50%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: "hsl(230, 8%, 50%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(var(--foreground))",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, undefined]}
            />
            <Area type="monotone" dataKey="revenue" stroke="hsl(155, 50%, 38%)" strokeWidth={1.5} fill="url(#revenueGrad)" name="Revenue" />
            <Area type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" strokeWidth={1.5} fill="url(#expenseGrad)" name="Expenses" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
