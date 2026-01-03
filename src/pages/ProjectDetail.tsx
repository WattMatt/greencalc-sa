import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, BarChart3, DollarSign, Zap, Plug, Sun, CloudSun, FileText, LayoutDashboard, ScrollText, Wallet } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tenants">
            <Users className="h-4 w-4 mr-2" />
            Tenants & Profiles
          </TabsTrigger>
          <TabsTrigger value="load-profile">
            <BarChart3 className="h-4 w-4 mr-2" />
            Load Profile
          </TabsTrigger>
          <TabsTrigger value="costs">
            <Wallet className="h-4 w-4 mr-2" />
            Costs
          </TabsTrigger>
          <TabsTrigger value="tariff">
            <DollarSign className="h-4 w-4 mr-2" />
            Tariff
          </TabsTrigger>
          <TabsTrigger value="simulation">
            <Zap className="h-4 w-4 mr-2" />
            Simulation
          </TabsTrigger>
          <TabsTrigger value="pv-layout">
            <Sun className="h-4 w-4 mr-2" />
            PV Layout
          </TabsTrigger>
          <TabsTrigger value="solar-forecast">
            <CloudSun className="h-4 w-4 mr-2" />
            Solar Forecast
          </TabsTrigger>
          <TabsTrigger value="proposals">
            <ScrollText className="h-4 w-4 mr-2" />
            Proposals
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

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
          <ReportBuilder projectId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}