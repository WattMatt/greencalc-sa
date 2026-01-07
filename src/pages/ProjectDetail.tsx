import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, BarChart3, DollarSign, Zap, Plug, Sun, CloudSun, FileText, LayoutDashboard, ScrollText, Wallet, CheckCircle2, AlertCircle, Lock, Circle } from "lucide-react";
import { TenantManager } from "@/components/projects/TenantManager";
import { LoadProfileChart } from "@/components/projects/LoadProfileChart";
import { TariffSelector } from "@/components/projects/TariffSelector";
import { SimulationModes } from "@/components/projects/SimulationModes";
import { FloorPlanMarkup } from "@/components/floor-plan/FloorPlanMarkup";
import { SolarForecastCard } from "@/components/projects/SolarForecastCard";
import { ReportBuilder } from "@/components/reports/builder";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { ProposalManager } from "@/components/projects/ProposalManager";
import { SystemCostsManager, SystemCostsData } from "@/components/projects/SystemCostsManager";
import { DEFAULT_SYSTEM_COSTS } from "@/components/projects/simulation/FinancialAnalysis";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TabStatus = "complete" | "partial" | "pending" | "blocked";

const TabStatusBadge = ({ status }: { status: TabStatus }) => {
  const styles = {
    complete: "bg-green-500",
    partial: "bg-amber-500",
    pending: "bg-muted-foreground/40",
    blocked: "bg-destructive/60"
  };
  
  return (
    <span className={cn(
      "absolute -top-1 -right-1 h-2 w-2 rounded-full",
      styles[status]
    )} />
  );
};

