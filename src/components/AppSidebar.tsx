import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  TrendingUp,
  CreditCard,
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
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
      className={`flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 transition-all duration-300 ease-in-out ${
        collapsed ? "w-[60px]" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white font-semibold text-sm">L</span>
          </div>
          {!collapsed && (
            <span className="text-foreground font-semibold text-[15px] tracking-tight">Ledge</span>
          )}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-sidebar-accent transition-colors text-muted-foreground"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {!collapsed && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2 block">
            Menu
          </span>
        )}
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 h-9 rounded-xl text-[13px] transition-all duration-200 ${
                isActive
                  ? "bg-accent text-accent-foreground font-medium shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <item.icon
                size={17}
                strokeWidth={isActive ? 2 : 1.5}
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
          className={`w-full flex items-center gap-3 px-3 h-9 rounded-xl text-[13px] transition-all duration-200 ${
            location.pathname === "/settings"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
          }`}
        >
          <Settings size={17} strokeWidth={1.5} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
