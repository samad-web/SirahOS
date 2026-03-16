import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: "spring", bounce: 0 }}
      className="surface-elevated rounded-lg p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold tracking-tight">Revenue vs Expenses</h2>
        <span className="text-xs text-muted-foreground">Last 6 months</span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(155, 60%, 45%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(155, 60%, 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(15, 80%, 55%)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(15, 80%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 15%, 20%)" />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(230, 10%, 55%)", fontSize: 12 }}
              axisLine={{ stroke: "hsl(230, 15%, 20%)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: "hsl(230, 10%, 55%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(230, 20%, 14%)",
                border: "1px solid hsl(230, 15%, 22%)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "hsl(0, 0%, 96%)",
              }}
              formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, undefined]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(155, 60%, 45%)"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              name="Revenue"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="hsl(15, 80%, 55%)"
              strokeWidth={2}
              fill="url(#expenseGrad)"
              name="Expenses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
