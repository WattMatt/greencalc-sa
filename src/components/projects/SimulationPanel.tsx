import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, ComposedChart } from "recharts";
import { Sun, Battery, Zap, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useSolcastForecast } from "@/hooks/useSolcastForecast";
import { 
  PVSystemConfig, 
  PVSystemConfigData, 
  getDefaultPVConfig, 
  generateSolarProfile,
  generateAverageSolcastProfile,
  SA_SOLAR_LOCATIONS,
  calculateSystemEfficiency,
  HourlyIrradianceData
} from "./PVSystemConfig";

interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  shop_type_id: string | null;
  monthly_kwh_override: number | null;
  shop_types?: {
    name: string;
    kwh_per_sqm_month: number;
    load_profile_weekday: number[];
  } | null;
}

interface ShopType {
  id: string;
  name: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
}

interface SimulationPanelProps {
  projectId: string;
  project: any;
  tenants: Tenant[];
  shopTypes: ShopType[];
}

const DEFAULT_PROFILE = Array(24).fill(4.17);

// Longitude values for SA cities (matching SA_SOLAR_LOCATIONS)
const SA_LOCATION_LONGITUDES: Record<string, number> = {
  johannesburg: 28.0,
  capetown: 18.4,
  durban: 31.0,
  pretoria: 28.2,
  bloemfontein: 26.2,
  port_elizabeth: 25.6,
  upington: 21.3,
  polokwane: 29.4,
  nelspruit: 30.9,
  kimberley: 24.8,
};

