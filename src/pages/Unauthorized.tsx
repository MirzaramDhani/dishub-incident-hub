import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <ShieldAlert className="h-16 w-16 mx-auto text-destructive" />
        <h1 className="text-3xl font-bold">Akses Ditolak</h1>
        <p className="text-muted-foreground max-w-md">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <Button onClick={() => navigate("/dashboard")}>
          Kembali ke Dashboard
        </Button>
      </div>
    </div>
  );
}
