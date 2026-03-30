import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, tasksApi, bugsApi, tokenStorage, Project, Task, BugReport, CreateProjectPayload, CreateTaskPayload, CreateBugPayload } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ─── Re-export types for backward compat with views ─────────────────────────

export type ProjectStatus = Project["status"];
export type TaskType     = Task["type"];
export type TaskStatus   = Task["status"];
export type TaskPriority = Task["priority"];
export type BugSeverity  = BugReport["severity"];
export type BugStatus    = BugReport["status"];

export type { Project, Task, BugReport };

// ─── Query keys ──────────────────────────────────────────────────────────────

export const QK = {
  projects: ["projects"] as const,
  tasks: (projectId?: string) => projectId ? ["tasks", projectId] : ["tasks"],
  bugs:  (projectId?: string) => projectId ? ["bugs", projectId]  : ["bugs"],
};

// ─── Context interface ────────────────────────────────────────────────────────

interface ProjectCtx {
  projects: Project[];
  tasks: Task[];
  bugs: BugReport[];
  isLoading: boolean;

  // Project mutations
  createProject:  (p: CreateProjectPayload) => Promise<void>;
  assignPM:       (projectId: string, pmId: string) => Promise<void>;
  assignLead:     (projectId: string, leadId: string) => Promise<void>;
  addMember:      (projectId: string, userId: string) => Promise<void>;
  removeMember:   (projectId: string, userId: string) => Promise<void>;
  updateProjectStatus: (projectId: string, status: ProjectStatus) => Promise<void>;

  // Task mutations
  createTask:       (t: CreateTaskPayload) => Promise<void>;
  assignTask:       (taskId: string, userId: string | null) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;

  // Bug mutations
  reportBug:      (b: CreateBugPayload) => Promise<void>;
  assignBug:      (bugId: string, userId: string) => Promise<void>;
  updateBugStatus:(bugId: string, status: BugStatus, resolution?: string) => Promise<void>;
}

const Ctx = createContext<ProjectCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProjectProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // ── Queries (only fire when logged in) ────────────────────────────────────
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: QK.projects,
    queryFn: () => projectsApi.list().then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: QK.tasks(),
    queryFn: () => tasksApi.list().then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: bugs = [], isLoading: loadingBugs } = useQuery({
    queryKey: QK.bugs(),
    queryFn: () => bugsApi.list().then((r) => r.data),
    enabled: isAuthenticated,
  });

  const isLoading = loadingProjects || loadingTasks || loadingBugs;

  // ── Project mutations ────────────────────────────────────────────────────────
  const createProjectMut = useMutation({
    mutationFn: (p: CreateProjectPayload) => projectsApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projects }),
  });

  const assignPMMut = useMutation({
    mutationFn: ({ projectId, pmId }: { projectId: string; pmId: string }) =>
      projectsApi.assignPm(projectId, pmId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projects }),
  });

  const assignLeadMut = useMutation({
    mutationFn: ({ projectId, leadId }: { projectId: string; leadId: string }) =>
      projectsApi.assignLead(projectId, leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projects }),
  });

  const addMemberMut = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      projectsApi.addMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projects }),
  });

  const removeMemberMut = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      projectsApi.removeMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projects }),
  });

  const updateProjectStatusMut = useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: string }) =>
      projectsApi.updateStatus(projectId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projects }),
  });

  // ── Task mutations ────────────────────────────────────────────────────────────
  const createTaskMut = useMutation({
    mutationFn: (t: CreateTaskPayload) => tasksApi.create(t),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.tasks() }),
  });

  const assignTaskMut = useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string | null }) =>
      tasksApi.update(taskId, { assigneeId: userId ?? undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.tasks() }),
  });

  const updateTaskStatusMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      tasksApi.update(taskId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.tasks() }),
  });

  // ── Bug mutations ─────────────────────────────────────────────────────────────
  const reportBugMut = useMutation({
    mutationFn: (b: CreateBugPayload) => bugsApi.create(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.bugs() }),
  });

  const assignBugMut = useMutation({
    mutationFn: ({ bugId, userId }: { bugId: string; userId: string }) =>
      bugsApi.assign(bugId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.bugs() }),
  });

  const updateBugStatusMut = useMutation({
    mutationFn: ({ bugId, status, resolution }: { bugId: string; status: BugStatus; resolution?: string }) =>
      bugsApi.updateStatus(bugId, status, resolution),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.bugs() }),
  });

  // ── Exposed helpers (match original signature) ────────────────────────────────
  const createProject = (p: CreateProjectPayload) => createProjectMut.mutateAsync(p).then(() => {});
  const assignPM      = (projectId: string, pmId: string) => assignPMMut.mutateAsync({ projectId, pmId }).then(() => {});
  const assignLead    = (projectId: string, leadId: string) => assignLeadMut.mutateAsync({ projectId, leadId }).then(() => {});
  const addMember     = (projectId: string, userId: string) => addMemberMut.mutateAsync({ projectId, userId }).then(() => {});
  const removeMember  = (projectId: string, userId: string) => removeMemberMut.mutateAsync({ projectId, userId }).then(() => {});
  const updateProjectStatus = (projectId: string, status: ProjectStatus) =>
    updateProjectStatusMut.mutateAsync({ projectId, status }).then(() => {});

  const createTask       = (t: CreateTaskPayload) => createTaskMut.mutateAsync(t).then(() => {});
  const assignTask       = (taskId: string, userId: string | null) => assignTaskMut.mutateAsync({ taskId, userId }).then(() => {});
  const updateTaskStatus = (taskId: string, status: TaskStatus) => updateTaskStatusMut.mutateAsync({ taskId, status }).then(() => {});

  const reportBug       = (b: CreateBugPayload) => reportBugMut.mutateAsync(b).then(() => {});
  const assignBug       = (bugId: string, userId: string) => assignBugMut.mutateAsync({ bugId, userId }).then(() => {});
  const updateBugStatus = (bugId: string, status: BugStatus, resolution?: string) =>
    updateBugStatusMut.mutateAsync({ bugId, status, resolution }).then(() => {});

  return (
    <Ctx.Provider value={{
      projects, tasks, bugs, isLoading,
      createProject, assignPM, assignLead, addMember, removeMember, updateProjectStatus,
      createTask, assignTask, updateTaskStatus,
      reportBug, assignBug, updateBugStatus,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjects must be inside ProjectProvider");
  return ctx;
}
