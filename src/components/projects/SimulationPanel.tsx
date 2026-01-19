import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, ComposedChart } from "recharts";
import { Sun, Battery, Zap, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Cloud, Loader2, CheckCircle2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useSolcastForecast } from "@/hooks/useSolcastForecast";
import { ReportToggle } from "@/components/reports/ReportToggle";
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
import {
  AdvancedSimulationConfig,
  DEFAULT_ADVANCED_CONFIG,
  AdvancedFinancialResults,
} from "./simulation/AdvancedSimulationTypes";
import { AdvancedSimulationConfigPanel } from "./simulation/AdvancedSimulationConfig";
import { runAdvancedSimulation } from "./simulation/AdvancedSimulationEngine";
import { AdvancedResultsDisplay } from "./simulation/AdvancedResultsDisplay";
import { AdvancedConfigComparison } from "./simulation/AdvancedConfigComparison";
import { LoadSheddingAnalysisPanel } from "./simulation/LoadSheddingAnalysisPanel";
import { InverterSizing, InverterConfig, getDefaultInverterConfig } from "./InverterSizing";
import { SystemCostsData } from "./SystemCostsManager";

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
  systemCosts: SystemCostsData;
  onSystemCostsChange: (costs: SystemCostsData) => void;
  includesBattery?: boolean;
}

