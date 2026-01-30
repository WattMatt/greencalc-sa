import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
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
import { ArrowLeft, Users, BarChart3, DollarSign, Zap, Plug, Sun, CloudSun, FileText, LayoutDashboard, ScrollText, Wallet, CheckCircle2, AlertCircle, Lock, Circle, CalendarIcon, Save, TrendingUp, Leaf, Battery, Building2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { TenantManager } from "@/components/projects/TenantManager";
import { LoadProfileChart } from "@/components/projects/LoadProfileChart";
import { TariffSelector } from "@/components/projects/TariffSelector";
import { SimulationModes, SimulationModesRef } from "@/components/projects/SimulationModes";
import { FloorPlanMarkup } from "@/components/floor-plan/FloorPlanMarkup";
import { SolarForecastCard } from "@/components/projects/SolarForecastCard";
import { ReportBuilder } from "@/components/reports/builder";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { ProjectLocationMap } from "@/components/projects/ProjectLocationMap";
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
  <TabsTrigger value={value} className="relative group">
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center">
          {children}
        </span>
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
    <TabStatusBadge status={status} />
  </TabsTrigger>
);

// Expose save function for tab change
interface DashboardTabContentRef {
  saveIfNeeded: () => Promise<void>;
}

// Type for simulation data passed from parent
type SimulationData = {
  id: string;
  name: string;
  solar_capacity_kwp: number | null;
  battery_capacity_kwh: number | null;
  battery_power_kw: number | null;
  annual_solar_savings: number | null;
  roi_percentage: number | null;
  results_json: any;
} | null;

