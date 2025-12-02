import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  FileText,
  Loader2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { z } from "zod";

const updateSchema = z.object({
  note: z
    .string()
    .min(10, "Catatan minimal 10 karakter")
    .max(1000, "Catatan maksimal 1000 karakter"),
  status: z.enum(["On Progress", "Resolved", "Rejected"]),
});

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
  assigned_to: string | null;
  categories?: { name: string };
  profiles?: { name: string };
  assigned_profiles?: { name: string; role?: string };
};

type ReportUpdate = {
  id: string;
  note: string;
  status_update: string;
  image_url: string | null;
  created_at: string;
  profiles?: { name: string };
};

export default function PetugasReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [updates, setUpdates] = useState<ReportUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [updateData, setUpdateData] = useState({
    note: "",
    status: "",
  });

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
        .select(
          `
          *,
          categories (name),
          profiles!reports_user_id_fkey (name),
          assigned_profiles:profiles!reports_assigned_to_fkey (name, role)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      setReport(data);
      // ensure we have the assigned profile role populated. sometimes the FK join
      // may not return 'role' (or the relation might not exist) — fetch a
      // fallback so canUpdate logic can rely on the role value.
      if (data?.assigned_to && !data?.assigned_profiles?.role) {
        try {
          const { data: assignedProfile, error: assignedError } = await supabase
            .from("profiles")
            .select("name, role")
            .eq("id", data.assigned_to)
            .single();

          if (!assignedError && assignedProfile) {
            setReport((prev) =>
              prev ? { ...prev, assigned_profiles: assignedProfile } : prev
            );
          }
        } catch (e) {
          // nothing — best-effort fallback
        }
      }
      setUpdateData({ ...updateData, status: data.status });
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
        .select(
          `
          *,
          profiles (name)
        `
        )
        .eq("report_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUpdates(data || []);
    } catch (error: any) {
      console.error("Error fetching updates:", error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile || !profile) return null;

    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("report-images")
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("report-images").getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      toast.error("Gagal mengupload gambar");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !report) return;

    setSubmitting(true);

    try {
      const validatedData = updateSchema.parse(updateData);

      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          throw new Error("Gagal mengupload gambar");
        }
      }

      // Update report status
      const { error: reportError } = await supabase
        .from("reports")
        .update({ status: validatedData.status })
        .eq("id", report.id);

      if (reportError) throw reportError;

      // Insert update
      const { error: updateError } = await supabase
        .from("report_updates")
        .insert({
          report_id: report.id,
          petugas_id: profile.id,
          note: validatedData.note,
          status_update: validatedData.status,
          image_url: imageUrl,
        });

      if (updateError) throw updateError;

      toast.success("Update berhasil disimpan");
      setUpdateData({ note: "", status: validatedData.status });
      setImageFile(null);
      setImagePreview("");
      fetchReportDetail();
      fetchReportUpdates();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Gagal menyimpan update");
      }
    } finally {
      setSubmitting(false);
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
          <Button
            onClick={() => navigate("/petugas")}
            variant="outline"
            className="mt-4"
          >
            Kembali
          </Button>
        </div>
      </Layout>
    );
  }

  // allow admin always; allow the assigned user; allow unassigned reports; and
  // allow any petugas (Dishub) to update reports assigned to the organization
  const isAdmin = profile?.role === "admin";
  const isPetugas = profile?.role === "petugas";
  const assignedIsPetugas = report.assigned_profiles?.role === "petugas";
  const canUpdate =
    isAdmin ||
    report.assigned_to === profile?.id ||
    report.assigned_to === null ||
    (isPetugas && assignedIsPetugas);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/petugas")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Report Detail */}
          <Card>
            <CardHeader>
              <div className="space-y-2">
                <Badge className={getStatusColor(report.status)}>
                  {report.status}
                </Badge>
                <CardTitle className="text-xl">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.image_url && (
                <img
                  src={report.image_url}
                  alt={report.title}
                  className="w-full h-48 object-cover rounded-lg border"
                />
              )}

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Kategori:</span>
                  <span>{report.categories?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Pelapor:</span>
                  <span>{report.profiles?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Dibuat:</span>
                  <span>
                    {new Date(report.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Deskripsi</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {report.description}
                </p>
              </div>

              <div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Lokasi</h4>
                    <p className="text-sm text-muted-foreground">
                      {report.location_text}
                    </p>
                    {report.latitude && report.longitude && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Koordinat: {report.latitude.toFixed(6)},{" "}
                        {report.longitude.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Update Form or explanation when not allowed */}
          {canUpdate ? (
            <Card>
              <CardHeader>
                <CardTitle>Tambah Update</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={updateData.status}
                      onValueChange={(value) =>
                        setUpdateData({ ...updateData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="On Progress">
                          Dalam Proses
                        </SelectItem>
                        <SelectItem value="Resolved">Selesai</SelectItem>
                        <SelectItem value="Rejected">Ditolak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Catatan Penanganan *</Label>
                    <Textarea
                      id="note"
                      placeholder="Jelaskan tindakan yang telah dilakukan..."
                      rows={4}
                      value={updateData.note}
                      onChange={(e) =>
                        setUpdateData({ ...updateData, note: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="update-image">
                      Upload Foto Bukti (Opsional)
                    </Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="update-image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="flex-1"
                      />
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-16 w-16 rounded-lg object-cover border"
                        />
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting || uploadingImage}
                  >
                    {submitting || uploadingImage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {uploadingImage ? "Mengupload..." : "Menyimpan..."}
                      </>
                    ) : (
                      "Simpan Update"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Tambah Update</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Anda tidak memiliki izin untuk menambahkan update pada laporan
                  ini.
                  {report.assigned_to ? (
                    <>
                      {" "}
                      Laporan ditugaskan kepada{" "}
                      <strong>
                        {report.assigned_profiles?.name ?? report.assigned_to}
                      </strong>
                      {report.assigned_profiles?.role ? (
                        <> ({report.assigned_profiles.role})</>
                      ) : null}
                    </>
                  ) : (
                    <> Laporan belum ditugaskan kepada petugas tertentu.</>
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Updates History */}
        {updates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Penanganan</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
