import { AppSidebar } from "@/components/AppSidebar";
import { OngoingProjects } from "@/components/OngoingProjects";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell } from "lucide-react";

const Projects = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 min-w-0 pb-20">
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border bg-background/80 backdrop-blur-sm">
          <h1 className="text-sm font-medium">Ongoing Projects</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell size={16} strokeWidth={1.5} className="text-muted-foreground" />
            </button>
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-[11px] font-medium text-primary">AK</span>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-6xl">
          <OngoingProjects />
        </div>
      </main>
    </div>
  );
};

export default Projects;
