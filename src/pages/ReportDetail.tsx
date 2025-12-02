import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Calendar, User, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Report = {
  id: string;
  title: string;
  description: string;
  status: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  categories?: { name: string };
  profiles?: { name: string };
  assigned_profiles?: { name: string };
};

type ReportUpdate = {
  id: string;
  note: string;
  status_update: string;
  image_url: string | null;
  created_at: string;
  profiles?: { name: string };
};

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [updates, setUpdates] = useState<ReportUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchReportDetail();
      fetchReportUpdates();
    }
  }, [id]);

  const fetchReportDetail = async () => {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select(`
          *,
          categories (name),
          profiles!reports_user_id_fkey (name),
          assigned_profiles:profiles!reports_assigned_to_fkey (name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setReport(data);
    } catch (error: any) {
      toast.error("Gagal memuat detail laporan");
    } finally {
      setLoading(false);
    }
  };

  const fetchReportUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from("report_updates")
        .select(`
          *,
          profiles (name)
        `)
        .eq("report_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUpdates(data || []);
    } catch (error: any) {
      console.error("Error fetching updates:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-info text-info-foreground";
      case "On Progress":
        return "bg-warning text-warning-foreground";
      case "Resolved":
        return "bg-success text-success-foreground";
      case "Rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Laporan tidak ditemukan</p>
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="mt-4">
            Kembali
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Badge className={getStatusColor(report.status)}>
                  {report.status}
                </Badge>
                <CardTitle className="text-2xl">{report.title}</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {report.image_url && (
              <img
                src={report.image_url}
                alt={report.title}
                className="w-full h-64 object-cover rounded-lg border"
              />
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Kategori:</span>
                <span>{report.categories?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Pelapor:</span>
                <span>{report.profiles?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Dibuat:</span>
                <span>{new Date(report.created_at).toLocaleString("id-ID")}</span>
              </div>
              {report.assigned_profiles && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Ditangani:</span>
                  <span>{report.assigned_profiles.name}</span>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Deskripsi</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {report.description}
              </p>
            </div>

            <div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Lokasi</h3>
                  <p className="text-sm text-muted-foreground">{report.location_text}</p>
                  {report.latitude && report.longitude && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Koordinat: {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {updates.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-4">Riwayat Penanganan</h3>
                  <div className="space-y-4">
                    {updates.map((update) => (
                      <Card key={update.id} className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <Badge className={getStatusColor(update.status_update)}>
                              {update.status_update}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(update.created_at).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <p className="text-sm mb-2">{update.note}</p>
                          <p className="text-xs text-muted-foreground">
                            oleh {update.profiles?.name}
                          </p>
                          {update.image_url && (
                            <img
                              src={update.image_url}
                              alt="Update"
                              className="mt-3 w-full h-48 object-cover rounded-lg border"
                            />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
