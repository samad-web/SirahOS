import { motion } from "framer-motion";
import { IndianRupee, Users, FileText, TrendingUp, Bell } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { MetricCard } from "@/components/MetricCard";
import { InvoiceTable } from "@/components/InvoiceTable";
import { RevenueChart } from "@/components/RevenueChart";
import { CommandBar } from "@/components/CommandBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ThemeToggle } from "@/components/ThemeToggle";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const Index = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 min-w-0 pb-20">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border bg-background/80 backdrop-blur-sm">
          <div>
            <h1 className="text-sm font-medium">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell size={16} strokeWidth={1.5} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-money-out" />
            </button>
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-[11px] font-medium text-primary">AK</span>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-5 max-w-6xl">
          {/* Metrics */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <MetricCard title="Revenue" value="₹12.4L" change="+12.5%" changeType="positive" icon={IndianRupee} />
            <MetricCard title="Outstanding" value="₹3.2L" change="8 pending" changeType="negative" icon={FileText} />
            <MetricCard title="Customers" value="284" change="+18" changeType="positive" icon={Users} />
            <MetricCard title="Profit" value="34.2%" change="+2.1%" changeType="positive" icon={TrendingUp} />
          </motion.div>

          {/* Chart + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <RevenueChart />
            </div>
            <div className="lg:col-span-2">
              <ActivityFeed />
            </div>
          </div>

          {/* Invoices */}
          <InvoiceTable />
        </div>
      </main>

      <CommandBar />
    </div>
  );
};

export default Index;
