import { useState } from "react";
import { ExternalLink, Eye, EyeOff, Copy, Check, Plus, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

const initialProjects: Project[] = [
  {
    id: "1",
    name: "E-Commerce Platform",
    developedBy: "Arjun Kumar",
    managedBy: "Priya Sharma",
    databaseOwnedBy: "DevOps Team",
    databasePassword: "ec-secret-db2024",
    githubUrl: "https://github.com/org/ecommerce-platform",
    githubVisibility: "private",
    githubAccountOwnedBy: "Arjun Kumar",
    status: "active",
  },
  {
    id: "2",
    name: "CRM Dashboard",
    developedBy: "Rahul Verma",
    managedBy: "Sneha Patel",
    databaseOwnedBy: "Backend Team",
    databasePassword: "crm-secret-prod",
    githubUrl: "https://github.com/org/crm-dashboard",
    githubVisibility: "public",
    githubAccountOwnedBy: "Sneha Patel",
    status: "review",
  },
  {
    id: "3",
    name: "Invoice Automation",
    developedBy: "Vikram Singh",
    managedBy: "Anita Desai",
    databaseOwnedBy: "Vikram Singh",
    databasePassword: "inv-secret-auto",
    githubUrl: "https://github.com/org/invoice-auto",
    githubVisibility: "private",
    githubAccountOwnedBy: "Vikram Singh",
    status: "active",
  },
];

const emptyProject: Omit<Project, "id"> = {
  name: "",
  developedBy: "",
  managedBy: "",
  databaseOwnedBy: "",
  databasePassword: "",
  githubUrl: "",
  githubVisibility: "private",
  githubAccountOwnedBy: "",
  status: "active",
};

const statusBadge: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  review: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function PasswordCell({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono">
        {revealed ? value : "••••••••"}
      </span>
      <button onClick={() => setRevealed(!revealed)} className="p-0.5 hover:bg-muted rounded transition-colors">
        {revealed ? <EyeOff size={12} className="text-muted-foreground" /> : <Eye size={12} className="text-muted-foreground" />}
      </button>
      <button onClick={handleCopy} className="p-0.5 hover:bg-muted rounded transition-colors">
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-muted-foreground" />}
      </button>
    </div>
  );
}

export function OngoingProjects() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Project, "id">>(emptyProject);

  const handleCreate = () => {
    if (!form.name.trim()) return;
    setProjects((prev) => [
      ...prev,
      { ...form, id: crypto.randomUUID() },
    ]);
    setForm(emptyProject);
    setOpen(false);
  };

  const updateField = (field: keyof Omit<Project, "id">, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Ongoing Projects</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{projects.length} projects</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-8 text-xs">
              <Plus size={14} />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Create New Project</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Project Name</Label>
                <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="My Project" className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Developed by</Label>
                  <Input value={form.developedBy} onChange={(e) => updateField("developedBy", e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Managed by</Label>
                  <Input value={form.managedBy} onChange={(e) => updateField("managedBy", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Database owned by</Label>
                  <Input value={form.databaseOwnedBy} onChange={(e) => updateField("databaseOwnedBy", e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Database password</Label>
                  <Input type="password" value={form.databasePassword} onChange={(e) => updateField("databasePassword", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">GitHub URL</Label>
                <Input value={form.githubUrl} onChange={(e) => updateField("githubUrl", e.target.value)} placeholder="https://github.com/..." className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">GitHub visibility</Label>
                  <Select value={form.githubVisibility} onValueChange={(v) => updateField("githubVisibility", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">GitHub account owner</Label>
                  <Input value={form.githubAccountOwnedBy} onChange={(e) => updateField("githubAccountOwnedBy", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleCreate}>Create Project</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs h-9">Project</TableHead>
              <TableHead className="text-xs h-9">Developed by</TableHead>
              <TableHead className="text-xs h-9">Managed by</TableHead>
              <TableHead className="text-xs h-9">DB Owner</TableHead>
              <TableHead className="text-xs h-9">DB Password</TableHead>
              <TableHead className="text-xs h-9">GitHub</TableHead>
              <TableHead className="text-xs h-9">Visibility</TableHead>
              <TableHead className="text-xs h-9">GH Account</TableHead>
              <TableHead className="text-xs h-9">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="text-xs font-medium">{project.name}</TableCell>
                <TableCell className="text-xs">{project.developedBy}</TableCell>
                <TableCell className="text-xs">{project.managedBy}</TableCell>
                <TableCell className="text-xs">{project.databaseOwnedBy}</TableCell>
                <TableCell><PasswordCell value={project.databasePassword} /></TableCell>
                <TableCell>
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    {project.githubUrl.replace("https://github.com/", "")}
                    <ExternalLink size={11} />
                  </a>
                </TableCell>
                <TableCell>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${project.githubVisibility === "private" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                    {project.githubVisibility}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{project.githubAccountOwnedBy}</TableCell>
                <TableCell>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${statusBadge[project.status]}`}>
                    {project.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
