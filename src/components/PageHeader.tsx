import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

function getToday() {
  return new Date().toLocaleDateString("en-US", { weekday:"short", day:"numeric", month:"short" });
}

interface PageHeaderProps {
  placeholder?: string;
  search?: string;
  onSearch?: (v: string) => void;
}

export function PageHeader({ placeholder = "Search…", search = "", onSearch }: PageHeaderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 pl-16 lg:pl-6 border-b border-border bg-background/80 backdrop-blur-xl gap-4">
      <div className="flex items-center gap-3 flex-1 max-w-sm">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5 flex-1">
          <Search size={14} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0" />
          <input
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            placeholder={placeholder}
            value={search}
            onChange={e => onSearch?.(e.target.value)}
            aria-label="Search"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap font-medium hidden sm:inline">
          Today, {getToday()}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <NotificationBell />
        <button
          onClick={() => navigate("/profile")}
          className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center ml-1 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
          title="View profile"
        >
          <span className="text-[11px] font-semibold text-white">{user?.initials ?? "??"}</span>
        </button>
      </div>
    </header>
  );
}
