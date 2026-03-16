import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  TrendingUp,
  CreditCard,
  Package,
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Invoices", path: "/invoices" },
  { icon: CreditCard, label: "POS Billing", path: "/pos" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: BookOpen, label: "Ledger", path: "/ledger" },
  { icon: TrendingUp, label: "Reports", path: "/reports" },
  { icon: Package, label: "Inventory", path: "/inventory" },
  { icon: Building2, label: "Branches", path: "/branches" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside
      className={`flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 ledge-transition ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-mono font-semibold text-xs">L</span>
          </div>
          {!collapsed && (
            <span className="text-foreground font-semibold text-sm tracking-tight">Ledge</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 h-9 rounded-md text-sm ledge-transition active-press ${
                isActive
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <item.icon
                size={18}
                strokeWidth={1.5}
                className={isActive ? "text-primary" : ""}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center h-8 rounded-md text-sidebar-foreground hover:bg-sidebar-accent ledge-transition"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
