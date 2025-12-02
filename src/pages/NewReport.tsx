import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Upload, Loader2, MapPin } from "lucide-react";
import { z } from "zod";

const reportSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter").max(200, "Judul maksimal 200 karakter"),
  description: z.string().min(10, "Deskripsi minimal 10 karakter").max(2000, "Deskripsi maksimal 2000 karakter"),
  category_id: z.string().uuid("Kategori harus dipilih"),
  location_text: z.string().min(5, "Lokasi minimal 5 karakter").max(500, "Lokasi maksimal 500 karakter"),
});

type Category = {
  id: string;
  name: string;
};

export default function NewReport() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    location_text: "",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    fetchCategories();
    getCurrentLocation();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Gagal memuat kategori");
    } else {
      setCategories(data || []);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          }));
          toast.success("Lokasi GPS berhasil diambil");
        },
        (error) => {
          console.error("Error getting location:", error);
          toast.info("Lokasi GPS tidak tersedia, masukkan lokasi manual");
        }
      );
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

      const { data: { publicUrl } } = supabase.storage
        .from("report-images")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      toast.error("Gagal mengupload gambar");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);

    try {
      const validatedData = reportSchema.parse(formData);

      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          throw new Error("Gagal mengupload gambar");
        }
      }

      const { error } = await supabase.from("reports").insert({
        user_id: profile.id,
        title: validatedData.title,
        description: validatedData.description,
        category_id: validatedData.category_id,
        location_text: validatedData.location_text,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        image_url: imageUrl,
        status: "Open",
      });

      if (error) throw error;

      toast.success("Laporan berhasil dibuat!");
      navigate("/dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Gagal membuat laporan");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
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
            <CardTitle>Buat Laporan Baru</CardTitle>
            <CardDescription>
              Laporkan masalah infrastruktur di wilayah Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Judul Laporan *</Label>
                <Input
                  id="title"
                  placeholder="Contoh: Jalan berlubang di Jl. Sudirman"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi *</Label>
                <Textarea
                  id="description"
                  placeholder="Jelaskan kondisi masalah secara detail..."
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Lokasi *</Label>
                <div className="flex gap-2">
                  <Input
                    id="location"
                    placeholder="Contoh: Jl. Sudirman No. 123, Jakarta"
                    value={formData.location_text}
                    onChange={(e) => setFormData({ ...formData, location_text: e.target.value })}
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    className="gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    GPS
                  </Button>
                </div>
                {formData.latitude && formData.longitude && (
                  <p className="text-xs text-muted-foreground">
                    Koordinat: {parseFloat(formData.latitude).toFixed(6)}, {parseFloat(formData.longitude).toFixed(6)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Upload Foto (Opsional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
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
                <p className="text-xs text-muted-foreground">
                  Format: JPG, PNG. Maksimal 5MB
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={loading || uploadingImage}
              >
                {loading || uploadingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadingImage ? "Mengupload gambar..." : "Mengirim laporan..."}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Kirim Laporan
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
