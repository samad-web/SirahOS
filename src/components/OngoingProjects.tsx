import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, Eye, EyeOff, Copy, Check,
  ChevronDown, Github, Database, Users, Calendar,
  Lock, Globe, Search,
} from "lucide-react";
import { useProjects, ProjectStatus } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";

const statusCls: Record<ProjectStatus, string> = {
  ACTIVE:    "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  PAUSED:    "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  REVIEW:    "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  PLANNING:  "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
};

function PasswordCell({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied]     = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs">
      <span className="text-foreground select-none">{revealed ? value : "••••••••••"}</span>
      <button onClick={() => setRevealed(v => !v)}
        className="p-1 rounded-md hover:bg-muted transition-colors flex-shrink-0" title={revealed ? "Hide" : "Reveal"}>
        {revealed
          ? <EyeOff size={11} className="text-muted-foreground"/>
          : <Eye    size={11} className="text-muted-foreground"/>}
      </button>
      <button onClick={handleCopy}
        className="p-1 rounded-md hover:bg-muted transition-colors flex-shrink-0" title="Copy password">
        {copied
          ? <Check size={11} className="text-emerald-500"/>
          : <Copy  size={11} className="text-muted-foreground"/>}
      </button>
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full gradient-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{pct}%</span>
    </div>
  );
}

export function OngoingProjects() {
  const { projects, tasks } = useProjects();
  const { allUsers } = useAuth();

  const [search, setSearch]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter]   = useState<"all" | ProjectStatus>("all");

  const filtered = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.client.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5 flex-1 max-w-xs">
          <Search size={13} className="text-muted-foreground flex-shrink-0"/>
          <input
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all","ACTIVE","REVIEW","PAUSED","PLANNING","COMPLETED"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Project rows */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No projects found.</p>
        )}
        {filtered.map((p, i) => {
          const pm      = allUsers.find(u => u.id === p.pmId);
          const lead    = allUsers.find(u => u.id === p.leadId);
          const members = p.members.map(m => m.user);
          const pTasks  = tasks.filter(t => t.projectId === p.id);
          const done    = pTasks.filter(t => t.status === "DONE").length;
          const isOpen  = expanded === p.id;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border border-border rounded-2xl overflow-hidden bg-card"
            >
              {/* Main row */}
              <button
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
              >
                {/* Project name + ID */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <span className="text-[10px] font-mono text-muted-foreground/70 flex-shrink-0">{p.id}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.client}</p>
                </div>

                {/* Status */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${statusCls[p.status]}`}>
                  {p.status}
                </span>

                {/* PM */}
                <div className="flex-shrink-0 w-28">
                  {pm ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-[7px] font-bold text-white">{pm.initials}</span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{pm.name}</span>
                    </div>
                  ) : <span className="text-[11px] text-muted-foreground/50 italic">No PM</span>}
                </div>

                {/* Team avatars */}
                <div className="flex items-center flex-shrink-0">
                  {members.slice(0, 4).map((m, idx) => (
                    <div key={m.id}
                      title={m.name}
                      className="w-6 h-6 rounded-full gradient-primary border-2 border-card flex items-center justify-center"
                      style={{ marginLeft: idx > 0 ? "-6px" : 0, zIndex: 4 - idx }}>
                      <span className="text-[7px] font-bold text-white">{m.initials}</span>
                    </div>
                  ))}
                  {members.length === 0 && <span className="text-[11px] text-muted-foreground/50 italic">No team</span>}
                  {members.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center" style={{ marginLeft: "-6px" }}>
                      <span className="text-[8px] font-bold text-muted-foreground">+{members.length - 4}</span>
                    </div>
                  )}
                </div>

                {/* Task progress */}
                <div className="w-28 flex-shrink-0">
                  {pTasks.length > 0 ? (
                    <div className="space-y-1">
                      <ProgressBar done={done} total={pTasks.length} />
                      <p className="text-[10px] text-muted-foreground">{done}/{pTasks.length} tasks</p>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/50 italic">No tasks</span>
                  )}
                </div>

                {/* Deadline */}
                <div className="flex items-center gap-1.5 flex-shrink-0 w-24">
                  <Calendar size={11} className="text-muted-foreground/60"/>
                  <span className="text-[11px] text-muted-foreground">{p.deadline || "—"}</span>
                </div>

                {/* Chevron */}
                <ChevronDown
                  size={14}
                  className={`text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Expanded technical details */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border bg-muted/20 px-5 py-4 grid grid-cols-3 gap-5">
                      {/* Team */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Users size={12} className="text-primary"/>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Team</span>
                        </div>
                        <DetailRow label="Developed by" value={p.developedBy || "—"}/>
                        <DetailRow label="Project Manager" value={pm?.name || "—"}/>
                        <DetailRow label="Lead" value={lead?.name || "—"}/>
                        {members.length > 0 && (
                          <div>
                            <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide block mb-1">Members</span>
                            <div className="flex flex-wrap gap-1">
                              {members.map(m => (
                                <span key={m.id} className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">{m.name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Database */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Database size={12} className="text-primary"/>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Database</span>
                        </div>
                        <DetailRow label="DB Owner" value={p.databaseOwnedBy || "—"}/>
                        <div>
                          <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide block mb-1">DB Password</span>
                          {p.databasePassword
                            ? <PasswordCell value={p.databasePassword}/>
                            : <span className="text-[11px] text-muted-foreground/50 italic">Not set</span>}
                        </div>
                      </div>

                      {/* GitHub */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Github size={12} className="text-primary"/>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">GitHub</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide block mb-1">Repository</span>
                          {p.githubUrl ? (
                            <a href={p.githubUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
                              {p.githubUrl.replace("https://github.com/", "")}
                              <ExternalLink size={10}/>
                            </a>
                          ) : <span className="text-[11px] text-muted-foreground/50 italic">Not set</span>}
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide block mb-1">Visibility</span>
                          <div className="flex items-center gap-1.5">
                            {p.visibility === "PRIVATE"
                              ? <Lock size={10} className="text-amber-500"/>
                              : <Globe size={10} className="text-emerald-500"/>}
                            <span className={`text-[10px] font-medium capitalize ${p.visibility === "PRIVATE" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {p.visibility.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide block mb-0.5">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
