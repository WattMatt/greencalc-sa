import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, BarChart3, DollarSign, Zap, Sun, MapPin, Plug, 
  CheckCircle2, AlertCircle, ArrowRight, Building2, TrendingDown, Wallet
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

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

  const setupSteps = [
    { label: "Add tenants", done: tenants.length > 0, tab: "tenants" },
    { label: "Assign load profiles", done: assignedProfiles > 0, tab: "tenants" },
    { label: "Set connection size", done: hasConnectionSize, tab: "tenants" },
    { label: "Select tariff", done: hasTariff, tab: "tariff" },
  ];
  
  const completedSteps = setupSteps.filter(s => s.done).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;

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

      {/* Mini Load Profile Chart */}
      {tenants.length > 0 && miniChartData.length > 0 && (
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("load-profile")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Daily Load Profile
              </CardTitle>
              <div className="flex items-center gap-4 text-sm">
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
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={miniChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    interval={5}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    width={35}
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
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Click to view detailed analysis →
            </p>
          </CardContent>
        </Card>
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