export interface SimulationPanelRef {
  autoSave: () => Promise<void>;
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

export const SimulationPanel = forwardRef<SimulationPanelRef, SimulationPanelProps>(({ projectId, project, tenants, shopTypes, systemCosts, onSystemCostsChange, includesBattery = false }, ref) => {
  const queryClient = useQueryClient();
  
  // Fetch the most recent saved simulation FIRST
  const { data: lastSavedSimulation, isLoading: isLoadingLastSaved, isFetched } = useQuery({
    queryKey: ["last-simulation", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_simulations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 0, // Always fetch fresh data
  });

  // Extract saved values or use defaults - computed once query completes
  const savedResultsJson = lastSavedSimulation?.results_json as any;
  
  const [solarCapacity, setSolarCapacity] = useState(100);
  const [batteryCapacity, setBatteryCapacity] = useState(includesBattery ? 50 : 0);
  const [batteryPower, setBatteryPower] = useState(includesBattery ? 25 : 0);
  const [pvConfig, setPvConfig] = useState<PVSystemConfigData>(getDefaultPVConfig);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useSolcast, setUseSolcast] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedSimulationConfig>(DEFAULT_ADVANCED_CONFIG);
  const [inverterConfig, setInverterConfig] = useState<InverterConfig>(getDefaultInverterConfig);
  
  // Track the loaded simulation name for UI feedback
  const [loadedSimulationName, setLoadedSimulationName] = useState<string | null>(null);
  const [loadedSimulationDate, setLoadedSimulationDate] = useState<string | null>(null);
  const hasInitializedFromSaved = useRef(false);

  // Auto-load the last saved simulation when data arrives (only once per projectId)
  useEffect(() => {
    // Reset initialization flag when projectId changes
    hasInitializedFromSaved.current = false;
  }, [projectId]);

  useEffect(() => {
    if (isFetched && lastSavedSimulation && !hasInitializedFromSaved.current) {
      hasInitializedFromSaved.current = true;
      
      console.log("Auto-loading saved simulation:", lastSavedSimulation.name, savedResultsJson);
      
      // Load configuration values
      setSolarCapacity(lastSavedSimulation.solar_capacity_kwp || 100);
      setBatteryCapacity(includesBattery ? (lastSavedSimulation.battery_capacity_kwh || 50) : 0);
      setBatteryPower(includesBattery ? (lastSavedSimulation.battery_power_kw || 25) : 0);
      
      // Load PV config if saved
      if (savedResultsJson?.pvConfig) {
        setPvConfig(savedResultsJson.pvConfig);
      }
      
      // Load inverter config if saved
      if (savedResultsJson?.inverterConfig) {
        setInverterConfig(savedResultsJson.inverterConfig);
      }
      
      // System costs are now loaded by ProjectDetail.tsx on initial load
      // to ensure consistency between Costs tab and Simulation tab
      
      // Set Solcast toggle based on saved type
      if (lastSavedSimulation.simulation_type === "solcast") {
        setUseSolcast(true);
      }
      
      // Track what we loaded for UI feedback
      setLoadedSimulationName(lastSavedSimulation.name);
      setLoadedSimulationDate(lastSavedSimulation.created_at);
    }
  }, [isFetched, lastSavedSimulation, savedResultsJson, includesBattery, onSystemCostsChange]);

  // Solcast forecast hook
  const { data: solcastData, isLoading: solcastLoading, error: solcastError, fetchForecast } = useSolcastForecast();

  // Get location coordinates from PV config location
  const selectedLocation = SA_SOLAR_LOCATIONS[pvConfig.location];
  const hasCoordinates = selectedLocation?.lat !== undefined;

  // Fetch Solcast data when enabled and location is available
  // Don't retry if there was an error (e.g., quota exceeded)
  useEffect(() => {
    if (useSolcast && hasCoordinates && !solcastData && !solcastLoading && !solcastError) {
      fetchForecast({
        latitude: selectedLocation.lat,
        longitude: SA_LOCATION_LONGITUDES[pvConfig.location] ?? 28.0,
        hours: 168,
        period: 'PT60M'
      });
    }
  }, [useSolcast, hasCoordinates, pvConfig.location, solcastError]);

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
    calculateFinancials(energyResults, tariffData, systemCosts, solarCapacity, batteryCapacity),
    [energyResults, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  const financialResultsGeneric = useMemo(() =>
    calculateFinancials(energyResultsGeneric, tariffData, systemCosts, solarCapacity, batteryCapacity),
    [energyResultsGeneric, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  const financialResultsSolcast = useMemo(() =>
    energyResultsSolcast
      ? calculateFinancials(energyResultsSolcast, tariffData, systemCosts, solarCapacity, batteryCapacity)
      : null,
    [energyResultsSolcast, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  // Annual scaling
  const annualEnergy = useMemo(() => scaleToAnnual(energyResults), [energyResults]);

  // Check if financial analysis is available (moved up for use in advanced simulation)
  const hasFinancialData = !!project.tariff_id;

  // Check if any advanced features are enabled
  const isAdvancedEnabled =
    advancedConfig.seasonal.enabled ||
    advancedConfig.degradation.enabled ||
    advancedConfig.financial.enabled ||
    advancedConfig.gridConstraints.enabled ||
    advancedConfig.loadGrowth.enabled;

  // Run advanced simulation when enabled
  const advancedResults = useMemo<AdvancedFinancialResults | null>(() => {
    if (!isAdvancedEnabled || !hasFinancialData) return null;

    return runAdvancedSimulation(
      energyResults,
      tariffData,
      systemCosts,
      solarCapacity,
      batteryCapacity,
      advancedConfig
    );
  }, [isAdvancedEnabled, hasFinancialData, energyResults, tariffData, solarCapacity, batteryCapacity, advancedConfig]);

  // Auto-save mutation - upserts simulation on tab change
  const autoSaveMutation = useMutation({
    mutationFn: async () => {
      const simulationName = `Auto-saved ${format(new Date(), "MMM d, HH:mm")}`;
      
      // Check if we have an existing simulation to update
      const existingId = lastSavedSimulation?.id;
      
      const simulationData = {
        project_id: projectId,
        name: existingId ? lastSavedSimulation.name : simulationName,
        simulation_type: useSolcast ? "solcast" : "generic",
        solar_capacity_kwp: solarCapacity,
        battery_capacity_kwh: includesBattery ? batteryCapacity : 0,
        battery_power_kw: includesBattery ? batteryPower : 0,
        solar_orientation: pvConfig.location,
        solar_tilt_degrees: pvConfig.tilt,
        annual_solar_savings: hasFinancialData ? financialResults.annualSavings : 0,
        annual_grid_cost: energyResults.totalGridImport * 2.5 * 365,
        payback_years: hasFinancialData ? financialResults.paybackYears : 0,
        roi_percentage: hasFinancialData ? financialResults.roi : 0,
        results_json: JSON.parse(JSON.stringify({
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
          pvConfig,
          usingSolcast: !!useSolcast,
          inverterConfig,
          systemCosts,
        })),
      };

      if (existingId) {
        // Update existing simulation
        const { error } = await supabase
          .from("project_simulations")
          .update(simulationData)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        // Insert new simulation
        const { error } = await supabase
          .from("project_simulations")
          .insert(simulationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-simulations", projectId] });
      queryClient.invalidateQueries({ queryKey: ["last-simulation", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-latest-simulation", projectId] });
    },
  });

  // Expose autoSave method to parent
  useImperativeHandle(ref, () => ({
    autoSave: async () => {
      // Only auto-save if we have tenants (valid simulation)
      if (tenants.length > 0) {
        await autoSaveMutation.mutateAsync();
      }
    }
  }), [autoSaveMutation, tenants.length]);

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

      {/* Loaded Simulation Indicator */}
      {isLoadingLastSaved ? (
        <Card className="border-muted bg-muted/30">
          <CardContent className="py-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading last saved simulation...
            </p>
          </CardContent>
        </Card>
      ) : loadedSimulationName ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <p className="text-sm">
              <span className="text-muted-foreground">Loaded: </span>
              <span className="font-medium">{loadedSimulationName}</span>
              {loadedSimulationDate && (
                <span className="text-muted-foreground ml-2">
                  • {format(new Date(loadedSimulationDate), "dd MMM yyyy HH:mm")}
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      ) : null}

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

      {/* Advanced Simulation Configuration */}
      <AdvancedSimulationConfigPanel
        config={advancedConfig}
        onChange={setAdvancedConfig}
      />

      {/* Scenario Comparison */}
      {hasFinancialData && isAdvancedEnabled && (
        <AdvancedConfigComparison
          currentConfig={advancedConfig}
          energyResults={energyResults}
          tariffData={tariffData}
          systemCosts={systemCosts}
          solarCapacity={solarCapacity}
          batteryCapacity={batteryCapacity}
          onApplyConfig={setAdvancedConfig}
        />
      )}

      {/* System Costs Configuration */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              System Costs Configuration
              <span className="text-xs text-muted-foreground ml-2">
                R{systemCosts.solarCostPerKwp.toLocaleString()}/kWp • R{systemCosts.batteryCostPerKwh.toLocaleString()}/kWh
              </span>
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Cost Assumptions for Payback Calculation</CardTitle>
              <CardDescription className="text-xs">
                Enter your actual system costs to get accurate payback and ROI figures
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-xs">Solar Cost (R/kWp)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">R</span>
                  <input
                    type="number"
                    value={systemCosts.solarCostPerKwp}
                    onChange={(e) => onSystemCostsChange({ ...systemCosts, solarCostPerKwp: Number(e.target.value) || 0 })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    min={0}
                    step={100}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Default: R{DEFAULT_SYSTEM_COSTS.solarCostPerKwp.toLocaleString()}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Battery Cost (R/kWh)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">R</span>
                  <input
                    type="number"
                    value={systemCosts.batteryCostPerKwh}
                    onChange={(e) => onSystemCostsChange({ ...systemCosts, batteryCostPerKwh: Number(e.target.value) || 0 })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    min={0}
                    step={100}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Default: R{DEFAULT_SYSTEM_COSTS.batteryCostPerKwh.toLocaleString()}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Installation Cost (R)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">R</span>
                  <input
                    type="number"
                    value={systemCosts.installationCost}
                    onChange={(e) => onSystemCostsChange({ ...systemCosts, installationCost: Number(e.target.value) || 0 })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    min={0}
                    step={1000}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Fixed installation cost
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Annual Maintenance (R/year)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">R</span>
                  <input
                    type="number"
                    value={systemCosts.maintenancePerYear}
                    onChange={(e) => onSystemCostsChange({ ...systemCosts, maintenancePerYear: Number(e.target.value) || 0 })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    min={0}
                    step={500}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Annual O&M costs
                </p>
              </div>
            </CardContent>
            <CardContent className="pt-0 pb-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total System Cost: </span>
                  <span className="font-semibold">
                    R{((solarCapacity * systemCosts.solarCostPerKwp) + (batteryCapacity * systemCosts.batteryCostPerKwh) + systemCosts.installationCost).toLocaleString()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSystemCostsChange({
                    solarCostPerKwp: DEFAULT_SYSTEM_COSTS.solarCostPerKwp,
                    batteryCostPerKwh: DEFAULT_SYSTEM_COSTS.batteryCostPerKwh,
                    installationCost: DEFAULT_SYSTEM_COSTS.installationCost ?? 0,
                    maintenancePerYear: DEFAULT_SYSTEM_COSTS.maintenancePerYear ?? 0,
                  })}
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
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

        {/* Inverter-Based Sizing */}
        <InverterSizing
          config={inverterConfig}
          onChange={setInverterConfig}
          currentSolarCapacity={solarCapacity}
          onSolarCapacityChange={setSolarCapacity}
          maxSolarKva={maxSolarKva}
        />

        {includesBattery && (
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
        )}

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
            <CardDescription>Annual Production</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {Math.round(energyResults.totalDailySolar * 365).toLocaleString()} kWh
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
          batteryCapacity: includesBattery ? batteryCapacity : 0,
          batteryPower: includesBattery ? batteryPower : 0,
          pvConfig,
          usingSolcast: !!usingRealData,
          inverterConfig,
          systemCosts,
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
          if (includesBattery) {
            setBatteryCapacity(config.batteryCapacity);
            setBatteryPower(config.batteryPower);
          }
          if (config.pvConfig && Object.keys(config.pvConfig).length > 0) {
            setPvConfig((prev) => ({ ...prev, ...config.pvConfig }));
          }
          // Load inverter config if present
          if (config.inverterConfig) {
            setInverterConfig(config.inverterConfig);
          }
          // Load system costs if present
          if (config.systemCosts) {
            onSystemCostsChange(config.systemCosts);
          }
          // Track which simulation was loaded for UI feedback
          setLoadedSimulationName(config.simulationName);
          setLoadedSimulationDate(config.simulationDate);
        }}
        includesBattery={includesBattery}
      />

      {/* Advanced Results Display */}
      {advancedResults && (
        <AdvancedResultsDisplay results={advancedResults} />
      )}

      {/* Charts */}
      <Tabs defaultValue="energy">
        <TabsList>
          <TabsTrigger value="energy">Energy Flow</TabsTrigger>
          <TabsTrigger value="battery">Battery State</TabsTrigger>
          {hasFinancialData && <TabsTrigger value="cost">Cost Comparison</TabsTrigger>}
          <TabsTrigger value="loadshed" className="gap-1">
            <Zap className="h-3 w-3" />
            Load Shedding
          </TabsTrigger>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Hourly Energy Flow</CardTitle>
                  <CardDescription>Load, solar generation, and grid import by hour (kWh)</CardDescription>
                </div>
                <ReportToggle
                  id="energy-flow-chart"
                  segmentType="energy_flow"
                  label="Energy Flow Chart"
                />
              </div>
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

        {/* Load Shedding Scenarios Tab */}
        <TabsContent value="loadshed" className="mt-4">
          <LoadSheddingAnalysisPanel
            loadProfile={loadProfile}
            solarProfile={solarProfile}
            config={energyConfig}
            tariffRate={tariffData.averageRatePerKwh}
          />
        </TabsContent>

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
                    <p className={`text-lg font-semibold ${energyResultsSolcast.totalDailySolar >= energyResultsGeneric.totalDailySolar
                        ? "text-green-600" : "text-amber-600"
                      }`}>
                      {((energyResultsSolcast.totalDailySolar - energyResultsGeneric.totalDailySolar) /
                        energyResultsGeneric.totalDailySolar * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Grid Import</p>
                    <p className={`text-lg font-semibold ${energyResultsSolcast.totalGridImport <= energyResultsGeneric.totalGridImport
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
                        <p className={`text-lg font-semibold ${financialResultsSolcast.annualSavings >= financialResultsGeneric.annualSavings
                            ? "text-green-600" : "text-amber-600"
                          }`}>
                          {((financialResultsSolcast.annualSavings - financialResultsGeneric.annualSavings) /
                            financialResultsGeneric.annualSavings * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Payback</p>
                        <p className={`text-lg font-semibold ${financialResultsSolcast.paybackYears <= financialResultsGeneric.paybackYears
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
});
