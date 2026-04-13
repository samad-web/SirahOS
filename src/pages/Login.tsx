import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, ShieldCheck, FolderKanban, Code2, TestTube2, Users, PenLine, Megaphone } from "lucide-react";
import { useAuth, ROLE_LABELS, Role } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const roleHomeRoute = (role: Role) => (role === "ADMIN" || role === "SUPER_ADMIN") ? "/" : "/projects";

const roleIcons: Partial<Record<Role, React.ElementType>> = {
  ADMIN:            ShieldCheck,
  PROJECT_MANAGER:  FolderKanban,
  LEAD:             Users,
  DEVELOPER:        Code2,
  TESTER:           TestTube2,
  EDITOR:           PenLine,
  DIGITAL_MARKETER: Megaphone,
};

const roleDescriptions: Partial<Record<Role, string>> = {
  ADMIN:            "Full access: billing, invoices, reports, user management",
  PROJECT_MANAGER:  "Project oversight, task management, team coordination",
  LEAD:             "Technical leadership, task assignment, sprint planning",
  DEVELOPER:        "View assigned tasks, update progress, submit fixes",
  TESTER:           "Test features, report bugs, verify developer fixes",
  EDITOR:           "Edit and publish content, review copy, manage assets",
  DIGITAL_MARKETER: "Run campaigns, track performance, manage outreach",
};


export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) { setError(result.error ?? "Login failed"); return; }
    navigate(roleHomeRoute(result.role!));
  };


  return (
    <div className="min-h-screen flex bg-background">
      {/* ─── Left branding panel ─── */}
      <div className="hidden lg:flex lg:w-2/5 gradient-primary flex-col p-12 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Sirahos" className="w-10 h-10 rounded-xl object-contain" />
            <span className="text-white font-bold text-lg">Sirahos</span>
          </div>

          <div className="mt-auto mb-auto pt-16">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Manage billing,<br />projects & teams<br />in one place.
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              All-in-one platform for invoicing, accounting, project tracking, and team collaboration.
            </p>
          </div>

          <div className="space-y-3">
            {(Object.keys(roleDescriptions) as Role[]).slice(0, 3).map(role => {
              const Icon = roleIcons[role];
              const { label } = ROLE_LABELS[role];
              return (
                <div key={role} className="flex items-start gap-3 bg-white/10 rounded-xl p-3">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">{label}</p>
                    <p className="text-white/60 text-[11px] leading-relaxed">{roleDescriptions[role]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Right login panel ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <img src="/logo.png" alt="Sirahos" className="w-9 h-9 rounded-xl object-contain" />
            <span className="text-lg font-bold">Sirahos</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-7">Sign in to your workspace.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email address</label>
              <input
                type="email" autoComplete="email" required
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} autoComplete="current-password" required
                  className="w-full bg-muted rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                {error}
              </motion.p>
            )}

            <button type="submit" disabled={loading}
              className="w-full gradient-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <><LogIn size={15} /> Sign In</>
              )}
            </button>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
