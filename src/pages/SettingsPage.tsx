import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Settings } from "lucide-react";

const SettingsPage = () => (
  <div className="flex min-h-screen bg-background">
    <AppSidebar />
    <main className="flex-1 min-w-0">
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border bg-background/80 backdrop-blur-sm">
        <h1 className="text-sm font-medium">Settings</h1>
        <ThemeToggle />
      </header>
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground gap-3">
        <Settings size={32} strokeWidth={1} />
        <p className="text-sm">Settings module coming soon</p>
      </div>
    </main>
  </div>
);

export default SettingsPage;
