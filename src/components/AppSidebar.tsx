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
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Invoices", path: "/invoices" },
  { icon: CreditCard, label: "POS", path: "/pos" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: BookOpen, label: "Ledger", path: "/ledger" },
  { icon: TrendingUp, label: "Reports", path: "/reports" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside
      className={`flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 transition-all duration-200 ${
        collapsed ? "w-14" : "w-52"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-mono font-semibold text-xs">L</span>
          </div>
          {!collapsed && (
            <span className="text-foreground font-semibold text-sm tracking-tight">Ledge</span>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] transition-colors ${
                isActive
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <item.icon
                size={17}
                strokeWidth={1.5}
                className={isActive ? "text-primary" : ""}
              />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => navigate("/settings")}
          className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <Settings size={17} strokeWidth={1.5} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
