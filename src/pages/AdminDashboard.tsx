import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Clock, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalReports: 0,
    totalUsers: 0,
    openReports: 0,
    resolvedReports: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [reportsRes, usersRes] = await Promise.all([
        supabase.from("reports").select("status"),
        supabase.from("profiles").select("id"),
      ]);

      const reports = reportsRes.data || [];
      const users = usersRes.data || [];

      setStats({
        totalReports: reports.length,
        totalUsers: users.length,
        openReports: reports.filter(r => r.status === "Open").length,
        resolvedReports: reports.filter(r => r.status === "Resolved").length,
      });
    } catch (error: any) {
      toast.error("Gagal memuat statistik");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Admin</h1>
          <p className="text-muted-foreground mt-1">Kelola sistem dan monitor laporan</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Laporan</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total User</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Perlu Ditangani</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.openReports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Selesai</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.resolvedReports}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
