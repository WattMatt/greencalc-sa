import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Battery, Zap, TrendingUp, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DischargeTOUSelection, DEFAULT_DISCHARGE_TOU_SELECTION } from "./load-profile/types";
import { getTOUSettingsFromStorage, useTOUSettings } from "@/hooks/useTOUSettings";
import { type BatteryDispatchStrategy, type DispatchConfig, type TimeWindow } from "./simulation/EnergySimulationEngine";
import { PVSystemConfig, PVSystemConfigData, getDefaultPVConfig, calculateSystemEfficiency } from "./PVSystemConfig";
import { type LossCalculationMode, type PVsystLossChainConfig, DEFAULT_PVSYST_CONFIG } from "@/lib/pvsystLossChain";
import { PVsystLossChainConfig as PVsystLossChainConfigPanel } from "./PVsystLossChainConfig";
import { AdvancedSimulationConfig, DEFAULT_ADVANCED_CONFIG } from "./simulation/AdvancedSimulationTypes";
import { AdvancedSimulationConfigPanel } from "./simulation/AdvancedSimulationConfig";
import { AdvancedResultsDisplay } from "./simulation/AdvancedResultsDisplay";
import { InverterConfig, getDefaultInverterConfig } from "./InverterSizing";
import { getModulePresetById, getDefaultModulePreset, calculateModuleMetrics } from "./SolarModulePresets";
import { ConfigCarousel, CarouselPane } from "./simulation/ConfigCarousel";
import { InverterPane } from "./simulation/InverterPane";
import { SolarModulesPane } from "./simulation/SolarModulesPane";
import { BatteryPane } from "./simulation/BatteryPane";
import { SimulationKPICards } from "./simulation/SimulationKPICards";
import { SimulationChartTabs } from "./simulation/SimulationChartTabs";
import { FinancialConfigPane } from "./simulation/FinancialConfigPane";
import { SimulationToolbar } from "./simulation/SimulationToolbar";
import { SavedConfigCollapsible } from "./simulation/SavedConfigCollapsible";
import { useSolarProfiles, type SolarDataSource } from "./simulation/useSolarProfiles";
import { useSimulationEngine } from "./simulation/useSimulationEngine";
import { useAutoSave } from "./simulation/useAutoSave";
import { getInitialSimulationValues } from "./simulation/useInitialSimulationState";
import { restoreSimulationState, type SimulationStateSetters } from "./simulation/restoreSimulationState";
import type { SystemCostsData } from "./SystemCostsManager";
import type { BlendedRateType } from "./TariffSelector";
import type { Tenant as FullTenant, ShopType as FullShopType } from "./load-profile/types";

type TOUPeriod = 'off-peak' | 'standard' | 'peak';

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

