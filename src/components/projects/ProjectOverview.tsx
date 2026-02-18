import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, BarChart3, DollarSign, Zap, Sun, MapPin, Plug, 
  CheckCircle2, AlertCircle, ArrowRight, Building2, TrendingDown, Wallet, TrendingUp,
  ChevronRight, Lock, CloudSun, ScrollText, GitBranch
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, Legend, CartesianGrid, ReferenceLine, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  scada_import_id: string | null;
  shop_type_id: string | null;
  scada_imports?: {
    load_profile_weekday?: number[];
  } | null;
  shop_types?: {
    kwh_per_sqm_month?: number;
    load_profile_weekday?: number[];
  } | null;
  monthly_kwh_override?: number | null;
}

interface ProjectOverviewProps {
  project: any;
  tenants: Tenant[];
  onNavigateTab: (tab: string) => void;
}

export function ProjectOverview({ project, tenants, onNavigateTab }: ProjectOverviewProps) {
  const totalArea = tenants.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0);
  const assignedProfiles = tenants.filter(t => t.scada_import_id).length;
  const profileCompletion = tenants.length > 0 ? (assignedProfiles / tenants.length) * 100 : 0;
  
  const hasTariff = !!project.tariff_id;
  const hasConnectionSize = !!project.connection_size_kva;
  const maxSolarKva = hasConnectionSize ? project.connection_size_kva * 0.7 : null;

  // Calculate estimated monthly consumption (simplified)
  const estimatedMonthlyKwh = totalArea * 50; // Default 50 kWh/m²/month

  // Generate mini load profile data
  const DEFAULT_PROFILE = [4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17, 4.17];
  
  const miniChartData = useMemo(() => {
    if (tenants.length === 0) return [];
    
    const hourlyData: { hour: string; load: number }[] = [];
    
    for (let h = 0; h < 24; h++) {
      let totalLoad = 0;
      
      tenants.forEach((tenant) => {
        const tenantArea = Number(tenant.area_sqm) || 0;
        const scadaProfile = tenant.scada_imports?.load_profile_weekday;
        
        if (scadaProfile?.length === 24) {
          const scadaArea = 100; // Simplified - use tenant area as base
          const areaScaleFactor = tenantArea / scadaArea;
          totalLoad += (scadaProfile[h] || 0) * areaScaleFactor;
        } else {
          const shopType = tenant.shop_types;
          const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
          const dailyKwh = monthlyKwh / 30;
          const profile = shopType?.load_profile_weekday?.length === 24 
            ? shopType.load_profile_weekday 
            : DEFAULT_PROFILE;
          totalLoad += dailyKwh * (profile[h] / 100);
        }
      });
      
      hourlyData.push({
        hour: `${h.toString().padStart(2, '0')}:00`,
        load: totalLoad
      });
    }
    
    return hourlyData;
  }, [tenants]);

  const peakLoad = miniChartData.length > 0 ? Math.max(...miniChartData.map(d => d.load)) : 0;
  const dailyTotal = miniChartData.reduce((sum, d) => sum + d.load, 0);

  // Generate mini PV profile data (typical solar curve)
  const pvChartData = useMemo(() => {
    if (!maxSolarKva) return [];
    
    // Typical solar generation curve (percentage of peak for each hour)
    const solarCurve = [0, 0, 0, 0, 0, 0, 5, 20, 45, 70, 85, 95, 100, 98, 90, 75, 55, 30, 10, 0, 0, 0, 0, 0];
    const peakGeneration = maxSolarKva * 0.85; // 85% efficiency factor
    
    return solarCurve.map((pct, h) => ({
      hour: `${h.toString().padStart(2, '0')}:00`,
      generation: (pct / 100) * peakGeneration
    }));
  }, [maxSolarKva]);

  const dailyPvGeneration = pvChartData.reduce((sum, d) => sum + d.generation, 0);
  const peakPvGeneration = pvChartData.length > 0 ? Math.max(...pvChartData.map(d => d.generation)) : 0;

  // Financial estimates
  const annualConsumption = dailyTotal * 365;
  const avgTariffRate = 2.50; // R/kWh - default estimate for commercial
  const annualGridCost = annualConsumption * avgTariffRate;
  
  // Solar savings estimates (if connection size is set)
  const solarFinancials = useMemo(() => {
    if (!maxSolarKva || dailyTotal === 0) return null;
    
    // Typical SA solar yield: ~1600-1800 kWh/kWp/year, use 1700 as average
    const annualSolarYield = maxSolarKva * 1700;
    // Self-consumption typically 60-80% for commercial
    const selfConsumptionRate = 0.7;
    const usableSolarEnergy = Math.min(annualSolarYield * selfConsumptionRate, annualConsumption);
    const annualSavings = usableSolarEnergy * avgTariffRate;
    
    // System cost estimate: ~R12,000/kWp installed
    const systemCost = maxSolarKva * 12000;
    const paybackYears = systemCost / annualSavings;
    const roiPercent = (annualSavings / systemCost) * 100;
    const savingsPercent = (usableSolarEnergy / annualConsumption) * 100;
    
    return {
      annualSolarYield,
      usableSolarEnergy,
      annualSavings,
      systemCost,
      paybackYears,
      roiPercent,
      savingsPercent
    };
  }, [maxSolarKva, dailyTotal, annualConsumption]);

  // Calculate energy ratios for pie charts
  const energyRatios = useMemo(() => {
    if (!solarFinancials || dailyTotal === 0 || dailyPvGeneration === 0) return null;
    
    const dailySelfConsumed = Math.min(dailyPvGeneration * 0.7, dailyTotal); // 70% self-consumption
    const dailyGridExport = dailyPvGeneration - dailySelfConsumed;
    const dailyGridImport = Math.max(0, dailyTotal - dailySelfConsumed);
    
    const selfConsumptionRate = (dailySelfConsumed / dailyPvGeneration) * 100;
    const solarCoverageRate = (dailySelfConsumed / dailyTotal) * 100;
    const gridDependencyRate = (dailyGridImport / dailyTotal) * 100;
    
    return {
      selfConsumptionRate,
      solarCoverageRate,
      gridDependencyRate,
      dailySelfConsumed,
      dailyGridExport,
      dailyGridImport,
      // Pie chart data
      energySourceData: [
        { name: 'Solar', value: dailySelfConsumed, color: 'hsl(45 93% 47%)' },
        { name: 'Grid', value: dailyGridImport, color: 'hsl(var(--destructive))' }
      ],
      pvUsageData: [
        { name: 'Self-consumed', value: dailySelfConsumed, color: 'hsl(142 76% 36%)' },
        { name: 'Exported', value: dailyGridExport, color: 'hsl(var(--primary))' }
      ]
    };
  }, [solarFinancials, dailyTotal, dailyPvGeneration]);

  // Generate savings breakdown chart data (10-year projection)
  const savingsChartData = useMemo(() => {
    if (!solarFinancials || annualGridCost === 0) return [];
    
    const escalationRate = 0.08; // 8% annual electricity increase
    const years = 15;
    const data: { year: number; gridCost: number; solarCost: number; cumulativeSavings: number }[] = [];
    
    let cumulativeSavings = 0;
    
    for (let year = 1; year <= years; year++) {
      const gridCostThisYear = annualGridCost * Math.pow(1 + escalationRate, year - 1);
      const remainingGridCost = (annualConsumption - solarFinancials.usableSolarEnergy) * avgTariffRate * Math.pow(1 + escalationRate, year - 1);
      const solarCostThisYear = remainingGridCost + (solarFinancials.systemCost / 20); // 20-year amortization
      
      const savingsThisYear = gridCostThisYear - solarCostThisYear;
      cumulativeSavings += savingsThisYear;
      
      data.push({
        year,
        gridCost: gridCostThisYear / 1000, // in thousands
        solarCost: solarCostThisYear / 1000,
        cumulativeSavings: cumulativeSavings / 1000
      });
    }
    
    return data;
  }, [solarFinancials, annualGridCost, annualConsumption, avgTariffRate]);

  // Calculate breakeven year (when cumulative savings exceed system cost)
  const breakevenYear = useMemo(() => {
    if (!solarFinancials || savingsChartData.length === 0) return null;
    const systemCostK = solarFinancials.systemCost / 1000;
    const breakevenPoint = savingsChartData.find(d => d.cumulativeSavings >= systemCostK);
    if (breakevenPoint) return breakevenPoint.year;
    // Interpolate if between years
    for (let i = 1; i < savingsChartData.length; i++) {
      const prev = savingsChartData[i - 1];
      const curr = savingsChartData[i];
      if (prev.cumulativeSavings < systemCostK && curr.cumulativeSavings >= systemCostK) {
        const fraction = (systemCostK - prev.cumulativeSavings) / (curr.cumulativeSavings - prev.cumulativeSavings);
        return prev.year + fraction;
      }
    }
    return null;
  }, [solarFinancials, savingsChartData]);

  const setupSteps = [
    { label: "Add tenants", done: tenants.length > 0, tab: "tenants" },
    { label: "Assign load profiles", done: assignedProfiles > 0, tab: "tenants" },
    { label: "Set connection size", done: hasConnectionSize, tab: "tenants" },
    { label: "Select tariff", done: hasTariff, tab: "tariff" },
  ];
  
  const completedSteps = setupSteps.filter(s => s.done).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;

  // Workflow steps for the visual diagram
  type WorkflowStatus = "complete" | "partial" | "pending" | "blocked";
  
  const workflowSteps: Array<{
    id: string;
    label: string;
    icon: any;
    status: WorkflowStatus;
    statusText: string;
    dependsOn: string[];
  }> = useMemo(() => [
    {
      id: "tenants",
      label: "Tenants",
      icon: Users,
      status: tenants.length === 0 ? "pending" 
        : assignedProfiles === tenants.length ? "complete" 
        : "partial",
      statusText: tenants.length === 0 
        ? "Add tenants"
        : `${assignedProfiles}/${tenants.length} profiles`,
      dependsOn: []
    },
    {
      id: "load-profile",
      label: "Load Profile",
      icon: BarChart3,
      status: assignedProfiles === 0 ? "blocked" 
        : assignedProfiles === tenants.length ? "complete" 
        : "partial",
      statusText: assignedProfiles === 0 
        ? "Needs tenants"
        : `${dailyTotal.toFixed(0)} kWh/day`,
      dependsOn: ["tenants"]
    },
    {
      id: "tariff",
      label: "Tariff",
      icon: DollarSign,
      status: hasTariff ? "complete" : "pending",
      statusText: hasTariff ? "Selected" : "Not set",
      dependsOn: []
    },
    {
      id: "costs",
      label: "Costs",
      icon: Wallet,
      status: "complete",
      statusText: "Configured",
      dependsOn: []
    },
    {
      id: "simulation",
      label: "Simulation",
      icon: Zap,
      status: (!hasTariff || assignedProfiles === 0) ? "blocked" : "pending",
      statusText: (!hasTariff || assignedProfiles === 0) 
        ? "Needs setup"
        : "Ready to run",
      dependsOn: ["load-profile", "tariff", "costs"]
    },
    {
      id: "pv-layout",
      label: "PV Layout",
      icon: Sun,
      status: "pending",
      statusText: maxSolarKva ? `Max ${maxSolarKva.toFixed(0)} kVA` : "Optional",
      dependsOn: []
    },
    {
      id: "solar-forecast",
      label: "Forecast",
      icon: CloudSun,
      status: project.location ? "complete" : "pending",
      statusText: project.location ? "Location set" : "Set location",
      dependsOn: []
    },
    {
      id: "proposals",
      label: "Proposals",
      icon: ScrollText,
      status: "pending",
      statusText: "Create proposal",
      dependsOn: ["simulation"]
    },
  ], [tenants.length, assignedProfiles, hasTariff, dailyTotal, maxSolarKva, project.location]);

  const completedWorkflowSteps = workflowSteps.filter(s => s.status === "complete").length;

  // Workflow node component
  const WorkflowNode = ({ step, onClick }: { step: typeof workflowSteps[0]; onClick: () => void }) => {
    const statusStyles = {
      complete: "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
      partial: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      blocked: "border-muted-foreground/30 bg-muted/30 text-muted-foreground opacity-60",
      pending: "border-muted-foreground/40 bg-muted/20 text-muted-foreground"
    };
    
    const IconComponent = step.icon;
    
    return (
      <button
        onClick={onClick}
        className={cn(
          "relative flex flex-col items-center p-3 rounded-lg border-2 min-w-[80px] transition-all hover:scale-105 hover:shadow-md cursor-pointer",
          statusStyles[step.status]
        )}
      >
        {/* Status indicator */}
        <div className="absolute -top-2 -right-2">
          {step.status === "complete" && <CheckCircle2 className="h-4 w-4 text-green-500 bg-background rounded-full" />}
          {step.status === "blocked" && <Lock className="h-4 w-4 text-muted-foreground bg-background rounded-full" />}
          {step.status === "partial" && <AlertCircle className="h-4 w-4 text-amber-500 bg-background rounded-full" />}
        </div>
        
        {/* Icon */}
        <IconComponent className="h-5 w-5 mb-1" />
        
        {/* Label */}
        <span className="text-xs font-medium text-center leading-tight">{step.label}</span>
        
        {/* Status text */}
        <span className="text-[10px] opacity-70 mt-0.5 text-center">{step.statusText}</span>
      </button>
    );
  };

  // Workflow connector
  const WorkflowConnector = ({ isComplete }: { isComplete: boolean }) => (
    <div className="flex items-center px-1">
      <div className={cn(
        "w-4 h-0.5",
        isComplete ? "bg-green-500" : "bg-muted-foreground/30"
      )} />
      <ChevronRight className={cn(
        "h-4 w-4 -ml-1",
        isComplete ? "text-green-500" : "text-muted-foreground/30"
      )} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Setup Progress */}
      {setupProgress < 100 && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Project Setup
            </CardTitle>
            <CardDescription>Complete these steps to enable full simulation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Progress value={setupProgress} className="flex-1" />
              <span className="text-sm font-medium">{completedSteps}/{setupSteps.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {setupSteps.map((step, i) => (
                <Badge
                  key={i}
                  variant={step.done ? "default" : "outline"}
                  className={`cursor-pointer ${step.done ? "bg-primary/20 text-primary hover:bg-primary/30" : "hover:bg-muted"}`}
                  onClick={() => onNavigateTab(step.tab)}
                >
                  {step.done ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                  {step.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual Workflow Diagram */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                Project Workflow
              </CardTitle>
              <CardDescription>
                Click any step to navigate • {completedWorkflowSteps}/{workflowSteps.length} complete
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Complete</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Partial</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="text-muted-foreground">Pending</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Main workflow - primary flow */}
          <div className="space-y-4">
            {/* Row 1: Tenants → Load Profile → Tariff → Costs → Simulation */}
            <div className="flex items-center justify-center gap-1 overflow-x-auto pb-2">
              <WorkflowNode step={workflowSteps[0]} onClick={() => onNavigateTab("tenants")} />
              <WorkflowConnector isComplete={workflowSteps[0].status === "complete" || workflowSteps[0].status === "partial"} />
              <WorkflowNode step={workflowSteps[1]} onClick={() => onNavigateTab("load-profile")} />
              <WorkflowConnector isComplete={workflowSteps[1].status === "complete"} />
              <WorkflowNode step={workflowSteps[2]} onClick={() => onNavigateTab("tariff")} />
              <WorkflowConnector isComplete={workflowSteps[2].status === "complete"} />
              <WorkflowNode step={workflowSteps[3]} onClick={() => onNavigateTab("costs")} />
              <WorkflowConnector isComplete={workflowSteps[3].status === "complete"} />
              <WorkflowNode step={workflowSteps[4]} onClick={() => onNavigateTab("simulation")} />
              <WorkflowConnector isComplete={workflowSteps[4].status === "complete"} />
              <WorkflowNode step={workflowSteps[7]} onClick={() => onNavigateTab("proposals")} />
            </div>
            
            {/* Row 2: Supporting tools (PV Layout, Solar Forecast) */}
            <div className="flex items-center justify-center gap-6 pt-2 border-t border-dashed border-muted-foreground/20">
              <div className="flex items-center gap-2">
                <WorkflowNode step={workflowSteps[5]} onClick={() => onNavigateTab("pv-layout")} />
                <span className="text-[10px] text-muted-foreground">Affects capacity</span>
              </div>
              <div className="flex items-center gap-2">
                <WorkflowNode step={workflowSteps[6]} onClick={() => onNavigateTab("solar-forecast")} />
                <span className="text-[10px] text-muted-foreground">Improves accuracy</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("tenants")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tenants</p>
                <p className="text-2xl font-bold">{tenants.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {assignedProfiles} with profiles
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            {tenants.length > 0 && (
              <Progress value={profileCompletion} className="mt-3 h-1" />
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("load-profile")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Area</p>
                <p className="text-2xl font-bold">{totalArea.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">m²</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("tariff")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tariff</p>
                <p className="text-2xl font-bold">
                  {hasTariff ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasTariff ? "Selected" : "Required for simulation"}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("simulation")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Max Solar</p>
                <p className="text-2xl font-bold">
                  {maxSolarKva ? `${maxSolarKva.toFixed(0)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasConnectionSize ? `kVA (70% of ${project.connection_size_kva} kVA)` : "Set connection size"}
                </p>
              </div>
              <Sun className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mini Charts Grid */}
      {tenants.length > 0 && miniChartData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Load Profile Chart */}
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("load-profile")}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Daily Load Profile
                </CardTitle>
                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Peak: </span>
                    <span className="font-medium">{peakLoad.toFixed(0)} kWh</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Daily: </span>
                    <span className="font-medium">{dailyTotal.toFixed(0)} kWh</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={miniChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 9 }} 
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickFormatter={(v) => v.replace(':00', '')}
                    />
                    <YAxis 
                      tick={{ fontSize: 9 }} 
                      tickLine={false}
                      axisLine={false}
                      width={30}
                      tickFormatter={(v) => `${v.toFixed(0)}`}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                              <p className="text-xs text-muted-foreground">{payload[0].payload.hour}</p>
                              <p className="text-sm font-medium">{Number(payload[0].value).toFixed(1)} kWh</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="load"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#loadGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* PV Generation Chart */}
          {pvChartData.length > 0 ? (
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("load-profile")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    Est. PV Generation
                  </CardTitle>
                  <div className="flex items-center gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Peak: </span>
                      <span className="font-medium">{peakPvGeneration.toFixed(0)} kW</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Daily: </span>
                      <span className="font-medium">{dailyPvGeneration.toFixed(0)} kWh</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pvChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(45 93% 47%)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="hsl(45 93% 47%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="hour" 
                        tick={{ fontSize: 9 }} 
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        tickFormatter={(v) => v.replace(':00', '')}
                      />
                      <YAxis 
                        tick={{ fontSize: 9 }} 
                        tickLine={false}
                        axisLine={false}
                        width={30}
                        tickFormatter={(v) => `${v.toFixed(0)}`}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                                <p className="text-xs text-muted-foreground">{payload[0].payload.hour}</p>
                                <p className="text-sm font-medium text-amber-600">{Number(payload[0].value).toFixed(1)} kW</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="generation"
                        stroke="hsl(45 93% 47%)"
                        strokeWidth={2}
                        fill="url(#pvGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center" onClick={() => onNavigateTab("tenants")}>
              <CardContent className="py-8 text-center">
                <Sun className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Set connection size to see</p>
                <p className="text-sm text-muted-foreground">estimated PV generation</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Energy Ratio Charts */}
      {energyRatios && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Energy Source Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Energy Source
              </CardTitle>
              <CardDescription className="text-xs">Where your energy comes from</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-32 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={energyRatios.energySourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {energyRatios.energySourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                              <p className="text-xs font-medium">{payload[0].name}</p>
                              <p className="text-sm">{Number(payload[0].value).toFixed(1)} kWh</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(45 93% 47%)' }} />
                  <span>Solar {energyRatios.solarCoverageRate.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span>Grid {energyRatios.gridDependencyRate.toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Solar Self-Consumption */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                PV Utilization
              </CardTitle>
              <CardDescription className="text-xs">How solar generation is used</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-32 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={energyRatios.pvUsageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {energyRatios.pvUsageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                              <p className="text-xs font-medium">{payload[0].name}</p>
                              <p className="text-sm">{Number(payload[0].value).toFixed(1)} kWh</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(142 76% 36%)' }} />
                  <span>Used {energyRatios.selfConsumptionRate.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>Export {(100 - energyRatios.selfConsumptionRate).toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid Independence */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-500" />
                Grid Independence
              </CardTitle>
              <CardDescription className="text-xs">Reduced grid dependency</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-32 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold text-green-600">
                  {energyRatios.solarCoverageRate.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">of load from solar</p>
                <div className="w-full mt-3">
                  <Progress value={energyRatios.solarCoverageRate} className="h-2" />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                <span>Grid: {energyRatios.dailyGridImport.toFixed(0)} kWh/day</span>
                <span>Solar: {energyRatios.dailySelfConsumed.toFixed(0)} kWh/day</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financial Summary Card */}
      {tenants.length > 0 && (
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("simulation")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Financial Summary
              </CardTitle>
              <Badge variant="outline" className="text-xs">Estimates</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Annual Consumption */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Annual Consumption</p>
                <p className="text-xl font-bold">{(annualConsumption / 1000).toFixed(0)} MWh</p>
                <p className="text-xs text-muted-foreground">{annualConsumption.toLocaleString()} kWh/year</p>
              </div>

              {/* Annual Grid Cost */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Est. Annual Cost</p>
                <p className="text-xl font-bold text-destructive">
                  R {(annualGridCost / 1000000).toFixed(2)}M
                </p>
                <p className="text-xs text-muted-foreground">@ R{avgTariffRate.toFixed(2)}/kWh avg</p>
              </div>

              {/* Potential Savings */}
              {solarFinancials ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-green-500" />
                      Potential Savings
                    </p>
                    <p className="text-xl font-bold text-green-600">
                      R {(solarFinancials.annualSavings / 1000).toFixed(0)}k
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {solarFinancials.savingsPercent.toFixed(0)}% of consumption
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Simple Payback</p>
                    <p className="text-xl font-bold">
                      {solarFinancials.paybackYears.toFixed(1)} years
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {solarFinancials.roiPercent.toFixed(0)}% ROI
                    </p>
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex items-center justify-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground text-center">
                    Set connection size to see solar savings potential
                  </p>
                </div>
              )}
            </div>

            {solarFinancials && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground">System Size: </span>
                    <span className="font-medium">{maxSolarKva?.toFixed(0)} kWp</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Cost: </span>
                    <span className="font-medium">R {(solarFinancials.systemCost / 1000000).toFixed(2)}M</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Annual Yield: </span>
                    <span className="font-medium">{(solarFinancials.annualSolarYield / 1000).toFixed(0)} MWh</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  Run Full Simulation <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Savings Breakdown Chart */}
      {savingsChartData.length > 0 && solarFinancials && (
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("simulation")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                15-Year Cost Projection
              </CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">Grid Only</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">With Solar</span>
                </div>
              </div>
            </div>
            <CardDescription className="flex items-center gap-2">
              Projected annual costs assuming 8% electricity escalation
              {breakevenYear && (
                <Badge variant="secondary" className="ml-2 bg-chart-4/20 text-chart-4 border-chart-4/30">
                  Breakeven: {breakevenYear.toFixed(1)} years
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fontSize: 11 }} 
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'Year', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }} 
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tickFormatter={(v) => `R${v.toFixed(0)}k`}
                    label={{ value: 'Annual Cost', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const gridCost = Number(payload[0]?.value || 0);
                        const solarCost = Number(payload[1]?.value || 0);
                        const savings = gridCost - solarCost;
                        const cumulative = Number(payload[2]?.value || 0);
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                            <p className="text-sm font-medium mb-1">Year {label}</p>
                            <div className="space-y-1 text-xs">
                              <p><span className="text-destructive">Grid Cost:</span> R{(gridCost * 1000).toLocaleString()}</p>
                              <p><span className="text-green-600">With Solar:</span> R{(solarCost * 1000).toLocaleString()}</p>
                              <p className="pt-1 border-t">
                                <span className="text-muted-foreground">Annual Savings:</span>{' '}
                                <span className="font-medium text-green-600">R{(savings * 1000).toLocaleString()}</span>
                              </p>
                              <p>
                                <span className="text-muted-foreground">Cumulative Savings:</span>{' '}
                                <span className="font-medium">R{(cumulative * 1000).toLocaleString()}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gridCost"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={false}
                    name="Grid Only"
                  />
                  <Line
                    type="monotone"
                    dataKey="solarCost"
                    stroke="hsl(142 76% 36%)"
                    strokeWidth={2}
                    dot={false}
                    name="With Solar"
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeSavings"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Cumulative Savings"
                  />
                  {breakevenYear && (
                    <ReferenceLine 
                      x={breakevenYear} 
                      stroke="hsl(var(--chart-4))" 
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{ 
                        value: `Breakeven: Year ${breakevenYear.toFixed(1)}`, 
                        position: 'top',
                        fill: 'hsl(var(--foreground))',
                        fontSize: 11,
                        fontWeight: 500
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">5-Year Savings</p>
                <p className="text-lg font-bold text-green-600">
                  R{((savingsChartData[4]?.cumulativeSavings || 0) * 1000 / 1000000).toFixed(2)}M
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">10-Year Savings</p>
                <p className="text-lg font-bold text-green-600">
                  R{((savingsChartData[9]?.cumulativeSavings || 0) * 1000 / 1000000).toFixed(2)}M
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">15-Year Savings</p>
                <p className="text-lg font-bold text-green-600">
                  R{((savingsChartData[14]?.cumulativeSavings || 0) * 1000 / 1000000).toFixed(2)}M
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Load Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {tenants.length > 0 
                ? `View aggregated load profile for ${tenants.length} tenants`
                : "Add tenants to generate load profile"
              }
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab("load-profile")} disabled={tenants.length === 0}>
              View Profile <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Simulation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {hasTariff && tenants.length > 0
                ? "Run energy and financial simulations"
                : "Complete setup to enable simulation"
              }
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab("simulation")} disabled={!hasTariff || tenants.length === 0}>
              Run Simulation <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4" />
              PV Layout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Design PV array layout on floor plans
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab("pv-layout")}>
              Open Designer <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Location</p>
                <p className="font-medium">{project.location || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Connection Size</p>
                <p className="font-medium">{project.connection_size_kva ? `${project.connection_size_kva} kVA` : "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Est. Monthly Consumption</p>
                <p className="font-medium">{estimatedMonthlyKwh.toLocaleString()} kWh</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(project.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
