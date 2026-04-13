import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionExpiredModal } from "@/components/SessionExpiredModal";
import { CommandBar } from "@/components/CommandBar";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import Login from "./pages/Login";

// Lazy-load all protected pages — only the bundle for the current route is fetched
const Index = lazy(() => import("./pages/Index"));
const Projects = lazy(() => import("./pages/Projects"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Invoices = lazy(() => import("./pages/Invoices"));
const RecurringInvoices = lazy(() => import("./pages/RecurringInvoices"));
const Customers = lazy(() => import("./pages/Customers"));
const Ledger = lazy(() => import("./pages/Ledger"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Notes = lazy(() => import("./pages/Notes"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const Employees = lazy(() => import("./pages/Employees"));
const Profile = lazy(() => import("./pages/Profile"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const ContentPipeline = lazy(() => import("./pages/ContentPipeline"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,           // 5 minutes — cached data served instantly on navigation
      gcTime: 15 * 60_000,             // 15 minutes — keep in cache longer
      refetchOnWindowFocus: "always",   // background refresh on tab switch (UI stays instant)
      refetchOnReconnect: true,
    },
  },
});

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <SessionExpiredModal />
            <BrowserRouter>
              <CommandBar />
              <KeyboardShortcutsHelp />
              <Suspense fallback={null}>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* 403 Forbidden */}
                <Route path="/403" element={<Forbidden />} />

                {/* Dashboard — SUPER_ADMIN sees company management, ADMIN sees business metrics */}
                <Route path="/" element={
                  <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
                    <Index />
                  </ProtectedRoute>
                } />

                {/* Company management — SUPER_ADMIN only */}
                <Route path="/companies" element={
                  <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                    <Companies />
                  </ProtectedRoute>
                } />
                <Route path="/companies/:id" element={
                  <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                    <CompanyDetail />
                  </ProtectedRoute>
                } />

                {/* Billing routes */}
                <Route path="/invoices" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]} feature="billing">
                    <Invoices />
                  </ProtectedRoute>
                } />
                <Route path="/recurring-invoices" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]} feature="billing">
                    <RecurringInvoices />
                  </ProtectedRoute>
                } />
                <Route path="/customers" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]} feature="billing">
                    <Customers />
                  </ProtectedRoute>
                } />
                <Route path="/ledger" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]} feature="billing">
                    <Ledger />
                  </ProtectedRoute>
                } />
                <Route path="/expenses" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]} feature="billing">
                    <Expenses />
                  </ProtectedRoute>
                } />

                {/* Employee management */}
                <Route path="/employees" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Employees />
                  </ProtectedRoute>
                } />

                {/* Notes & Goals — all authenticated users */}
                <Route path="/notes" element={
                  <ProtectedRoute>
                    <Notes />
                  </ProtectedRoute>
                } />

                {/* Leads routes */}
                <Route path="/leads" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]} feature="leads">
                    <Leads />
                  </ProtectedRoute>
                } />
                <Route path="/leads/:id" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]} feature="leads">
                    <LeadDetail />
                  </ProtectedRoute>
                } />

                {/* Admin + PM */}
                <Route path="/settings" element={
                  <ProtectedRoute allowedRoles={["ADMIN", "PROJECT_MANAGER"]}>
                    <SettingsPage />
                  </ProtectedRoute>
                } />

                {/* All authenticated roles */}
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />

                {/* Content Pipeline (Editor + Digital Marketer) */}
                <Route path="/content" element={
                  <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "DIGITAL_MARKETER", "EDITOR"]}>
                    <ContentPipeline />
                  </ProtectedRoute>
                } />

                {/* Projects routes */}
                <Route path="/projects" element={
                  <ProtectedRoute feature="projects">
                    <Projects />
                  </ProtectedRoute>
                } />

                {/* Cross-project task hub — managers and above */}
                <Route path="/tasks" element={
                  <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "LEAD"]} feature="projects">
                    <Tasks />
                  </ProtectedRoute>
                } />

                {/* Attendance routes */}
                <Route path="/attendance" element={
                  <ProtectedRoute feature="attendance">
                    <Attendance />
                  </ProtectedRoute>
                } />

                {/* Catch-all */}
                <Route path="*" element={
                  <ProtectedRoute>
                    <NotFound />
                  </ProtectedRoute>
                } />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </ProjectProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
