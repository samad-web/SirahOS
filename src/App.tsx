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
import Login from "./pages/Login";
import Index from "./pages/Index";
import Projects from "./pages/Projects";
import Invoices from "./pages/Invoices";
import Customers from "./pages/Customers";
import Ledger from "./pages/Ledger";
import SettingsPage from "./pages/SettingsPage";
import Attendance from "./pages/Attendance";
import Expenses from "./pages/Expenses";
import Notes from "./pages/Notes";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Employees from "./pages/Employees";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,              // 30 seconds — data stays fresh
      gcTime: 10 * 60_000,            // 10 minutes — keep in cache
      refetchOnWindowFocus: true,      // refetch on tab switch for real-time data
      refetchOnReconnect: true,        // refetch when network reconnects
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
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* Admin only */}
                <Route path="/" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="/invoices" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Invoices />
                  </ProtectedRoute>
                } />
                <Route path="/customers" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Customers />
                  </ProtectedRoute>
                } />
                <Route path="/ledger" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Ledger />
                  </ProtectedRoute>
                } />
                <Route path="/employees" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Employees />
                  </ProtectedRoute>
                } />
                <Route path="/expenses" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Expenses />
                  </ProtectedRoute>
                } />
                <Route path="/notes" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Notes />
                  </ProtectedRoute>
                } />
                <Route path="/leads" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <Leads />
                  </ProtectedRoute>
                } />
                <Route path="/leads/:id" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
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
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <Projects />
                  </ProtectedRoute>
                } />
                <Route path="/attendance" element={
                  <ProtectedRoute>
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
            </BrowserRouter>
          </TooltipProvider>
        </ProjectProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
