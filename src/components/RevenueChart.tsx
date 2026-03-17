import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="surface-elevated p-5 h-full"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold">Revenue vs Expenses</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Last 6 months overview</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-money-out" />
            <span className="text-[11px] text-muted-foreground">Expenses</span>
          </div>
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(250, 75%, 58%)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(250, 75%, 58%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.08} />
                <stop offset="100%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 91%)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                fontSize: "12px",
                color: "hsl(var(--foreground))",
                boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                padding: "8px 12px",
              }}
              formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, undefined]}
            />
            <Area type="monotone" dataKey="revenue" stroke="hsl(250, 75%, 58%)" strokeWidth={2} fill="url(#revenueGrad)" name="Revenue" />
            <Area type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 55%)" strokeWidth={1.5} fill="url(#expenseGrad)" name="Expenses" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
