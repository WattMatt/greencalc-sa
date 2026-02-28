import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sun, Battery, Zap, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Cloud, Loader2, Database, Activity, RefreshCw, Save } from "lucide-react";
import { DischargeTOUSelection, DEFAULT_DISCHARGE_TOU_SELECTION, TOUPeriod as LoadProfileTOUPeriod } from "./load-profile/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { useSolarProfiles, type SolarDataSource } from "./simulation/useSolarProfiles";
import { restoreSimulationState, type SimulationStateSetters } from "./simulation/restoreSimulationState";
import { useSimulationEngine } from "./simulation/useSimulationEngine";

import { SavedSimulations } from "./SavedSimulations";
import { SimulationKPICards } from "./simulation/SimulationKPICards";
import { SimulationChartTabs } from "./simulation/SimulationChartTabs";
import { FinancialConfigPane } from "./simulation/FinancialConfigPane";
import { useAutoSave } from "./simulation/useAutoSave";
import {
  PVSystemConfig,
  PVSystemConfigData,
  getDefaultPVConfig,
  SA_SOLAR_LOCATIONS,
  calculateSystemEfficiency,
} from "./PVSystemConfig";
import {
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
import { AdvancedResultsDisplay } from "./simulation/AdvancedResultsDisplay";
import { AdvancedConfigComparison } from "./simulation/AdvancedConfigComparison";
import { LoadSheddingAnalysisPanel } from "./simulation/LoadSheddingAnalysisPanel";
import { InverterSizing, InverterConfig, getDefaultInverterConfig } from "./InverterSizing";
import { InverterSizeModuleConfig } from "./InverterSizeModuleConfig";
import { InverterSliderPanel } from "./InverterSliderPanel";
import { getModulePresetById, getDefaultModulePreset, calculateModuleMetrics } from "./SolarModulePresets";
import { SystemCostsData } from "./SystemCostsManager";
import type { BlendedRateType } from "./TariffSelector";
import { 
  type LossCalculationMode, 
  type PVsystLossChainConfig, 
  DEFAULT_PVSYST_CONFIG,
} from "@/lib/pvsystLossChain";
import { PVsystLossChainConfig as PVsystLossChainConfigPanel } from "./PVsystLossChainConfig";
import { Tenant as FullTenant, ShopType as FullShopType } from "./load-profile/types";
import { ConfigCarousel, CarouselPane } from "./simulation/ConfigCarousel";

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
    staleTime: 0,
  });

  const savedResultsJson = lastSavedSimulation?.results_json as any;

  const getCachedSimulation = () => {
    const cached = queryClient.getQueryData<any>(["last-simulation", projectId]);
    return cached ? { sim: cached, json: cached?.results_json as any } : null;
  };
  
  const [solarCapacity, setSolarCapacity] = useState(() => {
    const c = getCachedSimulation();
    return c?.sim?.solar_capacity_kwp ?? 0;
  });
  const [batteryAcCapacity, setBatteryAcCapacity] = useState(() => {
    const c = getCachedSimulation();
    if (c) {
      const minSoC = c.json?.batteryMinSoC ?? 0;
      const maxSoC = c.json?.batteryMaxSoC ?? 0;
      const dod = maxSoC - minSoC;
      const dcCap = includesBattery ? (c.sim.battery_capacity_kwh || 0) : 0;
      return Math.round(dcCap * dod / 100);
    }
    return 0;
  });
  const [batteryChargeCRate, setBatteryChargeCRate] = useState(() => {
    const c = getCachedSimulation();
    if (c?.json?.batteryChargeCRate) return c.json.batteryChargeCRate;
    if (c?.json?.batteryCRate) return c.json.batteryCRate;
    return 0;
  });
  const [batteryDischargeCRate, setBatteryDischargeCRate] = useState(() => {
    const c = getCachedSimulation();
    if (c?.json?.batteryDischargeCRate) return c.json.batteryDischargeCRate;
    if (c?.json?.batteryCRate) return c.json.batteryCRate;
    return 0;
  });
  const [batteryMinSoC, setBatteryMinSoC] = useState(() => {
    const c = getCachedSimulation();
    return c?.json?.batteryMinSoC ?? 0;
  });
  const [batteryMaxSoC, setBatteryMaxSoC] = useState(() => {
    const c = getCachedSimulation();
    return c?.json?.batteryMaxSoC ?? 0;
  });
   
   const [batteryStrategy, setBatteryStrategy] = useState<BatteryDispatchStrategy>(() => {
     const c = getCachedSimulation();
     return c?.json?.batteryStrategy ?? 'none';
   });
   const [dispatchConfig, setDispatchConfig] = useState<DispatchConfig>(() => {
     const c = getCachedSimulation();
     return c?.json?.dispatchConfig ?? getDefaultDispatchConfig('none');
   });
   
   const [chargeTouPeriod, setChargeTouPeriod] = useState<TOUPeriod | undefined>(() => {
     const c = getCachedSimulation();
     return c?.json?.chargeTouPeriod ?? undefined;
   });
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

  const batteryDoD = batteryMaxSoC - batteryMinSoC;
  const batteryCapacity = batteryDoD > 0 ? Math.round(batteryAcCapacity / (batteryDoD / 100)) : 0;
  const batteryChargePower = Math.round(batteryAcCapacity * batteryChargeCRate * 10) / 10;
  const batteryDischargePower = Math.round(batteryAcCapacity * batteryDischargeCRate * 10) / 10;
  const batteryPower = Math.max(batteryChargePower, batteryDischargePower);
  const [pvConfig, setPvConfig] = useState<PVSystemConfigData>(getDefaultPVConfig);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [solarDataSource, setSolarDataSource] = useState<SolarDataSource>("pvgis_monthly");
  const [lossCalculationMode, setLossCalculationMode] = useState<LossCalculationMode>("simplified");
  const [pvsystConfig, setPvsystConfig] = useState<PVsystLossChainConfig>(DEFAULT_PVSYST_CONFIG);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedSimulationConfig>(DEFAULT_ADVANCED_CONFIG);
  const [inverterConfig, setInverterConfig] = useState<InverterConfig>(getDefaultInverterConfig);
  
  const [dailyOutputOverride, setDailyOutputOverride] = useState<number | null>(null);
  const [specificYieldOverride, setSpecificYieldOverride] = useState<number | null>(null);
  const [productionReductionPercent, setProductionReductionPercent] = useState(15);
  
  const [loadedSimulationName, setLoadedSimulationName] = useState<string | null>(null);
  const [loadedSimulationDate, setLoadedSimulationDate] = useState<string | null>(null);
  const hasInitializedFromSaved = useRef(false);
  
  const stateSetters: SimulationStateSetters = useMemo(() => ({
    setSolarCapacity, setBatteryAcCapacity, setBatteryMinSoC, setBatteryMaxSoC,
    setBatteryChargeCRate, setBatteryDischargeCRate, setBatteryStrategy, setDispatchConfig,
    setChargeTouPeriod, setDischargeTouSelection, setPvConfig, setInverterConfig,
    setSolarDataSource, setPvsystConfig, setLossCalculationMode, setProductionReductionPercent,
    setAdvancedConfig, setLoadedSimulationName, setLoadedSimulationDate,
    onSystemCostsChange,
  }), [onSystemCostsChange]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [showAnnualAverage, setShowAnnualAverage] = useState(true);
  const [comparisonTabViewed, setComparisonTabViewed] = useState(false);

  const navigateDayIndex = useCallback((direction: "prev" | "next") => {
    setSelectedDayIndex(prev => {
      if (direction === "prev") return Math.max(0, prev - 1);
      return Math.min(364, prev + 1);
    });
  }, []);

  const dayDateInfo = useMemo(() => {
    const date = new Date(2026, 0, 1 + selectedDayIndex);
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    const dayLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const dayTypeName = dayOfWeek === 0 ? 'Sunday' : dayOfWeek === 6 ? 'Saturday' : 'Weekday';
    return { dayLabel, dayName, dayOfWeek, month, dayTypeName, dayNumber: selectedDayIndex + 1 };
  }, [selectedDayIndex]);

  // Auto-load the last saved simulation when data arrives (only once per projectId)
  useEffect(() => {
    hasInitializedFromSaved.current = false;
  }, [projectId]);

  useEffect(() => {
    if (isFetched && lastSavedSimulation && !hasInitializedFromSaved.current) {
      hasInitializedFromSaved.current = true;
      
      restoreSimulationState({
        solarCapacity: lastSavedSimulation.solar_capacity_kwp || 0,
        batteryCapacityDc: includesBattery ? (lastSavedSimulation.battery_capacity_kwh || 0) : 0,
        batteryPower: includesBattery ? (lastSavedSimulation.battery_power_kw || 0) : 0,
        simulationType: lastSavedSimulation.simulation_type,
        simulationName: lastSavedSimulation.name,
        simulationDate: lastSavedSimulation.created_at,
        batteryMinSoC: savedResultsJson?.batteryMinSoC,
        batteryMaxSoC: savedResultsJson?.batteryMaxSoC,
        batteryChargeCRate: savedResultsJson?.batteryChargeCRate,
        batteryDischargeCRate: savedResultsJson?.batteryDischargeCRate,
        batteryCRate: savedResultsJson?.batteryCRate,
        batteryStrategy: savedResultsJson?.batteryStrategy,
        dispatchConfig: savedResultsJson?.dispatchConfig,
        chargeTouPeriod: savedResultsJson?.chargeTouPeriod,
        dischargeTouPeriod: savedResultsJson?.dischargeTouPeriod,
        dischargeTouSelection: savedResultsJson?.dischargeTouSelection,
        pvConfig: savedResultsJson?.pvConfig,
        inverterConfig: savedResultsJson?.inverterConfig,
        pvsystConfig: savedResultsJson?.pvsystConfig,
        lossCalculationMode: savedResultsJson?.lossCalculationMode,
        productionReductionPercent: savedResultsJson?.productionReductionPercent,
        advancedConfig: savedResultsJson?.advancedConfig,
      }, stateSetters, includesBattery);
    }
  }, [isFetched, lastSavedSimulation, savedResultsJson, includesBattery, stateSetters]);

  // Calculate module metrics for PVsyst calculations
  const moduleMetrics = useMemo(() => {
    const selectedModule = inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule
      ? inverterConfig.customModule
      : getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
    
    const currentAcCapacity = inverterConfig.inverterSize * inverterConfig.inverterCount;
    const metrics = {
      ...calculateModuleMetrics(currentAcCapacity, inverterConfig.dcAcRatio, selectedModule),
      moduleName: selectedModule.name,
    };
    
    return metrics;
  }, [inverterConfig]);

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

  // ── Solar profiles hook ──
  const {
    solcastData, solcastLoading,
    pvgisTmyData, pvgisMonthlyData, pvgisLoadingTMY, pvgisLoadingMonthly,
    solarProfile, solarProfileSolcast, solarProfileGenericSimplified,
    solcastPvProfileData,
    annualPVsystResult,
    tmyDcProfile8760, tmySolarProfile8760, tmyInverterLossMultiplier,
    selectedLocation, effectiveLat, effectiveLng,
    isLoadingData, hasRealData, activeDataSourceLabel,
    reductionFactor,
  } = useSolarProfiles({
    pvConfig, moduleMetrics, solarDataSource, lossCalculationMode, pvsystConfig,
    productionReductionPercent, inverterConfig, project, projectId, includesSolar,
  });
  const solarProfileGeneric = solarProfileGenericSimplified;

  // ── Simulation engine hook (energy, financial, chart data) ──
  const {
    energyConfig,
    loadProfile,
    loadProfileChartData,
    loadProfileTotalDaily,
    loadProfilePeakHour,
    loadProfileLoadFactor,
    loadProfileIsWeekend,
    tenantsWithScada,
    tenantsEstimated,
    annualEnergyResults,
    annualEnergyResultsGeneric,
    annualEnergyResultsSolcast,
    representativeDay,
    touPeriodsForDay,
    tariffData,
    tariffRates,
    tariff,
    annualBlendedRates,
    selectedBlendedRate,
    hasFinancialData,
    financialResults,
    financialResultsGeneric,
    financialResultsSolcast,
    basicFinancialMetrics,
    threeYearOM,
    advancedResults,
    unifiedPaybackPeriod,
    isAdvancedEnabled,
    simulationChartData,
  } = useSimulationEngine({
    projectId, project, tenants, shopTypes,
    solarCapacity, batteryCapacity, batteryAcCapacity, batteryPower,
    batteryChargePower, batteryDischargePower,
    batteryMinSoC, batteryMaxSoC, batteryStrategy, dispatchConfig,
    includesSolar, includesBattery,
    inverterConfig, moduleMetrics,
    solarDataSource, solcastPvProfileData,
    solarProfile, solarProfileSolcast, solarProfileGeneric: solarProfileGenericSimplified,
    tmySolarProfile8760, tmyDcProfile8760, tmyInverterLossMultiplier,
    annualPVsystResult, reductionFactor,
    selectedDayIndex, showAnnualAverage,
    dayDateInfo: { dayOfWeek: dayDateInfo.dayOfWeek, month: dayDateInfo.month },
    comparisonTabViewed,
    systemCosts, blendedRateType, useHourlyTouRates,
    advancedConfig, touSettingsData, touPeriodToWindows,
  });

  // Auto-save hook
  const { isAutoSaving, lastSavedAt, triggerSave } = useAutoSave({
    projectId,
    solarDataSource,
    solarCapacity,
    batteryCapacity,
    batteryPower,
    includesBattery,
    pvConfig,
    inverterConfig,
    systemCosts,
    lossCalculationMode,
    pvsystConfig,
    productionReductionPercent,
    advancedConfig,
    moduleCount: moduleMetrics.moduleCount,
    batteryStrategy,
    dispatchConfig,
    chargeTouPeriod,
    dischargeTouSelection,
    batteryChargeCRate,
    batteryDischargeCRate,
    batteryDoD,
    batteryMinSoC,
    batteryMaxSoC,
    blendedRateType,
    useHourlyTouRates,
    selectedBlendedRate,
    annualBlendedRates,
    annualEnergyResults,
    financialResults,
    hasFinancialData,
    tenantCount: tenants.length,
    hasInitializedFromSaved: hasInitializedFromSaved.current,
    isFetched,
  });

  // Expose autoSave method to parent
  useImperativeHandle(ref, () => ({
    autoSave: triggerSave,
  }), [triggerSave]);

  // Connection size and max solar limit
  const connectionSizeKva = project.connection_size_kva ? Number(project.connection_size_kva) : null;
  const maxSolarKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const solarExceedsLimit = maxSolarKva && solarCapacity > maxSolarKva;
  const systemEfficiency = calculateSystemEfficiency(pvConfig);


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

      {/* Saved Configurations Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between h-auto py-2.5 px-3">
            <div className="flex items-center gap-2 text-sm">
              {isLoadingLastSaved ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Loading saved configurations...</span>
                </>
              ) : loadedSimulationName ? (
                <>
                  <Database className="h-4 w-4 text-primary" />
                  <span className="font-medium">{loadedSimulationName}</span>
                  {loadedSimulationDate && (
                    <span className="text-muted-foreground">
                      • {format(new Date(loadedSimulationDate), "dd MMM yyyy HH:mm")}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Saved Configurations</span>
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
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
              batteryChargeCRate,
              batteryDischargeCRate,
              batteryDoD,
              batteryMinSoC,
              batteryMaxSoC,
              batteryStrategy,
              dispatchConfig,
              chargeTouPeriod,
              dischargeTouSelection,
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
              restoreSimulationState({
                solarCapacity: config.solarCapacity,
                batteryCapacityDc: config.batteryCapacity || 0,
                batteryPower: config.batteryPower || 0,
                batteryDoD: config.batteryDoD || batteryDoD || 85,
                batteryMinSoC: config.batteryMinSoC,
                batteryMaxSoC: config.batteryMaxSoC,
                batteryChargeCRate: config.batteryChargeCRate,
                batteryDischargeCRate: config.batteryDischargeCRate,
                batteryCRate: config.batteryCRate,
                batteryStrategy: config.batteryStrategy,
                dispatchConfig: config.dispatchConfig,
                chargeTouPeriod: config.chargeTouPeriod,
                dischargeTouPeriod: config.dischargeTouPeriod,
                dischargeTouSelection: config.dischargeTouSelection,
                pvConfig: config.pvConfig,
                inverterConfig: config.inverterConfig,
                solarDataSource: config.solarDataSource,
                pvsystConfig: config.pvsystConfig,
                lossCalculationMode: config.lossCalculationMode,
                productionReductionPercent: config.productionReductionPercent,
                advancedConfig: config.advancedConfig,
                systemCosts: config.systemCosts,
                simulationName: config.simulationName,
                simulationDate: config.simulationDate,
              }, stateSetters, includesBattery);
            }}
            includesBattery={includesBattery}
          />
        </CollapsibleContent>
      </Collapsible>

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

      {/* PVsyst Loss Chain Configuration */}
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
                  <div>
                    <InverterSizeModuleConfig
                      config={inverterConfig}
                      onChange={setInverterConfig}
                      onSolarCapacityChange={setSolarCapacity}
                    />
                  </div>
                  <div className="pt-2 border-t space-y-2 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-muted-foreground text-[10px]">Expected daily output</Label>
                      <div className="flex items-center gap-1">
                        <NumericInput
                          integer
                          value={dailyOutputOverride ?? (annualPVsystResult 
                            ? Math.round(annualPVsystResult.eGrid / 365)
                            : Math.round(annualEnergyResults.totalAnnualSolar / 365))}
                          onChange={(v) => setDailyOutputOverride(v)}
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
                        <NumericInput
                          integer
                          value={specificYieldOverride ?? (annualPVsystResult 
                            ? Math.round(annualPVsystResult.specificYield)
                            : Math.round(annualEnergyResults.totalAnnualSolar / solarCapacity))}
                          onChange={(v) => setSpecificYieldOverride(v)}
                          className="h-6 w-20 text-right text-xs"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">kWh/kWp/yr</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSpecificYieldOverride(null)} title="Reset to calculated value">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-muted-foreground text-[10px]">Production reduction</Label>
                      <div className="flex items-center gap-1">
                        <NumericInput
                          integer
                          value={productionReductionPercent}
                          onChange={(v) => setProductionReductionPercent(v)}
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
                  <div className="space-y-1">
                    <Label className="text-xs">AC Capacity (kWh)</Label>
                    <NumericInput
                      integer
                      value={batteryAcCapacity}
                      onChange={(v) => setBatteryAcCapacity(v)}
                      className="h-8"
                      min={0}
                      max={5000}
                      step={10}
                    />
                  </div>
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
              <FinancialConfigPane
                hasFinancialData={hasFinancialData}
                annualBlendedRates={annualBlendedRates}
                blendedRateType={blendedRateType}
                onBlendedRateTypeChange={onBlendedRateTypeChange}
                useHourlyTouRates={useHourlyTouRates}
                onUseHourlyTouRatesChange={onUseHourlyTouRatesChange}
                financialResults={financialResults}
                advancedResults={advancedResults}
                basicFinancialMetrics={basicFinancialMetrics}
                unifiedPaybackPeriod={unifiedPaybackPeriod}
                threeYearOM={threeYearOM}
                solarCapacity={solarCapacity}
                annualEnergyResults={annualEnergyResults}
                annualPVsystResult={annualPVsystResult}
                reductionFactor={reductionFactor}
                inverterConfig={inverterConfig}
                systemCosts={systemCosts}
                advancedConfig={advancedConfig}
                projectLocation={project?.location}
              />
            ),
          },
        ] as CarouselPane[]}
        onRequestEnable={onRequestEnableFeature}
      />

      {/* Energy Results Summary */}
      <SimulationKPICards
        annualLoad={annualEnergyResults.totalAnnualLoad}
        annualSolar={annualEnergyResults.totalAnnualSolar}
        annualGridImport={annualEnergyResults.totalAnnualGridImport}
        selfConsumptionRate={annualEnergyResults.selfConsumptionRate}
        peakReduction={annualEnergyResults.peakReduction}
        includesSolar={includesSolar}
        annualPVsystResult={annualPVsystResult}
        reductionFactor={reductionFactor}
      />

      {/* Advanced Results Display */}
      {advancedResults && (
        <AdvancedResultsDisplay results={advancedResults} />
      )}

      {/* Charts */}
      <SimulationChartTabs
        showAnnualAverage={showAnnualAverage}
        setShowAnnualAverage={setShowAnnualAverage}
        selectedDayIndex={selectedDayIndex}
        setSelectedDayIndex={setSelectedDayIndex}
        navigateDayIndex={navigateDayIndex}
        dayDateInfo={dayDateInfo}
        simulationChartData={simulationChartData}
        loadProfileIsWeekend={loadProfileIsWeekend}
        touPeriodsForDay={touPeriodsForDay}
        dcAcRatio={inverterConfig.dcAcRatio}
        maxPvAcKva={inverterConfig.inverterSize * inverterConfig.inverterCount}
        includesBattery={includesBattery}
        batteryCapacity={batteryCapacity}
        batteryAcCapacity={batteryAcCapacity}
        batteryChargePower={batteryChargePower}
        loadProfile={loadProfile}
        solarProfile={solarProfile}
        energyConfig={energyConfig}
        tariffRate={tariffData.averageRatePerKwh}
        comparisonTabViewed={comparisonTabViewed}
        setComparisonTabViewed={setComparisonTabViewed}
        solarProfileSolcast={solarProfileSolcast}
        solarProfileGeneric={solarProfileGenericSimplified}
        annualEnergyResultsGeneric={annualEnergyResultsGeneric}
        annualEnergyResultsSolcast={annualEnergyResultsSolcast}
        financialResultsGeneric={financialResultsGeneric}
        financialResultsSolcast={financialResultsSolcast}
        hasFinancialData={hasFinancialData}
        selectedLocationName={selectedLocation.name}
      />
    </div>
  );
});
