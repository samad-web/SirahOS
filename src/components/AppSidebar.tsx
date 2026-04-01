import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FileText, Users, BookOpen,
  FolderKanban, Settings, LogOut, CalendarDays, Receipt, StickyNote, UserPlus, UsersRound,
  Menu, X, Building2,
} from "lucide-react";
import { useAuth, ROUTE_ACCESS, ROLE_LABELS } from "@/contexts/AuthContext";

interface NavSection {
  title: string;
  items: { icon: React.ElementType; label: string; path: string }[];
}

const allSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Building2, label: "Companies", path: "/companies" },
    ],
  },
  {
    title: "Team",
    items: [
      { icon: UsersRound, label: "Employees", path: "/employees" },
      { icon: FolderKanban, label: "Projects", path: "/projects" },
      { icon: CalendarDays, label: "Attendance", path: "/attendance" },
    ],
  },
  {
    title: "Billing",
    items: [
      { icon: FileText, label: "Invoices", path: "/invoices" },
      { icon: Users, label: "Customers", path: "/customers" },
      { icon: Receipt, label: "Expenses", path: "/expenses" },
      { icon: BookOpen, label: "Ledger", path: "/ledger" },
    ],
  },
  {
    title: "Tools",
    items: [
      { icon: UserPlus, label: "Leads", path: "/leads" },
      { icon: StickyNote, label: "Notes", path: "/notes" },
    ],
  },
];

// Map paths to feature flags for filtering
const PATH_FEATURE_MAP: Record<string, "billing" | "projects" | "attendance" | "leads"> = {
  "/projects": "projects",
  "/invoices": "billing",
  "/customers": "billing",
  "/expenses": "billing",
  "/ledger": "billing",
  "/attendance": "attendance",
  "/leads": "leads",
};

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasFeature } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role ?? "DEVELOPER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const allowed = ROUTE_ACCESS;
  const canSettings = !isSuperAdmin && (allowed["/settings"] ?? []).includes(role);
  const { label: roleLbl, cls: roleCls } = ROLE_LABELS[role];

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const navTo = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  // Filter sections by role and feature flags
  // SUPER_ADMIN without a company only sees Dashboard
  // SUPER_ADMIN with a company sees Dashboard + their company's enabled features
  const isSuperAdminWithCompany = isSuperAdmin && !!user?.companyId;
  const sections = allSections
    .map(s => ({
      ...s,
      items: s.items.filter(item => {
        // SUPER_ADMIN without company — Dashboard + Companies
        if (isSuperAdmin && !isSuperAdminWithCompany) return item.path === "/" || item.path === "/companies";
        // SUPER_ADMIN with company — Dashboard + Companies + company features (treat as ADMIN for nav)
        if (isSuperAdminWithCompany) {
          // Always show dashboard and companies
          if (item.path === "/" || item.path === "/companies") return true;
          // Check if ADMIN would see this route
          if (!(allowed[item.path] ?? []).includes("ADMIN")) return false;
          // Feature flag check
          const flag = PATH_FEATURE_MAP[item.path];
          if (flag && !hasFeature(flag)) return false;
          return true;
        }
        // Regular role check
        if (!(allowed[item.path] ?? []).includes(role)) return false;
        // Feature flag check
        const flag = PATH_FEATURE_MAP[item.path];
        if (flag && !hasFeature(flag)) return false;
        return true;
      }),
    }))
    .filter(s => s.items.length > 0);

  const sidebarContent = (expanded: boolean) => (
    <>
      {/* Logo */}
      <div className={`flex items-center ${expanded ? "gap-3 px-4" : "justify-center"} h-14 border-b border-sidebar-border flex-shrink-0`}>
        <button
          onClick={() => navTo(role === "ADMIN" || role === "SUPER_ADMIN" ? "/" : "/projects")}
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden"
        >
          <img src="/logo.png" alt="Sirahos" className="w-full h-full object-contain" />
        </button>
        {expanded && <span className="text-sm font-bold truncate">Sirahos</span>}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 flex flex-col ${expanded ? "px-3" : "items-center"} gap-0.5 overflow-y-auto`}>
        {sections.map((section, si) => (
          <div key={section.title}>
            {si > 0 && <div className={`${expanded ? "mx-1" : "mx-2"} my-2 border-t border-sidebar-border`} />}
            {expanded && (
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1 block">
                {section.title}
              </span>
            )}
            {section.items.map(item => {
              const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
              return (
                <button
                  key={item.path}
                  onClick={() => navTo(item.path)}
                  title={!expanded ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`${expanded ? "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm" : "w-10 h-10 flex items-center justify-center rounded-xl"} relative transition-all duration-200 ${
                    isActive
                      ? "bg-accent text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                  )}
                  <item.icon size={expanded ? 16 : 18} strokeWidth={isActive ? 2 : 1.5} />
                  {expanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: settings + user + logout */}
      <div className={`border-t border-sidebar-border pt-3 pb-3 flex flex-col ${expanded ? "px-3" : "items-center"} gap-1`}>
        {canSettings && (
          <button
            onClick={() => navTo("/settings")}
            title={!expanded ? "Settings" : undefined}
            aria-label="Settings"
            className={`${expanded ? "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm" : "w-10 h-10 flex items-center justify-center rounded-xl"} relative transition-all duration-200 ${
              location.pathname === "/settings"
                ? "bg-accent text-primary font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
            }`}
          >
            {location.pathname === "/settings" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
            )}
            <Settings size={expanded ? 16 : 18} strokeWidth={1.5} />
            {expanded && <span>Settings</span>}
          </button>
        )}

        {/* User avatar — links to profile */}
        <button
          onClick={() => navTo("/profile")}
          title={!expanded ? "Profile" : undefined}
          className={`relative group ${expanded ? "w-full flex items-center gap-2.5 px-2 py-2 rounded-xl" : "w-10 h-10 flex items-center justify-center rounded-xl"} transition-all duration-200 ${
            location.pathname === "/profile"
              ? "bg-accent text-primary"
              : "hover:bg-sidebar-accent hover:text-foreground"
          }`}
        >
          {location.pathname === "/profile" && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
          )}
          <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-[9px] font-bold text-white">{user?.initials}</span>
          </div>
          {expanded && (
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-semibold truncate">{user?.name}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleCls}`}>{roleLbl}</span>
            </div>
          )}
          {/* Tooltip for collapsed sidebar */}
          {!expanded && (
            <div className="absolute left-12 bottom-0 hidden group-hover:flex flex-col bg-card border border-border rounded-xl shadow-lg p-3 min-w-[160px] z-50 pointer-events-none">
              <p className="text-xs font-semibold">{user?.name}</p>
              <p className="text-[11px] text-muted-foreground mb-1.5">{user?.email}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${roleCls}`}>{roleLbl}</span>
            </div>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={!expanded ? "Sign out" : undefined}
          aria-label="Sign out"
          className={`${expanded ? "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm" : "w-10 h-10 flex items-center justify-center rounded-xl"} text-sidebar-foreground hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-200`}
        >
          <LogOut size={expanded ? 16 : 16} strokeWidth={1.5} />
          {expanded && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        className="fixed top-3 left-3 z-40 w-10 h-10 flex items-center justify-center rounded-xl bg-background border border-border shadow-sm lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 h-screen w-[260px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 w-[64px] flex-shrink-0">
        {sidebarContent(false)}
      </aside>
    </>
  );
}
