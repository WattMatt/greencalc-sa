import { Suspense, lazy } from "react";
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

// Lazy load all pages for code-splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TariffManagement = lazy(() => import("./pages/TariffManagement"));
const LoadProfiles = lazy(() => import("./pages/LoadProfiles"));
const Calculator = lazy(() => import("./pages/Calculator"));
const Settings = lazy(() => import("./pages/Settings"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ProjectDashboard = lazy(() => import("./pages/ProjectDashboard"));

const QuickEstimate = lazy(() => import("./pages/QuickEstimate"));
const SandboxWorkspace = lazy(() => import("./pages/SandboxWorkspace"));
const ProposalWorkspace = lazy(() => import("./pages/ProposalWorkspace"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const Install = lazy(() => import("./pages/Install"));
const CodeReview = lazy(() => import("./pages/CodeReview"));


const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/portal/:token" element={<ClientPortal />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/tariffs" element={<TariffManagement />} />
                    <Route path="/load-profiles" element={<LoadProfiles />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:id" element={<ProjectDetail />} />
                    <Route path="/projects/:id/dashboard" element={<ProjectDashboard />} />
                    <Route path="/projects/:id/quick-estimate" element={<QuickEstimate />} />
                    <Route path="/projects/:projectId/sandbox/:id" element={<SandboxWorkspace />} />
                    <Route path="/projects/:projectId/proposal" element={<ProposalWorkspace />} />
                    <Route path="/calculator" element={<Calculator />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<ProfileSettings />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/code-review" element={<CodeReview />} />
                    
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
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
