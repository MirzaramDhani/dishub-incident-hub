import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock, CheckCircle2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Report = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  location_text: string;
  categories?: { name: string };
  profiles?: { name: string };
};

export default function PetugasDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [availableReports, setAvailableReports] = useState<Report[]>([]);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [rejectedReports, setRejectedReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    fetchReports();
  }, [profile]);

  const fetchReports = async () => {
    if (!profile) return;

    try {
      // Fetch available reports (Open status, not assigned)
      const { data: available, error: availableError } = await supabase
        .from("reports")
        .select(
          `
          *,
          categories (name),
          profiles!reports_user_id_fkey (name)
        `
        )
        .eq("status", "Open")
        .is("assigned_to", null)
        .order("created_at", { ascending: false });

      if (availableError) throw availableError;
      setAvailableReports(available || []);

      // Fetch reports being handled by petugas team (Dishub org-level)
      // This includes:
      // 1. Reports assigned to any petugas account (.assigned_to role = petugas)
      // 2. Reports with status changed to "On Progress" or "Resolved" (meaning a petugas worked on it)
      // 3. Reports with updates created by petugas (even if assigned_to is null/non-petugas)
      const { data: mine, error: mineError } = await supabase
        .from("reports")
        .select(
          `
          *,
          categories (name),
          profiles!reports_user_id_fkey (name),
          assigned_profiles:profiles!reports_assigned_to_fkey (name, role)
        `
        )
        .or(`status.eq.On Progress,status.eq.Resolved,assigned_to.not.is.null`)
        .order("created_at", { ascending: false });

      if (mineError) throw mineError;
      setMyReports(mine || []);

      // Calculate stats (only count "On Progress" and "Resolved" since "Ditangani"
      // now shows all reports with those statuses OR assigned reports)
      const total = mine?.length || 0;
      const inProgress =
        mine?.filter((r) => r.status === "On Progress").length || 0;
      const completed =
        mine?.filter((r) => r.status === "Resolved").length || 0;

      setStats({ total, inProgress, completed });

      // Fetch rejected reports (for quick review)
      const { data: rejected, error: rejectedError } = await supabase
        .from("reports")
        .select(
          `
          *,
          categories (name),
          profiles!reports_user_id_fkey (name),
          assigned_profiles:profiles!reports_assigned_to_fkey (name, role)
        `
        )
        .eq("status", "Rejected")
        .order("created_at", { ascending: false });

      if (rejectedError) throw rejectedError;
      setRejectedReports(rejected || []);
    } catch (error: any) {
      toast.error("Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  };

  const handleTakeReport = async (reportId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from("reports")
        .update({
          assigned_to: profile.id,
          status: "On Progress",
        })
        .eq("id", reportId);

      if (error) throw error;

      // Add initial update
      await supabase.from("report_updates").insert({
        report_id: reportId,
        petugas_id: profile.id,
        note: "Laporan diambil dan sedang ditangani",
        status_update: "On Progress",
      });

      toast.success("Laporan berhasil diambil");
      fetchReports();
    } catch (error: any) {
      toast.error("Gagal mengambil laporan");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-info text-info-foreground";
      case "On Progress":
        return "bg-warning text-warning-foreground";
      case "Rejected":
        return "bg-destructive text-destructive-foreground";
      case "Resolved":
        return "bg-success text-success-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard Petugas
          </h1>
          <p className="text-muted-foreground mt-1">
            Kelola dan tangani laporan masuk
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Ditangani
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Dalam Proses
              </CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats.inProgress}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Selesai</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {stats.completed}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Laporan</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="available" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="available">
                  Tersedia ({availableReports.length})
                </TabsTrigger>
                <TabsTrigger value="mine">
                  Ditangani ({myReports.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Ditolak ({rejectedReports.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="available" className="space-y-4 mt-4">
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">
                    Memuat...
                  </p>
                ) : availableReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Tidak ada laporan tersedia
                  </p>
                ) : (
                  availableReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-smooth"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{report.title}</h3>
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span>{report.categories?.name}</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="line-clamp-1">
                              {report.location_text}
                            </span>
                          </div>
                          <span>
                            {new Date(report.created_at).toLocaleDateString(
                              "id-ID"
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            navigate(`/petugas/report/${report.id}`)
                          }
                          variant="outline"
                          size="sm"
                        >
                          Detail
                        </Button>
                        <Button
                          onClick={() => handleTakeReport(report.id)}
                          size="sm"
                        >
                          Ambil
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="mine" className="space-y-4 mt-4">
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">
                    Memuat...
                  </p>
                ) : myReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Belum ada laporan yang ditangani
                  </p>
                ) : (
                  myReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => navigate(`/petugas/report/${report.id}`)}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-smooth"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{report.title}</h3>
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span>{report.categories?.name}</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="line-clamp-1">
                              {report.location_text}
                            </span>
                          </div>
                          <span>
                            {new Date(report.created_at).toLocaleDateString(
                              "id-ID"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-4 mt-4">
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">
                    Memuat...
                  </p>
                ) : rejectedReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Tidak ada laporan yang ditolak
                  </p>
                ) : (
                  rejectedReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => navigate(`/petugas/report/${report.id}`)}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-smooth"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{report.title}</h3>
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span>{report.categories?.name}</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="line-clamp-1">
                              {report.location_text}
                            </span>
                          </div>
                          <span>
                            {new Date(report.created_at).toLocaleDateString(
                              "id-ID"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