export function SimulationPanel({ projectId, project, tenants, shopTypes }: SimulationPanelProps) {
  const queryClient = useQueryClient();
  const [solarCapacity, setSolarCapacity] = useState(100);
  const [batteryCapacity, setBatteryCapacity] = useState(50);
  const [batteryPower, setBatteryPower] = useState(25);
  const [pvConfig, setPvConfig] = useState<PVSystemConfigData>(getDefaultPVConfig);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useSolcast, setUseSolcast] = useState(false);
  
  // Solcast forecast hook
  const { data: solcastData, isLoading: solcastLoading, fetchForecast, error: solcastError } = useSolcastForecast();

  // Get location coordinates from PV config location
  const selectedLocation = SA_SOLAR_LOCATIONS[pvConfig.location];
  const hasCoordinates = selectedLocation?.lat !== undefined;
  
  // Fetch Solcast data when enabled and location is available
  useEffect(() => {
    if (useSolcast && hasCoordinates && !solcastData && !solcastLoading) {
      fetchForecast({
        latitude: selectedLocation.lat,
        longitude: SA_LOCATION_LONGITUDES[pvConfig.location] ?? 28.0,
        hours: 168, // 7 days
        period: 'PT60M'
      });
    }
  }, [useSolcast, hasCoordinates, pvConfig.location]);
  
  // Process Solcast data into hourly average profile
  const solcastHourlyProfile = useMemo<HourlyIrradianceData[] | undefined>(() => {
    if (!solcastData?.hourly || solcastData.hourly.length === 0) return undefined;
    return generateAverageSolcastProfile(solcastData.hourly);
  }, [solcastData]);

  const { data: tariffRates } = useQuery({
    queryKey: ["tariff-rates", project.tariff_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_rates")
        .select("*")
        .eq("tariff_id", project.tariff_id);
      if (error) throw error;
      return data;
    },
    enabled: !!project.tariff_id,
  });

  const { data: tariff } = useQuery({
    queryKey: ["tariff", project.tariff_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select("*")
        .eq("id", project.tariff_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!project.tariff_id,
  });

  // Calculate load profile from tenants
  const loadProfile = useMemo(() => {
    const profile = Array(24).fill(0);
    tenants.forEach((tenant) => {
      const shopType = tenant.shop_type_id
        ? shopTypes.find((st) => st.id === tenant.shop_type_id)
        : null;
      const monthlyKwh =
        tenant.monthly_kwh_override ||
        (shopType?.kwh_per_sqm_month || 50) * Number(tenant.area_sqm);
      const dailyKwh = monthlyKwh / 30;
      const tenantProfile = shopType?.load_profile_weekday?.length === 24
        ? shopType.load_profile_weekday.map(Number)
        : DEFAULT_PROFILE;
      
      for (let h = 0; h < 24; h++) {
        profile[h] += dailyKwh * (tenantProfile[h] / 100);
      }
    });
    return profile;
  }, [tenants, shopTypes]);

  // Generate solar profile - use Solcast data if available, otherwise fallback to PVWatts-style calculation
  const solarProfile = useMemo(() => {
    const hourlyData = useSolcast && solcastHourlyProfile ? solcastHourlyProfile : undefined;
    return generateSolarProfile(pvConfig, solarCapacity, hourlyData);
  }, [pvConfig, solarCapacity, useSolcast, solcastHourlyProfile]);

  // Simulation calculations
  const simulation = useMemo(() => {
    // Solar generation now comes from PVWatts-style calculation
    const solarGeneration = solarProfile;
    
    // Calculate hourly metrics
    const hourlyData = [];
    let totalGridImport = 0;
    let totalSolarUsed = 0;
    let totalSolarExport = 0;
    let batteryState = batteryCapacity * 0.5; // Start at 50% SOC
    let totalBatteryDischarge = 0;
    let totalBatteryCharge = 0;

    for (let h = 0; h < 24; h++) {
      const load = loadProfile[h];
      const solar = solarGeneration[h];
      let netLoad = load - solar;
      let gridImport = 0;
      let solarUsed = Math.min(solar, load);
      let solarExport = 0;
      let batteryDischarge = 0;
      let batteryCharge = 0;

      if (netLoad > 0) {
        // Load exceeds solar - try battery then grid
        const batteryAvailable = Math.min(batteryState, batteryPower);
        batteryDischarge = Math.min(netLoad, batteryAvailable);
        batteryState -= batteryDischarge;
        totalBatteryDischarge += batteryDischarge;
        
        gridImport = netLoad - batteryDischarge;
        totalGridImport += gridImport;
      } else {
        // Solar exceeds load - charge battery or export
        const excess = -netLoad;
        const batterySpace = batteryCapacity - batteryState;
        batteryCharge = Math.min(excess, batterySpace, batteryPower);
        batteryState += batteryCharge;
        totalBatteryCharge += batteryCharge;
        
        solarExport = excess - batteryCharge;
        totalSolarExport += solarExport;
      }

      totalSolarUsed += solarUsed;

      hourlyData.push({
        hour: `${h.toString().padStart(2, "0")}:00`,
        load,
        solar,
        gridImport,
        solarUsed,
        solarExport,
        batterySOC: (batteryState / batteryCapacity) * 100,
        batteryDischarge,
        batteryCharge,
      });
    }

    // Cost calculations (simplified)
    const avgRate = tariffRates?.length
      ? tariffRates.reduce((sum, r) => sum + Number(r.rate_per_kwh), 0) / tariffRates.length
      : 2.5;
    const fixedCharge = Number(tariff?.fixed_monthly_charge || 0);
    const demandCharge = Number(tariff?.demand_charge_per_kva || 0);
    
    const totalDailyLoad = loadProfile.reduce((a, b) => a + b, 0);
    const peakDemand = Math.max(...loadProfile);
    
    // Grid-only costs
    const gridOnlyEnergyCost = totalDailyLoad * avgRate;
    const gridOnlyDemandCost = peakDemand * demandCharge;
    const gridOnlyDailyCost = gridOnlyEnergyCost + gridOnlyDemandCost + (fixedCharge / 30);

    // With solar + battery
    const newPeakDemand = Math.max(...hourlyData.map((d) => d.gridImport));
    const solarEnergyCost = totalGridImport * avgRate;
    const solarDemandCost = newPeakDemand * demandCharge;
    const solarDailyCost = solarEnergyCost + solarDemandCost + (fixedCharge / 30);

    const dailySavings = gridOnlyDailyCost - solarDailyCost;
    const monthlySavings = dailySavings * 30;
    const annualSavings = dailySavings * 365;

    // Rough system cost estimate
    const solarCostPerKwp = 12000; // R/kWp installed
    const batteryCostPerKwh = 8000; // R/kWh
    const systemCost = (solarCapacity * solarCostPerKwp) + (batteryCapacity * batteryCostPerKwh);
    const paybackYears = systemCost / annualSavings;
    const roi = (annualSavings / systemCost) * 100;

    return {
      hourlyData,
      totalDailyLoad,
      totalGridImport,
      totalSolarUsed,
      totalSolarExport,
      totalBatteryDischarge,
      peakDemand,
      newPeakDemand,
      gridOnlyDailyCost,
      solarDailyCost,
      dailySavings,
      monthlySavings,
      annualSavings,
      systemCost,
      paybackYears,
      roi,
      avgRate,
    };
  }, [loadProfile, solarProfile, solarCapacity, batteryCapacity, batteryPower, tariffRates, tariff]);

  if (tenants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Add tenants first to run energy simulations
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!project.tariff_id) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Select a tariff first to run cost simulations
          </p>
        </CardContent>
      </Card>
    );
  }

  // Connection size and max solar limit
  const connectionSizeKva = project.connection_size_kva ? Number(project.connection_size_kva) : null;
  const maxSolarKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const solarExceedsLimit = maxSolarKva && solarCapacity > maxSolarKva;

  const systemEfficiency = calculateSystemEfficiency(pvConfig);

  // Data source indicator
  const usingRealData = useSolcast && solcastHourlyProfile;
  const avgDailyGhi = solcastData?.summary?.average_daily_ghi_kwh_m2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Energy Simulation</h2>
          <p className="text-sm text-muted-foreground">
            Model solar and battery systems to optimize costs • {selectedLocation.name} 
            {usingRealData ? (
              <span className="text-primary"> (Solcast: {avgDailyGhi?.toFixed(1)} kWh/m²/day)</span>
            ) : (
              <span> ({selectedLocation.ghi} kWh/m²/day)</span>
            )}
          </p>
        </div>
        {/* Solcast Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={useSolcast ? "default" : "outline"}
            size="sm"
            onClick={() => setUseSolcast(!useSolcast)}
            disabled={solcastLoading}
            className="gap-2"
          >
            {solcastLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            {useSolcast ? "Using Solcast" : "Use Solcast Forecast"}
          </Button>
          {usingRealData && (
            <Badge variant="outline" className="text-xs text-primary border-primary">
              Real Irradiance Data
            </Badge>
          )}
        </div>
      </div>

      {/* Connection Size Warning */}
      {!connectionSizeKva && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Set the site's connection size (kVA) in the project header to enable solar sizing limits.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Solar Limit Exceeded Warning */}
      {solarExceedsLimit && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">
              Solar capacity ({solarCapacity} kWp) exceeds the 70% limit of {maxSolarKva?.toFixed(0)} kVA for a {connectionSizeKva} kVA connection.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Advanced PV Configuration (Collapsible) */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Advanced PV Configuration (PVWatts-style)
              <span className="text-xs text-muted-foreground ml-2">
                {selectedLocation.name} • {(systemEfficiency * 100).toFixed(1)}% efficiency
              </span>
            </span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <PVSystemConfig 
            config={pvConfig}
            onChange={setPvConfig}
            maxSolarKva={maxSolarKva}
            solarCapacity={solarCapacity}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* System Configuration */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className={solarExceedsLimit ? "border-destructive/50" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Solar PV System
              {maxSolarKva && (
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  Max: {maxSolarKva.toFixed(0)} kVA
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Capacity</Label>
                <span className={`text-xs ${solarExceedsLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {solarCapacity} kWp
                </span>
              </div>
              <Slider
                value={[solarCapacity]}
                onValueChange={([v]) => setSolarCapacity(v)}
                min={10}
                max={maxSolarKva ? Math.max(maxSolarKva * 1.5, 500) : 500}
                step={10}
                className={solarExceedsLimit ? "[&_[role=slider]]:border-destructive [&_[role=slider]]:bg-destructive" : ""}
              />
              {maxSolarKva && (
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10 kWp</span>
                  <span className="text-amber-500">70% limit: {maxSolarKva.toFixed(0)}</span>
                  <span>{Math.round(maxSolarKva * 1.5)} kWp</span>
                </div>
              )}
            </div>
            {/* Location-based output estimate */}
            <div className="pt-2 border-t space-y-1 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Expected daily output</span>
                <span className="text-foreground">{solarProfile.reduce((a, b) => a + b, 0).toFixed(0)} kWh</span>
              </div>
              <div className="flex justify-between">
                <span>Specific yield</span>
                <span className="text-foreground">
                  {((solarProfile.reduce((a, b) => a + b, 0) * 365) / solarCapacity).toFixed(0)} kWh/kWp/yr
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Battery className="h-4 w-4" />
              Battery Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Capacity</Label>
                <span className="text-xs text-muted-foreground">{batteryCapacity} kWh</span>
              </div>
              <Slider
                value={[batteryCapacity]}
                onValueChange={([v]) => setBatteryCapacity(v)}
                min={0}
                max={200}
                step={10}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Power</Label>
                <span className="text-xs text-muted-foreground">{batteryPower} kW</span>
              </div>
              <Slider
                value={[batteryPower]}
                onValueChange={([v]) => setBatteryPower(v)}
                min={5}
                max={100}
                step={5}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">System Cost</span>
              <span className="font-medium">R{simulation.systemCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Annual Savings</span>
              <span className="font-medium text-green-600">R{Math.round(simulation.annualSavings).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payback</span>
              <span className="font-medium">{simulation.paybackYears.toFixed(1)} years</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ROI</span>
              <span className="font-medium">{simulation.roi.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily Load</CardDescription>
            <CardTitle className="text-2xl">{Math.round(simulation.totalDailyLoad)} kWh</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Solar Generated</CardDescription>
            <CardTitle className="text-2xl text-amber-500">
              {Math.round(solarProfile.reduce((a, b) => a + b, 0))} kWh
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Grid Import</CardDescription>
            <CardTitle className="text-2xl">{Math.round(simulation.totalGridImport)} kWh</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Solar Self-Use</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {Math.round((simulation.totalSolarUsed / solarProfile.reduce((a, b) => a + b, 0)) * 100)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Reduction</CardDescription>
            <CardTitle className="text-2xl">
              {Math.round(((simulation.peakDemand - simulation.newPeakDemand) / simulation.peakDemand) * 100)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="energy">
        <TabsList>
          <TabsTrigger value="energy">Energy Flow</TabsTrigger>
          <TabsTrigger value="battery">Battery State</TabsTrigger>
          <TabsTrigger value="cost">Cost Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="energy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Energy Flow</CardTitle>
              <CardDescription>Load, solar generation, and grid import by hour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simulation.hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="load" name="Load" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="solar" name="Solar" fill="hsl(142 76% 36%)" />
                    <Bar dataKey="gridImport" name="Grid Import" fill="hsl(var(--destructive))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="battery" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Battery State of Charge</CardTitle>
              <CardDescription>Battery charge level throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={simulation.hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, "SOC"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="batterySOC"
                      name="State of Charge"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Comparison</CardTitle>
              <CardDescription>Grid-only vs Solar+Battery system costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-3">Grid Only</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Daily Cost</span>
                      <span>R{simulation.gridOnlyDailyCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Cost</span>
                      <span>R{(simulation.gridOnlyDailyCost * 30).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Annual Cost</span>
                      <span>R{Math.round(simulation.gridOnlyDailyCost * 365).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <h4 className="font-medium mb-3 text-green-700">With Solar + Battery</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Daily Cost</span>
                      <span>R{simulation.solarDailyCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Cost</span>
                      <span>R{(simulation.solarDailyCost * 30).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Annual Cost</span>
                      <span>R{Math.round(simulation.solarDailyCost * 365).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-medium text-green-600 pt-2 border-t border-green-500/20">
                      <span>Annual Savings</span>
                      <span>R{Math.round(simulation.annualSavings).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
