import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { 
  LogOut, 
  User as UserIcon, 
  Shield, 
  AlertCircle,
  Home
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getDashboardPath = () => {
    if (profile?.role === "admin") return "/admin";
    if (profile?.role === "petugas") return "/petugas";
    return "/dashboard";
  };

  const getRoleIcon = () => {
    if (profile?.role === "admin") return <Shield className="h-4 w-4" />;
    if (profile?.role === "petugas") return <AlertCircle className="h-4 w-4" />;
    return <UserIcon className="h-4 w-4" />;
  };

  const getRoleLabel = () => {
    if (profile?.role === "admin") return "Admin";
    if (profile?.role === "petugas") return "Petugas";
    return "Pelapor";
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate(getDashboardPath())}
              className="flex items-center gap-2 font-bold text-xl text-primary hover:opacity-80 transition-smooth"
            >
              <AlertCircle className="h-6 w-6" />
              <span>Dishub Report</span>
            </button>
            
            {profile && (
              <nav className="hidden md:flex items-center gap-4">
                <Button
                  variant={isActive(getDashboardPath()) ? "default" : "ghost"}
                  size="sm"
                  onClick={() => navigate(getDashboardPath())}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </nav>
            )}
          </div>

          {profile && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                {getRoleIcon()}
                <span className="text-sm font-medium">{profile.name}</span>
                <span className="text-xs text-muted-foreground">({getRoleLabel()})</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6 px-4">
        {children}
      </main>
    </div>
  );
};
