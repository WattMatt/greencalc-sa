import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            <Route path="/portal/:token" element={<ClientPortal />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
