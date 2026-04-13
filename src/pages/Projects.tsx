import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { AdminProjectsView }            from "@/components/projects/AdminProjectsView";
import { PMProjectsView }               from "@/components/projects/PMProjectsView";
import { LeadProjectsView }             from "@/components/projects/LeadProjectsView";
import { DeveloperProjectsView }        from "@/components/projects/DeveloperProjectsView";
import { TesterProjectsView }           from "@/components/projects/TesterProjectsView";
import { EditorProjectsView }           from "@/components/projects/EditorProjectsView";
import { DigitalMarketerProjectsView }  from "@/components/projects/DigitalMarketerProjectsView";

const roleTitle: Record<string, string> = {
  SUPER_ADMIN:      "All Projects",
  ADMIN:            "All Projects",
  PROJECT_MANAGER:  "Project Management",
  LEAD:             "My Project",
  DEVELOPER:        "My Tasks",
  TESTER:           "Testing & QA",
  EDITOR:           "Content Pipeline",
  DIGITAL_MARKETER: "Campaign Funnel",
};

const Projects = () => {
  const { user } = useAuth();
  const role = user?.role ?? "DEVELOPER";

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 pb-20">
        <PageHeader placeholder={`Search ${roleTitle[role].toLowerCase()}…`} />
        <div className="p-6 max-w-7xl">
          <div className="mb-5">
            <h1 className="text-lg font-semibold">{roleTitle[role]}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(role === "ADMIN" || role === "SUPER_ADMIN") && "Overview of all projects, team assignments and health."}
              {role === "PROJECT_MANAGER" && "Manage your projects, assign leads and track progress."}
              {role === "LEAD"            && "Your project task board, team, and bug reports."}
              {role === "DEVELOPER"        && "Tasks assigned to you across all projects."}
              {role === "TESTER"           && "Your test tasks and bug reporting dashboard."}
              {role === "EDITOR"           && "Drafts, reviews, and published pieces across all projects."}
              {role === "DIGITAL_MARKETER" && "Planned, running, and wrapped campaigns across all projects."}
            </p>
          </div>

          {(role === "ADMIN" || role === "SUPER_ADMIN") && <AdminProjectsView />}
          {role === "PROJECT_MANAGER"  && <PMProjectsView />}
          {role === "LEAD"             && <LeadProjectsView />}
          {role === "DEVELOPER"        && <DeveloperProjectsView />}
          {role === "TESTER"           && <TesterProjectsView />}
          {role === "EDITOR"           && <EditorProjectsView />}
          {role === "DIGITAL_MARKETER" && <DigitalMarketerProjectsView />}
        </div>
      </main>
    </div>
  );
};

export default Projects;
