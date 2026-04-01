import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { SuperAdminDashboard } from "@/components/super-admin/SuperAdminDashboard";

export default function Companies() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <PageHeader placeholder="Search companies…" />
        <SuperAdminDashboard />
      </main>
    </div>
  );
}
