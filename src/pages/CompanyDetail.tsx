import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Users, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AppSidebar } from "@/components/AppSidebar";
import { toast } from "sonner";
import { superAdminApi, Company } from "@/lib/api";

const featureFlags = [
  { key: "featureBilling" as const, label: "Billing" },
  { key: "featureProjects" as const, label: "Projects" },
  { key: "featureAttendance" as const, label: "Attendance" },
  { key: "featureLeads" as const, label: "Leads" },
];

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data } = await superAdminApi.getCompany(id!);
      return data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Company>) => superAdminApi.updateCompany(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company updated");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to update";
      toast.error(msg);
    },
  });

  const toggleStatus = () => {
    if (!company) return;
    updateMutation.mutate({ status: company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" });
  };

  const toggleFeature = (key: keyof Company, value: boolean) => {
    updateMutation.mutate({ [key]: value } as Partial<Company>);
  };

  const toggleSuperAdminMutation = useMutation({
    mutationFn: ({ userId, grant }: { userId: string; grant: boolean }) =>
      superAdminApi.toggleSuperAdmin(id!, userId, grant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("User role updated");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to update role";
      toast.error(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Company not found</p>
        </div>
      </div>
    );
  }

  const admins = company.users ?? [];

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Back button + header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{company.name}</h1>
                <Badge variant={company.status === "ACTIVE" ? "default" : "destructive"}>
                  {company.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">/{company.slug} &middot; Created {new Date(company.createdAt).toLocaleDateString()}</p>
            </div>
            <Button
              variant={company.status === "ACTIVE" ? "destructive" : "default"}
              onClick={toggleStatus}
              disabled={updateMutation.isPending}
            >
              {company.status === "ACTIVE" ? "Suspend Company" : "Reactivate Company"}
            </Button>
          </div>

          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Feature Modules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {featureFlags.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{label}</Label>
                  <Switch
                    checked={!!company[key]}
                    onCheckedChange={(checked) => toggleFeature(key, checked)}
                    disabled={updateMutation.isPending}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Admin Info */}
          {admins.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Company Admins
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm flex-1">
                      <div>
                        <p className="text-muted-foreground text-xs">Name</p>
                        <p className="font-medium">{admin.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Email</p>
                        <p className="font-medium">{admin.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`h-4 w-4 ${admin.role === "SUPER_ADMIN" ? "text-red-500" : "text-muted-foreground"}`} />
                        <Label className="text-sm whitespace-nowrap">Super Admin</Label>
                      </div>
                      <Switch
                        checked={admin.role === "SUPER_ADMIN"}
                        onCheckedChange={(checked) =>
                          toggleSuperAdminMutation.mutate({ userId: admin.id, grant: checked })
                        }
                        disabled={toggleSuperAdminMutation.isPending}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* User Stats */}
          {company.userStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{company.userStats.total}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active</CardTitle>
                  <UserCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{company.userStats.active}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                  <UserX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600">{company.userStats.inactive}</div></CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
