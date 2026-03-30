import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { AdminAttendanceView } from "@/components/attendance/AdminAttendanceView";
import { LeadAttendanceView }  from "@/components/attendance/LeadAttendanceView";
import { SelfAttendanceView }  from "@/components/attendance/SelfAttendanceView";

type ViewMode = "manage" | "my";

export default function Attendance() {
  const { user } = useAuth();
  const role = user?.role ?? "DEVELOPER";
  const hasManagerView = role === "ADMIN" || role === "PROJECT_MANAGER" || role === "LEAD";
  const [view, setView] = useState<ViewMode>("manage");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader placeholder="Search attendance…" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {!hasManagerView ? "My Attendance" : view === "manage" ? "Attendance Management" : "My Attendance"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {!hasManagerView
                  ? "Mark your daily attendance and manage your leave requests."
                  : view === "manage"
                    ? "View and manage attendance and leave requests."
                    : "Mark your attendance and apply for leave."}
              </p>
            </div>
            {hasManagerView && (
              <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
                <button onClick={() => setView("manage")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === "manage" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {role === "LEAD" ? "Team" : "Manage"}
                </button>
                <button onClick={() => setView("my")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === "my" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  My Attendance
                </button>
              </div>
            )}
          </div>

          {!hasManagerView && <SelfAttendanceView />}
          {hasManagerView && view === "my" && <SelfAttendanceView />}
          {hasManagerView && view === "manage" && (
            <>
              {(role === "ADMIN" || role === "PROJECT_MANAGER") && <AdminAttendanceView />}
              {role === "LEAD" && <LeadAttendanceView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
