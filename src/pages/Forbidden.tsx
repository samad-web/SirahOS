import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <ShieldX className="mx-auto mb-4 h-16 w-16 text-red-400" />
        <h1 className="text-4xl font-bold mb-2">403</h1>
        <p className="text-muted-foreground mb-6">
          You don't have permission to access this page. This module may not be enabled for your company.
        </p>
        <Button onClick={() => navigate(-1)} variant="outline" className="mr-2">
          Go Back
        </Button>
        <Button onClick={() => navigate("/")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
