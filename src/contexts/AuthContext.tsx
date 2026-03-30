import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authApi, usersApi, tokenStorage, AppUser, UserRole } from "@/lib/api";

// ─── Role UI helpers ──────────────────────────────────────────────────────────

export type Role = UserRole; // re-export for backward compat

export const ROLE_LABELS: Record<UserRole, { label: string; cls: string }> = {
  ADMIN:           { label: "Admin",           cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  PROJECT_MANAGER: { label: "Project Manager", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  LEAD:            { label: "Lead",            cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  DEVELOPER:       { label: "Developer",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  TESTER:          { label: "Tester",          cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

// Route access: which roles are allowed per path
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  "/":           ["ADMIN"],
  "/employees":  ["ADMIN"],
  "/projects":   ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER"],
  "/attendance": ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER"],
  "/invoices":   ["ADMIN"],
  "/customers":  ["ADMIN"],
  "/expenses":   ["ADMIN"],
  "/ledger":     ["ADMIN"],
  "/notes":      ["ADMIN"],
  "/leads":      ["ADMIN"],
  "/settings":   ["ADMIN", "PROJECT_MANAGER"],
  "/profile":    ["ADMIN", "PROJECT_MANAGER", "LEAD", "DEVELOPER", "TESTER"],
};

// ─── Context types ────────────────────────────────────────────────────────────

interface AuthCtx {
  user: AppUser | null;
  allUsers: AppUser[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; role?: UserRole; error?: string }>;
  logout: () => Promise<void>;
  addUser: (data: { name: string; email: string; password: string; role: UserRole; reportsToId?: string }) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      const token = tokenStorage.getAccess();
      if (!token) { setIsLoading(false); return; }
      try {
        const { data } = await authApi.me();
        setUser(data);
      } catch {
        tokenStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  // Load assignable users when authenticated
  useEffect(() => {
    if (!user) return;
    usersApi.assignable()
      .then(({ data }) => setAllUsers(data))
      .catch(() => {});
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await authApi.login(email, password);
      tokenStorage.set(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { ok: true, role: data.user.role };
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Login failed. Please try again.";
      return { ok: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefresh();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // best-effort
    } finally {
      tokenStorage.clear();
      setUser(null);
      setAllUsers([]);
    }
  }, []);

  const addUser = useCallback(
    async (data: { name: string; email: string; password: string; role: UserRole; reportsToId?: string }) => {
      const { data: newUser } = await usersApi.create(data);
      setAllUsers((prev) => [...prev, newUser]);
    },
    []
  );

  const toggleStatus = useCallback(async (id: string) => {
    const target = allUsers.find((u) => u.id === id);
    if (!target) return;
    const newStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { data: updated } = await usersApi.updateStatus(id, newStatus);
    setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: updated.status } : u)));
  }, [allUsers]);

  return (
    <Ctx.Provider value={{ user, allUsers, isLoading, login, logout, addUser, toggleStatus }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
