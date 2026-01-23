import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPaybackPeriod } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, ComposedChart } from "recharts";
import { Sun, Battery, Zap, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Cloud, Loader2, CheckCircle2, Database, Activity, RefreshCw, Calculator, Clock, Info, Save } from "lucide-react";
import { LoadChart } from "./load-profile/charts/LoadChart";
import { SolarChart } from "./load-profile/charts/SolarChart";
import { GridFlowChart } from "./load-profile/charts/GridFlowChart";
import { BatteryChart } from "./load-profile/charts/BatteryChart";
import { TOULegend } from "./load-profile/components/TOULegend";
import { ChartDataPoint } from "./load-profile/types";
import { FinancialMetricRow } from "./simulation/FinancialMetricRow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ANNUAL_HOURS_24H, ANNUAL_HOURS_SOLAR } from "@/lib/tariffCalculations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { useSolcastForecast } from "@/hooks/useSolcastForecast";
import { usePVGISProfile, PVGISTMYResponse, PVGISMonthlyResponse } from "@/hooks/usePVGISProfile";
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
import { InverterSizeModuleConfig } from "./InverterSizeModuleConfig";
import { InverterSliderPanel } from "./InverterSliderPanel";
import { getModulePresetById, getDefaultModulePreset, calculateModuleMetrics } from "./SolarModulePresets";
import { SystemCostsData } from "./SystemCostsManager";
import { calculateAnnualBlendedRates } from "@/lib/tariffCalculations";
import { type BlendedRateType } from "./TariffSelector";
import { 
  type LossCalculationMode, 
  type PVsystLossChainConfig, 
  type AnnualPVsystResult,
  DEFAULT_PVSYST_CONFIG,
  calculateHourlyPVsystOutput,
  calculatePVsystLossChain,
  calculateAnnualPVsystOutput
} from "@/lib/pvsystLossChain";
import { PVsystLossChainConfig as PVsystLossChainConfigPanel } from "./PVsystLossChainConfig";

// Solar data source type
type SolarDataSource = "solcast" | "pvgis_monthly" | "pvgis_tmy";

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
  blendedRateType?: BlendedRateType;
  onBlendedRateTypeChange?: (type: BlendedRateType) => void;
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

