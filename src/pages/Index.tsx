import { motion } from "framer-motion";
import { IndianRupee, Users, FileText, TrendingUp, Bell, Search } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { MetricCard } from "@/components/MetricCard";
import { InvoiceTable } from "@/components/InvoiceTable";
import { RevenueChart } from "@/components/RevenueChart";
import { CommandBar } from "@/components/CommandBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ThemeToggle } from "@/components/ThemeToggle";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const Index = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 min-w-0 pb-20">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border bg-background/70 backdrop-blur-xl">
          <div>
            <h1 className="text-sm font-semibold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="p-2 rounded-xl hover:bg-muted transition-colors">
              <Search size={15} strokeWidth={1.5} className="text-muted-foreground" />
            </button>
            <ThemeToggle />
            <button className="relative p-2 rounded-xl hover:bg-muted transition-colors">
              <Bell size={15} strokeWidth={1.5} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
            </button>
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center ml-1 shadow-sm">
              <span className="text-[11px] font-semibold text-white">AK</span>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6 max-w-6xl">
          {/* Welcome */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="text-lg font-semibold">Welcome back, Arjun</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening with your business today.</p>
          </motion.div>

          {/* Metrics */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <MetricCard title="Revenue" value="₹12.4L" change="+12.5% from last month" changeType="positive" icon={IndianRupee} />
            <MetricCard title="Outstanding" value="₹3.2L" change="8 invoices pending" changeType="negative" icon={FileText} />
            <MetricCard title="Customers" value="284" change="+18 this month" changeType="positive" icon={Users} />
            <MetricCard title="Profit" value="34.2%" change="+2.1% from last month" changeType="positive" icon={TrendingUp} />
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
