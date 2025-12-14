import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, ComposedChart } from "recharts";
import { Sun, Battery, Zap, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Cloud, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useSolcastForecast } from "@/hooks/useSolcastForecast";
import { SavedSimulations } from "./SavedSimulations";
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
import {
  runEnergySimulation,
  calculateFinancials,
  scaleToAnnual,
  DEFAULT_SYSTEM_COSTS,
  type TariffData,
} from "./simulation";

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

// Helper component for showing differences
function DifferenceIndicator({ baseValue, compareValue, suffix = "", invert = false }: {
  baseValue: number;
  compareValue: number;
  suffix?: string;
  invert?: boolean;
}) {
  const diff = compareValue - baseValue;
  const pct = baseValue !== 0 ? (diff / baseValue) * 100 : 0;
  const isPositive = invert ? diff < 0 : diff > 0;
  
  if (Math.abs(pct) < 0.5) return null;
  
  return (
    <span className={`text-xs ml-1 ${isPositive ? "text-green-600" : "text-amber-600"}`}>
      ({pct > 0 ? "+" : ""}{pct.toFixed(1)}%{suffix})
    </span>
  );
}

export function SimulationPanel({ projectId, project, tenants, shopTypes }: SimulationPanelProps) {
  const [solarCapacity, setSolarCapacity] = useState(100);
  const [batteryCapacity, setBatteryCapacity] = useState(50);
  const [batteryPower, setBatteryPower] = useState(25);
  const [pvConfig, setPvConfig] = useState<PVSystemConfigData>(getDefaultPVConfig);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useSolcast, setUseSolcast] = useState(false);
  
  // Solcast forecast hook
  const { data: solcastData, isLoading: solcastLoading, fetchForecast } = useSolcastForecast();

  // Get location coordinates from PV config location
  const selectedLocation = SA_SOLAR_LOCATIONS[pvConfig.location];
  const hasCoordinates = selectedLocation?.lat !== undefined;
  
  // Fetch Solcast data when enabled and location is available
  useEffect(() => {
    if (useSolcast && hasCoordinates && !solcastData && !solcastLoading) {
      fetchForecast({
        latitude: selectedLocation.lat,
        longitude: SA_LOCATION_LONGITUDES[pvConfig.location] ?? 28.0,
        hours: 168,
        period: 'PT60M'
      });
    }
  }, [useSolcast, hasCoordinates, pvConfig.location]);
  
  // Process Solcast data into hourly average profile
  const solcastHourlyProfile = useMemo<HourlyIrradianceData[] | undefined>(() => {
    if (!solcastData?.hourly || solcastData.hourly.length === 0) return undefined;
    return generateAverageSolcastProfile(solcastData.hourly);
  }, [solcastData]);

  // Fetch tariff data (for financial analysis only)
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

  // Calculate load profile from tenants (kWh per hour)
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

  // Generate solar profiles - both with Solcast and without (for comparison)
  const solarProfileSolcast = useMemo(() => {
    if (!solcastHourlyProfile) return null;
    return generateSolarProfile(pvConfig, solarCapacity, solcastHourlyProfile);
  }, [pvConfig, solarCapacity, solcastHourlyProfile]);

  const solarProfileGeneric = useMemo(() => {
    return generateSolarProfile(pvConfig, solarCapacity, undefined);
  }, [pvConfig, solarCapacity]);

  // Active solar profile based on toggle
  const solarProfile = useSolcast && solarProfileSolcast ? solarProfileSolcast : solarProfileGeneric;

  // ========================================
  // PHASE 1: Energy Simulation (tariff-independent)
  // ========================================
  const energyConfig = useMemo(() => ({
    solarCapacity,
    batteryCapacity,
    batteryPower,
  }), [solarCapacity, batteryCapacity, batteryPower]);

  const energyResults = useMemo(() => 
    runEnergySimulation(loadProfile, solarProfile, energyConfig),
    [loadProfile, solarProfile, energyConfig]
  );

  const energyResultsGeneric = useMemo(() => 
    runEnergySimulation(loadProfile, solarProfileGeneric, energyConfig),
    [loadProfile, solarProfileGeneric, energyConfig]
  );

  const energyResultsSolcast = useMemo(() => 
    solarProfileSolcast ? runEnergySimulation(loadProfile, solarProfileSolcast, energyConfig) : null,
    [loadProfile, solarProfileSolcast, energyConfig]
  );

  // ========================================
  // PHASE 2: Financial Analysis (tariff-dependent)
  // ========================================
  const tariffData: TariffData = useMemo(() => ({
    fixedMonthlyCharge: Number(tariff?.fixed_monthly_charge || 0),
    demandChargePerKva: Number(tariff?.demand_charge_per_kva || 0),
    networkAccessCharge: Number(tariff?.network_access_charge || 0),
    averageRatePerKwh: tariffRates?.length
      ? tariffRates.reduce((sum, r) => sum + Number(r.rate_per_kwh), 0) / tariffRates.length
      : 2.5,
    exportRatePerKwh: 0, // No feed-in tariff by default
  }), [tariff, tariffRates]);

  const financialResults = useMemo(() => 
    calculateFinancials(energyResults, tariffData, DEFAULT_SYSTEM_COSTS, solarCapacity, batteryCapacity),
    [energyResults, tariffData, solarCapacity, batteryCapacity]
  );

  const financialResultsGeneric = useMemo(() => 
    calculateFinancials(energyResultsGeneric, tariffData, DEFAULT_SYSTEM_COSTS, solarCapacity, batteryCapacity),
    [energyResultsGeneric, tariffData, solarCapacity, batteryCapacity]
  );

  const financialResultsSolcast = useMemo(() => 
    energyResultsSolcast 
      ? calculateFinancials(energyResultsSolcast, tariffData, DEFAULT_SYSTEM_COSTS, solarCapacity, batteryCapacity)
      : null,
    [energyResultsSolcast, tariffData, solarCapacity, batteryCapacity]
  );

  // Annual scaling
  const annualEnergy = useMemo(() => scaleToAnnual(energyResults), [energyResults]);

  // Empty states
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

  // Connection size and max solar limit
  const connectionSizeKva = project.connection_size_kva ? Number(project.connection_size_kva) : null;
  const maxSolarKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const solarExceedsLimit = maxSolarKva && solarCapacity > maxSolarKva;

  const systemEfficiency = calculateSystemEfficiency(pvConfig);

  // Data source indicator
  const usingRealData = useSolcast && solcastHourlyProfile;
  const avgDailyGhi = solcastData?.summary?.average_daily_ghi_kwh_m2;

  // Check if financial analysis is available
  const hasFinancialData = !!project.tariff_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Energy Simulation</h2>
          <p className="text-sm text-muted-foreground">
            Model solar and battery energy flows • {selectedLocation.name} 
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
            {/* Energy output estimate (tariff-independent) */}
            <div className="pt-2 border-t space-y-1 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Expected daily output</span>
                <span className="text-foreground">{energyResults.totalDailySolar.toFixed(0)} kWh</span>
              </div>
              <div className="flex justify-between">
                <span>Specific yield</span>
                <span className="text-foreground">
                  {((energyResults.totalDailySolar * 365) / solarCapacity).toFixed(0)} kWh/kWp/yr
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
            {/* Battery utilization (tariff-independent) */}
            <div className="pt-2 border-t space-y-1 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Daily cycles</span>
                <span className="text-foreground">{energyResults.batteryCycles.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Energy throughput</span>
                <span className="text-foreground">{energyResults.totalBatteryDischarge.toFixed(0)} kWh</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary - only show if tariff is selected */}
        {hasFinancialData ? (
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
                <span className="font-medium">R{financialResults.systemCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annual Savings</span>
                <span className="font-medium text-green-600">R{Math.round(financialResults.annualSavings).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payback</span>
                <span className="font-medium">{financialResults.paybackYears.toFixed(1)} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ROI</span>
                <span className="font-medium">{financialResults.roi.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Financial Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Select a tariff to enable cost analysis and ROI calculations.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Energy Results Summary (always visible - tariff-independent) */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily Load</CardDescription>
            <CardTitle className="text-2xl">{Math.round(energyResults.totalDailyLoad)} kWh</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Solar Generated</CardDescription>
            <CardTitle className="text-2xl text-amber-500">
              {Math.round(energyResults.totalDailySolar)} kWh
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Grid Import</CardDescription>
            <CardTitle className="text-2xl">{Math.round(energyResults.totalGridImport)} kWh</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Self-Consumption</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {Math.round(energyResults.selfConsumptionRate)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Reduction</CardDescription>
            <CardTitle className="text-2xl">
              {Math.round(energyResults.peakReduction)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Saved Simulations */}
      <SavedSimulations
        projectId={projectId}
        currentConfig={{
          solarCapacity,
          batteryCapacity,
          batteryPower,
          pvConfig,
          usingSolcast: !!usingRealData,
        }}
        currentResults={{
          totalDailyLoad: energyResults.totalDailyLoad,
          totalDailySolar: energyResults.totalDailySolar,
          totalGridImport: energyResults.totalGridImport,
          totalSolarUsed: energyResults.totalSolarUsed,
          annualSavings: hasFinancialData ? financialResults.annualSavings : 0,
          systemCost: financialResults.systemCost,
          paybackYears: hasFinancialData ? financialResults.paybackYears : 0,
          roi: hasFinancialData ? financialResults.roi : 0,
          peakDemand: energyResults.peakLoad,
          newPeakDemand: energyResults.peakGridImport,
        }}
        onLoadSimulation={(config) => {
          setSolarCapacity(config.solarCapacity);
          setBatteryCapacity(config.batteryCapacity);
          setBatteryPower(config.batteryPower);
          if (config.pvConfig && Object.keys(config.pvConfig).length > 0) {
            setPvConfig((prev) => ({ ...prev, ...config.pvConfig }));
          }
        }}
      />

      {/* Charts */}
      <Tabs defaultValue="energy">
        <TabsList>
          <TabsTrigger value="energy">Energy Flow</TabsTrigger>
          <TabsTrigger value="battery">Battery State</TabsTrigger>
          {hasFinancialData && <TabsTrigger value="cost">Cost Comparison</TabsTrigger>}
          {energyResultsSolcast && (
            <TabsTrigger value="compare" className="gap-1">
              <Cloud className="h-3 w-3" />
              Data Comparison
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="energy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Energy Flow</CardTitle>
              <CardDescription>Load, solar generation, and grid import by hour (kWh)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={energyResults.hourlyData}>
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
                  <LineChart data={energyResults.hourlyData}>
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

        {hasFinancialData && (
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
                        <span>R{financialResults.gridOnlyDailyCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Cost</span>
                        <span>R{financialResults.gridOnlyMonthlyCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Annual Cost</span>
                        <span>R{Math.round(financialResults.gridOnlyAnnualCost).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <h4 className="font-medium mb-3 text-green-700">With Solar + Battery</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Daily Cost</span>
                        <span>R{financialResults.solarDailyCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Cost</span>
                        <span>R{financialResults.solarMonthlyCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Annual Cost</span>
                        <span>R{Math.round(financialResults.solarAnnualCost).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-medium text-green-600 pt-2 border-t border-green-500/20">
                        <span>Annual Savings</span>
                        <span>R{Math.round(financialResults.annualSavings).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Data Comparison Tab - Solcast vs Generic */}
        {energyResultsSolcast && (
          <TabsContent value="compare" className="mt-4 space-y-4">
            {/* Solar Profile Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  Solar Generation Comparison
                </CardTitle>
                <CardDescription>
                  Compare hourly solar output using Solcast real irradiance vs generic model
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={Array.from({ length: 24 }, (_, h) => ({
                        hour: `${h.toString().padStart(2, "0")}:00`,
                        generic: solarProfileGeneric[h],
                        solcast: solarProfileSolcast ? solarProfileSolcast[h] : 0,
                        difference: solarProfileSolcast ? solarProfileSolcast[h] - solarProfileGeneric[h] : 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number, name: string) => [
                          `${v.toFixed(1)} kWh`,
                          name === 'generic' ? 'Generic Model' : name === 'solcast' ? 'Solcast Forecast' : 'Difference'
                        ]}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="generic"
                        name="Generic Model"
                        fill="hsl(var(--muted))"
                        stroke="hsl(var(--muted-foreground))"
                        fillOpacity={0.3}
                      />
                      <Line
                        type="monotone"
                        dataKey="solcast"
                        name="Solcast Forecast"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Side-by-Side Energy Metrics Comparison */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Generic Model Results */}
              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sun className="h-4 w-4 text-muted-foreground" />
                    Generic Model (PVWatts-style)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Based on average historical GHI for {selectedLocation.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Daily Solar</p>
                      <p className="text-lg font-semibold">{energyResultsGeneric.totalDailySolar.toFixed(0)} kWh</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Grid Import</p>
                      <p className="text-lg font-semibold">{energyResultsGeneric.totalGridImport.toFixed(0)} kWh</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Self-Consumption</p>
                      <p className="text-lg font-semibold">{Math.round(energyResultsGeneric.selfConsumptionRate)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Peak Reduction</p>
                      <p className="text-lg font-semibold">{Math.round(energyResultsGeneric.peakReduction)}%</p>
                    </div>
                  </div>
                  {hasFinancialData && (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Annual Savings</span>
                        <span className="text-green-600">R{Math.round(financialResultsGeneric.annualSavings).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payback</span>
                        <span>{financialResultsGeneric.paybackYears.toFixed(1)} yrs</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Solcast Results */}
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-primary" />
                    Solcast Forecast
                    <Badge variant="outline" className="text-xs text-primary border-primary ml-auto">Real Data</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Based on 7-day weather forecast for actual location
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Daily Solar</p>
                      <p className="text-lg font-semibold">
                        {energyResultsSolcast.totalDailySolar.toFixed(0)} kWh
                        <DifferenceIndicator 
                          baseValue={energyResultsGeneric.totalDailySolar} 
                          compareValue={energyResultsSolcast.totalDailySolar} 
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Grid Import</p>
                      <p className="text-lg font-semibold">
                        {energyResultsSolcast.totalGridImport.toFixed(0)} kWh
                        <DifferenceIndicator 
                          baseValue={energyResultsGeneric.totalGridImport} 
                          compareValue={energyResultsSolcast.totalGridImport}
                          invert
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Self-Consumption</p>
                      <p className="text-lg font-semibold">{Math.round(energyResultsSolcast.selfConsumptionRate)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Peak Reduction</p>
                      <p className="text-lg font-semibold">{Math.round(energyResultsSolcast.peakReduction)}%</p>
                    </div>
                  </div>
                  {hasFinancialData && financialResultsSolcast && (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Annual Savings</span>
                        <span className="text-green-600">
                          R{Math.round(financialResultsSolcast.annualSavings).toLocaleString()}
                          <DifferenceIndicator 
                            baseValue={financialResultsGeneric.annualSavings} 
                            compareValue={financialResultsSolcast.annualSavings} 
                          />
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payback</span>
                        <span>
                          {financialResultsSolcast.paybackYears.toFixed(1)} yrs
                          <DifferenceIndicator 
                            baseValue={financialResultsGeneric.paybackYears} 
                            compareValue={financialResultsSolcast.paybackYears}
                            invert
                          />
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Accuracy Impact Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Accuracy Impact Summary</CardTitle>
                <CardDescription className="text-xs">
                  How real weather data affects your simulation results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Solar Output</p>
                    <p className={`text-lg font-semibold ${
                      energyResultsSolcast.totalDailySolar >= energyResultsGeneric.totalDailySolar 
                        ? "text-green-600" : "text-amber-600"
                    }`}>
                      {((energyResultsSolcast.totalDailySolar - energyResultsGeneric.totalDailySolar) / 
                        energyResultsGeneric.totalDailySolar * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Grid Import</p>
                    <p className={`text-lg font-semibold ${
                      energyResultsSolcast.totalGridImport <= energyResultsGeneric.totalGridImport 
                        ? "text-green-600" : "text-amber-600"
                    }`}>
                      {((energyResultsSolcast.totalGridImport - energyResultsGeneric.totalGridImport) / 
                        energyResultsGeneric.totalGridImport * 100).toFixed(1)}%
                    </p>
                  </div>
                  {hasFinancialData && financialResultsSolcast && (
                    <>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Savings</p>
                        <p className={`text-lg font-semibold ${
                          financialResultsSolcast.annualSavings >= financialResultsGeneric.annualSavings 
                            ? "text-green-600" : "text-amber-600"
                        }`}>
                          {((financialResultsSolcast.annualSavings - financialResultsGeneric.annualSavings) / 
                            financialResultsGeneric.annualSavings * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Payback</p>
                        <p className={`text-lg font-semibold ${
                          financialResultsSolcast.paybackYears <= financialResultsGeneric.paybackYears 
                            ? "text-green-600" : "text-amber-600"
                        }`}>
                          {((financialResultsSolcast.paybackYears - financialResultsGeneric.paybackYears) / 
                            financialResultsGeneric.paybackYears * 100).toFixed(1)}%
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
