import { motion } from "framer-motion";
import { ExternalLink, Eye, EyeOff, Copy, Check } from "lucide-react";
import { useState } from "react";

interface Project {
  id: string;
  name: string;
  developedBy: string;
  managedBy: string;
  databaseOwnedBy: string;
  databasePassword: string;
  githubUrl: string;
  githubVisibility: "public" | "private";
  githubAccountOwnedBy: string;
  status: "active" | "paused" | "review";
}

const sampleProjects: Project[] = [
  {
    id: "1",
    name: "E-Commerce Platform",
    developedBy: "Arjun Kumar",
    managedBy: "Priya Sharma",
    databaseOwnedBy: "DevOps Team",
    databasePassword: "ec•••••••db2024",
    githubUrl: "https://github.com/org/ecommerce-platform",
    githubVisibility: "private",
    githubAccountOwnedBy: "Arjun Kumar",
  },
  {
    id: "2",
    name: "CRM Dashboard",
    developedBy: "Rahul Verma",
    managedBy: "Sneha Patel",
    databaseOwnedBy: "Backend Team",
    databasePassword: "crm•••••••prod",
    githubUrl: "https://github.com/org/crm-dashboard",
    githubVisibility: "public",
    githubAccountOwnedBy: "Sneha Patel",
  },
  {
    id: "3",
    name: "Invoice Automation",
    developedBy: "Vikram Singh",
    managedBy: "Anita Desai",
    databaseOwnedBy: "Vikram Singh",
    databasePassword: "inv•••••••auto",
    githubUrl: "https://github.com/org/invoice-auto",
    githubVisibility: "private",
    githubAccountOwnedBy: "Vikram Singh",
  },
];

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  review: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function FieldRow({ label, value, isSensitive, isLink }: { label: string; value: string; isSensitive?: boolean; isLink?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[180px] truncate"
          >
            {value.replace("https://github.com/", "")}
            <ExternalLink size={11} />
          </a>
        ) : (
          <span className="text-xs text-foreground font-medium max-w-[180px] truncate">
            {isSensitive && !revealed ? "••••••••" : value}
          </span>
        )}
        {isSensitive && (
          <button onClick={() => setRevealed(!revealed)} className="p-0.5 hover:bg-muted rounded transition-colors">
            {revealed ? <EyeOff size={12} className="text-muted-foreground" /> : <Eye size={12} className="text-muted-foreground" />}
          </button>
        )}
        {!isLink && (
          <button onClick={handleCopy} className="p-0.5 hover:bg-muted rounded transition-colors">
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-muted-foreground" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function OngoingProjects() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Ongoing Projects</h2>
        <span className="text-xs text-muted-foreground">{sampleProjects.length} projects</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sampleProjects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{project.name}</h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[project.status] || statusColors.active}`}>
                active
              </span>
            </div>

            <div className="space-y-0">
              <FieldRow label="Developed by" value={project.developedBy} />
              <FieldRow label="Managed by" value={project.managedBy} />
              <FieldRow label="Database owned by" value={project.databaseOwnedBy} />
              <FieldRow label="Database password" value={project.databasePassword} isSensitive />
              <FieldRow label="GitHub URL" value={project.githubUrl} isLink />
              <FieldRow label="GitHub visibility" value={project.githubVisibility} />
              <FieldRow label="GitHub account" value={project.githubAccountOwnedBy} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
