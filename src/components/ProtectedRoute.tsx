import { Navigate } from "react-router-dom";
import { useAuth, Role, FeatureFlag } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface Props {
  children: React.ReactNode;
  allowedRoles?: Role[];
  feature?: FeatureFlag;
}

export function ProtectedRoute({ children, allowedRoles, feature }: Props) {
  const { user, isLoading, hasFeature } = useAuth();

  // Wait for session restoration before making a routing decision
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/" : "/projects"} replace />;
  }

  if (feature && !hasFeature(feature)) {
    return <Navigate to="/403" replace />;
  }

  return <ErrorBoundary inline>{children}</ErrorBoundary>;
}
