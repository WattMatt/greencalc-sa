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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, ComposedChart } from "recharts";
import { Sun, Battery, Zap, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Cloud, Loader2, CheckCircle2, Database, Activity, RefreshCw, Calculator, Clock, Info, Save, ChevronLeft, ChevronRight, Building2, ArrowDownToLine } from "lucide-react";
import { LoadChart } from "./load-profile/charts/LoadChart";
import { BuildingProfileChart } from "./load-profile/charts/BuildingProfileChart";
import { SolarChart } from "./load-profile/charts/SolarChart";
import { GridFlowChart } from "./load-profile/charts/GridFlowChart";
import { BatteryChart } from "./load-profile/charts/BatteryChart";
import { TOULegend } from "./load-profile/components/TOULegend";
import { ChartDataPoint, DayOfWeek, DAYS_OF_WEEK, DischargeTOUSelection, DEFAULT_DISCHARGE_TOU_SELECTION } from "./load-profile/types";
import { FinancialMetricRow } from "./simulation/FinancialMetricRow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ANNUAL_HOURS_24H, ANNUAL_HOURS_SOLAR } from "@/lib/tariffCalculations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { useSolcastForecast } from "@/hooks/useSolcastForecast";
import { usePVGISProfile, PVGISTMYResponse, PVGISMonthlyResponse } from "@/hooks/usePVGISProfile";

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
  runAnnualEnergySimulation,
  calculateFinancialsFromAnnual,
  DEFAULT_SYSTEM_COSTS,
  type TariffData,
} from "./simulation";
import {
  type BatteryDispatchStrategy,
  type DispatchConfig,
  type TimeWindow,
  getDefaultDispatchConfig,
} from "./simulation/EnergySimulationEngine";

type TOUPeriod = 'off-peak' | 'standard' | 'peak';

import { getTOUSettingsFromStorage, useTOUSettings } from "@/hooks/useTOUSettings";

/** Convert a TOU period name to hour windows, derived from stored TOU settings */
function touPeriodToWindows(period: TOUPeriod): TimeWindow[] {
  const settings = getTOUSettingsFromStorage();
  // Derive windows from the low-season weekday map (primary reference)
  const hourMap = settings.lowSeason.weekday;
  const windows: TimeWindow[] = [];
  let start: number | null = null;
  for (let h = 0; h <= 24; h++) {
    const p = h < 24 ? hourMap[h] : undefined;
    if (p === period && start === null) {
      start = h;
    } else if (p !== period && start !== null) {
      windows.push({ start, end: h });
      start = null;
    }
  }
  return windows.length > 0 ? windows : [{ start: 0, end: 0 }];
}
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
import { useLoadProfileData } from "./load-profile/hooks/useLoadProfileData";
import { useSolcastPVProfile } from "./load-profile/hooks/useSolcastPVProfile";
import { Tenant as FullTenant, ShopType as FullShopType } from "./load-profile/types";
import { ConfigCarousel, CarouselPane } from "./simulation/ConfigCarousel";

// Solar data source type
type SolarDataSource = "solcast" | "pvgis_monthly" | "pvgis_tmy";

// Use full Tenant and ShopType from load-profile types for compatibility with useLoadProfileData