export const SimulationPanel = forwardRef<SimulationPanelRef, SimulationPanelProps>(({ projectId, project, tenants, shopTypes, systemCosts, onSystemCostsChange, includesBattery = false, blendedRateType = 'solarHours', onBlendedRateTypeChange }, ref) => {
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
  const [solarDataSource, setSolarDataSource] = useState<SolarDataSource>("pvgis_monthly");
  const [lossCalculationMode, setLossCalculationMode] = useState<LossCalculationMode>("simplified");
  const [pvsystConfig, setPvsystConfig] = useState<PVsystLossChainConfig>(DEFAULT_PVSYST_CONFIG);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedSimulationConfig>(DEFAULT_ADVANCED_CONFIG);
  const [inverterConfig, setInverterConfig] = useState<InverterConfig>(getDefaultInverterConfig);
  
  // Override states for editable energy output metrics
  const [dailyOutputOverride, setDailyOutputOverride] = useState<number | null>(null);
  const [specificYieldOverride, setSpecificYieldOverride] = useState<number | null>(null);
  
  // Production reduction percentage (conservative safety margin)
  const [productionReductionPercent, setProductionReductionPercent] = useState(15);
  
  // Track the loaded simulation name for UI feedback
  const [loadedSimulationName, setLoadedSimulationName] = useState<string | null>(null);
  const [loadedSimulationDate, setLoadedSimulationDate] = useState<string | null>(null);
  const hasInitializedFromSaved = useRef(false);
  
  // Auto-save tracking
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialLoadComplete = useRef(false);
  const AUTOSAVE_DEBOUNCE_MS = 1500;

  // TOU toggle state for charts (with localStorage persistence)
  const [showTOU, setShowTOU] = useState(() => {
    const saved = localStorage.getItem('simulation_showTOU');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('simulation_showTOU', String(showTOU));
  }, [showTOU]);

  // Auto-load the last saved simulation when data arrives (only once per projectId)
  useEffect(() => {
    // Reset initialization flag when projectId changes
    hasInitializedFromSaved.current = false;
    hasInitialLoadComplete.current = false;
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
      
      // Load inverter config if saved - merge with defaults to preserve new fields
      if (savedResultsJson?.inverterConfig) {
        setInverterConfig({
          ...getDefaultInverterConfig(),
          ...savedResultsJson.inverterConfig,
        });
      }
      
      // Load PVsyst config if saved - merge with defaults to preserve new fields like lossesAfterInverter
      if (savedResultsJson?.pvsystConfig) {
        setPvsystConfig({
          ...DEFAULT_PVSYST_CONFIG,
          ...savedResultsJson.pvsystConfig,
          irradiance: {
            ...DEFAULT_PVSYST_CONFIG.irradiance,
            ...savedResultsJson.pvsystConfig?.irradiance,
          },
          array: {
            ...DEFAULT_PVSYST_CONFIG.array,
            ...savedResultsJson.pvsystConfig?.array,
          },
          system: {
            ...DEFAULT_PVSYST_CONFIG.system,
            inverter: {
              ...DEFAULT_PVSYST_CONFIG.system.inverter,
              ...savedResultsJson.pvsystConfig?.system?.inverter,
            },
          },
          lossesAfterInverter: {
            ...DEFAULT_PVSYST_CONFIG.lossesAfterInverter,
            ...savedResultsJson.pvsystConfig?.lossesAfterInverter,
          },
        });
      }
      
      // System costs are now loaded by ProjectDetail.tsx on initial load
      // to ensure consistency between Costs tab and Simulation tab
      
      // Set solar data source based on saved type
      const savedType = lastSavedSimulation.simulation_type;
      if (savedType === "solcast" || savedType === "pvgis_monthly" || savedType === "pvgis_tmy") {
        setSolarDataSource(savedType);
      } else if (savedType === "generic") {
        setSolarDataSource("pvgis_monthly"); // Default to PVGIS monthly for legacy "generic" saves
      }
      
      // Load production reduction if saved
      if (savedResultsJson?.productionReductionPercent !== undefined) {
        setProductionReductionPercent(savedResultsJson.productionReductionPercent);
      }
      
      // Load loss calculation mode if saved
      if (savedResultsJson?.lossCalculationMode) {
        setLossCalculationMode(savedResultsJson.lossCalculationMode);
      }
      
      // Load advanced config if saved - deep merge with defaults to preserve new fields
      if (savedResultsJson?.advancedConfig) {
        setAdvancedConfig({
          ...DEFAULT_ADVANCED_CONFIG,
          ...savedResultsJson.advancedConfig,
          seasonal: {
            ...DEFAULT_ADVANCED_CONFIG.seasonal,
            ...savedResultsJson.advancedConfig?.seasonal,
          },
          degradation: {
            ...DEFAULT_ADVANCED_CONFIG.degradation,
            ...savedResultsJson.advancedConfig?.degradation,
          },
          financial: {
            ...DEFAULT_ADVANCED_CONFIG.financial,
            ...savedResultsJson.advancedConfig?.financial,
          },
          gridConstraints: {
            ...DEFAULT_ADVANCED_CONFIG.gridConstraints,
            ...savedResultsJson.advancedConfig?.gridConstraints,
          },
          loadGrowth: {
            ...DEFAULT_ADVANCED_CONFIG.loadGrowth,
            ...savedResultsJson.advancedConfig?.loadGrowth,
          },
        });
      }
      
      // Track what we loaded for UI feedback
      setLoadedSimulationName(lastSavedSimulation.name);
      setLoadedSimulationDate(lastSavedSimulation.created_at);
    }
  }, [isFetched, lastSavedSimulation, savedResultsJson, includesBattery, onSystemCostsChange]);

  // Sync solarCapacity slider with inverter-based AC capacity
  useEffect(() => {
    const acCapacity = inverterConfig.inverterSize * inverterConfig.inverterCount;
    if (acCapacity !== solarCapacity) {
      setSolarCapacity(acCapacity);
    }
  }, [inverterConfig.inverterSize, inverterConfig.inverterCount]);

  // Sync CPI from systemCosts to advancedConfig for O&M escalation
  useEffect(() => {
    if (systemCosts.cpi !== advancedConfig.financial.inflationRate) {
      setAdvancedConfig(prev => ({
        ...prev,
        financial: {
          ...prev.financial,
          inflationRate: systemCosts.cpi ?? 6.0,
        }
      }));
    }
  }, [systemCosts.cpi]);

  // Solcast forecast hook
  const { data: solcastData, isLoading: solcastLoading, error: solcastError, fetchForecast } = useSolcastForecast();
  
  // PVGIS data hook
  const {
    tmyData: pvgisTmyData,
    monthlyData: pvgisMonthlyData,
    isLoadingTMY: pvgisLoadingTMY,
    isLoadingMonthly: pvgisLoadingMonthly,
    fetchTMY,
    fetchMonthlyRadiation,
  } = usePVGISProfile();

  // Get location coordinates from PV config location or project
  const selectedLocation = SA_SOLAR_LOCATIONS[pvConfig.location];
  const hasCoordinates = selectedLocation?.lat !== undefined || (project?.latitude && project?.longitude);
  const effectiveLat = project?.latitude ?? selectedLocation?.lat;
  const effectiveLng = project?.longitude ?? SA_LOCATION_LONGITUDES[pvConfig.location] ?? 28.0;

  // Fetch Solcast data when selected and location is available
  useEffect(() => {
    if (solarDataSource === "solcast" && hasCoordinates && !solcastData && !solcastLoading && !solcastError) {
      fetchForecast({
        latitude: effectiveLat,
        longitude: effectiveLng,
        hours: 168,
        period: 'PT60M'
      });
    }
  }, [solarDataSource, hasCoordinates, effectiveLat, effectiveLng, solcastError]);

  // Fetch PVGIS TMY data when selected
  useEffect(() => {
    if (solarDataSource === "pvgis_tmy" && hasCoordinates && !pvgisTmyData && !pvgisLoadingTMY) {
      fetchTMY({ latitude: effectiveLat, longitude: effectiveLng, projectId });
    }
  }, [solarDataSource, hasCoordinates, effectiveLat, effectiveLng, pvgisTmyData, pvgisLoadingTMY, projectId]);

  // Fetch PVGIS Monthly data when selected
  useEffect(() => {
    if (solarDataSource === "pvgis_monthly" && hasCoordinates && !pvgisMonthlyData && !pvgisLoadingMonthly) {
      fetchMonthlyRadiation({ latitude: effectiveLat, longitude: effectiveLng, projectId });
    }
  }, [solarDataSource, hasCoordinates, effectiveLat, effectiveLng, pvgisMonthlyData, pvgisLoadingMonthly, projectId]);

  // Process Solcast data into hourly average profile
  const solcastHourlyProfile = useMemo<HourlyIrradianceData[] | undefined>(() => {
    if (!solcastData?.hourly || solcastData.hourly.length === 0) return undefined;
    return generateAverageSolcastProfile(solcastData.hourly);
  }, [solcastData]);

  // Generate PVGIS hourly profiles from TMY/Monthly data
  const pvgisHourlyProfile = useMemo<HourlyIrradianceData[] | undefined>(() => {
    const activeData = solarDataSource === "pvgis_tmy" ? pvgisTmyData : pvgisMonthlyData;
    if (!activeData?.typicalDay?.hourlyGhi) return undefined;
    
    // Convert PVGIS typicalDay to HourlyIrradianceData format
    return activeData.typicalDay.hourlyGhi.map((ghi, hour) => ({
      hour,
      ghi,
      dni: activeData.typicalDay.hourlyDni?.[hour] ?? 0,
      dhi: activeData.typicalDay.hourlyDhi?.[hour] ?? 0,
      temp: activeData.typicalDay.hourlyTemp?.[hour] ?? 25,
    }));
  }, [solarDataSource, pvgisTmyData, pvgisMonthlyData]);

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

  // Calculate module metrics for PVsyst calculations (needed before solar profile generation)
  const moduleMetrics = useMemo(() => {
    const selectedModule = inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule
      ? inverterConfig.customModule
      : getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
    
    const currentAcCapacity = inverterConfig.inverterSize * inverterConfig.inverterCount;
    const metrics = {
      ...calculateModuleMetrics(currentAcCapacity, inverterConfig.dcAcRatio, selectedModule),
      moduleName: selectedModule.name,
    };
    
    // Debug logging for module metrics
    console.log("=== Module Metrics ===");
    console.log("Selected Module:", selectedModule.name, selectedModule.power_wp + "W");
    console.log("Module Dimensions:", selectedModule.width_m, "x", selectedModule.length_m, "m");
    console.log("Module Count:", metrics.moduleCount);
    console.log("Collector Area (m²):", metrics.collectorAreaM2.toFixed(2));
    console.log("STC Efficiency:", metrics.stcEfficiency);
    
    return metrics;
  }, [inverterConfig]);

  // Calculate 3-Year O&M with CPI escalation for financial metrics
  const threeYearOM = useMemo(() => {
    const cpi = systemCosts.cpi ?? 6.0;
    const solarCost = solarCapacity * (systemCosts.solarCostPerKwp ?? 8500);
    const batteryCost = batteryCapacity * (systemCosts.batteryCostPerKwh ?? 3500);
    const solarMaintenance = solarCost * ((systemCosts.solarMaintenancePercentage ?? 3.5) / 100);
    const batteryMaintenance = includesBattery 
      ? batteryCost * ((systemCosts.batteryMaintenancePercentage ?? 1.5) / 100) 
      : 0;
    
    // Year 1 + Year 2 (with CPI) + Year 3 (with 2 years CPI compounded)
    const cpiMultiplier = 1 + Math.pow(1 + cpi / 100, 1) + Math.pow(1 + cpi / 100, 2);
    const threeYearTotal = (solarMaintenance + batteryMaintenance) * cpiMultiplier;
    
    return threeYearTotal;
  }, [systemCosts, solarCapacity, batteryCapacity, includesBattery]);

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

  // Production reduction factor for conservative estimates
  const reductionFactor = 1 - (productionReductionPercent / 100);

  // Generate solar profiles - both with real data and generic (for comparison)
  // Simplified mode uses the existing PVWatts-style calculation, with reduction applied
  const solarProfileSolcastSimplified = useMemo(() => {
    if (!solcastHourlyProfile) return null;
    const baseProfile = generateSolarProfile(pvConfig, solarCapacity, solcastHourlyProfile);
    return baseProfile.map(v => v * reductionFactor);
  }, [pvConfig, solarCapacity, solcastHourlyProfile, reductionFactor]);

  const solarProfilePVGISSimplified = useMemo(() => {
    if (!pvgisHourlyProfile) return null;
    const baseProfile = generateSolarProfile(pvConfig, solarCapacity, pvgisHourlyProfile);
    return baseProfile.map(v => v * reductionFactor);
  }, [pvConfig, solarCapacity, pvgisHourlyProfile, reductionFactor]);

  const solarProfileGenericSimplified = useMemo(() => {
    const baseProfile = generateSolarProfile(pvConfig, solarCapacity, undefined);
    return baseProfile.map(v => v * reductionFactor);
  }, [pvConfig, solarCapacity, reductionFactor]);

  // Calculate annual GHI from PVGIS monthly data (for annual PVsyst calculation)
  const annualGHI = useMemo(() => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    if (solarDataSource === "pvgis_monthly" && pvgisMonthlyData?.monthly) {
      // Sum up (avgDailyGhi * daysInMonth) for each month
      return pvgisMonthlyData.monthly.reduce((sum, m) => {
        const days = daysInMonth[m.month - 1] || 30;
        return sum + (m.avgDailyGhi * days);
      }, 0);
    }
    
    if (solarDataSource === "pvgis_tmy" && pvgisTmyData?.summary?.annualGhiKwh) {
      return pvgisTmyData.summary.annualGhiKwh;
    }
    
    // Fallback to daily GHI × 365
    if (pvgisHourlyProfile) {
      const dailySum = pvgisHourlyProfile.reduce((sum, h) => sum + h.ghi / 1000, 0); // Convert W/m² to kWh/m²
      return dailySum * 365;
    }
    
    // Use location default
    return selectedLocation.ghi * 365;
  }, [solarDataSource, pvgisMonthlyData, pvgisTmyData, pvgisHourlyProfile, selectedLocation.ghi]);

  // PVsyst ANNUAL calculation result (matching Excel methodology)
  const annualPVsystResult = useMemo<AnnualPVsystResult | null>(() => {
    if (lossCalculationMode !== "pvsyst") {
      return null;
    }
    
    // DC capacity for specific yield calculation
    const dcCapacityKwp = inverterConfig.inverterSize * inverterConfig.inverterCount * inverterConfig.dcAcRatio;
    
    // Create config with actual module-derived values - explicitly include lossesAfterInverter
    const configWithModuleData: PVsystLossChainConfig = {
      ...pvsystConfig,
      stcEfficiency: moduleMetrics.stcEfficiency,
      collectorAreaM2: moduleMetrics.collectorAreaM2,
      lossesAfterInverter: {
        ...DEFAULT_PVSYST_CONFIG.lossesAfterInverter,
        ...pvsystConfig.lossesAfterInverter,
      },
    };
    
    console.log('=== Config Verification ===');
    console.log('pvsystConfig.lossesAfterInverter:', pvsystConfig.lossesAfterInverter);
    console.log('configWithModuleData.lossesAfterInverter:', configWithModuleData.lossesAfterInverter);
    
    // Calculate annual output using Excel methodology
    const result = calculateAnnualPVsystOutput(
      annualGHI,
      moduleMetrics.collectorAreaM2,
      moduleMetrics.stcEfficiency,
      dcCapacityKwp,
      configWithModuleData,
      true  // Enable debug logging
    );
    
    console.log('=== Annual PVsyst Result ===');
    console.log('E_Grid:', result.eGrid.toFixed(0), 'kWh/year');
    console.log('Specific Yield:', result.specificYield.toFixed(0), 'kWh/kWp/year');
    
    return result;
  }, [lossCalculationMode, annualGHI, moduleMetrics, pvsystConfig, inverterConfig]);

  // PVsyst HOURLY calculation for daily profile chart (derived from annual proportionally)
  const solarProfilePVsyst = useMemo(() => {
    // Get hourly GHI profile for daily shape
    const activeProfile = solarDataSource === "solcast" 
      ? solcastHourlyProfile 
      : pvgisHourlyProfile;
    
    if (lossCalculationMode !== "pvsyst" || !activeProfile || !annualPVsystResult) {
      return null;
    }
    
    // Calculate daily E_Grid from annual result
    const dailyEGrid = annualPVsystResult.eGrid / 365;
    
    // Get the hourly GHI shape (normalized to total = 1)
    const hourlyGhi = activeProfile.map(h => h.ghi);
    const totalDailyGhi = hourlyGhi.reduce((a, b) => a + b, 0);
    
    if (totalDailyGhi <= 0) {
      return Array(24).fill(0);
    }
    
    // Distribute daily E_Grid according to hourly GHI shape, with reduction applied
    const hourlyProfile = hourlyGhi.map(ghi => (ghi / totalDailyGhi) * dailyEGrid * reductionFactor);
    
    return hourlyProfile;
  }, [lossCalculationMode, solarDataSource, solcastHourlyProfile, pvgisHourlyProfile, annualPVsystResult, reductionFactor]);

  // Active solar profile based on data source and loss calculation mode
  const solarProfile = useMemo(() => {
    // If PVsyst mode and we have a valid profile, use it
    if (lossCalculationMode === "pvsyst" && solarProfilePVsyst) {
      return solarProfilePVsyst;
    }
    
    // Otherwise use simplified mode
    switch (solarDataSource) {
      case "solcast":
        return solarProfileSolcastSimplified ?? solarProfileGenericSimplified;
      case "pvgis_monthly":
      case "pvgis_tmy":
        return solarProfilePVGISSimplified ?? solarProfileGenericSimplified;
      default:
        return solarProfileGenericSimplified;
    }
  }, [lossCalculationMode, solarDataSource, solarProfilePVsyst, solarProfileSolcastSimplified, solarProfilePVGISSimplified, solarProfileGenericSimplified]);

  // For comparison charts, use simplified versions
  const solarProfileSolcast = solarProfileSolcastSimplified;
  const solarProfileGeneric = solarProfileGenericSimplified;

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
  // Calculate blended rates using the new accurate methodology with all unbundled charges
  const annualBlendedRates = useMemo(() => 
    calculateAnnualBlendedRates(tariffRates, { legacy_charge_per_kwh: tariff?.legacy_charge_per_kwh }),
    [tariffRates, tariff?.legacy_charge_per_kwh]
  );
  
  // Use the selected blended rate type (from Tariff tab or default to solarHours)
  const selectedBlendedRate = useMemo(() => {
    if (!annualBlendedRates) return 2.5; // Fallback default
    return blendedRateType === 'allHours' 
      ? annualBlendedRates.allHours.annual 
      : annualBlendedRates.solarHours.annual;
  }, [annualBlendedRates, blendedRateType]);
  
  const tariffData: TariffData = useMemo(() => ({
    fixedMonthlyCharge: Number(tariff?.fixed_monthly_charge || 0),
    demandChargePerKva: Number(tariff?.demand_charge_per_kva || 0),
    networkAccessCharge: Number(tariff?.network_access_charge || 0),
    // Use the selected blended rate (includes all unbundled charges)
    averageRatePerKwh: selectedBlendedRate,
    exportRatePerKwh: 0, // No feed-in tariff by default
  }), [tariff, selectedBlendedRate]);

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

  // Calculate basic financial metrics (NPV, IRR, LCOE) using systemCosts parameters
  const basicFinancialMetrics = useMemo(() => {
    // Use financial parameters from systemCosts
    const projectLifeYears = systemCosts.projectDurationYears ?? 20;
    const discountRate = (systemCosts.lcoeDiscountRate ?? 9) / 100; // Convert from % to decimal
    const financeRate = (systemCosts.mirrFinanceRate ?? 9) / 100;
    const reinvestmentRate = (systemCosts.mirrReinvestmentRate ?? 10) / 100;
    const annualSavings = financialResults.annualSavings;
    const systemCost = financialResults.systemCost;
    const annualGeneration = energyResults.totalDailySolar * 365;
    
    // Build cash flows: Year 0 is negative (investment), Years 1-n are savings
    const cashFlows = [-systemCost];
    for (let y = 1; y <= projectLifeYears; y++) {
      cashFlows.push(annualSavings);
    }
    
    // NPV calculation using lcoeDiscountRate
    let npv = -systemCost;
    for (let y = 1; y <= projectLifeYears; y++) {
      npv += annualSavings / Math.pow(1 + discountRate, y);
    }
    
    // IRR calculation (Newton-Raphson approximation)
    let irr = 0.1; // Start guess
    for (let iter = 0; iter < 50; iter++) {
      let npvAtRate = -systemCost;
      let derivativeNpv = 0;
      for (let y = 1; y <= projectLifeYears; y++) {
        const discountFactor = Math.pow(1 + irr, y);
        npvAtRate += annualSavings / discountFactor;
        derivativeNpv -= y * annualSavings / Math.pow(1 + irr, y + 1);
      }
      if (Math.abs(derivativeNpv) < 1e-10) break;
      const newIrr = irr - npvAtRate / derivativeNpv;
      if (Math.abs(newIrr - irr) < 1e-6) break;
      irr = newIrr;
    }
    
    // MIRR calculation using mirrFinanceRate and mirrReinvestmentRate
    // Future value of positive cash flows at reinvestment rate
    let fvPositive = 0;
    for (let y = 1; y <= projectLifeYears; y++) {
      fvPositive += annualSavings * Math.pow(1 + reinvestmentRate, projectLifeYears - y);
    }
    // Present value of negative cash flows at finance rate (just the initial investment)
    const pvNegative = systemCost; // Already discounted at t=0
    const mirr = pvNegative > 0 ? Math.pow(fvPositive / pvNegative, 1 / projectLifeYears) - 1 : 0;
    
    // LCOE calculation (simplified: system cost / lifetime generation)
    const lifetimeGeneration = annualGeneration * projectLifeYears * 0.9; // ~10% average degradation
    const lcoe = lifetimeGeneration > 0 ? systemCost / lifetimeGeneration : 0;
    
    return {
      npv,
      irr: irr * 100, // Convert to percentage
      mirr: mirr * 100,
      lcoe,
      projectLifeYears,
      discountRate: discountRate * 100, // Convert back to percentage for display
    };
  }, [financialResults, energyResults, systemCosts]);

  // Annual scaling
  const annualEnergy = useMemo(() => scaleToAnnual(energyResults), [energyResults]);

  // Transform energyResults.hourlyData to ChartDataPoint format for LoadProfile charts
  const simulationChartData = useMemo<ChartDataPoint[]>(() => {
    if (!energyResults?.hourlyData) return [];
    
    const dcAcRatio = inverterConfig.dcAcRatio;
    
    return energyResults.hourlyData.map((point): ChartDataPoint => {
      // Calculate DC output based on DC/AC ratio
      const pvAcOutput = point.solar;
      const pvDcOutput = pvAcOutput * dcAcRatio;
      const clipping = Math.max(0, pvDcOutput - solarCapacity); // Clipping when DC exceeds inverter capacity
      const pv1to1Baseline = Math.min(pvAcOutput, solarCapacity); // What a 1:1 ratio would produce
      
      return {
        hour: point.hour,
        total: point.load,
        pvGeneration: pvAcOutput,
        pvDcOutput: pvDcOutput,
        pvClipping: clipping,
        pv1to1Baseline: pv1to1Baseline,
        gridImport: point.gridImport,
        gridExport: point.gridExport,
        batteryCharge: point.batteryCharge,
        batteryDischarge: point.batteryDischarge,
        batterySoC: point.batterySOC * batteryCapacity / 100, // Convert % to kWh
      };
    });
  }, [energyResults?.hourlyData, inverterConfig.dcAcRatio, solarCapacity, batteryCapacity]);

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
  }, [isAdvancedEnabled, hasFinancialData, energyResults, tariffData, systemCosts, solarCapacity, batteryCapacity, advancedConfig]);

  // Compute unified payback period from advancedResults (same logic as AdvancedResultsDisplay)
  // This ensures consistency between the MetricCard, Break-even badge, and Financial Return Outputs table
  const unifiedPaybackPeriod = useMemo(() => {
    if (!advancedResults) return null;
    
    // Use sensitivityResults if available (preferred source)
    if (advancedResults.sensitivityResults?.expected.payback) {
      return advancedResults.sensitivityResults.expected.payback;
    }
    
    // Fallback: calculate interpolated payback from yearlyProjections
    const projections = advancedResults.yearlyProjections;
    const breakeven = projections.find(p => p.cumulativeCashFlow >= 0);
    if (!breakeven) return null; // No payback within projection period
    
    // Interpolate for more accurate payback
    const prevYear = projections[breakeven.year - 2];
    if (!prevYear) return breakeven.year;
    
    const remaining = Math.abs(prevYear.cumulativeCashFlow);
    const fraction = remaining / breakeven.netCashFlow;
    
    return breakeven.year - 1 + fraction;
  }, [advancedResults]);

  // Auto-save mutation - upserts simulation on tab change
  const autoSaveMutation = useMutation({
    mutationFn: async () => {
      const simulationName = `Auto-saved ${format(new Date(), "MMM d, HH:mm")}`;
      
      // Check if we have an existing simulation to update
      const existingId = lastSavedSimulation?.id;
      
      const simulationData = {
        project_id: projectId,
        name: existingId ? lastSavedSimulation.name : simulationName,
        simulation_type: solarDataSource,
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
          solarDataSource,
          inverterConfig,
          systemCosts,
          // Blended solar rate for IRR/financial modeling
          blendedSolarRate: selectedBlendedRate,
          blendedRateType,
          blendedRates: annualBlendedRates ? {
            allHours: annualBlendedRates.allHours.annual,
            solarHours: annualBlendedRates.solarHours.annual,
          } : null,
          // Save PVsyst loss configuration for persistence
          lossCalculationMode,
          pvsystConfig,
          // Save production reduction percentage
          productionReductionPercent,
          // Save advanced simulation config (degradation, financial, seasonal, etc.)
          advancedConfig,
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
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["project-simulations", projectId] });
      queryClient.invalidateQueries({ queryKey: ["last-simulation", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-latest-simulation", projectId] });
    },
  });

  // Debounced auto-save on any configuration change
  useEffect(() => {
    // Skip if not yet initialized from saved data
    if (!hasInitializedFromSaved.current || !isFetched) return;
    
    // Skip on first render after initialization
    if (!hasInitialLoadComplete.current) {
      hasInitialLoadComplete.current = true;
      return;
    }
    
    // Clear any pending save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Only auto-save if we have valid tenants
    if (tenants.length === 0) return;
    
    // Schedule debounced save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setIsAutoSaving(true);
      try {
        await autoSaveMutation.mutateAsync();
      } finally {
        setIsAutoSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    
    // Cleanup on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    // Watch all configuration values
    solarCapacity,
    batteryCapacity,
    batteryPower,
    JSON.stringify(pvConfig),
    JSON.stringify(inverterConfig),
    JSON.stringify(pvsystConfig),
    JSON.stringify(advancedConfig),
    lossCalculationMode,
    productionReductionPercent,
    solarDataSource,
    JSON.stringify(systemCosts),
    blendedRateType,
  ]);

  // Expose autoSave method to parent
  useImperativeHandle(ref, () => ({
    autoSave: async () => {
      // Cancel any pending debounced save first
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      // Only auto-save if we have tenants (valid simulation)
      if (tenants.length > 0) {
        await autoSaveMutation.mutateAsync();
      }
    }
  }), [autoSaveMutation, tenants.length]);

  // Get the active data source's peak sun hours for display (must be before early return)
  const activeDataSourceLabel = useMemo(() => {
    if (solarDataSource === "solcast" && solcastData?.summary?.average_daily_ghi_kwh_m2) {
      return `Solcast: ${solcastData.summary.average_daily_ghi_kwh_m2.toFixed(1)} kWh/m²/day`;
    }
    if (solarDataSource === "pvgis_monthly" && pvgisMonthlyData?.summary?.peakSunHours) {
      return `PVGIS 19-Yr: ${pvgisMonthlyData.summary.peakSunHours.toFixed(1)} kWh/m²/day`;
    }
    if (solarDataSource === "pvgis_tmy" && pvgisTmyData?.summary?.peakSunHours) {
      return `PVGIS TMY: ${pvgisTmyData.summary.peakSunHours.toFixed(1)} kWh/m²/day`;
    }
    return `${selectedLocation?.ghi || 5.0} kWh/m²/day`;
  }, [solarDataSource, solcastData, pvgisMonthlyData, pvgisTmyData, selectedLocation?.ghi]);

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
  const isLoadingData = solarDataSource === "solcast" ? solcastLoading 
    : solarDataSource === "pvgis_tmy" ? pvgisLoadingTMY 
    : pvgisLoadingMonthly;
  
  const hasRealData = solarDataSource === "solcast" ? !!solcastHourlyProfile
    : !!pvgisHourlyProfile;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold">Energy Simulation</h2>
            <p className="text-sm text-muted-foreground">
              Model solar and battery energy flows • {selectedLocation.name}
              {hasRealData ? (
                <span className="text-primary"> ({activeDataSourceLabel})</span>
              ) : (
                <span> ({selectedLocation.ghi} kWh/m²/day)</span>
              )}
            </p>
          </div>
          {/* Auto-save indicator */}
          {isAutoSaving ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </div>
          ) : lastSavedAt ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <Save className="h-3 w-3" />
              <span>Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}</span>
            </div>
          ) : null}
        </div>
        {/* Solar Data Source Toggle */}
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={solarDataSource}
            onValueChange={(value) => value && setSolarDataSource(value as SolarDataSource)}
            className="border rounded-lg p-0.5"
          >
            <ToggleGroupItem
              value="solcast"
              size="sm"
              className="text-xs gap-1 px-3"
              disabled={solcastLoading}
            >
              {solcastLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              Solcast
            </ToggleGroupItem>
            <ToggleGroupItem
              value="pvgis_monthly"
              size="sm"
              className="text-xs gap-1 px-3"
              disabled={pvgisLoadingMonthly}
            >
              {pvgisLoadingMonthly ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Database className="h-3 w-3" />
              )}
              PVGIS
            </ToggleGroupItem>
            <ToggleGroupItem
              value="pvgis_tmy"
              size="sm"
              className="text-xs gap-1 px-3"
              disabled={pvgisLoadingTMY}
            >
              {pvgisLoadingTMY ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Database className="h-3 w-3" />
              )}
              TMY
            </ToggleGroupItem>
          </ToggleGroup>
          
          {/* Loss Calculation Mode Toggle */}
          <ToggleGroup
            type="single"
            value={lossCalculationMode}
            onValueChange={(value) => value && setLossCalculationMode(value as LossCalculationMode)}
            className="border rounded-lg p-0.5"
          >
            <ToggleGroupItem value="simplified" size="sm" className="text-xs gap-1 px-3">
              <Zap className="h-3 w-3" />
              Simplified
            </ToggleGroupItem>
            <ToggleGroupItem value="pvsyst" size="sm" className="text-xs gap-1 px-3">
              <Activity className="h-3 w-3" />
              PVsyst
            </ToggleGroupItem>
          </ToggleGroup>
          
          {hasRealData && (
            <Badge variant="outline" className="text-xs">
              {solarDataSource === "solcast" ? "Forecast" : solarDataSource === "pvgis_tmy" ? "Typical Year" : "19-Yr Avg"}
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
        <Card className="border-dashed">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Advanced PV Configuration (PVWatts-style)</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {selectedLocation.name} • {(systemEfficiency * 100).toFixed(1)}% efficiency
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <PVSystemConfig
                config={pvConfig}
                onChange={setPvConfig}
                maxSolarKva={maxSolarKva}
                solarCapacity={solarCapacity}
                projectLocation={project?.location}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* PVsyst Loss Chain Configuration - only show when in PVsyst mode */}
      {lossCalculationMode === "pvsyst" && (
        <PVsystLossChainConfigPanel
          config={{ ...pvsystConfig, stcEfficiency: moduleMetrics.stcEfficiency }}
          onChange={(newConfig) => setPvsystConfig({ ...newConfig, stcEfficiency: moduleMetrics.stcEfficiency })}
          dailyGHI={selectedLocation.ghi}
          capacityKwp={solarCapacity}
          ambientTemp={25}
          moduleMetrics={{
            moduleCount: moduleMetrics.moduleCount,
            collectorAreaM2: moduleMetrics.collectorAreaM2,
            stcEfficiency: moduleMetrics.stcEfficiency,
            moduleName: moduleMetrics.moduleName,
          }}
        />
      )}

      {/* Advanced Simulation Configuration */}
      <AdvancedSimulationConfigPanel
        config={advancedConfig}
        onChange={setAdvancedConfig}
        includesBattery={includesBattery}
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

      {/* Note: System Costs are now configured exclusively in the Costs tab */}

      {/* System Configuration */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Solar PV System - includes capacity slider + inverter size & module config */}
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
            {/* Solar Capacity Slider */}
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
                  <span className="text-warning">70% limit: {maxSolarKva.toFixed(0)}</span>
                  <span>{Math.round(maxSolarKva * 1.5)} kWp</span>
                </div>
              )}
            </div>

            {/* Inverter Size & Module Config - below the slider */}
            <div className="pt-2 border-t">
              <InverterSizeModuleConfig
                config={inverterConfig}
                onChange={setInverterConfig}
                onSolarCapacityChange={setSolarCapacity}
              />
            </div>
            
            {/* Energy output estimate (tariff-independent) - editable with reset */}
            <div className="pt-2 border-t space-y-2 text-[10px]">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-muted-foreground text-[10px]">Expected daily output</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={dailyOutputOverride ?? (annualPVsystResult 
                      ? Math.round(annualPVsystResult.eGrid / 365)
                      : Math.round(energyResults.totalDailySolar))}
                    onChange={(e) => setDailyOutputOverride(parseInt(e.target.value) || 0)}
                    className="h-6 w-20 text-right text-xs"
                  />
                  <span className="text-xs text-muted-foreground">kWh</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setDailyOutputOverride(null)}
                    title="Reset to calculated value"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-muted-foreground text-[10px]">Specific yield</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={specificYieldOverride ?? (annualPVsystResult 
                      ? Math.round(annualPVsystResult.specificYield)
                      : Math.round((energyResults.totalDailySolar * 365) / solarCapacity))}
                    onChange={(e) => setSpecificYieldOverride(parseInt(e.target.value) || 0)}
                    className="h-6 w-20 text-right text-xs"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">kWh/kWp/yr</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setSpecificYieldOverride(null)}
                    title="Reset to calculated value"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Production Reduction - conservative safety margin */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-muted-foreground text-[10px]">Production reduction</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={productionReductionPercent}
                    onChange={(e) => setProductionReductionPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="h-6 w-16 text-right text-xs"
                    min={0}
                    max={100}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setProductionReductionPercent(15)}
                    title="Reset to default (15%)"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {productionReductionPercent > 0 && (
                <p className="text-[9px] text-muted-foreground mt-1">
                  Output reduced by {productionReductionPercent}% for conservative estimate
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inverter-Based Sizing - sliders, metrics, quick select */}
        <Card className={solarExceedsLimit ? "border-destructive/50" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Inverter-Based Sizing
            </CardTitle>
            <CardDescription className="text-xs">
              Size system based on inverter capacity and grouping
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InverterSliderPanel
              config={inverterConfig}
              onChange={setInverterConfig}
              currentSolarCapacity={solarCapacity}
              onSolarCapacityChange={setSolarCapacity}
              maxSolarKva={maxSolarKva}
            />
          </CardContent>
        </Card>

        {/* Third column: Tariff Selector + Financial Returns (stacked) */}
        <div className="flex flex-col gap-4">
          {/* Simulation Tariff Rate Selector - compact pane */}
          {hasFinancialData && annualBlendedRates && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Simulation Tariff Rate
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3">
                  <Select 
                    value={blendedRateType} 
                    onValueChange={(value: BlendedRateType) => onBlendedRateTypeChange?.(value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select rate type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solarHours">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4 text-amber-500" />
                          <span>Solar Sun Hours (6h)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="allHours">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>All Hours (24/7/365)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <span className={`text-lg font-bold ml-auto ${blendedRateType === 'solarHours' ? 'text-amber-600' : ''}`}>
                    R{(blendedRateType === 'solarHours' 
                      ? annualBlendedRates.solarHours.annual 
                      : annualBlendedRates.allHours.annual
                    ).toFixed(4)}/kWh
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Return Outputs - now below the tariff selector */}
          {hasFinancialData ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Financial Return Outputs
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    {project?.location || 'Site'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Table Rows */}
                <div className="divide-y divide-border text-sm">
                  <FinancialMetricRow
                    label="ZAR / kWh (Incl. 3-Yr O&M)"
                    value={((financialResults.systemCost + threeYearOM) / ((annualPVsystResult?.eGrid ?? energyResults.totalDailySolar * 365) * reductionFactor)).toFixed(2)}
                    breakdown={{
                      formula: "(System Cost + 3-Yr O&M) ÷ (Annual Production × Reduction)",
                      inputs: [
                        { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                        { label: "3-Yr O&M Total", value: `R ${Math.round(threeYearOM).toLocaleString()}` },
                        { label: "Annual Production", value: `${Math.round(annualPVsystResult?.eGrid ?? energyResults.totalDailySolar * 365).toLocaleString()} kWh` },
                        { label: "Reduction Factor", value: `${(reductionFactor * 100).toFixed(0)}%` },
                      ],
                    }}
                  />
                  <FinancialMetricRow
                    label="ZAR / Wp (DC)"
                    value={((financialResults.systemCost + threeYearOM) / (solarCapacity * inverterConfig.dcAcRatio * 1000)).toFixed(2)}
                    breakdown={{
                      formula: "(System Cost + 3-Yr O&M) ÷ (DC Capacity in Wp)",
                      inputs: [
                        { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                        { label: "3-Yr O&M Total", value: `R ${Math.round(threeYearOM).toLocaleString()}` },
                        { label: "AC Capacity", value: `${solarCapacity} kW` },
                        { label: "DC/AC Ratio", value: inverterConfig.dcAcRatio.toFixed(2) },
                        { label: "DC Capacity", value: `${(solarCapacity * inverterConfig.dcAcRatio).toFixed(1)} kWp` },
                      ],
                    }}
                  />
                  <FinancialMetricRow
                    label="ZAR / Wp (AC)"
                    value={((financialResults.systemCost + threeYearOM) / ((inverterConfig.inverterSize * inverterConfig.inverterCount || solarCapacity) * 1000)).toFixed(2)}
                    breakdown={{
                      formula: "(System Cost + 3-Yr O&M) ÷ (AC Capacity in Wp)",
                      inputs: [
                        { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                        { label: "3-Yr O&M Total", value: `R ${Math.round(threeYearOM).toLocaleString()}` },
                        { label: "AC Capacity", value: `${inverterConfig.inverterSize * inverterConfig.inverterCount || solarCapacity} kW` },
                      ],
                    }}
                  />
                  <FinancialMetricRow
                    label="LCOE (ZAR/kWh)"
                    value={(advancedResults?.lcoe ?? basicFinancialMetrics.lcoe).toFixed(2)}
                    breakdown={{
                      formula: "Undiscounted Total Costs ÷ NPV of Energy Yield",
                      inputs: [
                        { label: "Initial Capital", value: `R ${financialResults.systemCost.toLocaleString()}` },
                        { label: "20-Yr O&M (CPI escalated)", value: advancedResults?.columnTotals ? `R ${Math.round(advancedResults.columnTotals.totalOM).toLocaleString()}` : 'N/A' },
                        { label: "20-Yr Insurance (CPI escalated)", value: advancedResults?.columnTotals ? `R ${Math.round(advancedResults.columnTotals.totalInsurance).toLocaleString()}` : 'N/A' },
                        { label: "Replacements (Yr 10)", value: advancedResults?.columnTotals ? `R ${Math.round(advancedResults.columnTotals.totalReplacements).toLocaleString()}` : 'N/A' },
                        { label: "NPV of Energy Yield", value: advancedResults?.columnTotals ? `${Math.round(advancedResults.columnTotals.npvEnergyYield).toLocaleString()} kWh` : 'N/A' },
                        { label: "LCOE Discount Rate", value: `${systemCosts.lcoeDiscountRate ?? 10}%` },
                      ],
                    }}
                  />
                  {(() => {
                    // Calculate Initial Yield using net cashflow: (Income Y1 - O&M Y1 - Insurance Y1) / Total Cost
                    const year1Projection = advancedResults?.yearlyProjections?.[0];
                    const totalIncomeY1 = year1Projection?.totalIncomeR ?? financialResults.annualSavings;
                    const omCostY1 = year1Projection?.maintenanceCost ?? (systemCosts.maintenancePerYear ?? 0);
                    // Insurance Rate is monthly - multiply by 12 for annual fallback
                    const insuranceY1 = year1Projection?.insuranceCostR ?? (financialResults.systemCost * (systemCosts.insuranceRatePercent ?? 1) / 100 * 12);
                    const netCashflowY1 = totalIncomeY1 - omCostY1 - insuranceY1;
                    const initialYield = (netCashflowY1 / financialResults.systemCost) * 100;
                    
                    return (
                      <FinancialMetricRow
                        label="Initial Yield"
                        value={`${initialYield.toFixed(2)}%`}
                        breakdown={{
                          formula: "((Total Income Y1 - O&M Y1 - Insurance Y1) ÷ Total Project Cost) × 100",
                          inputs: [
                            { label: "Total Income Y1", value: `R ${Math.round(totalIncomeY1).toLocaleString()}` },
                            { label: "O&M Cost Y1", value: `R ${Math.round(omCostY1).toLocaleString()}` },
                            { label: "Insurance Y1", value: `R ${Math.round(insuranceY1).toLocaleString()}` },
                            { label: "Net Cashflow Y1", value: `R ${Math.round(netCashflowY1).toLocaleString()}` },
                            { label: "Total Project Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                          ],
                        }}
                      />
                    );
                  })()}
                  <FinancialMetricRow
                    label="IRR"
                    value={`${(advancedResults?.irr ?? basicFinancialMetrics.irr).toFixed(2)}%`}
                    breakdown={{
                      formula: "Rate where NPV of cashflows = 0",
                      inputs: [
                        { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                        { label: "Annual Savings (Yr 1)", value: `R ${Math.round(financialResults.annualSavings).toLocaleString()}` },
                        { label: "Project Lifetime", value: `${advancedConfig.financial.projectLifetimeYears ?? 20} years` },
                        { label: "Tariff Escalation", value: `${advancedConfig.financial.tariffEscalationRate ?? 10}%` },
                      ],
                    }}
                  />
                  <FinancialMetricRow
                    label="MIRR"
                    value={`${(advancedResults?.mirr ?? basicFinancialMetrics.mirr).toFixed(2)}%`}
                    breakdown={{
                      formula: "[(FV Positives / PV Negatives)^(1/n)] - 1",
                      inputs: [
                        { label: "Finance Rate", value: `${systemCosts.mirrFinanceRate ?? 10}%` },
                        { label: "Reinvestment Rate", value: `${systemCosts.mirrReinvestmentRate ?? 12}%` },
                        { label: "Project Lifetime", value: `${advancedConfig.financial.projectLifetimeYears ?? 20} years` },
                      ],
                    }}
                  />
                  <FinancialMetricRow
                    label="Payback Period"
                    value={formatPaybackPeriod(unifiedPaybackPeriod ?? financialResults.paybackYears)}
                    breakdown={{
                      formula: "Year when cumulative cashflow ≥ 0",
                      inputs: [
                        { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                        { label: "Year 1 Savings", value: `R ${Math.round(financialResults.annualSavings).toLocaleString()}` },
                        { label: "Tariff Escalation", value: `${advancedConfig.financial.tariffEscalationRate ?? 10}%` },
                      ],
                    }}
                  />
                  <FinancialMetricRow
                    label="NPV"
                    value={Math.round(advancedResults?.npv ?? basicFinancialMetrics.npv).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    valueClassName={(advancedResults?.npv ?? basicFinancialMetrics.npv) >= 0 ? 'text-green-600' : 'text-red-600'}
                    breakdown={{
                      formula: "Σ (Cashflow_t ÷ (1 + r)^t)",
                      inputs: [
                        { label: "System Cost (Year 0)", value: `-R ${financialResults.systemCost.toLocaleString()}` },
                        { label: "Annual Savings (Yr 1)", value: `R ${Math.round(financialResults.annualSavings).toLocaleString()}` },
                        { label: "Discount Rate", value: `${advancedConfig.financial.discountRate ?? 10}%` },
                        { label: "Project Lifetime", value: `${advancedConfig.financial.projectLifetimeYears ?? 20} years` },
                      ],
                    }}
                  />
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
      </div>

      {/* Battery Storage - separate row when enabled */}
      {includesBattery && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Battery className="h-4 w-4" />
              Battery Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
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
            <CardTitle className="text-2xl text-chart-2">
              {annualPVsystResult 
                ? Math.round(annualPVsystResult.eGrid * reductionFactor).toLocaleString()
                : Math.round(energyResults.totalDailySolar * 365).toLocaleString()} kWh
            </CardTitle>
            {annualPVsystResult && (
              <p className="text-xs text-muted-foreground">
                {Math.round(annualPVsystResult.specificYield * reductionFactor).toLocaleString()} kWh/kWp • PR: {annualPVsystResult.performanceRatio.toFixed(1)}%
              </p>
            )}
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
          usingSolcast: solarDataSource === "solcast",
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
            setInverterConfig((prev) => ({ ...prev, ...config.inverterConfig }));
          }
          // Load system costs if present
          if (config.systemCosts) {
            // Handle legacy data that may have old maintenancePercentage field or missing new fields
            const savedCosts = config.systemCosts as any;
            onSystemCostsChange({
              solarCostPerKwp: savedCosts.solarCostPerKwp,
              batteryCostPerKwh: savedCosts.batteryCostPerKwh,
              solarMaintenancePercentage: savedCosts.solarMaintenancePercentage ?? savedCosts.maintenancePercentage ?? 3.5,
              batteryMaintenancePercentage: savedCosts.batteryMaintenancePercentage ?? 1.5,
              maintenancePerYear: savedCosts.maintenancePerYear ?? 0,
              // Additional Fixed Costs
              healthAndSafetyCost: savedCosts.healthAndSafetyCost ?? 0,
              waterPointsCost: savedCosts.waterPointsCost ?? 0,
              cctvCost: savedCosts.cctvCost ?? 0,
              mvSwitchGearCost: savedCosts.mvSwitchGearCost ?? 0,
              // Insurance
              insuranceCostPerYear: savedCosts.insuranceCostPerYear ?? 0,
              insuranceRatePercent: savedCosts.insuranceRatePercent ?? 1.0,
              // Percentage-based Fees
              professionalFeesPercent: savedCosts.professionalFeesPercent ?? 0,
              projectManagementPercent: savedCosts.projectManagementPercent ?? 0,
              contingencyPercent: savedCosts.contingencyPercent ?? 0,
              // Replacement Costs (Year 10)
              replacementYear: savedCosts.replacementYear ?? 10,
              equipmentCostPercent: savedCosts.equipmentCostPercent ?? 45,
              moduleSharePercent: savedCosts.moduleSharePercent ?? 70,
              inverterSharePercent: savedCosts.inverterSharePercent ?? 30,
              solarModuleReplacementPercent: savedCosts.solarModuleReplacementPercent ?? 10,
              inverterReplacementPercent: savedCosts.inverterReplacementPercent ?? 50,
              batteryReplacementPercent: savedCosts.batteryReplacementPercent ?? 30,
              // Financial Return Parameters
              costOfCapital: savedCosts.costOfCapital ?? 9.0,
              cpi: savedCosts.cpi ?? 6.0,
              electricityInflation: savedCosts.electricityInflation ?? 10.0,
              projectDurationYears: savedCosts.projectDurationYears ?? 20,
              lcoeDiscountRate: savedCosts.lcoeDiscountRate ?? 9.0,
              mirrFinanceRate: savedCosts.mirrFinanceRate ?? 9.0,
              mirrReinvestmentRate: savedCosts.mirrReinvestmentRate ?? 10.0,
            });
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
          <TabsTrigger value="energy">Energy Charts</TabsTrigger>
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
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Energy Simulation Charts</CardTitle>
                  <CardDescription>Hourly load, solar generation, and grid flow analysis</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showTOU} onCheckedChange={setShowTOU} className="scale-75" />
                    TOU
                  </Label>
                  <ReportToggle
                    id="energy-flow-chart"
                    segmentType="energy_flow"
                    label="Energy Flow Chart"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Load Profile Chart */}
              <LoadChart 
                chartData={simulationChartData} 
                showTOU={showTOU} 
                isWeekend={false} 
                unit="kW" 
              />

              {/* Solar Chart */}
              {solarCapacity > 0 && (
                <SolarChart
                  chartData={simulationChartData}
                  showTOU={showTOU}
                  isWeekend={false}
                  dcAcRatio={inverterConfig.dcAcRatio}
                  show1to1Comparison={inverterConfig.dcAcRatio > 1}
                  unit="kW"
                  maxPvAcKva={solarCapacity}
                />
              )}

              {/* Grid Flow Chart */}
              {solarCapacity > 0 && (
                <GridFlowChart
                  chartData={simulationChartData}
                  showTOU={showTOU}
                  isWeekend={false}
                  unit="kW"
                />
              )}

              {/* Battery Chart */}
              {includesBattery && batteryCapacity > 0 && (
                <BatteryChart
                  chartData={simulationChartData}
                  batteryCapacity={batteryCapacity}
                  batteryPower={batteryPower}
                />
              )}

              {/* TOU Legend */}
              {showTOU && <TOULegend />}
            </CardContent>
          </Card>
        </TabsContent>

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
                        <span>{formatPaybackPeriod(financialResultsGeneric.paybackYears)}</span>
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
                          {formatPaybackPeriod(financialResultsSolcast.paybackYears)}
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