const TabWithStatus = ({ 
  value, 
  children, 
  status, 
  tooltip 
}: { 
  value: string; 
  children: React.ReactNode; 
  status: TabStatus;
  tooltip: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <TabsTrigger value={value} className="relative">
        {children}
        <TabStatusBadge status={status} />
      </TabsTrigger>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="max-w-xs">
      <div className="flex items-center gap-2">
        {status === "complete" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {status === "partial" && <AlertCircle className="h-3 w-3 text-amber-500" />}
        {status === "blocked" && <Lock className="h-3 w-3 text-destructive" />}
        {status === "pending" && <Circle className="h-3 w-3 text-muted-foreground" />}
        <span>{tooltip}</span>
      </div>
    </TooltipContent>
  </Tooltip>
);

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  
  // System costs state (for payback calculations)
  const [systemCosts, setSystemCosts] = useState<SystemCostsData>({
    solarCostPerKwp: DEFAULT_SYSTEM_COSTS.solarCostPerKwp,
    batteryCostPerKwh: DEFAULT_SYSTEM_COSTS.batteryCostPerKwh,
    installationCost: DEFAULT_SYSTEM_COSTS.installationCost ?? 0,
    maintenancePerYear: DEFAULT_SYSTEM_COSTS.maintenancePerYear ?? 0,
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          tariffs(*, municipality_id, municipalities(name, province_id, provinces(name)))
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tenants } = useQuery({
    queryKey: ["project-tenants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tenants")
        .select(`*, shop_types(*), scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend)`)
        .eq("project_id", id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shopTypes } = useQuery({
    queryKey: ["shop-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest proposal for branding
  const { data: latestProposal } = useQuery({
    queryKey: ["latest-proposal-branding", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("branding")
        .eq("project_id", id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch simulation count for status tracking
  const { data: simulationCount = 0 } = useQuery({
    queryKey: ["project-simulations-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("project_simulations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  // Fetch PV layout for status tracking
  const { data: pvLayout } = useQuery({
    queryKey: ["project-pv-layout", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pv_layouts")
        .select("id, pv_arrays")
        .eq("project_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch proposal count for status tracking
  const { data: proposalCount = 0 } = useQuery({
    queryKey: ["project-proposals-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  const updateProject = useMutation({
    mutationFn: async (updates: { tariff_id?: string; total_area_sqm?: number; connection_size_kva?: number }) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Project updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const [connectionSizeInput, setConnectionSizeInput] = useState<string>("");

  // Sync connection size input when project loads
  const connectionSize = project?.connection_size_kva;
  const maxSolarKva = connectionSize ? connectionSize * 0.7 : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="link" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  // Calculate total area from tenants
  const totalArea = tenants?.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0) || 0;

  // Count tenants with assigned SCADA profiles
  const assignedCount = tenants?.filter(t => t.scada_import_id).length || 0;
  const tenantCount = tenants?.length || 0;

  // Calculate tab statuses
  const hasTariff = !!project.tariff_id;
  const hasSimulations = simulationCount > 0;
  const hasPVLayout = !!pvLayout?.pv_arrays && Array.isArray(pvLayout.pv_arrays) && pvLayout.pv_arrays.length > 0;
  const hasProposals = proposalCount > 0;
  const hasLocation = !!project.location;

  const tabStatuses: Record<string, { status: TabStatus; tooltip: string }> = {
    overview: { 
      status: "complete", 
      tooltip: "Project summary dashboard" 
    },
    tenants: {
      status: tenantCount === 0 ? "pending" 
        : assignedCount === tenantCount ? "complete" 
        : "partial",
      tooltip: tenantCount === 0 
        ? "Add tenants to get started"
        : assignedCount < tenantCount 
          ? `${assignedCount}/${tenantCount} tenants have load profiles`
          : `${tenantCount} tenants configured`
    },
    "load-profile": {
      status: assignedCount === 0 ? "blocked" 
        : assignedCount === tenantCount ? "complete" 
        : "partial",
      tooltip: assignedCount === 0 
        ? "Assign load profiles to tenants first"
        : `Showing data from ${assignedCount} tenant profiles`
    },
    costs: {
      status: "complete",
      tooltip: "System costs configured"
    },
    tariff: {
      status: hasTariff ? "complete" : "pending",
      tooltip: hasTariff 
        ? "Tariff selected"
        : "Select a tariff for simulation"
    },
    simulation: {
      status: (!hasTariff || assignedCount === 0) ? "blocked"
        : hasSimulations ? "complete" 
        : "pending",
      tooltip: !hasTariff 
        ? "Needs: Select a tariff first"
        : assignedCount === 0 
          ? "Needs: Assign tenant load profiles"
          : hasSimulations 
            ? `${simulationCount} simulation${simulationCount > 1 ? 's' : ''} saved`
            : "Ready to run simulations"
    },
    "pv-layout": {
      status: hasPVLayout ? "complete" : "pending",
      tooltip: hasPVLayout 
        ? "PV layout configured"
        : "Design your PV array layout"
    },
    "solar-forecast": {
      status: hasLocation ? "complete" : "pending",
      tooltip: hasLocation 
        ? "Location set for forecasting"
        : "Set project location for forecasts"
    },
    proposals: {
      status: !hasSimulations ? "blocked"
        : hasProposals ? "complete" 
        : "pending",
      tooltip: !hasSimulations 
        ? "Needs: Run a simulation first"
        : hasProposals 
          ? `${proposalCount} proposal${proposalCount > 1 ? 's' : ''} created`
          : "Ready to create proposals"
    },
    reports: {
      status: "complete",
      tooltip: "Generate project reports"
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        {/* Project Logo */}
        {project.logo_url && (
          <div className="h-14 w-14 rounded-lg border bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
            <img 
              src={project.logo_url} 
              alt={`${project.name} logo`}
              className="h-12 w-12 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground">
            {project.location || "No location set"} • {tenants?.length || 0} tenants ({assignedCount} with profiles) • {totalArea.toLocaleString()} m²
            {connectionSize && ` • ${connectionSize} kVA connection`}
          </p>
        </div>

        {/* Connection Size Card */}
        <Card className="ml-auto">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Connection Size</Label>
                <Input
                  type="number"
                  placeholder="kVA"
                  className="w-24 h-8"
                  value={connectionSizeInput || connectionSize || ""}
                  onChange={(e) => setConnectionSizeInput(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(connectionSizeInput);
                    if (!isNaN(value) && value > 0) {
                      updateProject.mutate({ connection_size_kva: value });
                    }
                    setConnectionSizeInput("");
                  }}
                />
                <span className="text-xs text-muted-foreground">kVA</span>
              </div>
              {maxSolarKva && (
                <div className="text-xs text-muted-foreground border-l pl-3 ml-2">
                  Max PV: <span className="font-medium text-foreground">{maxSolarKva.toFixed(0)} kVA</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TooltipProvider delayDuration={300}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabWithStatus value="overview" status={tabStatuses.overview.status} tooltip={tabStatuses.overview.tooltip}>
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Overview
            </TabWithStatus>
            <TabWithStatus value="tenants" status={tabStatuses.tenants.status} tooltip={tabStatuses.tenants.tooltip}>
              <Users className="h-4 w-4 mr-2" />
              Tenants & Profiles
            </TabWithStatus>
            <TabWithStatus value="load-profile" status={tabStatuses["load-profile"].status} tooltip={tabStatuses["load-profile"].tooltip}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Load Profile
            </TabWithStatus>
            <TabWithStatus value="costs" status={tabStatuses.costs.status} tooltip={tabStatuses.costs.tooltip}>
              <Wallet className="h-4 w-4 mr-2" />
              Costs
            </TabWithStatus>
            <TabWithStatus value="tariff" status={tabStatuses.tariff.status} tooltip={tabStatuses.tariff.tooltip}>
              <DollarSign className="h-4 w-4 mr-2" />
              Tariff
            </TabWithStatus>
            <TabWithStatus value="simulation" status={tabStatuses.simulation.status} tooltip={tabStatuses.simulation.tooltip}>
              <Zap className="h-4 w-4 mr-2" />
              Simulation
            </TabWithStatus>
            <TabWithStatus value="pv-layout" status={tabStatuses["pv-layout"].status} tooltip={tabStatuses["pv-layout"].tooltip}>
              <Sun className="h-4 w-4 mr-2" />
              PV Layout
            </TabWithStatus>
            <TabWithStatus value="solar-forecast" status={tabStatuses["solar-forecast"].status} tooltip={tabStatuses["solar-forecast"].tooltip}>
              <CloudSun className="h-4 w-4 mr-2" />
              Solar Forecast
            </TabWithStatus>
            <TabWithStatus value="proposals" status={tabStatuses.proposals.status} tooltip={tabStatuses.proposals.tooltip}>
              <ScrollText className="h-4 w-4 mr-2" />
              Proposals
            </TabWithStatus>
            <TabWithStatus value="reports" status={tabStatuses.reports.status} tooltip={tabStatuses.reports.tooltip}>
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabWithStatus>
          </TabsList>
        </TooltipProvider>

        <TabsContent value="overview" className="mt-6">
          <ProjectOverview
            project={project}
            tenants={tenants || []}
            onNavigateTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="tenants" className="mt-6">
          <TenantManager
            projectId={id!}
            tenants={tenants || []}
            shopTypes={shopTypes || []}
          />
        </TabsContent>

        <TabsContent value="load-profile" className="mt-6">
          <LoadProfileChart
            tenants={tenants || []}
            shopTypes={shopTypes || []}
            connectionSizeKva={project.connection_size_kva}
            latitude={-33.9249} // Cape Town default - TODO: Add project coordinates
            longitude={18.4241}
          />
        </TabsContent>

        <TabsContent value="costs" className="mt-6">
          <SystemCostsManager
            costs={systemCosts}
            onChange={setSystemCosts}
            solarCapacity={100}
            batteryCapacity={50}
          />
        </TabsContent>

        <TabsContent value="tariff" className="mt-6">
          <TariffSelector
            projectId={id!}
            currentTariffId={project.tariff_id}
            onSelect={(tariffId) => updateProject.mutate({ tariff_id: tariffId })}
          />
        </TabsContent>

        <TabsContent value="simulation" className="mt-6">
          <SimulationModes
            projectId={id!}
            project={project}
            tenants={tenants || []}
            shopTypes={shopTypes || []}
            systemCosts={systemCosts}
            onSystemCostsChange={setSystemCosts}
          />
        </TabsContent>

        <TabsContent value="pv-layout" className="mt-6">
          <FloorPlanMarkup projectId={id!} />
        </TabsContent>

        <TabsContent value="solar-forecast" className="mt-6">
          <SolarForecastCard projectLocation={project.location || undefined} />
        </TabsContent>

        <TabsContent value="proposals" className="mt-6">
          <ProposalManager projectId={id!} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ReportBuilder 
            projectId={id!} 
            projectName={project.name}
            branding={latestProposal?.branding as any}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}