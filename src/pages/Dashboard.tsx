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
import { Plus, FileText, Clock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Report = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  category_id: string;
  categories?: { name: string };
  profiles?: { name?: string } | null;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    onProgress: 0,
    resolved: 0,
  });

  useEffect(() => {
    fetchReports(viewAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, viewAll]);

  const fetchReports = async (all = false) => {
    if (!profile) {
      // not signed in — clear list and stop loading so the UI doesn't hang
      setReports([]);
      setStats({ total: 0, open: 0, onProgress: 0, resolved: 0 });
      setLoading(false);
      return;
    }

    try {
      setFetchError(null);
      setLoading(true);

      // Only request profiles when asking for all reports to avoid unexpected shapes
      // from the DB when selecting nested relations for a single-user view.
      // When selecting all reports we want the report author's profile (user_id) —
      // there are multiple FK relationships to profiles (user_id and assigned_to),
      // so disambiguate by using the foreign key relationship name.
      let query = all
        ? supabase
            .from("reports")
            // use PostgREST relationship qualifier to pick reports_user_id_fkey
            .select(`*, categories (name), profiles!reports_user_id_fkey (name)`)
        : supabase.from("reports").select(`*, categories (name)`);

      if (!all) {
        query = query.eq("user_id", profile.id);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      const normalizeProfiles = (p: any): { name: string } => {
        if (!p) return { name: "" };
        if (typeof p === "string") return { name: p };
        if (Array.isArray(p) && p.length > 0 && typeof p[0] === "object") {
          return { name: (p[0] as any).name || "" };
        }
        if (typeof p === "object" && "name" in p && typeof p.name === "string")
          return { name: p.name };
        // fallback
        return { name: "" };
      };

      const normalized: Report[] = (data || []).map((item: any) => ({
        ...item,
        profiles: normalizeProfiles(item.profiles),
      }));
      setReports(normalized);

      // Calculate stats from normalized list (safer types)
      const total = normalized.length;
      const open = normalized.filter((r) => r.status === "Open").length || 0;
      const onProgress =
        normalized.filter((r) => r.status === "On Progress").length || 0;
      const resolved =
        normalized.filter((r) => r.status === "Resolved").length || 0;

      setStats({ total, open, onProgress, resolved });
    } catch (error: any) {
      // surface a clearer message and log details to help debug why fetch fails
      const msg =
        error?.message || JSON.stringify(error) || "Gagal memuat laporan";
      setFetchError(msg);
      toast.error(msg);
      // eslint-disable-next-line no-console
      console.error("fetchReports failed", {
        all,
        profileId: profile?.id,
        error,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "text-info bg-info/10";
      case "On Progress":
        return "text-warning bg-warning/10";
      case "Resolved":
        return "text-success bg-success/10";
      case "Rejected":
        return "text-destructive bg-destructive/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Selamat Datang, {profile?.name}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Laporkan masalah infrastruktur untuk kota yang lebih baik
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate("/dashboard/new-report")}
              size="lg"
              className="gap-2 shadow-primary"
            >
              <Plus className="h-5 w-5" />
              Buat Laporan
            </Button>

            {/* toggle moved to Reports card header */}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Laporan
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Baru</CardTitle>
              <Clock className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{stats.open}</div>
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
                {stats.onProgress}
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
                {stats.resolved}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        <Card>
          <CardHeader className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Riwayat Laporan</CardTitle>
              <CardDescription>
                {viewAll
                  ? "Daftar semua laporan dari semua pengguna (termasuk status)"
                  : "Daftar semua laporan yang telah Anda buat"}
              </CardDescription>
            </div>

            <div className="self-center flex gap-2">
              <Button
                variant={!viewAll ? "secondary" : "ghost"}
                onClick={() => setViewAll(false)}
                size="sm"
                className="gap-2"
              >
                Laporan Saya
              </Button>

              <Button
                variant={viewAll ? "secondary" : "ghost"}
                onClick={() => setViewAll(true)}
                size="sm"
                className="gap-2"
              >
                Semua Laporan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">
                Memuat...
              </p>
            ) : fetchError ? (
              <div className="text-center py-12">
                <p className="text-destructive font-medium mb-4">
                  {fetchError}
                </p>
                <Button
                  onClick={() => fetchReports(viewAll)}
                  variant="outline"
                  className="mt-2"
                >
                  Coba Lagi
                </Button>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Belum ada laporan</p>
                <Button
                  onClick={() => navigate("/dashboard/new-report")}
                  variant="outline"
                  className="mt-4"
                >
                  Buat Laporan Pertama
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => navigate(`/dashboard/report/${report.id}`)}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-smooth"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{report.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {report.categories?.name} •{" "}
                        {new Date(report.created_at).toLocaleDateString(
                          "id-ID"
                        )}
                        {viewAll ? (
                          <span className="opacity-80">
                            {" "}
                            • oleh {report.profiles?.name}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        report.status
                      )}`}
                    >
                      {report.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