interface DashboardTabContentProps {
  projectId: string;
  project: { 
    name: string; 
    location: string | null; 
    connection_size_kva: number | null;
    description: string | null;
    total_area_sqm: number | null;
    client_name: string | null;
    budget: number | null;
    target_date: string | null;
    system_type: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  tenants: { area_sqm: number; scada_import_id: string | null }[];
  latestSimulation: SimulationData; // Single source of truth - passed from parent
  onProjectUpdate: () => void;
}

// Dashboard Tab Content Component
const DashboardTabContent = forwardRef<DashboardTabContentRef, DashboardTabContentProps>(({ 
  projectId, 
  project, 
  tenants,
  latestSimulation, // Now passed from parent - single source of truth
  onProjectUpdate
}, ref) => {
  const queryClient = useQueryClient();

  const [params, setParams] = useState<DashboardParams>({
    name: project.name || "",
    location: project.location || "",
    totalArea: project.total_area_sqm || tenants.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0),
    capacity: project.connection_size_kva || 0,
    systemType: (project.system_type as DashboardParams['systemType']) || "Solar",
    clientName: project.client_name || "",
    budget: project.budget || 0,
    targetDate: project.target_date ? new Date(project.target_date) : undefined,
  });
  
  // Sync params with database values when project data changes (e.g., from header input)
  useEffect(() => {
    setParams(prev => ({
      ...prev,
      name: project.name || prev.name,
      location: project.location || prev.location,
      totalArea: project.total_area_sqm || prev.totalArea,
      capacity: project.connection_size_kva || prev.capacity,
      systemType: (project.system_type as DashboardParams['systemType']) || prev.systemType,
      clientName: project.client_name || prev.clientName,
      budget: project.budget || prev.budget,
      targetDate: project.target_date ? new Date(project.target_date) : prev.targetDate,
    }));
  }, [project.name, project.location, project.total_area_sqm, project.connection_size_kva, project.system_type, project.client_name, project.budget, project.target_date]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const isInitialMount = useRef(true);
  const lastSavedParams = useRef(JSON.stringify(params));

  // Save function - called on blur or tab change
  const saveParams = useCallback(async () => {
    // Check if anything actually changed
    const currentParamsStr = JSON.stringify(params);
    if (currentParamsStr === lastSavedParams.current) {
      return; // No changes to save
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: params.name,
          location: params.location,
          connection_size_kva: params.capacity || null,
          total_area_sqm: params.totalArea || null,
          system_type: params.systemType || "Solar",
          client_name: params.clientName || null,
          budget: params.budget || null,
          target_date: params.targetDate?.toISOString().split('T')[0] || null,
        })
        .eq("id", projectId);
      
      if (error) throw error;
      
      lastSavedParams.current = currentParamsStr;
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onProjectUpdate();
      setHasUnsavedChanges(false);
      
      toast.success("Changes saved", { duration: 1500 });
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [params, projectId, queryClient, onProjectUpdate]);

  // Expose saveIfNeeded to parent via ref for tab change saving
  useImperativeHandle(ref, () => ({
    saveIfNeeded: async () => {
      if (hasUnsavedChanges) {
        await saveParams();
      }
    }
  }), [hasUnsavedChanges, saveParams]);

  // Track unsaved changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedParams.current = JSON.stringify(params);
      return;
    }
    
    const currentParamsStr = JSON.stringify(params);
    setHasUnsavedChanges(currentParamsStr !== lastSavedParams.current);
  }, [params]);

  // Extract simulation results for KPIs
  const simulationResults = latestSimulation?.results_json as any;
  const hasSimulation = !!latestSimulation;

  const workflowSteps: WorkflowStep[] = [
    { id: 1, name: "Resource Analysis", status: tenants.length > 0 ? "complete" : "pending" },
    { id: 2, name: "System Design", status: latestSimulation?.solar_capacity_kwp ? "complete" : "pending" },
    { id: 3, name: "Energy Configuration", status: simulationResults?.totalDailyLoad ? "complete" : "pending" },
    { id: 4, name: "Financial Analysis", status: latestSimulation?.annual_solar_savings ? "complete" : "pending" },
    { id: 5, name: "Proposal Draft", status: "pending" },
    { id: 6, name: "Client Review", status: "pending" },
    { id: 7, name: "Approval Workflow", status: "pending" },
    { id: 8, name: "Contract Generation", status: "pending" },
    { id: 9, name: "Portal Setup", status: "pending" },
  ];

  // Calculate KPIs from real simulation data
  const annualSolarYield = hasSimulation && simulationResults?.totalDailySolar 
    ? (simulationResults.totalDailySolar * 365) / 1000 // Convert to MWh
    : 0;
  
  const selfCoverageRate = hasSimulation && simulationResults?.totalDailyLoad && simulationResults?.totalSolarUsed
    ? (simulationResults.totalSolarUsed / simulationResults.totalDailyLoad) * 100
    : 0;

  // CO2 avoided: ~0.9 kg CO2 per kWh for South African grid
  const co2Avoided = annualSolarYield * 0.9; // tonnes CO2

  const kpis: KPIData = {
    annualYield: annualSolarYield,
    savings: latestSimulation?.annual_solar_savings || 0,
    roi: latestSimulation?.roi_percentage || simulationResults?.roi || 0,
    selfCoverage: selfCoverageRate,
    co2Avoided: co2Avoided,
    gridImpact: hasSimulation && simulationResults?.totalDailyLoad && simulationResults?.totalGridImport
      ? -((1 - simulationResults.totalGridImport / simulationResults.totalDailyLoad) * 100)
      : 0,
  };

  const completedSteps = workflowSteps.filter(s => s.status === "complete").length;

  const handleParamChange = (key: keyof DashboardParams, value: string | number | Date | undefined) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveParams();
  };
  
  // Handle field blur - save when leaving any input
  const handleFieldBlur = () => {
    if (hasUnsavedChanges) {
      saveParams();
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
    <div className="flex flex-col lg:flex-row gap-6 min-w-0">
      {/* Left Panel - Parameters */}
      <div className="w-full lg:w-80 lg:flex-shrink-0">
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
                onBlur={handleFieldBlur}
                placeholder="Enter project name"
                className="h-8"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="location" className="text-xs">Location</Label>
                {project.latitude && project.longitude && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30">
                    <MapPin className="h-2.5 w-2.5 mr-0.5" />
                    {project.latitude.toFixed(4)}, {project.longitude.toFixed(4)}
                  </Badge>
                )}
                <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-primary ml-auto"
                      title="Open map to set location"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Project Location</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 h-full min-h-[500px]">
                      <ProjectLocationMap
                        projectId={projectId}
                        latitude={project.latitude}
                        longitude={project.longitude}
                        location={params.location}
                        onLocationUpdate={() => {
                          queryClient.invalidateQueries({ queryKey: ["project", projectId] });
                        }}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="location"
                value={params.location}
                onChange={(e) => handleParamChange("location", e.target.value)}
                onBlur={handleFieldBlur}
                placeholder={
                  (project as any).tariffs?.municipalities?.name && (project as any).tariffs?.municipalities?.provinces?.name
                    ? `${(project as any).tariffs.municipalities.provinces.name}, ${(project as any).tariffs.municipalities.name}`
                    : "Enter location"
                }
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
                  onBlur={handleFieldBlur}
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
                  onBlur={handleFieldBlur}
                  placeholder="0"
                  className="h-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">System Type</Label>
              <Select
                value={params.systemType}
                onValueChange={(value) => {
                  handleParamChange("systemType", value);
                  // Save immediately for select changes
                  setTimeout(() => saveParams(), 0);
                }}
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
                onBlur={handleFieldBlur}
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
                onBlur={handleFieldBlur}
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
                    onSelect={(date) => {
                      handleParamChange("targetDate", date);
                      // Save immediately for calendar selection
                      setTimeout(() => saveParams(), 0);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button onClick={handleSave} className="flex-1 h-8" size="sm" disabled={isSaving || !hasUnsavedChanges}>
                {isSaving ? (
                  <span className="animate-spin mr-2 h-3 w-3 border border-current border-t-transparent rounded-full" />
                ) : (
                  <Save className="mr-2 h-3 w-3" />
                )}
                {isSaving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}
              </Button>
              {!hasUnsavedChanges && !isSaving && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
            </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Key Performance Indicators</CardTitle>
              {latestSimulation && (
                <Badge variant="secondary" className="text-xs">
                  From: {latestSimulation.name}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasSimulation ? (
              <div className="text-center py-6">
                <Zap className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No simulation saved yet</p>
                <p className="text-xs text-muted-foreground mt-1">Run a simulation in the Simulation tab to see KPIs here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <Sun className="h-3 w-3 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Annual Yield</span>
                  </div>
                  <p className="text-xl font-bold">{kpis.annualYield.toFixed(1)}</p>
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
                  <p className="text-xl font-bold">{kpis.roi.toFixed(1)}%</p>
                  <span className="text-xs text-muted-foreground">return</span>
                </div>

                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <Battery className="h-3 w-3 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Self-Coverage</span>
                  </div>
                  <p className="text-xl font-bold">{kpis.selfCoverage.toFixed(1)}%</p>
                  <span className="text-xs text-muted-foreground">of load</span>
                </div>

                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <Leaf className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-muted-foreground">CO₂ Avoided</span>
                  </div>
                  <p className="text-xl font-bold">{kpis.co2Avoided.toFixed(1)}</p>
                  <span className="text-xs text-muted-foreground">tons/year</span>
                </div>

                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-3 w-3 text-orange-500" />
                    <span className="text-xs text-muted-foreground">Grid Impact</span>
                  </div>
                  <p className="text-xl font-bold">{kpis.gridImpact.toFixed(1)}%</p>
                  <span className="text-xs text-muted-foreground">reduction</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

DashboardTabContent.displayName = "DashboardTabContent";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [blendedRateType, setBlendedRateType] = useState<
    'allHours' | 'allHoursHigh' | 'allHoursLow' | 'solarHours' | 'solarHoursHigh' | 'solarHoursLow'
  >('solarHours');
  const dashboardRef = useRef<DashboardTabContentRef>(null);
  const simulationRef = useRef<SimulationModesRef>(null);
  
  // Handle tab change - save before switching
  const handleTabChange = async (newTab: string) => {
    // Save any unsaved changes in dashboard tab before switching
    if (activeTab === "overview" && dashboardRef.current) {
      await dashboardRef.current.saveIfNeeded();
    }
    // Auto-save simulation when leaving simulation or costs tabs
    // Also save when going TO pv-layout to ensure latest data is available
    const shouldSaveSimulation = 
      activeTab === "simulation" || 
      activeTab === "costs" ||
      newTab === "pv-layout";
    
    if (shouldSaveSimulation && simulationRef.current) {
      await simulationRef.current.saveIfNeeded();
    }
    setActiveTab(newTab);
  };
  
  // System costs state (for payback calculations)
  const [systemCosts, setSystemCosts] = useState<SystemCostsData>({
    solarCostPerKwp: DEFAULT_SYSTEM_COSTS.solarCostPerKwp,
    batteryCostPerKwh: DEFAULT_SYSTEM_COSTS.batteryCostPerKwh,
    solarMaintenancePercentage: DEFAULT_SYSTEM_COSTS.solarMaintenancePercentage ?? 3.5,
    batteryMaintenancePercentage: DEFAULT_SYSTEM_COSTS.batteryMaintenancePercentage ?? 1.5,
    maintenancePerYear: 0,
    // Additional Fixed Costs
    healthAndSafetyCost: DEFAULT_SYSTEM_COSTS.healthAndSafetyCost ?? 0,
    waterPointsCost: DEFAULT_SYSTEM_COSTS.waterPointsCost ?? 0,
    cctvCost: DEFAULT_SYSTEM_COSTS.cctvCost ?? 0,
    mvSwitchGearCost: DEFAULT_SYSTEM_COSTS.mvSwitchGearCost ?? 0,
    // Insurance
    insuranceCostPerYear: DEFAULT_SYSTEM_COSTS.insuranceCostPerYear ?? 0,
    insuranceRatePercent: DEFAULT_SYSTEM_COSTS.insuranceRatePercent ?? 1.0,
    // Percentage-based Fees
    professionalFeesPercent: DEFAULT_SYSTEM_COSTS.professionalFeesPercent ?? 0,
    projectManagementPercent: DEFAULT_SYSTEM_COSTS.projectManagementPercent ?? 0,
    contingencyPercent: DEFAULT_SYSTEM_COSTS.contingencyPercent ?? 0,
    // Replacement Costs (Year 10)
    replacementYear: DEFAULT_SYSTEM_COSTS.replacementYear ?? 10,
    equipmentCostPercent: DEFAULT_SYSTEM_COSTS.equipmentCostPercent ?? 45,
    moduleSharePercent: DEFAULT_SYSTEM_COSTS.moduleSharePercent ?? 70,
    inverterSharePercent: DEFAULT_SYSTEM_COSTS.inverterSharePercent ?? 30,
    solarModuleReplacementPercent: DEFAULT_SYSTEM_COSTS.solarModuleReplacementPercent ?? 10,
    inverterReplacementPercent: DEFAULT_SYSTEM_COSTS.inverterReplacementPercent ?? 50,
    batteryReplacementPercent: DEFAULT_SYSTEM_COSTS.batteryReplacementPercent ?? 30,
    // Financial Return Parameters
    costOfCapital: DEFAULT_SYSTEM_COSTS.costOfCapital ?? 9.0,
    cpi: DEFAULT_SYSTEM_COSTS.cpi ?? 6.0,
    electricityInflation: DEFAULT_SYSTEM_COSTS.electricityInflation ?? 10.0,
    projectDurationYears: DEFAULT_SYSTEM_COSTS.projectDurationYears ?? 20,
    lcoeDiscountRate: DEFAULT_SYSTEM_COSTS.lcoeDiscountRate ?? 9.0,
    mirrFinanceRate: DEFAULT_SYSTEM_COSTS.mirrFinanceRate ?? 9.0,
    mirrReinvestmentRate: DEFAULT_SYSTEM_COSTS.mirrReinvestmentRate ?? 10.0,
  });
  
  // Track if costs were initialized from saved simulation
  const costsInitializedRef = useRef(false);
  
  // Fetch last saved simulation to initialize costs
  const { data: lastSavedSimulation } = useQuery({
    queryKey: ["last-saved-simulation-costs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_simulations")
        .select("results_json")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  
  // Initialize costs and blended rate type from last saved simulation (only once per project)
  useEffect(() => {
    if (!costsInitializedRef.current && lastSavedSimulation?.results_json) {
      const savedJson = lastSavedSimulation.results_json as any;
      const savedCosts = savedJson?.systemCosts;
      if (savedCosts) {
        setSystemCosts({
          solarCostPerKwp: savedCosts.solarCostPerKwp ?? DEFAULT_SYSTEM_COSTS.solarCostPerKwp,
          batteryCostPerKwh: savedCosts.batteryCostPerKwh ?? DEFAULT_SYSTEM_COSTS.batteryCostPerKwh,
          solarMaintenancePercentage: savedCosts.solarMaintenancePercentage ?? savedCosts.maintenancePercentage ?? DEFAULT_SYSTEM_COSTS.solarMaintenancePercentage ?? 3.5,
          batteryMaintenancePercentage: savedCosts.batteryMaintenancePercentage ?? DEFAULT_SYSTEM_COSTS.batteryMaintenancePercentage ?? 1.5,
          maintenancePerYear: savedCosts.maintenancePerYear ?? 0,
          // Additional Fixed Costs
          healthAndSafetyCost: savedCosts.healthAndSafetyCost ?? DEFAULT_SYSTEM_COSTS.healthAndSafetyCost ?? 0,
          waterPointsCost: savedCosts.waterPointsCost ?? DEFAULT_SYSTEM_COSTS.waterPointsCost ?? 0,
          cctvCost: savedCosts.cctvCost ?? DEFAULT_SYSTEM_COSTS.cctvCost ?? 0,
          mvSwitchGearCost: savedCosts.mvSwitchGearCost ?? DEFAULT_SYSTEM_COSTS.mvSwitchGearCost ?? 0,
          // Insurance
          insuranceCostPerYear: savedCosts.insuranceCostPerYear ?? DEFAULT_SYSTEM_COSTS.insuranceCostPerYear ?? 0,
          insuranceRatePercent: savedCosts.insuranceRatePercent ?? DEFAULT_SYSTEM_COSTS.insuranceRatePercent ?? 1.0,
          // Percentage-based Fees
          professionalFeesPercent: savedCosts.professionalFeesPercent ?? DEFAULT_SYSTEM_COSTS.professionalFeesPercent ?? 0,
          projectManagementPercent: savedCosts.projectManagementPercent ?? DEFAULT_SYSTEM_COSTS.projectManagementPercent ?? 0,
          contingencyPercent: savedCosts.contingencyPercent ?? DEFAULT_SYSTEM_COSTS.contingencyPercent ?? 0,
          // Replacement Costs (Year 10)
          replacementYear: savedCosts.replacementYear ?? DEFAULT_SYSTEM_COSTS.replacementYear ?? 10,
          equipmentCostPercent: savedCosts.equipmentCostPercent ?? DEFAULT_SYSTEM_COSTS.equipmentCostPercent ?? 45,
          moduleSharePercent: savedCosts.moduleSharePercent ?? DEFAULT_SYSTEM_COSTS.moduleSharePercent ?? 70,
          inverterSharePercent: savedCosts.inverterSharePercent ?? DEFAULT_SYSTEM_COSTS.inverterSharePercent ?? 30,
          solarModuleReplacementPercent: savedCosts.solarModuleReplacementPercent ?? DEFAULT_SYSTEM_COSTS.solarModuleReplacementPercent ?? 10,
          inverterReplacementPercent: savedCosts.inverterReplacementPercent ?? DEFAULT_SYSTEM_COSTS.inverterReplacementPercent ?? 50,
          batteryReplacementPercent: savedCosts.batteryReplacementPercent ?? DEFAULT_SYSTEM_COSTS.batteryReplacementPercent ?? 30,
          // Financial Return Parameters
          costOfCapital: savedCosts.costOfCapital ?? DEFAULT_SYSTEM_COSTS.costOfCapital ?? 9.0,
          cpi: savedCosts.cpi ?? DEFAULT_SYSTEM_COSTS.cpi ?? 6.0,
          electricityInflation: savedCosts.electricityInflation ?? DEFAULT_SYSTEM_COSTS.electricityInflation ?? 10.0,
          projectDurationYears: savedCosts.projectDurationYears ?? DEFAULT_SYSTEM_COSTS.projectDurationYears ?? 20,
          lcoeDiscountRate: savedCosts.lcoeDiscountRate ?? DEFAULT_SYSTEM_COSTS.lcoeDiscountRate ?? 9.0,
          mirrFinanceRate: savedCosts.mirrFinanceRate ?? DEFAULT_SYSTEM_COSTS.mirrFinanceRate ?? 9.0,
          mirrReinvestmentRate: savedCosts.mirrReinvestmentRate ?? DEFAULT_SYSTEM_COSTS.mirrReinvestmentRate ?? 10.0,
        });
      }
      // Load blended rate type preference
      if (savedJson?.blendedRateType) {
        setBlendedRateType(savedJson.blendedRateType);
      }
      costsInitializedRef.current = true;
    }
  }, [lastSavedSimulation]);
  
  // Reset initialization flag when project changes
  useEffect(() => {
    costsInitializedRef.current = false;
  }, [id]);

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

  // Get system type from project
  const projectSystemType = project?.system_type || "Solar";

  // Check if system includes battery
  const systemIncludesBattery = projectSystemType === "Solar + Battery" || projectSystemType === "Hybrid";

  const { data: tenants, isLoading: isLoadingTenants } = useQuery({
    queryKey: ["project-tenants", id],
    queryFn: async () => {
      // Fetch tenants with their direct scada_imports relation
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("project_tenants")
        .select(`*, shop_types(*), scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend, raw_data, date_range_start, date_range_end, detected_interval_minutes)`)
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
          scada_imports:scada_import_id(id, shop_name, site_name, area_sqm, load_profile_weekday, load_profile_weekend, detected_interval_minutes)
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

  // Fetch latest simulation for PV capacity and status tracking
  const { data: latestSimulation, isLoading: isLoadingSimulation } = useQuery({
    queryKey: ["project-latest-simulation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_simulations")
        .select("id, name, solar_capacity_kwp, battery_capacity_kwh, battery_power_kw, annual_solar_savings, roi_percentage, results_json")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Use simulation count derived from latest simulation query
  const simulationCount = latestSimulation ? 1 : 0; // Simplified - count can be fetched separately if needed

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

  // Wait for all critical queries to load before rendering
  const isLoadingCritical = isLoading || isLoadingTenants || isLoadingSimulation;
  
  if (isLoadingCritical) {
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
    <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        {/* Project Logo */}
        {project.logo_url && (
          <div className="h-14 w-14 rounded-lg border bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
            <img 
              src={`${project.logo_url}?t=${Date.now()}`} 
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

      </div>


      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TooltipProvider delayDuration={300}>
          <TabsList className="flex-wrap h-auto gap-1 w-full justify-start">
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
            ref={dashboardRef}
            projectId={id!} 
            project={project} 
            tenants={tenants || []} 
            latestSimulation={latestSimulation || null}
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
            latitude={project.latitude ?? -33.9249}
            longitude={project.longitude ?? 18.4241}
            simulatedSolarCapacityKwp={latestSimulation?.solar_capacity_kwp}
            simulatedBatteryCapacityKwh={latestSimulation?.battery_capacity_kwh}
            simulatedBatteryPowerKw={latestSimulation?.battery_power_kw}
            simulatedDcAcRatio={(latestSimulation?.results_json as any)?.pvConfig?.dcAcRatio}
            systemIncludesSolar={projectSystemType !== "Grid Only"}
            systemIncludesBattery={systemIncludesBattery}
          />
        </TabsContent>

        <TabsContent value="costs" className="mt-6">
          <SystemCostsManager
            costs={systemCosts}
            onChange={setSystemCosts}
            onBlur={() => simulationRef.current?.saveIfNeeded()}
            solarCapacity={latestSimulation?.solar_capacity_kwp ?? 100}
            batteryCapacity={latestSimulation?.battery_capacity_kwh ?? 50}
            includesBattery={systemIncludesBattery}
          />
        </TabsContent>

        <TabsContent value="tariff" className="mt-6">
          <TariffSelector
            projectId={id!}
            currentTariffId={project.tariff_id}
            latitude={project.latitude}
            longitude={project.longitude}
            onSelect={(tariffId) => updateProject.mutate({ tariff_id: tariffId })}
            selectedBlendedRateType={blendedRateType}
            onBlendedRateTypeChange={setBlendedRateType}
          />
        </TabsContent>

        {/* Force-mount simulation when on costs tab to preserve ref for auto-save */}
        <TabsContent 
          value="simulation" 
          className={`mt-6 ${activeTab === "costs" ? "hidden" : ""}`}
          forceMount={activeTab === "costs" || activeTab === "simulation" ? true : undefined}
        >
          <SimulationModes
            ref={simulationRef}
            projectId={id!}
            project={project}
            tenants={tenants || []}
            shopTypes={shopTypes || []}
            systemCosts={systemCosts}
            onSystemCostsChange={setSystemCosts}
            includesBattery={systemIncludesBattery}
            blendedRateType={blendedRateType}
            onBlendedRateTypeChange={setBlendedRateType}
          />
        </TabsContent>

        <TabsContent value="pv-layout" className="mt-6">
          <FloorPlanMarkup projectId={id!} latestSimulation={latestSimulation} />
        </TabsContent>

        <TabsContent value="solar-forecast" className="mt-6">
          <ProjectLocationMap
            projectId={id!}
            latitude={project.latitude}
            longitude={project.longitude}
            location={project.location}
            onLocationUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ["project", id] });
            }}
          />
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