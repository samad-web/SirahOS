/**
 * Global command palette (Cmd/Ctrl+K).
 *
 * Replaces the old decorative "bottom bar" input. Now actually queries
 * `/api/search` on debounced keystrokes and renders grouped results via
 * `cmdk` (already installed as the shadcn Command primitive).
 *
 * Mounted once at the app root so it's available from every page. Also
 * owns the "?" keyboard-shortcut help modal as a cheap sibling — both
 * are global overlays triggered by modifier keys, so it's natural to
 * keep them together.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users, FileText, Repeat, FolderKanban, ListTodo,
  LayoutDashboard, CalendarDays, StickyNote, Settings, User, Receipt, BookOpen,
} from "lucide-react";
import { searchApi, type SearchResult, type SearchResultType } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { ROUTE_ACCESS } from "@/lib/permissions";

const typeIcon: Record<SearchResultType, React.ElementType> = {
  customer:            Users,
  invoice:             FileText,
  "recurring-invoice": Repeat,
  project:             FolderKanban,
  task:                ListTodo,
};

const typeLabel: Record<SearchResultType, string> = {
  customer:            "Customers",
  invoice:             "Invoices",
  "recurring-invoice": "Recurring",
  project:             "Projects",
  task:                "Tasks",
};

// Quick-nav destinations shown when the input is empty.
const QUICK_NAV: { path: string; label: string; icon: React.ElementType }[] = [
  { path: "/",                    label: "Dashboard",          icon: LayoutDashboard },
  { path: "/invoices",            label: "Invoices",           icon: FileText        },
  { path: "/recurring-invoices",  label: "Recurring Invoices", icon: Repeat          },
  { path: "/customers",           label: "Customers",          icon: Users           },
  { path: "/expenses",            label: "Expenses",           icon: Receipt         },
  { path: "/ledger",              label: "Ledger",             icon: BookOpen        },
  { path: "/projects",            label: "Projects",           icon: FolderKanban    },
  { path: "/tasks",               label: "Tasks",              icon: ListTodo        },
  { path: "/attendance",          label: "Attendance",         icon: CalendarDays    },
  { path: "/notes",               label: "Notes & Goals",      icon: StickyNote      },
  { path: "/settings",            label: "Settings",           icon: Settings        },
  { path: "/profile",             label: "Profile",            icon: User            },
];

export function CommandBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 200);

  // Filter the quick-nav list by what the current user can actually access.
  const accessibleNav = useMemo(() => {
    if (!user) return [];
    return QUICK_NAV.filter(n => (ROUTE_ACCESS[n.path] ?? []).includes(user.role));
  }, [user]);

  // Global Cmd/Ctrl+K binding
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Reset on close so reopening feels fresh.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced search effect
  useEffect(() => {
    if (!debouncedQuery.trim() || !user) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchApi
      .query(debouncedQuery)
      .then(r => {
        if (!cancelled) setResults(r.data.results);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, user]);

  // Group results by type for the rendered sections
  const grouped = useMemo(() => {
    const g = new Map<SearchResultType, SearchResult[]>();
    for (const r of results) {
      const arr = g.get(r.type) ?? [];
      arr.push(r);
      g.set(r.type, arr);
    }
    return g;
  }, [results]);

  // Not logged in? Don't render at all — the palette has no meaning pre-auth.
  if (!user) return null;

  const runItem = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search customers, invoices, projects, tasks…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim() && !loading && results.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {loading && (
          <CommandEmpty>Searching…</CommandEmpty>
        )}

        {/* Quick-nav when input is empty */}
        {!query.trim() && accessibleNav.length > 0 && (
          <CommandGroup heading="Navigate">
            {accessibleNav.map(n => {
              const Icon = n.icon;
              return (
                <CommandItem
                  key={n.path}
                  value={`nav ${n.label}`}
                  onSelect={() => runItem(n.path)}
                >
                  <Icon className="mr-2 h-4 w-4" aria-hidden />
                  <span>{n.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Search results grouped by entity type */}
        {Array.from(grouped.entries()).map(([type, items], idx) => {
          const Icon = typeIcon[type];
          return (
            <div key={type}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={typeLabel[type]}>
                {items.map(item => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.type} ${item.title} ${item.subtitle ?? ""}`}
                    onSelect={() => runItem(item.url)}
                  >
                    <Icon className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-[11px] text-muted-foreground truncate">{item.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
