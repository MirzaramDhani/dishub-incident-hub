import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewReport from "./pages/NewReport";
import ReportDetail from "./pages/ReportDetail";
import PetugasDashboard from "./pages/PetugasDashboard";
import PetugasReportDetail from "./pages/PetugasReportDetail";
import AdminDashboard from "./pages/AdminDashboard";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* User Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["user"]}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/new-report"
              element={
                <ProtectedRoute allowedRoles={["user"]}>
                  <NewReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/report/:id"
              element={
                <ProtectedRoute allowedRoles={["user"]}>
                  <ReportDetail />
                </ProtectedRoute>
              }
            />
            
            {/* Petugas Routes */}
            <Route
              path="/petugas"
              element={
                <ProtectedRoute allowedRoles={["petugas"]}>
                  <PetugasDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/petugas/report/:id"
              element={
                <ProtectedRoute allowedRoles={["petugas"]}>
                  <PetugasReportDetail />
                </ProtectedRoute>
              }
            />
            
            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route path="/unauthorized" element={<Unauthorized />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
