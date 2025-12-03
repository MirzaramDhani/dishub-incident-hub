import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Upload, Loader2, MapPin, X } from "lucide-react";
import { z } from "zod";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const reportSchema = z.object({
  title: z
    .string()
    .min(5, "Judul minimal 5 karakter")
    .max(200, "Judul maksimal 200 karakter"),
  description: z
    .string()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(2000, "Deskripsi maksimal 2000 karakter"),
  category_id: z.string().uuid("Kategori harus dipilih"),
  location_text: z
    .string()
    .min(5, "Lokasi minimal 5 karakter")
    .max(500, "Lokasi maksimal 500 karakter"),
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
  const [showMap, setShowMap] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    location_text: "",
    latitude: "",
    longitude: "",
  });
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    fetchCategories();
    // Don't auto-run GPS on mount; let the user trigger the GPS button.

    return () => {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      // Cleanup map
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Initialize map when showMap changes
  useEffect(() => {
    if (!showMap || !mapContainer.current) return;

    // Initialize map centered on a default location (Jakarta)
    const defaultLat = parseFloat(formData.latitude) || -6.2088;
    const defaultLon = parseFloat(formData.longitude) || 106.8456;

    if (map.current) {
      map.current.remove();
    }

    map.current = L.map(mapContainer.current).setView(
      [defaultLat, defaultLon],
      13
    );

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);

    // Add marker if coordinates exist
    if (formData.latitude && formData.longitude) {
      if (marker.current) marker.current.remove();
      marker.current = L.marker([defaultLat, defaultLon]).addTo(map.current);
    }

    // Handle map click to set location
    const onMapClick = (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;

      setFormData((prev) => ({
        ...prev,
        latitude: lat.toString(),
        longitude: lon.toString(),
      }));

      if (marker.current) marker.current.remove();
      marker.current = L.marker([lat, lon])
        .addTo(map.current!)
        .bindPopup(
          `<div class="text-sm">
            <p class="font-semibold">Lokasi Dipilih</p>
            <p>${lat.toFixed(6)}, ${lon.toFixed(6)}</p>
          </div>`
        )
        .openPopup();

      toast.success(`Lokasi dipilih: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    };

    map.current.on("click", onMapClick);

    return () => {
      if (map.current) {
        map.current.off("click", onMapClick);
      }
    };
  }, [showMap]);

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

  const stopGettingLocation = () => {
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setGettingLocation(false);
  };

  const getCurrentLocation = (useWatch = true) => {
    if (!navigator.geolocation) {
      toast.info("Geolocation tidak tersedia di browser Anda");
      return;
    }

    setGettingLocation(true);
    setLocationAccuracy(null);

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    };

    if (useWatch && navigator.geolocation.watchPosition) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const acc = position.coords.accuracy ?? null;

          setFormData((prev) => ({
            ...prev,
            latitude: lat.toString(),
            longitude: lon.toString(),
          }));
          setLocationAccuracy(acc);

          // stop if accurate enough
          if (acc !== null && acc <= 50) {
            toast.success("Lokasi GPS akurat diambil (akurasi ≤ 50m)");
            if (watchId.current !== null) {
              navigator.geolocation.clearWatch(watchId.current);
              watchId.current = null;
            }
            setGettingLocation(false);
          }
        },
        (error) => {
          console.error("Error getting location (watch):", error);
          toast.error(
            "Gagal mendapat lokasi cepat — coba lagi atau masukkan manual"
          );
          setGettingLocation(false);
        },
        options
      );

      watchId.current = id as unknown as number;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
        }));
        setLocationAccuracy(position.coords.accuracy ?? null);
        setGettingLocation(false);
        toast.success("Lokasi GPS berhasil diambil");
      },
      (error) => {
        console.error("Error getting location:", error);
        toast.info("Lokasi GPS tidak tersedia, masukkan lokasi manual");
        setGettingLocation(false);
      },
      options
    );
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
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location_text: e.target.value,
                      })
                    }
                    required
                    className="flex-1"
                  />
                  {gettingLocation ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        disabled
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mencari
                        {locationAccuracy
                          ? ` (${locationAccuracy.toFixed(0)} m)`
                          : "..."}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={stopGettingLocation}
                        className="gap-2"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => getCurrentLocation(true)}
                      className="gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      GPS
                    </Button>
                  )}
                </div>
                {formData.latitude && formData.longitude && (
                  <p className="text-xs text-muted-foreground">
                    Koordinat: {parseFloat(formData.latitude).toFixed(6)},{" "}
                    {parseFloat(formData.longitude).toFixed(6)}
                    {locationAccuracy ? (
                      <span className="ml-2 text-xs opacity-80">
                        (akurasi ~{locationAccuracy.toFixed(0)} m)
                      </span>
                    ) : null}
                  </p>
                )}
              </div>

              {/* Map Preview */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowMap(!showMap)}
                >
                  <MapPin className="h-4 w-4" />
                  {showMap ? "Tutup Peta" : "Buka Peta & Pilih Lokasi"}
                </Button>

                {showMap && (
                  <Card className="border-2 border-primary/20">
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground mb-2">
                        Klik di peta untuk memilih lokasi
                      </div>
                      <div
                        ref={mapContainer}
                        className="w-full h-96 rounded-lg border border-input"
                      />
                      {formData.latitude && formData.longitude && (
                        <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                          <p className="font-semibold mb-1">
                            Lokasi yang Dipilih:
                          </p>
                          <p>
                            Lat: {parseFloat(formData.latitude).toFixed(6)},
                            Lon: {parseFloat(formData.longitude).toFixed(6)}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
                    {uploadingImage
                      ? "Mengupload gambar..."
                      : "Mengirim laporan..."}
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
