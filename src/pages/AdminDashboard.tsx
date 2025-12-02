import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Users,
  Clock,
  CheckCircle2,
  Trash2,
  Edit3,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    fetchReports();
    fetchUsers();
    fetchCategories();
  }, []);
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCats, setLoadingCats] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editingCategoryName, setEditingCategoryName] = useState("");

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
        openReports: reports.filter((r) => r.status === "Open").length,
        resolvedReports: reports.filter((r) => r.status === "Resolved").length,
      });
    } catch (error: any) {
      toast.error("Gagal memuat statistik");
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      toast.error(error?.message || "Gagal memuat laporan");
    } finally {
      setLoadingReports(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Hapus laporan ini? Tindakan ini tidak bisa dibatalkan."))
      return;
    try {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw error;
      toast.success("Laporan dihapus");
      fetchReports();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.message || "Gagal menghapus laporan");
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat user");
    } finally {
      setLoadingUsers(false);
    }
  };

  const changeUserRole = async (id: string, role: "user" | "petugas") => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", id);
      if (error) throw error;
      toast.success("Role user diubah");
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengubah role user");
    }
  };

  const fetchCategories = async () => {
    setLoadingCats(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat kategori");
    } finally {
      setLoadingCats(false);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim())
      return toast.error("Nama kategori wajib diisi");
    try {
      const { error } = await supabase
        .from("categories")
        .insert({ name: newCategoryName.trim() });
      if (error) throw error;
      toast.success("Kategori dibuat");
      setNewCategoryName("");
      fetchCategories();
    } catch (error: any) {
      toast.error(error?.message || "Gagal menambahkan kategori");
    }
  };

  const startEditCategory = (cat: any) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const saveEditCategory = async () => {
    if (!editingCategoryId) return;
    try {
      const { error } = await supabase
        .from("categories")
        .update({ name: editingCategoryName })
        .eq("id", editingCategoryId);
      if (error) throw error;
      toast.success("Kategori diperbarui");
      setEditingCategoryId(null);
      setEditingCategoryName("");
      fetchCategories();
    } catch (error: any) {
      toast.error(error?.message || "Gagal memperbarui kategori");
    }
  };

  const deleteCategory = async (id: string) => {
    if (
      !confirm(
        "Hapus kategori ini? Semua laporan yang memakai kategori ini tidak akan terhapus tetapi kategori ini akan hilang."
      )
    )
      return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      toast.success("Kategori dihapus");
      fetchCategories();
    } catch (error: any) {
      toast.error(error?.message || "Gagal menghapus kategori");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Admin</h1>
          <p className="text-muted-foreground mt-1">
            Kelola sistem dan monitor laporan
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Laporan
              </CardTitle>
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
              <CardTitle className="text-sm font-medium">
                Perlu Ditangani
              </CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats.openReports}
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
                {stats.resolvedReports}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* All Reports */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Semua Laporan</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <p className="text-center text-muted-foreground py-8">
                  Memuat...
                </p>
              ) : reports.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Tidak ada laporan
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Judul</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Pelapor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.title}</TableCell>
                        <TableCell>{r.categories?.name || "-"}</TableCell>
                        <TableCell>{r.profiles?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              r.status === "Open"
                                ? "bg-info text-info-foreground"
                                : r.status === "On Progress"
                                ? "bg-warning text-warning-foreground"
                                : r.status === "Resolved"
                                ? "bg-success text-success-foreground"
                                : "bg-destructive text-destructive-foreground"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(r.created_at).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/dashboard/report/${r.id}`)
                            }
                          >
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteReport(r.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Hapus
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Users and Categories */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <p className="text-center text-muted-foreground py-8">
                    Memuat...
                  </p>
                ) : users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Tidak ada user
                  </p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded border"
                      >
                        <div>
                          <div className="font-medium">{u.name || u.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs mr-2">Role: {u.role}</div>
                          {/* don't allow changing admin role */}
                          {u.role !== "admin" ? (
                            <>
                              <Button
                                size="sm"
                                variant={
                                  u.role === "petugas" ? "secondary" : "ghost"
                                }
                                onClick={() => changeUserRole(u.id, "petugas")}
                              >
                                Petugas
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  u.role === "user" ? "secondary" : "ghost"
                                }
                                onClick={() => changeUserRole(u.id, "user")}
                              >
                                User
                              </Button>
                            </>
                          ) : (
                            <Badge>Admin</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manajemen Kategori</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Nama kategori baru"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button onClick={addCategory}>
                    <Plus className="h-4 w-4 mr-2" /> Tambah
                  </Button>
                </div>

                {loadingCats ? (
                  <p className="text-center text-muted-foreground py-8">
                    Memuat...
                  </p>
                ) : categories.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Tidak ada kategori
                  </p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded border"
                      >
                        <div className="flex items-center gap-2">
                          {editingCategoryId === c.id ? (
                            <Input
                              value={editingCategoryName}
                              onChange={(e) =>
                                setEditingCategoryName(e.target.value)
                              }
                              className="h-8 text-sm"
                            />
                          ) : (
                            <div className="font-medium">{c.name}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {editingCategoryId === c.id ? (
                            <>
                              <Button size="sm" onClick={saveEditCategory}>
                                Simpan
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingCategoryId(null)}
                              >
                                Batal
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditCategory(c)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteCategory(c.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