interface SimulationPanelProps {
  projectId: string;
  project: any;
  tenants: FullTenant[];
  shopTypes: FullShopType[];
  systemCosts: SystemCostsData;
  onSystemCostsChange: (costs: SystemCostsData) => void;
  includesBattery?: boolean;
  includesSolar?: boolean;
  onRequestEnableFeature?: (feature: string) => void;
  blendedRateType?: BlendedRateType;
  onBlendedRateTypeChange?: (type: BlendedRateType) => void;
  useHourlyTouRates?: boolean;
  onUseHourlyTouRatesChange?: (value: boolean) => void;
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

export const SimulationPanel = forwardRef<SimulationPanelRef, SimulationPanelProps>(({ projectId, project, tenants, shopTypes, systemCosts, onSystemCostsChange, includesBattery = false, includesSolar = true, onRequestEnableFeature, blendedRateType = 'solarHours', onBlendedRateTypeChange, useHourlyTouRates = true, onUseHourlyTouRatesChange }, ref) => {
  const queryClient = useQueryClient();
  const { touSettings: touSettingsData } = useTOUSettings();

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

  // Helper: read cached simulation data synchronously for useState initializers
  // This prevents the "flash of defaults" on hot reload
  const getCachedSimulation = () => {
    const cached = queryClient.getQueryData<any>(["last-simulation", projectId]);
    return cached ? { sim: cached, json: cached?.results_json as any } : null;
  };
  
  const [solarCapacity, setSolarCapacity] = useState(() => {
    const c = getCachedSimulation();
    return c?.sim?.solar_capacity_kwp || 100;
  });
  const [batteryAcCapacity, setBatteryAcCapacity] = useState(() => {
    const c = getCachedSimulation();
    if (c) {
      const minSoC = c.json?.batteryMinSoC ?? 10;
      const maxSoC = c.json?.batteryMaxSoC ?? 95;
      const dod = maxSoC - minSoC;
      const dcCap = includesBattery ? (c.sim.battery_capacity_kwh || 50) : 0;
      return Math.round(dcCap * dod / 100);
    }
    return includesBattery ? 42 : 0;
  });
  const [batteryChargeCRate, setBatteryChargeCRate] = useState(() => {
    const c = getCachedSimulation();
    if (c?.json?.batteryChargeCRate) return c.json.batteryChargeCRate;
    if (c?.json?.batteryCRate) return c.json.batteryCRate;
    return 0.5;
  });
  const [batteryDischargeCRate, setBatteryDischargeCRate] = useState(() => {
    const c = getCachedSimulation();
    if (c?.json?.batteryDischargeCRate) return c.json.batteryDischargeCRate;
    if (c?.json?.batteryCRate) return c.json.batteryCRate;
    return 0.5;
  });
  const [batteryMinSoC, setBatteryMinSoC] = useState(() => {
    const c = getCachedSimulation();
    return c?.json?.batteryMinSoC ?? 10;
  });
  const [batteryMaxSoC, setBatteryMaxSoC] = useState(() => {
    const c = getCachedSimulation();
    return c?.json?.batteryMaxSoC ?? 95;
  });
   
   // Battery dispatch strategy
   const [batteryStrategy, setBatteryStrategy] = useState<BatteryDispatchStrategy>(() => {
     const c = getCachedSimulation();
     return c?.json?.batteryStrategy || 'self-consumption';
   });
   const [dispatchConfig, setDispatchConfig] = useState<DispatchConfig>(() => {
     const c = getCachedSimulation();
     const strategy = c?.json?.batteryStrategy || 'self-consumption';
     return c?.json?.dispatchConfig ?? getDefaultDispatchConfig(strategy);
   });
   
   // TOU period selections for TOU Arbitrage mode
   const [chargeTouPeriod, setChargeTouPeriod] = useState<TOUPeriod>('off-peak');
   const [dischargeTouSelection, setDischargeTouSelection] = useState<DischargeTOUSelection>(() => {
     const c = getCachedSimulation();
     return c?.json?.dischargeTouSelection ?? DEFAULT_DISCHARGE_TOU_SELECTION;
   });

   const handleDischargeTouSelectionChange = useCallback((selection: DischargeTOUSelection) => {
     setDischargeTouSelection(selection);
     const flags = selection.lowSeason.weekday;
     const windows: TimeWindow[] = [];
     if (flags.peak) windows.push(...touPeriodToWindows('peak'));
     if (flags.standard) windows.push(...touPeriodToWindows('standard'));
     if (flags.offPeak) windows.push(...touPeriodToWindows('off-peak'));
     setDispatchConfig(prev => ({
       ...prev,
       dischargeWindows: windows.length > 0 ? windows : [{ start: 0, end: 0 }],
       dischargeTouSelection: selection,
     }));
   }, []);

  // DoD is derived from SoC limits
  const batteryDoD = batteryMaxSoC - batteryMinSoC;

  // Derived DC values used by all downstream calculations
  const batteryCapacity = batteryDoD > 0 ? Math.round(batteryAcCapacity / (batteryDoD / 100)) : 0; // DC kWh
  const batteryChargePower = Math.round(batteryAcCapacity * batteryChargeCRate * 10) / 10; // kW
  const batteryDischargePower = Math.round(batteryAcCapacity * batteryDischargeCRate * 10) / 10; // kW
  const batteryPower = Math.max(batteryChargePower, batteryDischargePower); // Legacy: max for display
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

  // High/Low demand season toggle for TOU chart backgrounds (with localStorage persistence)
  const [showHighSeason, setShowHighSeason] = useState(() => {
    const saved = localStorage.getItem('simulation_showHighSeason');
    return saved !== null ? saved === 'true' : false;
  });

  // Day-of-week selection for load profile visualization (matches Load Profile tab)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Wednesday");
  const [showAnnualAverage, setShowAnnualAverage] = useState(true);

  useEffect(() => {
    localStorage.setItem('simulation_showHighSeason', String(showHighSeason));
  }, [showHighSeason]);

  // Day navigation helper
  const navigateDay = useCallback((direction: "prev" | "next") => {
    const idx = DAYS_OF_WEEK.indexOf(selectedDay);
    if (direction === "prev") {
      setSelectedDay(DAYS_OF_WEEK[(idx - 1 + 7) % 7]);
    } else {
      setSelectedDay(DAYS_OF_WEEK[(idx + 1) % 7]);
    }
  }, [selectedDay]);

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
      const savedMinSoC = savedResultsJson?.batteryMinSoC ?? 10;
      const savedMaxSoC = savedResultsJson?.batteryMaxSoC ?? 95;
      const savedDoD = savedMaxSoC - savedMinSoC;
      const savedChargeCRate = savedResultsJson?.batteryChargeCRate ?? savedResultsJson?.batteryCRate;
      const savedDischargeCRate = savedResultsJson?.batteryDischargeCRate ?? savedResultsJson?.batteryCRate;
      setBatteryMinSoC(savedMinSoC);
      setBatteryMaxSoC(savedMaxSoC);
      const savedDcCap = includesBattery ? (lastSavedSimulation.battery_capacity_kwh || 50) : 0;
      const savedPower = includesBattery ? (lastSavedSimulation.battery_power_kw || 25) : 0;
      const derivedAc = Math.round(savedDcCap * savedDoD / 100);
      setBatteryAcCapacity(derivedAc);
      const fallbackCRate = derivedAc > 0 ? Math.round(savedPower / derivedAc * 100) / 100 : 0.5;
      setBatteryChargeCRate(savedChargeCRate ?? fallbackCRate);
      setBatteryDischargeCRate(savedDischargeCRate ?? fallbackCRate);
      
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
      
      // Load battery dispatch strategy if saved
      if (savedResultsJson?.batteryStrategy) {
        setBatteryStrategy(savedResultsJson.batteryStrategy);
        setDispatchConfig(savedResultsJson.dispatchConfig ?? getDefaultDispatchConfig(savedResultsJson.batteryStrategy));
      }
      if (savedResultsJson?.chargeTouPeriod) setChargeTouPeriod(savedResultsJson.chargeTouPeriod);
      if (savedResultsJson?.dischargeTouSelection) {
        setDischargeTouSelection(savedResultsJson.dischargeTouSelection);
      } else if (savedResultsJson?.dischargeTouPeriod) {
        const period = savedResultsJson.dischargeTouPeriod as TOUPeriod;
        const flags = { peak: period === 'peak', standard: period === 'standard', offPeak: period === 'off-peak' };
        setDischargeTouSelection({
          highSeason: { weekday: { ...flags }, weekend: { peak: false, standard: false, offPeak: false } },
          lowSeason: { weekday: { ...flags }, weekend: { peak: false, standard: false, offPeak: false } },
        });
      }

      // Track what we loaded for UI feedback
      setLoadedSimulationName(lastSavedSimulation.name);
      setLoadedSimulationDate(lastSavedSimulation.created_at);
    }
  }, [isFetched, lastSavedSimulation, savedResultsJson, includesBattery, onSystemCostsChange]);




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

  // Solcast PV Profile hook for consistent chart rendering (matches Load Profile tab)
  const {
    pvProfile: solcastPvProfileData,
    useSolcast: useSolcastForCharts,
    toggleSolcast: toggleSolcastForCharts,
  } = useSolcastPVProfile({
    latitude: effectiveLat,
    longitude: effectiveLng,
    enabled: solarDataSource === "solcast",
  });

  // Use the same useLoadProfileData hook as Load Profile tab for consistent chart visualization
  const {
    chartData: loadProfileChartData,
    totalDaily: loadProfileTotalDaily,
    peakHour: loadProfilePeakHour,
    loadFactor: loadProfileLoadFactor,
    isWeekend: loadProfileIsWeekend,
    tenantsWithScada,
    tenantsEstimated,
  } = useLoadProfileData({
    tenants,
    shopTypes,
    selectedDays: showAnnualAverage 
      ? new Set([0, 1, 2, 3, 4, 5, 6]) 
      : new Set([DAYS_OF_WEEK.indexOf(selectedDay) === -1 ? 3 : (DAYS_OF_WEEK.indexOf(selectedDay) + 1) % 7]),
    selectedMonths: showAnnualAverage ? new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) : undefined,
    displayUnit: "kw",
    powerFactor: 0.9,
    showPVProfile: includesSolar && solarCapacity > 0,
    maxPvAcKva: solarCapacity,
    dcCapacityKwp: solarCapacity * inverterConfig.dcAcRatio,
    dcAcRatio: inverterConfig.dcAcRatio,
    showBattery: includesBattery && batteryCapacity > 0,
    batteryCapacity,
    batteryPower: batteryChargePower,
    batteryDischargePower,
    solcastProfile: solarDataSource === "solcast" ? solcastPvProfileData : undefined,
  });
  const { data: tariffRates } = useQuery({
    queryKey: ["tariff-rates", project.tariff_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_rates")
        .select("*")
        .eq("tariff_plan_id", project.tariff_id);
      if (error) throw error;
      // Map new schema to legacy interface expected by downstream code
      return (data || []).map((r: any) => ({
        ...r,
        rate_per_kwh: r.charge === 'energy' ? r.amount : 0,
        time_of_use: r.tou === 'all' ? 'Any' : r.tou === 'peak' ? 'Peak' : r.tou === 'standard' ? 'Standard' : 'Off-Peak',
        season: r.season === 'all' ? 'All Year' : r.season === 'high' ? 'High/Winter' : 'Low/Summer',
      }));
    },
    enabled: !!project.tariff_id,
  });

  const { data: tariff } = useQuery({
    queryKey: ["tariff", project.tariff_id],
    queryFn: async () => {
      const { data: plan, error } = await supabase
        .from("tariff_plans")
        .select("*")
        .eq("id", project.tariff_id)
        .single();
      if (error) throw error;
      // Also fetch rates to extract fixed charges
      const { data: rates } = await supabase
        .from("tariff_rates")
        .select("*")
        .eq("tariff_plan_id", project.tariff_id);
      const basicCharge = (rates || []).find((r: any) => r.charge === 'basic')?.amount || 0;
      const demandCharge = (rates || []).find((r: any) => r.charge === 'demand')?.amount || 0;
      const networkCharge = (rates || []).find((r: any) => r.charge === 'network_access')?.amount || 0;
      return {
        ...plan,
        fixed_monthly_charge: basicCharge,
        demand_charge_per_kva: demandCharge,
        network_access_charge: networkCharge,
        legacy_charge_per_kwh: 0,
        tariff_type: (plan as any)?.structure || 'flat',
      };
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

  // Use the same load profile as charts - synchronized with SCADA data, scaling, and multipliers
  // This ensures simulation results match the accurate demand patterns shown in Load Profile charts
  const loadProfile = useMemo(() => {
    // loadProfileChartData already contains accurately calculated kW per hour
    // with SCADA meter data, interval corrections, area scaling, and diversity factors
    return loadProfileChartData.map(d => d.total);
  }, [loadProfileChartData]);

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
  const effectiveSolarCapacity = includesSolar ? solarCapacity : 0;

  const energyConfig = useMemo(() => ({
    solarCapacity: effectiveSolarCapacity,
    batteryCapacity,
    batteryPower,
    batteryChargePower,
    batteryDischargePower,
    batteryMinSoC: batteryMinSoC / 100,
    batteryMaxSoC: batteryMaxSoC / 100,
    dispatchStrategy: batteryStrategy,
    dispatchConfig,
    touPeriodToWindows,
    touSettings: touSettingsData,
    representativeSeason: showHighSeason ? 'high' as const : 'low' as const,
  }), [effectiveSolarCapacity, batteryCapacity, batteryPower, batteryChargePower, batteryDischargePower, batteryMinSoC, batteryMaxSoC, batteryStrategy, dispatchConfig, touSettingsData, showHighSeason]);

  // Extract solar from chart data (same source as pvGeneration) for engine input
  // This ensures the engine receives exactly the same solar values that appear in the charts
  const chartSolarProfile = useMemo(() => {
    return loadProfileChartData.map(d => d.pvGeneration || 0);
  }, [loadProfileChartData]);

  const effectiveSolarProfile = includesSolar ? chartSolarProfile : loadProfile.map(() => 0);

  // 8,760-hour annual simulation — single source of truth for all kWh and financial data
  const annualEnergyResults = useMemo(() =>
    runAnnualEnergySimulation(loadProfile, effectiveSolarProfile, energyConfig, touSettingsData),
    [loadProfile, effectiveSolarProfile, energyConfig, touSettingsData]
  );

  const annualEnergyResultsGeneric = useMemo(() =>
    runAnnualEnergySimulation(loadProfile, solarProfileGeneric, energyConfig, touSettingsData),
    [loadProfile, solarProfileGeneric, energyConfig, touSettingsData]
  );

  const annualEnergyResultsSolcast = useMemo(() =>
    solarProfileSolcast ? runAnnualEnergySimulation(loadProfile, solarProfileSolcast, energyConfig, touSettingsData) : null,
    [loadProfile, solarProfileSolcast, energyConfig, touSettingsData]
  );

  // Extract a representative 24-hour day from annual data for chart overlay
  const representativeDay = useMemo(() => {
    if (!annualEnergyResults?.hourlyData) return [];
    const season = showHighSeason ? 'high' : 'low';
    const startIdx = annualEnergyResults.hourlyData.findIndex(
      h => h.season === season && h.dayType === 'weekday'
    );
    if (startIdx === -1) return [];
    return annualEnergyResults.hourlyData.slice(startIdx, startIdx + 24);
  }, [annualEnergyResults, showHighSeason]);

  // ========================================
  // PHASE 2: Financial Analysis (tariff-dependent)
  // ========================================
  // Calculate blended rates using the new accurate methodology with all unbundled charges
  const annualBlendedRates = useMemo(() => 
    calculateAnnualBlendedRates(tariffRates, { legacy_charge_per_kwh: tariff?.legacy_charge_per_kwh }),
    [tariffRates, tariff?.legacy_charge_per_kwh]
  );
  
  // Use the selected blended rate type (from Tariff tab or default to solarHours)
  // Now supports all 6 rate options
  const selectedBlendedRate = useMemo(() => {
    if (!annualBlendedRates) return 2.5; // Fallback default
    
    switch (blendedRateType) {
      case 'allHours':
        return annualBlendedRates.allHours.annual;
      case 'allHoursHigh':
        return annualBlendedRates.allHours.high;
      case 'allHoursLow':
        return annualBlendedRates.allHours.low;
      case 'solarHours':
        return annualBlendedRates.solarHours.annual;
      case 'solarHoursHigh':
        return annualBlendedRates.solarHours.high;
      case 'solarHoursLow':
        return annualBlendedRates.solarHours.low;
      default:
        return annualBlendedRates.solarHours.annual;
    }
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
    calculateFinancialsFromAnnual(annualEnergyResults, tariffData, systemCosts, solarCapacity, batteryCapacity),
    [annualEnergyResults, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  const financialResultsGeneric = useMemo(() =>
    calculateFinancialsFromAnnual(annualEnergyResultsGeneric, tariffData, systemCosts, solarCapacity, batteryCapacity),
    [annualEnergyResultsGeneric, tariffData, systemCosts, solarCapacity, batteryCapacity]
  );

  const financialResultsSolcast = useMemo(() =>
    annualEnergyResultsSolcast
      ? calculateFinancialsFromAnnual(annualEnergyResultsSolcast, tariffData, systemCosts, solarCapacity, batteryCapacity)
      : null,
    [annualEnergyResultsSolcast, tariffData, systemCosts, solarCapacity, batteryCapacity]
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
    const annualGeneration = annualEnergyResults.totalAnnualSolar;
    
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
  }, [financialResults, annualEnergyResults, systemCosts]);



  // Merge authoritative battery + grid data from EnergySimulationEngine onto load profile chart data
  const simulationChartData = useMemo(() => {
    if (!loadProfileChartData || !representativeDay.length) return loadProfileChartData;
    return loadProfileChartData.map((hour, i) => {
      const engineHour = representativeDay[i];
      if (!engineHour) return hour;
      return {
        ...hour,
        batteryCharge: engineHour.batteryCharge,
        batteryDischarge: engineHour.batteryDischarge,
        batterySoC: (engineHour.batterySOC / 100) * batteryCapacity,
        gridImport: engineHour.gridImport,
        gridExport: engineHour.gridExport,
        gridImportWithBattery: engineHour.gridImport,
        netLoad: engineHour.netLoad,
        solarUsed: engineHour.solarUsed,
      };
    });
  }, [loadProfileChartData, representativeDay]);

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

    // Build a daily-equivalent adapter from annual results for backwards compatibility
    const dailyAdapter = {
      totalDailyLoad: annualEnergyResults.totalAnnualLoad / 365,
      totalDailySolar: annualEnergyResults.totalAnnualSolar / 365,
      totalGridImport: annualEnergyResults.totalAnnualGridImport / 365,
      totalGridExport: annualEnergyResults.totalAnnualGridExport / 365,
      totalSolarUsed: annualEnergyResults.totalAnnualSolarUsed / 365,
      totalBatteryCharge: annualEnergyResults.totalAnnualBatteryCharge / 365,
      totalBatteryDischarge: annualEnergyResults.totalAnnualBatteryDischarge / 365,
      totalBatteryChargeFromGrid: annualEnergyResults.totalAnnualBatteryChargeFromGrid / 365,
      selfConsumptionRate: annualEnergyResults.selfConsumptionRate,
      solarCoverageRate: annualEnergyResults.solarCoverageRate,
      peakLoad: annualEnergyResults.peakLoad,
      peakGridImport: annualEnergyResults.peakGridImport,
      peakReduction: annualEnergyResults.peakReduction,
      batteryCycles: annualEnergyResults.batteryCycles,
      batteryUtilization: 0,
      revenueKwh: 0,
      hourlyData: [],
    };

    return runAdvancedSimulation(
      dailyAdapter,
      tariffData,
      systemCosts,
      solarCapacity,
      batteryCapacity,
      advancedConfig,
      tariffRates ?? undefined,
      touSettingsData,
      annualEnergyResults
    );
  }, [isAdvancedEnabled, hasFinancialData, annualEnergyResults, tariffData, systemCosts, solarCapacity, batteryCapacity, advancedConfig, tariffRates, touSettingsData]);

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

      // IMPORTANT:
      // Auto-save must NEVER overwrite a manually saved (named) simulation.
      // Instead, maintain a dedicated auto-save record per project.
      const { data: existingAuto, error: existingAutoError } = await supabase
        .from("project_simulations")
        .select("id,name")
        .eq("project_id", projectId)
        .ilike("name", "Auto-saved%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingAutoError) throw existingAutoError;

      const existingId = existingAuto?.id;
      
      const simulationData = {
        project_id: projectId,
        name: simulationName,
        simulation_type: solarDataSource,
        solar_capacity_kwp: solarCapacity,
        battery_capacity_kwh: includesBattery ? batteryCapacity : 0,
        battery_power_kw: includesBattery ? batteryPower : 0,
        solar_orientation: pvConfig.location,
        solar_tilt_degrees: pvConfig.tilt,
        annual_solar_savings: hasFinancialData ? financialResults.annualSavings : 0,
        annual_grid_cost: annualEnergyResults.totalAnnualGridImport * 2.5,
        payback_years: hasFinancialData ? financialResults.paybackYears : 0,
        roi_percentage: hasFinancialData ? financialResults.roi : 0,
        results_json: JSON.parse(JSON.stringify({
          totalDailyLoad: annualEnergyResults.totalAnnualLoad / 365,
          totalDailySolar: annualEnergyResults.totalAnnualSolar / 365,
          totalGridImport: annualEnergyResults.totalAnnualGridImport / 365,
          totalSolarUsed: annualEnergyResults.totalAnnualSolarUsed / 365,
          annualSavings: hasFinancialData ? financialResults.annualSavings : 0,
          systemCost: financialResults.systemCost,
          paybackYears: hasFinancialData ? financialResults.paybackYears : 0,
          roi: hasFinancialData ? financialResults.roi : 0,
          peakDemand: annualEnergyResults.peakLoad,
          newPeakDemand: annualEnergyResults.peakGridImport,
          pvConfig,
          solarDataSource,
          inverterConfig,
          systemCosts,
          // Blended solar rate for IRR/financial modeling
          blendedSolarRate: selectedBlendedRate,
          blendedRateType,
          useHourlyTouRates,
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
          // Save module and inverter counts for layout comparison
          moduleCount: moduleMetrics.moduleCount,
          inverterCount: inverterConfig.inverterCount,
          // Save battery dispatch strategy
          batteryStrategy,
          dispatchConfig,
          chargeTouPeriod,
          dischargeTouSelection,
          // Save battery characteristics
          batteryChargeCRate,
          batteryDischargeCRate,
          batteryDoD,
          batteryMinSoC,
          batteryMaxSoC,
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
    batteryStrategy,
    JSON.stringify(dispatchConfig),
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
        batteryChargeCRate={batteryChargeCRate}
        onBatteryChargeCRateChange={setBatteryChargeCRate}
        batteryDischargeCRate={batteryDischargeCRate}
        onBatteryDischargeCRateChange={setBatteryDischargeCRate}
        batteryDoD={batteryDoD}
        batteryMinSoC={batteryMinSoC}
        onBatteryMinSoCChange={setBatteryMinSoC}
        batteryMaxSoC={batteryMaxSoC}
        onBatteryMaxSoCChange={setBatteryMaxSoC}
        batteryStrategy={batteryStrategy}
        onBatteryStrategyChange={setBatteryStrategy}
        dispatchConfig={dispatchConfig}
        onDispatchConfigChange={setDispatchConfig}
        chargeTouPeriod={chargeTouPeriod}
        onChargeTouPeriodChange={setChargeTouPeriod}
        dischargeTouSelection={dischargeTouSelection}
        onDischargeTouSelectionChange={handleDischargeTouSelectionChange}
        touPeriodToWindows={touPeriodToWindows}
        dischargeSources={dispatchConfig.dischargeSources}
        onDischargeSourcesChange={(sources) => setDispatchConfig(prev => ({ ...prev, dischargeSources: sources }))}
      />

      {/* Scenario Comparison */}
      {hasFinancialData && isAdvancedEnabled && (
        <AdvancedConfigComparison
          currentConfig={advancedConfig}
          energyResults={{
            totalDailyLoad: annualEnergyResults.totalAnnualLoad / 365,
            totalDailySolar: annualEnergyResults.totalAnnualSolar / 365,
            totalGridImport: annualEnergyResults.totalAnnualGridImport / 365,
            totalGridExport: annualEnergyResults.totalAnnualGridExport / 365,
            totalSolarUsed: annualEnergyResults.totalAnnualSolarUsed / 365,
            totalBatteryCharge: annualEnergyResults.totalAnnualBatteryCharge / 365,
            totalBatteryDischarge: annualEnergyResults.totalAnnualBatteryDischarge / 365,
            totalBatteryChargeFromGrid: annualEnergyResults.totalAnnualBatteryChargeFromGrid / 365,
            selfConsumptionRate: annualEnergyResults.selfConsumptionRate,
            solarCoverageRate: annualEnergyResults.solarCoverageRate,
            peakLoad: annualEnergyResults.peakLoad,
            peakGridImport: annualEnergyResults.peakGridImport,
            peakReduction: annualEnergyResults.peakReduction,
            batteryCycles: annualEnergyResults.batteryCycles,
            batteryUtilization: 0,
            revenueKwh: 0,
            hourlyData: [],
          }}
          tariffData={tariffData}
          systemCosts={systemCosts}
          solarCapacity={solarCapacity}
          batteryCapacity={batteryCapacity}
          onApplyConfig={setAdvancedConfig}
          tariffRates={tariffRates ?? undefined}
          touSettings={touSettingsData}
        />
      )}

      {/* Note: System Costs are now configured exclusively in the Costs tab */}

      {/* System Configuration Carousel */}
      <ConfigCarousel
        panes={[
          {
            id: 'inverters',
            label: 'Inverters',
            icon: <Zap className="h-4 w-4" />,
            enabled: includesSolar,
            disabledMessage: 'Enable Solar PV to configure inverters',
            content: (
              <Card className={solarExceedsLimit ? "border-destructive/50" : ""}>
                <CardContent className="pt-4">
                  <InverterSliderPanel
                    config={inverterConfig}
                    onChange={setInverterConfig}
                    currentSolarCapacity={solarCapacity}
                    onSolarCapacityChange={setSolarCapacity}
                    maxSolarKva={maxSolarKva}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: 'solarPV',
            label: 'Solar Modules',
            icon: <Sun className="h-4 w-4" />,
            enabled: includesSolar,
            disabledMessage: 'Solar PV is not enabled for this project',
            content: (
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
                  {/* Solar Module Config (no inverter size - moved to Inverters tab) */}
                  <div>
                    <InverterSizeModuleConfig
                      config={inverterConfig}
                      onChange={setInverterConfig}
                      onSolarCapacityChange={setSolarCapacity}
                    />
                  </div>
                  {/* Energy output estimate */}
                  <div className="pt-2 border-t space-y-2 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-muted-foreground text-[10px]">Expected daily output</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={dailyOutputOverride ?? (annualPVsystResult 
                            ? Math.round(annualPVsystResult.eGrid / 365)
                            : Math.round(annualEnergyResults.totalAnnualSolar / 365))}
                          onChange={(e) => setDailyOutputOverride(parseInt(e.target.value) || 0)}
                          className="h-6 w-20 text-right text-xs"
                        />
                        <span className="text-xs text-muted-foreground">kWh</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setDailyOutputOverride(null)} title="Reset to calculated value">
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
                            : Math.round(annualEnergyResults.totalAnnualSolar / solarCapacity))}
                          onChange={(e) => setSpecificYieldOverride(parseInt(e.target.value) || 0)}
                          className="h-6 w-20 text-right text-xs"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">kWh/kWp/yr</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSpecificYieldOverride(null)} title="Reset to calculated value">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Production Reduction */}
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
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setProductionReductionPercent(15)} title="Reset to default (15%)">
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
            ),
          },
          {
            id: 'battery',
            label: 'Battery',
            icon: <Battery className="h-4 w-4" />,
            enabled: includesBattery,
            disabledMessage: 'Battery storage is not enabled for this project',
            content: (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Battery className="h-4 w-4" />
                    Battery Storage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Row 1: AC Capacity (user input) */}
                  <div className="space-y-1">
                    <Label className="text-xs">AC Capacity (kWh)</Label>
                    <Input
                      type="number"
                      value={batteryAcCapacity}
                      onChange={(e) => setBatteryAcCapacity(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-8"
                      min={0}
                      max={5000}
                      step={10}
                    />
                  </div>

                  {/* Row 2: Charge Power, Discharge Power, DC Capacity (all computed) */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Charge Power (kW)</Label>
                      <Input
                        type="number"
                        value={batteryChargePower.toFixed(1)}
                        disabled
                        className="h-8 bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discharge Power (kW)</Label>
                      <Input
                        type="number"
                        value={batteryDischargePower.toFixed(1)}
                        disabled
                        className="h-8 bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">DC Capacity (kWh)</Label>
                      <Input
                        type="number"
                        value={batteryCapacity}
                        disabled
                        className="h-8 bg-muted"
                      />
                    </div>
                  </div>



                  {/* Summary stats */}
                  <div className="pt-2 border-t space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Usable capacity</span>
                      <span className="text-foreground">{batteryAcCapacity} kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily cycles</span>
                      <span className="text-foreground">{annualEnergyResults.batteryCycles.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Energy throughput</span>
                      <span className="text-foreground">{(annualEnergyResults.totalAnnualBatteryDischarge / 365).toFixed(0)} kWh</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: 'financial',
            label: 'Financial',
            icon: <TrendingUp className="h-4 w-4" />,
            enabled: hasFinancialData,
            cannotToggle: true,
            disabledMessage: 'Select a tariff to enable financial analysis',
            content: (
              <div className="flex flex-col gap-4">
                {/* Simulation Tariff Rate Selector */}
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
                          disabled={useHourlyTouRates}
                        >
                          <SelectTrigger className={`w-56 ${useHourlyTouRates ? 'opacity-50' : ''}`}>
                            <SelectValue placeholder="Select rate type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="solarHours">
                              <div className="flex items-center gap-2">
                                <Sun className="h-4 w-4 text-amber-500" />
                                <span>Solar Hours - Annual</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="solarHoursHigh">
                              <div className="flex items-center gap-2">
                                <Sun className="h-4 w-4 text-orange-500" />
                                <span>Solar Hours - High (Winter)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="solarHoursLow">
                              <div className="flex items-center gap-2">
                                <Sun className="h-4 w-4 text-yellow-500" />
                                <span>Solar Hours - Low (Summer)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="allHours">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>All Hours - Annual</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="allHoursHigh">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-orange-500" />
                                <span>All Hours - High (Winter)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="allHoursLow">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <span>All Hours - Low (Summer)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="hourly-rates-toggle"
                            checked={useHourlyTouRates}
                            onCheckedChange={(checked) => onUseHourlyTouRatesChange?.(checked)}
                          />
                          <Label htmlFor="hourly-rates-toggle" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                            Hourly Rates
                          </Label>
                        </div>
                        <span className={`text-lg font-bold ml-auto ${useHourlyTouRates ? 'text-primary' : blendedRateType?.startsWith('solarHours') ? 'text-amber-600' : ''}`}>
                          {useHourlyTouRates ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Hourly TOU
                            </span>
                          ) : (
                            <>R{(() => {
                              switch (blendedRateType) {
                                case 'solarHours': return annualBlendedRates.solarHours.annual;
                                case 'solarHoursHigh': return annualBlendedRates.solarHours.high;
                                case 'solarHoursLow': return annualBlendedRates.solarHours.low;
                                case 'allHours': return annualBlendedRates.allHours.annual;
                                case 'allHoursHigh': return annualBlendedRates.allHours.high;
                                case 'allHoursLow': return annualBlendedRates.allHours.low;
                                default: return annualBlendedRates.solarHours.annual;
                              }
                            })().toFixed(4)}/kWh</>
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {/* Financial Return Outputs */}
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
                      <div className="divide-y divide-border text-sm">
                        <FinancialMetricRow
                          label="ZAR / kWh (Incl. 3-Yr O&M)"
                          value={((financialResults.systemCost + threeYearOM) / ((annualPVsystResult?.eGrid ?? annualEnergyResults.totalAnnualSolar) * reductionFactor)).toFixed(2)}
                          breakdown={{
                            formula: "(System Cost + 3-Yr O&M) ÷ (Annual Production × Reduction)",
                            inputs: [
                              { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                              { label: "3-Yr O&M Total", value: `R ${Math.round(threeYearOM).toLocaleString()}` },
                              { label: "Annual Production", value: `${Math.round(annualPVsystResult?.eGrid ?? annualEnergyResults.totalAnnualSolar).toLocaleString()} kWh` },
                              { label: "Reduction Factor", value: `${(reductionFactor * 100).toFixed(0)}%` },
                              { label: "Note", value: "Uses total production (LCOE basis). Revenue kWh shown in cashflow table." },
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
                          const year1Projection = advancedResults?.yearlyProjections?.[0];
                          const totalIncomeY1 = year1Projection?.totalIncomeR ?? financialResults.annualSavings;
                          const omCostY1 = year1Projection?.maintenanceCost ?? (systemCosts.maintenancePerYear ?? 0);
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
            ),
          },
        ] as CarouselPane[]}
        onRequestEnable={onRequestEnableFeature}
      />

      {/* Energy Results Summary (always visible - tariff-independent) */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily Load</CardDescription>
            <CardTitle className="text-2xl">{Math.round(annualEnergyResults.totalAnnualLoad / 365)} kWh</CardTitle>
          </CardHeader>
        </Card>
        {includesSolar && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Solar Generated</CardDescription>
              <CardTitle className="text-2xl text-amber-500">
                {Math.round(annualEnergyResults.totalAnnualSolar / 365)} kWh
              </CardTitle>
            </CardHeader>
          </Card>
        )}
        {includesSolar && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Annual Production</CardDescription>
              <CardTitle className="text-2xl text-chart-2">
                {annualPVsystResult 
                  ? Math.round(annualPVsystResult.eGrid * reductionFactor).toLocaleString()
                  : Math.round(annualEnergyResults.totalAnnualSolar).toLocaleString()} kWh
              </CardTitle>
              {annualPVsystResult && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(annualPVsystResult.specificYield * reductionFactor).toLocaleString()} kWh/kWp • PR: {annualPVsystResult.performanceRatio.toFixed(1)}%
                </p>
              )}
            </CardHeader>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Grid Import</CardDescription>
            <CardTitle className="text-2xl">{Math.round(annualEnergyResults.totalAnnualGridImport / 365)} kWh</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Self-Consumption</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {Math.round(annualEnergyResults.selfConsumptionRate)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Reduction</CardDescription>
            <CardTitle className="text-2xl">
              {Math.round(annualEnergyResults.peakReduction)}%
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
          solarDataSource,
          inverterConfig,
          systemCosts,
          pvsystConfig,
          advancedConfig,
          lossCalculationMode,
          productionReductionPercent,
          moduleCount: moduleMetrics.moduleCount,
        }}
        currentResults={{
          totalDailyLoad: annualEnergyResults.totalAnnualLoad / 365,
          totalDailySolar: annualEnergyResults.totalAnnualSolar / 365,
          totalGridImport: annualEnergyResults.totalAnnualGridImport / 365,
          totalSolarUsed: annualEnergyResults.totalAnnualSolarUsed / 365,
          annualSavings: hasFinancialData ? financialResults.annualSavings : 0,
          systemCost: financialResults.systemCost,
          paybackYears: hasFinancialData ? financialResults.paybackYears : 0,
          roi: hasFinancialData ? financialResults.roi : 0,
          peakDemand: annualEnergyResults.peakLoad,
          newPeakDemand: annualEnergyResults.peakGridImport,
        }}
        onLoadSimulation={(config) => {
          setSolarCapacity(config.solarCapacity);
          if (includesBattery) {
            const dcCap = config.batteryCapacity || 0;
            const pwr = config.batteryPower || 0;
            const dod = config.batteryDoD || batteryDoD || 85;
            const savedChargeCRate = config.batteryChargeCRate ?? config.batteryCRate;
            const savedDischargeCRate = config.batteryDischargeCRate ?? config.batteryCRate;
            // Derive minSoC/maxSoC from saved DoD if no explicit values
            const loadedMinSoC = config.batteryMinSoC ?? Math.round((100 - dod) / 2);
            const loadedMaxSoC = config.batteryMaxSoC ?? Math.round(loadedMinSoC + dod);
            setBatteryMinSoC(loadedMinSoC);
            setBatteryMaxSoC(loadedMaxSoC);
            const ac = Math.round(dcCap * dod / 100);
            setBatteryAcCapacity(ac);
            const fallbackCRate = ac > 0 ? Math.round(pwr / ac * 100) / 100 : 0.5;
            setBatteryChargeCRate(savedChargeCRate ?? fallbackCRate);
            setBatteryDischargeCRate(savedDischargeCRate ?? fallbackCRate);
            setBatteryMinSoC(config.batteryMinSoC ?? 10);
            setBatteryMaxSoC(config.batteryMaxSoC ?? 95);
          }
          // Load battery dispatch strategy if present
          if (config.batteryStrategy) {
            setBatteryStrategy(config.batteryStrategy as BatteryDispatchStrategy);
            setDispatchConfig(config.dispatchConfig ?? getDefaultDispatchConfig(config.batteryStrategy as BatteryDispatchStrategy));
          }
          if (config.chargeTouPeriod) setChargeTouPeriod(config.chargeTouPeriod as TOUPeriod);
          if (config.dischargeTouSelection) {
            setDischargeTouSelection(config.dischargeTouSelection);
          } else if (config.dischargeTouPeriod) {
            const period = config.dischargeTouPeriod as TOUPeriod;
            const flags = { peak: period === 'peak', standard: period === 'standard', offPeak: period === 'off-peak' };
            setDischargeTouSelection({
              highSeason: { weekday: { ...flags }, weekend: { peak: false, standard: false, offPeak: false } },
              lowSeason: { weekday: { ...flags }, weekend: { peak: false, standard: false, offPeak: false } },
            });
          }
          if (config.pvConfig && Object.keys(config.pvConfig).length > 0) {
            setPvConfig((prev) => ({ ...prev, ...config.pvConfig }));
          }
          // Load inverter config if present
          if (config.inverterConfig) {
            setInverterConfig((prev) => ({ ...prev, ...config.inverterConfig }));
          }
          // Load solar data source if present
          if (config.solarDataSource) {
            setSolarDataSource(config.solarDataSource);
          }
          // Load PVsyst config if present
          if (config.pvsystConfig) {
            setPvsystConfig((prev) => ({
              ...DEFAULT_PVSYST_CONFIG,
              ...prev,
              ...config.pvsystConfig,
              irradiance: {
                ...DEFAULT_PVSYST_CONFIG.irradiance,
                ...config.pvsystConfig?.irradiance,
              },
              array: {
                ...DEFAULT_PVSYST_CONFIG.array,
                ...config.pvsystConfig?.array,
              },
              system: {
                ...DEFAULT_PVSYST_CONFIG.system,
                inverter: {
                  ...DEFAULT_PVSYST_CONFIG.system.inverter,
                  ...config.pvsystConfig?.system?.inverter,
                },
              },
              lossesAfterInverter: {
                ...DEFAULT_PVSYST_CONFIG.lossesAfterInverter,
                ...config.pvsystConfig?.lossesAfterInverter,
              },
            }));
          }
          // Load loss calculation mode if present
          if (config.lossCalculationMode) {
            setLossCalculationMode(config.lossCalculationMode);
          }
          // Load production reduction if present
          if (config.productionReductionPercent !== undefined) {
            setProductionReductionPercent(config.productionReductionPercent);
          }
          // Load advanced config if present
          if (config.advancedConfig) {
            setAdvancedConfig((prev) => ({
              ...DEFAULT_ADVANCED_CONFIG,
              ...prev,
              ...config.advancedConfig,
              seasonal: {
                ...DEFAULT_ADVANCED_CONFIG.seasonal,
                ...config.advancedConfig?.seasonal,
              },
              degradation: {
                ...DEFAULT_ADVANCED_CONFIG.degradation,
                ...config.advancedConfig?.degradation,
              },
              financial: {
                ...DEFAULT_ADVANCED_CONFIG.financial,
                ...config.advancedConfig?.financial,
              },
              gridConstraints: {
                ...DEFAULT_ADVANCED_CONFIG.gridConstraints,
                ...config.advancedConfig?.gridConstraints,
              },
              loadGrowth: {
                ...DEFAULT_ADVANCED_CONFIG.loadGrowth,
                ...config.advancedConfig?.loadGrowth,
              },
            }));
          }
          // Load system costs if present
          if (config.systemCosts) {
            const savedCosts = config.systemCosts as any;
            onSystemCostsChange({
              solarCostPerKwp: savedCosts.solarCostPerKwp,
              batteryCostPerKwh: savedCosts.batteryCostPerKwh,
              solarMaintenancePercentage: savedCosts.solarMaintenancePercentage ?? savedCosts.maintenancePercentage ?? 3.5,
              batteryMaintenancePercentage: savedCosts.batteryMaintenancePercentage ?? 1.5,
              maintenancePerYear: savedCosts.maintenancePerYear ?? 0,
              healthAndSafetyCost: savedCosts.healthAndSafetyCost ?? 0,
              waterPointsCost: savedCosts.waterPointsCost ?? 0,
              cctvCost: savedCosts.cctvCost ?? 0,
              mvSwitchGearCost: savedCosts.mvSwitchGearCost ?? 0,
              insuranceCostPerYear: savedCosts.insuranceCostPerYear ?? 0,
              insuranceRatePercent: savedCosts.insuranceRatePercent ?? 1.0,
              professionalFeesPercent: savedCosts.professionalFeesPercent ?? 0,
              projectManagementPercent: savedCosts.projectManagementPercent ?? 0,
              contingencyPercent: savedCosts.contingencyPercent ?? 0,
              replacementYear: savedCosts.replacementYear ?? 10,
              equipmentCostPercent: savedCosts.equipmentCostPercent ?? 45,
              moduleSharePercent: savedCosts.moduleSharePercent ?? 70,
              inverterSharePercent: savedCosts.inverterSharePercent ?? 30,
              solarModuleReplacementPercent: savedCosts.solarModuleReplacementPercent ?? 10,
              inverterReplacementPercent: savedCosts.inverterReplacementPercent ?? 50,
              batteryReplacementPercent: savedCosts.batteryReplacementPercent ?? 30,
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
      <Tabs defaultValue="building">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="building">Building Profile</TabsTrigger>
          <TabsTrigger value="load">Load Profile</TabsTrigger>
          <TabsTrigger value="grid">Grid Profile</TabsTrigger>
          <TabsTrigger value="pv">PV Profile</TabsTrigger>
          {includesBattery && batteryCapacity > 0 && (
            <TabsTrigger value="battery">Battery Profile</TabsTrigger>
          )}
          <TabsTrigger value="loadshed" className="gap-1">
            <Zap className="h-3 w-3" />
            Load Shedding
          </TabsTrigger>
          {annualEnergyResultsSolcast && (
            <TabsTrigger value="compare" className="gap-1">
              <Cloud className="h-3 w-3" />
              Data Comparison
            </TabsTrigger>
          )}
        </TabsList>

        {/* Building Profile Tab */}
        <TabsContent value="building" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!showAnnualAverage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay("prev")}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div>
                    <CardTitle className="text-base">{showAnnualAverage ? "Annual Average (Year 1)" : selectedDay}</CardTitle>
                    <CardDescription className="text-xs">Cumulative profile: load, grid, PV, and battery combined</CardDescription>
                  </div>
                  {!showAnnualAverage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay("next")}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showAnnualAverage} onCheckedChange={setShowAnnualAverage} className="scale-75" />
                    Annual Avg
                  </Label>
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showHighSeason} onCheckedChange={setShowHighSeason} className="scale-75" />
                    {showHighSeason ? "High Demand" : "Low Demand"}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <BuildingProfileChart 
                chartData={simulationChartData} 
                showTOU={true} 
                isWeekend={loadProfileIsWeekend} 
                unit="kW"
                includesBattery={includesBattery && batteryCapacity > 0}
                isHighSeason={showHighSeason}
              />
              <TOULegend isHighSeason={showHighSeason} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Load Profile Tab */}
        <TabsContent value="load" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!showAnnualAverage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay("prev")}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div>
                    <CardTitle className="text-base">{showAnnualAverage ? "Annual Average (Year 1)" : selectedDay}</CardTitle>
                    <CardDescription className="text-xs">Tenant load and estimated downstream tenant consumption</CardDescription>
                  </div>
                  {!showAnnualAverage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay("next")}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showAnnualAverage} onCheckedChange={setShowAnnualAverage} className="scale-75" />
                    Annual Avg
                  </Label>
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showHighSeason} onCheckedChange={setShowHighSeason} className="scale-75" />
                    {showHighSeason ? "High Demand" : "Low Demand"}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <LoadChart 
                chartData={simulationChartData} 
                showTOU={true} 
                isWeekend={loadProfileIsWeekend} 
                unit="kW"
                isHighSeason={showHighSeason}
              />
              <TOULegend isHighSeason={showHighSeason} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grid Profile Tab */}
        <TabsContent value="grid" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!showAnnualAverage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay("prev")}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div>
                    <CardTitle className="text-base">{showAnnualAverage ? "Annual Average (Year 1)" : selectedDay}</CardTitle>
                    <CardDescription className="text-xs">kW and kWh as perceived by the network operator</CardDescription>
                  </div>
                  {!showAnnualAverage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay("next")}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showAnnualAverage} onCheckedChange={setShowAnnualAverage} className="scale-75" />
                    Annual Avg
                  </Label>
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showHighSeason} onCheckedChange={setShowHighSeason} className="scale-75" />
                    {showHighSeason ? "High Demand" : "Low Demand"}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <GridFlowChart
                chartData={simulationChartData}
                showTOU={true}
                isWeekend={loadProfileIsWeekend}
                unit="kW"
                isHighSeason={showHighSeason}
              />
              <TOULegend isHighSeason={showHighSeason} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PV Profile Tab */}
        <TabsContent value="pv" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{showAnnualAverage ? "Annual Average (Year 1)" : "PV Generation"}</CardTitle>
                  <CardDescription>PV production output</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showHighSeason} onCheckedChange={setShowHighSeason} className="scale-75" />
                    {showHighSeason ? "High Demand" : "Low Demand"}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SolarChart
                chartData={simulationChartData}
                showTOU={true}
                isWeekend={false}
                dcAcRatio={inverterConfig.dcAcRatio}
                show1to1Comparison={inverterConfig.dcAcRatio > 1}
                unit="kW"
                maxPvAcKva={solarCapacity}
                isHighSeason={showHighSeason}
              />
              <TOULegend isHighSeason={showHighSeason} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Battery Profile Tab */}
        {includesBattery && batteryCapacity > 0 && (
          <TabsContent value="battery" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div>
                  <CardTitle>{showAnnualAverage ? "Annual Average (Year 1)" : "Battery Storage"}</CardTitle>
                  <CardDescription>Charging power and discharging power</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <BatteryChart
                  chartData={simulationChartData}
                  batteryCapacity={batteryCapacity}
                  batteryAcCapacity={batteryAcCapacity}
                  batteryPower={batteryChargePower}
                />
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
        {annualEnergyResultsSolcast && (
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
                      <p className="text-lg font-semibold">{(annualEnergyResultsGeneric.totalAnnualSolar / 365).toFixed(0)} kWh</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Grid Import</p>
                      <p className="text-lg font-semibold">{(annualEnergyResultsGeneric.totalAnnualGridImport / 365).toFixed(0)} kWh</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Self-Consumption</p>
                      <p className="text-lg font-semibold">{Math.round(annualEnergyResultsGeneric.selfConsumptionRate)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Peak Reduction</p>
                      <p className="text-lg font-semibold">{Math.round(annualEnergyResultsGeneric.peakReduction)}%</p>
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
                        {(annualEnergyResultsSolcast!.totalAnnualSolar / 365).toFixed(0)} kWh
                        <DifferenceIndicator
                          baseValue={annualEnergyResultsGeneric.totalAnnualSolar / 365}
                          compareValue={annualEnergyResultsSolcast!.totalAnnualSolar / 365}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Grid Import</p>
                      <p className="text-lg font-semibold">
                        {(annualEnergyResultsSolcast!.totalAnnualGridImport / 365).toFixed(0)} kWh
                        <DifferenceIndicator
                          baseValue={annualEnergyResultsGeneric.totalAnnualGridImport / 365}
                          compareValue={annualEnergyResultsSolcast!.totalAnnualGridImport / 365}
                          invert
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Self-Consumption</p>
                      <p className="text-lg font-semibold">{Math.round(annualEnergyResultsSolcast!.selfConsumptionRate)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Peak Reduction</p>
                      <p className="text-lg font-semibold">{Math.round(annualEnergyResultsSolcast!.peakReduction)}%</p>
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
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Solar Output</p>
                    <p className={`text-lg font-semibold ${annualEnergyResultsSolcast!.totalAnnualSolar >= annualEnergyResultsGeneric.totalAnnualSolar
                        ? "text-green-600" : "text-amber-600"
                      }`}>
                      {((annualEnergyResultsSolcast!.totalAnnualSolar - annualEnergyResultsGeneric.totalAnnualSolar) /
                        annualEnergyResultsGeneric.totalAnnualSolar * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Grid Import</p>
                    <p className={`text-lg font-semibold ${annualEnergyResultsSolcast!.totalAnnualGridImport <= annualEnergyResultsGeneric.totalAnnualGridImport
                        ? "text-green-600" : "text-amber-600"
                      }`}>
                      {((annualEnergyResultsSolcast!.totalAnnualGridImport - annualEnergyResultsGeneric.totalAnnualGridImport) /
                        annualEnergyResultsGeneric.totalAnnualGridImport * 100).toFixed(1)}%
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
