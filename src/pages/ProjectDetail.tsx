import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, BarChart3, DollarSign, Zap, Plug, Sun, CloudSun, FileText, LayoutDashboard, ScrollText, Wallet, CheckCircle2, AlertCircle, Lock, Circle, CalendarIcon, Save, TrendingUp, Leaf, Battery, Building2 } from "lucide-react";
import { format } from "date-fns";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DashboardParams {
  name: string;
  location: string;
  totalArea: number;
  capacity: number;
  systemType: "Solar" | "Solar + Battery" | "Hybrid" | "";
  clientName: string;
  budget: number;
  targetDate: Date | undefined;
}

interface WorkflowStep {
  id: number;
  name: string;
  status: "complete" | "pending";
}

interface KPIData {
  annualYield: number;
  savings: number;
  roi: number;
  selfCoverage: number;
  co2Avoided: number;
  gridImpact: number;
}

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

// Dashboard Tab Content Component
const DashboardTabContent = ({ 
  projectId, 
  project, 
  tenants,
  onProjectUpdate
}: { 
  projectId: string;
  project: { 
    name: string; 
    location: string | null; 
    connection_size_kva: number | null;
    description: string | null;
    total_area_sqm: number | null;
  };
  tenants: { area_sqm: number; scada_import_id: string | null }[];
  onProjectUpdate: () => void;
}) => {
  const queryClient = useQueryClient();
  
  // Parse stored metadata from description JSON if available
  const storedMetadata = useMemo(() => {
    try {
      if (project.description) {
        const parsed = JSON.parse(project.description);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // Not JSON, treat as plain description
    }
    return null;
  }, [project.description]);
  
  const [params, setParams] = useState<DashboardParams>({
    name: project.name || "",
    location: project.location || "",
    totalArea: project.total_area_sqm || tenants.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0),
    capacity: project.connection_size_kva || 0,
    systemType: storedMetadata?.systemType || "Solar",
    clientName: storedMetadata?.clientName || "",
    budget: storedMetadata?.budget || 0,
    targetDate: storedMetadata?.targetDate ? new Date(storedMetadata.targetDate) : undefined,
  });
  
  const [isSaving, setIsSaving] = useState(false);

  const workflowSteps: WorkflowStep[] = [
    { id: 1, name: "Resource Analysis", status: tenants.length > 0 ? "complete" : "pending" },
    { id: 2, name: "System Design", status: "pending" },
    { id: 3, name: "Energy Configuration", status: "pending" },
    { id: 4, name: "Financial Analysis", status: "pending" },
    { id: 5, name: "Proposal Draft", status: "pending" },
    { id: 6, name: "Client Review", status: "pending" },
    { id: 7, name: "Approval Workflow", status: "pending" },
    { id: 8, name: "Contract Generation", status: "pending" },
    { id: 9, name: "Portal Setup", status: "pending" },
  ];

  const kpis: KPIData = {
    annualYield: 245.8,
    savings: 480000,
    roi: 18.5,
    selfCoverage: 78.5,
    co2Avoided: 198.4,
    gridImpact: -45,
  };

  const completedSteps = workflowSteps.filter(s => s.status === "complete").length;

  const handleParamChange = (key: keyof DashboardParams, value: string | number | Date | undefined) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Store additional metadata as JSON in description field
      const metadata = {
        systemType: params.systemType,
        clientName: params.clientName,
        budget: params.budget,
        targetDate: params.targetDate?.toISOString(),
      };
      
      const { error } = await supabase
        .from("projects")
        .update({
          name: params.name,
          location: params.location,
          connection_size_kva: params.capacity || null,
          total_area_sqm: params.totalArea || null,
          description: JSON.stringify(metadata),
        })
        .eq("id", projectId);
      
      if (error) throw error;
      
      // Invalidate and refetch project data
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onProjectUpdate();
      
      toast.success("Project parameters saved");
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error("Failed to save project parameters");
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex gap-6">
      {/* Left Panel - Parameters */}
      <div className="w-80 flex-shrink-0">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Project Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs">Project Name</Label>
              <Input
                id="name"
                value={params.name}
                onChange={(e) => handleParamChange("name", e.target.value)}
                placeholder="Enter project name"
                className="h-8"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-xs">Location</Label>
              <Input
                id="location"
                value={params.location}
                onChange={(e) => handleParamChange("location", e.target.value)}
                placeholder="Enter location"
                className="h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="totalArea" className="text-xs">Total Area (m²)</Label>
                <Input
                  id="totalArea"
                  type="number"
                  value={params.totalArea || ""}
                  onChange={(e) => handleParamChange("totalArea", Number(e.target.value))}
                  placeholder="0"
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity" className="text-xs">Capacity (kVA)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={params.capacity || ""}
                  onChange={(e) => handleParamChange("capacity", Number(e.target.value))}
                  placeholder="0"
                  className="h-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">System Type</Label>
              <Select
                value={params.systemType}
                onValueChange={(value) => handleParamChange("systemType", value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select system type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solar">Solar (Grid-tied)</SelectItem>
                  <SelectItem value="Solar + Battery">Solar + Battery</SelectItem>
                  <SelectItem value="Hybrid">Hybrid (Solar/Wind + Battery)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {params.systemType === "Solar" && "Grid-tied solar without battery storage"}
                {params.systemType === "Solar + Battery" && "Solar with battery backup/load shifting"}
                {params.systemType === "Hybrid" && "Combined renewable sources with storage"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-xs">Client Name</Label>
              <Input
                id="clientName"
                value={params.clientName}
                onChange={(e) => handleParamChange("clientName", e.target.value)}
                placeholder="Enter client name"
                className="h-8"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget" className="text-xs">Budget (R)</Label>
              <Input
                id="budget"
                type="number"
                value={params.budget || ""}
                onChange={(e) => handleParamChange("budget", Number(e.target.value))}
                placeholder="0"
                className="h-8"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Target Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-8",
                      !params.targetDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {params.targetDate ? format(params.targetDate, "PPP") : <span>Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={params.targetDate}
                    onSelect={(date) => handleParamChange("targetDate", date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleSave} className="w-full h-8 mt-2" size="sm" disabled={isSaving}>
              {isSaving ? (
                <span className="animate-spin mr-2 h-3 w-3 border border-current border-t-transparent rounded-full" />
              ) : (
                <Save className="mr-2 h-3 w-3" />
              )}
              {isSaving ? "Saving..." : "Save Parameters"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Workflow & KPIs */}
      <div className="flex-1 space-y-6">
        {/* Progress Tracker */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Workflow Progress</span>
              <Badge variant="secondary" className="text-xs">
                {completedSteps}/{workflowSteps.length} Steps
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {workflowSteps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                    step.status === "complete"
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <div className="flex-shrink-0">
                    {step.status === "complete" ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground">Step {step.id}</span>
                    <p className="text-xs font-medium truncate">{step.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Key Performance Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <Sun className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Annual Yield</span>
                </div>
                <p className="text-xl font-bold">{kpis.annualYield}</p>
                <span className="text-xs text-muted-foreground">MWh</span>
              </div>

              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Savings</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(kpis.savings)}</p>
                <span className="text-xs text-muted-foreground">/year</span>
              </div>

              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-muted-foreground">ROI</span>
                </div>
                <p className="text-xl font-bold">{kpis.roi}%</p>
                <span className="text-xs text-muted-foreground">return</span>
              </div>

              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <Battery className="h-3 w-3 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Self-Coverage</span>
                </div>
                <p className="text-xl font-bold">{kpis.selfCoverage}%</p>
                <span className="text-xs text-muted-foreground">of load</span>
              </div>

              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <Leaf className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">CO₂ Avoided</span>
                </div>
                <p className="text-xl font-bold">{kpis.co2Avoided}</p>
                <span className="text-xs text-muted-foreground">tons/year</span>
              </div>

              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-3 w-3 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Grid Impact</span>
                </div>
                <p className="text-xl font-bold">{kpis.gridImpact}%</p>
                <span className="text-xs text-muted-foreground">reduction</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

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

  // Parse system type from project description metadata
  const projectSystemType = useMemo(() => {
    try {
      if (project?.description) {
        const parsed = JSON.parse(project.description);
        if (parsed && typeof parsed === 'object' && parsed.systemType) {
          return parsed.systemType as string;
        }
      }
    } catch {
      // Not JSON, ignore
    }
    return "Solar"; // Default to grid-tied solar
  }, [project?.description]);

  // Check if system includes battery
  const systemIncludesBattery = projectSystemType === "Solar + Battery" || projectSystemType === "Hybrid";

  const { data: tenants } = useQuery({
    queryKey: ["project-tenants", id],
    queryFn: async () => {
      // Fetch tenants with their direct scada_imports relation
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("project_tenants")
        .select(`*, shop_types(*), scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend, raw_data, date_range_start, date_range_end)`)
        .eq("project_id", id)
        .order("name");
      if (tenantsError) throw tenantsError;
      if (!tenantsData) return [];

      // Fetch all tenant_meters for these tenants (multi-meter assignments)
      const tenantIds = tenantsData.map(t => t.id);
      const { data: tenantMetersData, error: metersError } = await supabase
        .from("project_tenant_meters")
        .select(`
          id, 
          tenant_id, 
          scada_import_id, 
          weight, 
          scada_imports:scada_import_id(id, shop_name, site_name, area_sqm, load_profile_weekday, load_profile_weekend)
        `)
        .in("tenant_id", tenantIds);
      if (metersError) throw metersError;

      // Group tenant_meters by tenant_id
      const metersByTenant: Record<string, typeof tenantMetersData> = {};
      for (const meter of tenantMetersData || []) {
        if (!metersByTenant[meter.tenant_id]) {
          metersByTenant[meter.tenant_id] = [];
        }
        metersByTenant[meter.tenant_id].push(meter);
      }

      // Merge tenant_meters into tenants
      return tenantsData.map(tenant => ({
        ...tenant,
        tenant_meters: metersByTenant[tenant.id] || []
      }));
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
          <DashboardTabContent 
            projectId={id!} 
            project={project} 
            tenants={tenants || []} 
            onProjectUpdate={() => queryClient.invalidateQueries({ queryKey: ["project", id] })}
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
            includesBattery={systemIncludesBattery}
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