export const SimulationPanel = forwardRef<SimulationPanelRef, SimulationPanelProps>(({ projectId, project, tenants, shopTypes, systemCosts, onSystemCostsChange, includesBattery = false, includesSolar = true, onRequestEnableFeature, blendedRateType = 'solarHours', onBlendedRateTypeChange, useHourlyTouRates = true, onUseHourlyTouRatesChange }, ref) => {
  const queryClient = useQueryClient();
  const { touSettings: touSettingsData } = useTOUSettings();

  // Fetch the most recent saved simulation
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

  // ── Consolidated initial state from cache ──
  const initial = useMemo(
    () => getInitialSimulationValues(queryClient, projectId, includesBattery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally run once on mount
  );

  const [solarCapacity, setSolarCapacity] = useState(initial.solarCapacity);
  const [batteryAcCapacity, setBatteryAcCapacity] = useState(initial.batteryAcCapacity);
  const [batteryChargeCRate, setBatteryChargeCRate] = useState(initial.batteryChargeCRate);
  const [batteryDischargeCRate, setBatteryDischargeCRate] = useState(initial.batteryDischargeCRate);
  const [batteryMinSoC, setBatteryMinSoC] = useState(initial.batteryMinSoC);
  const [batteryMaxSoC, setBatteryMaxSoC] = useState(initial.batteryMaxSoC);
  const [batteryStrategy, setBatteryStrategy] = useState<BatteryDispatchStrategy>(initial.batteryStrategy);
  const [dispatchConfig, setDispatchConfig] = useState<DispatchConfig>(initial.dispatchConfig);
  const [chargeTouPeriod, setChargeTouPeriod] = useState<TOUPeriod | undefined>(initial.chargeTouPeriod);
  const [dischargeTouSelection, setDischargeTouSelection] = useState<DischargeTOUSelection>(initial.dischargeTouSelection);

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
    setSelectedDayIndex(prev => direction === "prev" ? Math.max(0, prev - 1) : Math.min(364, prev + 1));
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
  useEffect(() => { hasInitializedFromSaved.current = false; }, [projectId]);

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

  // Calculate module metrics
  const moduleMetrics = useMemo(() => {
    const selectedModule = inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule
      ? inverterConfig.customModule
      : getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
    const currentAcCapacity = inverterConfig.inverterSize * inverterConfig.inverterCount;
    return { ...calculateModuleMetrics(currentAcCapacity, inverterConfig.dcAcRatio, selectedModule), moduleName: selectedModule.name };
  }, [inverterConfig]);

  // Sync CPI from systemCosts to advancedConfig
  useEffect(() => {
    if (systemCosts.cpi !== advancedConfig.financial.inflationRate) {
      setAdvancedConfig(prev => ({ ...prev, financial: { ...prev.financial, inflationRate: systemCosts.cpi ?? 6.0 } }));
    }
  }, [systemCosts.cpi]);

  // ── Solar profiles hook ──
  const {
    solcastLoading, pvgisLoadingTMY, pvgisLoadingMonthly,
    solarProfile, solarProfileSolcast, solarProfileGenericSimplified,
    solcastPvProfileData, annualPVsystResult,
    tmyDcProfile8760, tmySolarProfile8760, tmyInverterLossMultiplier,
    selectedLocation, isLoadingData, hasRealData, activeDataSourceLabel,
    reductionFactor,
  } = useSolarProfiles({
    pvConfig, moduleMetrics, solarDataSource, lossCalculationMode, pvsystConfig,
    productionReductionPercent, inverterConfig, project, projectId, includesSolar,
  });

  // ── Simulation engine hook ──
  const engine = useSimulationEngine({
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
    projectId, solarDataSource, solarCapacity, batteryCapacity, batteryPower,
    includesBattery, pvConfig, inverterConfig, systemCosts,
    lossCalculationMode, pvsystConfig, productionReductionPercent, advancedConfig,
    moduleCount: moduleMetrics.moduleCount,
    batteryStrategy, dispatchConfig, chargeTouPeriod, dischargeTouSelection,
    batteryChargeCRate, batteryDischargeCRate, batteryDoD, batteryMinSoC, batteryMaxSoC,
    blendedRateType, useHourlyTouRates,
    selectedBlendedRate: engine.selectedBlendedRate,
    annualBlendedRates: engine.annualBlendedRates,
    annualEnergyResults: engine.annualEnergyResults,
    financialResults: engine.financialResults,
    hasFinancialData: engine.hasFinancialData,
    tenantCount: tenants.length,
    hasInitializedFromSaved: hasInitializedFromSaved.current,
    isFetched,
  });

  useImperativeHandle(ref, () => ({ autoSave: triggerSave }), [triggerSave]);

  const connectionSizeKva = project.connection_size_kva ? Number(project.connection_size_kva) : null;
  const maxSolarKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const solarExceedsLimit = maxSolarKva && solarCapacity > maxSolarKva;
  const systemEfficiency = calculateSystemEfficiency(pvConfig);

  // ── Saved config props (memoised to avoid re-renders) ──
  const savedCurrentConfig = useMemo(() => ({
    solarCapacity, batteryCapacity: includesBattery ? batteryCapacity : 0,
    batteryPower: includesBattery ? batteryPower : 0,
    pvConfig, usingSolcast: solarDataSource === "solcast", solarDataSource, inverterConfig,
    systemCosts, pvsystConfig, advancedConfig, lossCalculationMode, productionReductionPercent,
    moduleCount: moduleMetrics.moduleCount,
    batteryChargeCRate, batteryDischargeCRate, batteryDoD, batteryMinSoC, batteryMaxSoC,
    batteryStrategy, dispatchConfig, chargeTouPeriod, dischargeTouSelection,
  }), [solarCapacity, batteryCapacity, batteryPower, includesBattery, pvConfig, solarDataSource, inverterConfig, systemCosts, pvsystConfig, advancedConfig, lossCalculationMode, productionReductionPercent, moduleMetrics.moduleCount, batteryChargeCRate, batteryDischargeCRate, batteryDoD, batteryMinSoC, batteryMaxSoC, batteryStrategy, dispatchConfig, chargeTouPeriod, dischargeTouSelection]);

  const savedCurrentResults = useMemo(() => ({
    totalDailyLoad: engine.annualEnergyResults.totalAnnualLoad / 365,
    totalDailySolar: engine.annualEnergyResults.totalAnnualSolar / 365,
    totalGridImport: engine.annualEnergyResults.totalAnnualGridImport / 365,
    totalSolarUsed: engine.annualEnergyResults.totalAnnualSolarUsed / 365,
    annualSavings: engine.hasFinancialData ? engine.financialResults.annualSavings : 0,
    systemCost: engine.financialResults.systemCost,
    paybackYears: engine.hasFinancialData ? engine.financialResults.paybackYears : 0,
    roi: engine.hasFinancialData ? engine.financialResults.roi : 0,
    peakDemand: engine.annualEnergyResults.peakLoad,
    newPeakDemand: engine.annualEnergyResults.peakGridImport,
  }), [engine.annualEnergyResults, engine.financialResults, engine.hasFinancialData]);

  return (
    <div className="space-y-6">
      <SimulationToolbar
        selectedLocationName={selectedLocation.name}
        activeDataSourceLabel={activeDataSourceLabel}
        hasRealData={hasRealData}
        locationGhi={selectedLocation.ghi}
        solarDataSource={solarDataSource}
        onSolarDataSourceChange={setSolarDataSource}
        solcastLoading={solcastLoading}
        pvgisLoadingMonthly={pvgisLoadingMonthly}
        pvgisLoadingTMY={pvgisLoadingTMY}
        lossCalculationMode={lossCalculationMode}
        onLossCalculationModeChange={setLossCalculationMode}
        isAutoSaving={isAutoSaving}
        lastSavedAt={lastSavedAt}
      />

      <SavedConfigCollapsible
        projectId={projectId}
        isLoadingLastSaved={isLoadingLastSaved}
        loadedSimulationName={loadedSimulationName}
        loadedSimulationDate={loadedSimulationDate}
        currentConfig={savedCurrentConfig}
        currentResults={savedCurrentResults}
        stateSetters={stateSetters}
        includesBattery={includesBattery}
        batteryDoD={batteryDoD}
      />

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

      {/* Advanced PV Configuration */}
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
              <PVSystemConfig config={pvConfig} onChange={setPvConfig} maxSolarKva={maxSolarKva} solarCapacity={solarCapacity} projectLocation={project?.location} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {lossCalculationMode === "pvsyst" && (
        <PVsystLossChainConfigPanel
          config={{ ...pvsystConfig, stcEfficiency: moduleMetrics.stcEfficiency }}
          onChange={(newConfig) => setPvsystConfig({ ...newConfig, stcEfficiency: moduleMetrics.stcEfficiency })}
          dailyGHI={selectedLocation.ghi}
          capacityKwp={solarCapacity}
          ambientTemp={25}
          moduleMetrics={{ moduleCount: moduleMetrics.moduleCount, collectorAreaM2: moduleMetrics.collectorAreaM2, stcEfficiency: moduleMetrics.stcEfficiency, moduleName: moduleMetrics.moduleName }}
        />
      )}

      <AdvancedSimulationConfigPanel
        config={advancedConfig} onChange={setAdvancedConfig} includesBattery={includesBattery}
        batteryChargeCRate={batteryChargeCRate} onBatteryChargeCRateChange={setBatteryChargeCRate}
        batteryDischargeCRate={batteryDischargeCRate} onBatteryDischargeCRateChange={setBatteryDischargeCRate}
        batteryDoD={batteryDoD} batteryMinSoC={batteryMinSoC} onBatteryMinSoCChange={setBatteryMinSoC}
        batteryMaxSoC={batteryMaxSoC} onBatteryMaxSoCChange={setBatteryMaxSoC}
        batteryStrategy={batteryStrategy} onBatteryStrategyChange={setBatteryStrategy}
        dispatchConfig={dispatchConfig} onDispatchConfigChange={setDispatchConfig}
        chargeTouPeriod={chargeTouPeriod} onChargeTouPeriodChange={setChargeTouPeriod}
        dischargeTouSelection={dischargeTouSelection} onDischargeTouSelectionChange={handleDischargeTouSelectionChange}
        touPeriodToWindows={touPeriodToWindows}
        dischargeSources={dispatchConfig.dischargeSources}
        onDischargeSourcesChange={(sources) => setDispatchConfig(prev => ({ ...prev, dischargeSources: sources }))}
      />

      <ConfigCarousel
        panes={[
          {
            id: 'inverters', label: 'Inverters', icon: <Zap className="h-4 w-4" />,
            enabled: includesSolar, disabledMessage: 'Enable Solar PV to configure inverters',
            content: <InverterPane inverterConfig={inverterConfig} onInverterConfigChange={setInverterConfig} currentSolarCapacity={solarCapacity} onSolarCapacityChange={setSolarCapacity} maxSolarKva={maxSolarKva} solarExceedsLimit={!!solarExceedsLimit} />,
          },
          {
            id: 'solarPV', label: 'Solar Modules', icon: <Sun className="h-4 w-4" />,
            enabled: includesSolar, disabledMessage: 'Solar PV is not enabled for this project',
            content: (
              <SolarModulesPane
                inverterConfig={inverterConfig} onInverterConfigChange={setInverterConfig}
                onSolarCapacityChange={setSolarCapacity} maxSolarKva={maxSolarKva} solarExceedsLimit={!!solarExceedsLimit}
                dailyOutputOverride={dailyOutputOverride} onDailyOutputOverrideChange={setDailyOutputOverride}
                specificYieldOverride={specificYieldOverride} onSpecificYieldOverrideChange={setSpecificYieldOverride}
                productionReductionPercent={productionReductionPercent} onProductionReductionPercentChange={setProductionReductionPercent}
                calculatedDailyOutput={annualPVsystResult ? Math.round(annualPVsystResult.eGrid / 365) : Math.round(engine.annualEnergyResults.totalAnnualSolar / 365)}
                calculatedSpecificYield={annualPVsystResult ? Math.round(annualPVsystResult.specificYield) : Math.round(engine.annualEnergyResults.totalAnnualSolar / solarCapacity)}
                solarCapacity={solarCapacity}
              />
            ),
          },
          {
            id: 'battery', label: 'Battery', icon: <Battery className="h-4 w-4" />,
            enabled: includesBattery, disabledMessage: 'Battery storage is not enabled for this project',
            content: <BatteryPane batteryAcCapacity={batteryAcCapacity} onBatteryAcCapacityChange={setBatteryAcCapacity} batteryChargePower={batteryChargePower} batteryDischargePower={batteryDischargePower} batteryCapacity={batteryCapacity} batteryCycles={engine.annualEnergyResults.batteryCycles} annualBatteryDischarge={engine.annualEnergyResults.totalAnnualBatteryDischarge} />,
          },
          {
            id: 'financial', label: 'Financial', icon: <TrendingUp className="h-4 w-4" />,
            enabled: engine.hasFinancialData, cannotToggle: true, disabledMessage: 'Select a tariff to enable financial analysis',
            content: (
              <FinancialConfigPane
                hasFinancialData={engine.hasFinancialData} annualBlendedRates={engine.annualBlendedRates}
                blendedRateType={blendedRateType} onBlendedRateTypeChange={onBlendedRateTypeChange}
                useHourlyTouRates={useHourlyTouRates} onUseHourlyTouRatesChange={onUseHourlyTouRatesChange}
                financialResults={engine.financialResults} advancedResults={engine.advancedResults}
                basicFinancialMetrics={engine.basicFinancialMetrics} unifiedPaybackPeriod={engine.unifiedPaybackPeriod}
                threeYearOM={engine.threeYearOM} solarCapacity={solarCapacity}
                annualEnergyResults={engine.annualEnergyResults} annualPVsystResult={annualPVsystResult}
                reductionFactor={reductionFactor} inverterConfig={inverterConfig}
                systemCosts={systemCosts} advancedConfig={advancedConfig} projectLocation={project?.location}
              />
            ),
          },
        ] as CarouselPane[]}
        onRequestEnable={onRequestEnableFeature}
      />

      <SimulationKPICards
        annualLoad={engine.annualEnergyResults.totalAnnualLoad}
        annualSolar={engine.annualEnergyResults.totalAnnualSolar}
        annualGridImport={engine.annualEnergyResults.totalAnnualGridImport}
        selfConsumptionRate={engine.annualEnergyResults.selfConsumptionRate}
        peakReduction={engine.annualEnergyResults.peakReduction}
        includesSolar={includesSolar}
        annualPVsystResult={annualPVsystResult}
        reductionFactor={reductionFactor}
      />

      {engine.advancedResults && <AdvancedResultsDisplay results={engine.advancedResults} />}

      <SimulationChartTabs
        showAnnualAverage={showAnnualAverage} setShowAnnualAverage={setShowAnnualAverage}
        selectedDayIndex={selectedDayIndex} setSelectedDayIndex={setSelectedDayIndex}
        navigateDayIndex={navigateDayIndex} dayDateInfo={dayDateInfo}
        simulationChartData={engine.simulationChartData} loadProfileIsWeekend={engine.loadProfileIsWeekend}
        touPeriodsForDay={engine.touPeriodsForDay} dcAcRatio={inverterConfig.dcAcRatio}
        maxPvAcKva={inverterConfig.inverterSize * inverterConfig.inverterCount}
        includesBattery={includesBattery} batteryCapacity={batteryCapacity}
        batteryAcCapacity={batteryAcCapacity} batteryChargePower={batteryChargePower}
        loadProfile={engine.loadProfile} solarProfile={solarProfile} energyConfig={engine.energyConfig}
        tariffRate={engine.tariffData.averageRatePerKwh}
        comparisonTabViewed={comparisonTabViewed} setComparisonTabViewed={setComparisonTabViewed}
        solarProfileSolcast={solarProfileSolcast} solarProfileGeneric={solarProfileGenericSimplified}
        annualEnergyResultsGeneric={engine.annualEnergyResultsGeneric}
        annualEnergyResultsSolcast={engine.annualEnergyResultsSolcast}
        financialResultsGeneric={engine.financialResultsGeneric}
        financialResultsSolcast={engine.financialResultsSolcast}
        hasFinancialData={engine.hasFinancialData} selectedLocationName={selectedLocation.name}
      />
    </div>
  );
});
