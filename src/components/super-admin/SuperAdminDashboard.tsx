import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Building2, Users, CheckCircle, XCircle, Plus, MoreHorizontal, Eye, Ban, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { superAdminApi, Company, CreateCompanyPayload } from "@/lib/api";

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await superAdminApi.listCompanies();
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCompanyPayload) => superAdminApi.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSheetOpen(false);
      toast.success("Company created successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to create company");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) =>
      status === "SUSPENDED"
        ? superAdminApi.reactivateCompany(id)
        : superAdminApi.suspendCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company status updated");
    },
  });

  // Stats
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === "ACTIVE").length;
  const suspendedCompanies = companies.filter((c) => c.status === "SUSPENDED").length;
  const totalUsers = companies.reduce((sum, c) => sum + (c._count?.users || 0), 0);

  // Form state
  const [form, setForm] = useState({
    companyName: "",
    companySlug: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    features: { billing: true, projects: true, attendance: true, leads: true },
  });

  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, companyName: name, companySlug: slugify(name) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const resetForm = () => {
    setForm({
      companyName: "", companySlug: "", adminName: "", adminEmail: "", adminPassword: "",
      features: { billing: true, projects: true, attendance: true, leads: true },
    });
  };

  const featureFlags: ("billing" | "projects" | "attendance" | "leads")[] = ["billing", "projects", "attendance", "leads"];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Management</h1>
          <p className="text-muted-foreground text-sm">Manage all companies on the platform</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (open) resetForm(); }}>
          <SheetTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create Company</Button>
          </SheetTrigger>
          <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create New Company</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input id="companyName" value={form.companyName} onChange={(e) => handleNameChange(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companySlug">Slug *</Label>
                <Input id="companySlug" value={form.companySlug} onChange={(e) => setForm((f) => ({ ...f, companySlug: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin Full Name *</Label>
                <Input id="adminName" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin Email *</Label>
                <Input id="adminEmail" type="email" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Admin Password *</Label>
                <Input id="adminPassword" type="password" value={form.adminPassword} onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} required minLength={8} />
              </div>
              <div className="space-y-3 pt-2">
                <Label>Feature Modules</Label>
                {featureFlags.map((flag) => (
                  <div key={flag} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{flag}</span>
                    <Switch
                      checked={form.features[flag]}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, features: { ...f.features, [flag]: checked } }))}
                    />
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Company"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCompanies}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{activeCompanies}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{suspendedCompanies}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalUsers}</div></CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{company.slug}</TableCell>
                    <TableCell>
                      <Badge variant={company.status === "ACTIVE" ? "default" : "destructive"}>
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {company.featureBilling && <Badge variant="outline" className="text-xs">Billing</Badge>}
                        {company.featureProjects && <Badge variant="outline" className="text-xs">Projects</Badge>}
                        {company.featureAttendance && <Badge variant="outline" className="text-xs">Attendance</Badge>}
                        {company.featureLeads && <Badge variant="outline" className="text-xs">Leads</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{company.users?.[0]?.email || "—"}</TableCell>
                    <TableCell>{company._count?.users || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(company.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/companies/${company.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleStatusMutation.mutate({ id: company.id, status: company.status })}
                          >
                            {company.status === "ACTIVE" ? (
                              <><Ban className="mr-2 h-4 w-4" />Suspend</>
                            ) : (
                              <><RotateCcw className="mr-2 h-4 w-4" />Reactivate</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {companies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No companies yet. Create your first company to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
