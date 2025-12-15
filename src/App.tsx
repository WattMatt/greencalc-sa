import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TourProvider, TourOverlay } from "@/components/onboarding";
import { AppLayout } from "@/components/layout/AppLayout";
import { OfflineIndicator, InstallPrompt } from "@/components/pwa";
import Dashboard from "./pages/Dashboard";
import TariffManagement from "./pages/TariffManagement";
import LoadProfiles from "./pages/LoadProfiles";
import Calculator from "./pages/Calculator";
import Settings from "./pages/Settings";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import SimulationHub from "./pages/SimulationHub";
import QuickEstimate from "./pages/QuickEstimate";
import SandboxWorkspace from "./pages/SandboxWorkspace";
import ProposalWorkspace from "./pages/ProposalWorkspace";
import SimulationRoadmap from "./pages/SimulationRoadmap";
import ClientPortal from "./pages/ClientPortal";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ProfileSettings from "./pages/ProfileSettings";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/portal/:token" element={<ClientPortal />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tariffs" element={<TariffManagement />} />
                <Route path="/load-profiles" element={<LoadProfiles />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/projects/:id/quick-estimate" element={<QuickEstimate />} />
                <Route path="/simulations" element={<SimulationHub />} />
                <Route path="/simulations/sandbox/:id" element={<SandboxWorkspace />} />
                <Route path="/projects/:projectId/proposal" element={<ProposalWorkspace />} />
                <Route path="/simulations/roadmap" element={<SimulationRoadmap />} />
                <Route path="/calculator" element={<Calculator />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<ProfileSettings />} />
                <Route path="/install" element={<Install />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TourProvider>
          <Toaster />
          <Sonner />
          <TourOverlay />
          <OfflineIndicator />
          <InstallPrompt />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TourProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
