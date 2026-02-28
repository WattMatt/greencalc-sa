/**
 * useAutoSave Hook
 * 
 * Encapsulates the debounced auto-save mutation for simulation state.
 * Extracted from SimulationPanel.tsx to reduce monolith size.
 */

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { PVSystemConfigData } from "../PVSystemConfig";
import type { DispatchConfig, BatteryDispatchStrategy } from "./EnergySimulationEngine";
import type { AdvancedSimulationConfig } from "./AdvancedSimulationTypes";
import type { SystemCostsData } from "../SystemCostsManager";
import type { PVsystLossChainConfig, LossCalculationMode } from "@/lib/pvsystLossChain";
import type { InverterConfig } from "../InverterSizing";
import type { DischargeTOUSelection } from "../load-profile/types";
import type { BlendedRateType } from "../TariffSelector";
import type { AnnualEnergySimulationResults } from "./EnergySimulationEngine";

type TOUPeriod = 'off-peak' | 'standard' | 'peak';
type SolarDataSource = "solcast" | "pvgis_monthly" | "pvgis_tmy";

export interface AutoSaveConfig {
  projectId: string;
  solarDataSource: SolarDataSource;
  solarCapacity: number;
  batteryCapacity: number;
  batteryPower: number;
  includesBattery: boolean;
  pvConfig: PVSystemConfigData;
  inverterConfig: InverterConfig;
  systemCosts: SystemCostsData;
  lossCalculationMode: LossCalculationMode;
  pvsystConfig: PVsystLossChainConfig;
  productionReductionPercent: number;
  advancedConfig: AdvancedSimulationConfig;
  moduleCount: number;
  batteryStrategy: BatteryDispatchStrategy;
  dispatchConfig: DispatchConfig;
  chargeTouPeriod: TOUPeriod | undefined;
  dischargeTouSelection: DischargeTOUSelection;
  batteryChargeCRate: number;
  batteryDischargeCRate: number;
  batteryDoD: number;
  batteryMinSoC: number;
  batteryMaxSoC: number;
  blendedRateType: BlendedRateType;
  useHourlyTouRates: boolean;
  selectedBlendedRate: number;
  annualBlendedRates: any;
  // Results needed for save payload
  annualEnergyResults: AnnualEnergySimulationResults;
  financialResults: { annualSavings: number; systemCost: number; paybackYears: number; roi: number };
  hasFinancialData: boolean;
  tenantCount: number;
  // Initialization tracking
  hasInitializedFromSaved: boolean;
  isFetched: boolean;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function useAutoSave(config: AutoSaveConfig) {
  const queryClient = useQueryClient();
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialLoadComplete = useRef(false);

  const {
    projectId, solarDataSource, solarCapacity, batteryCapacity, batteryPower,
    includesBattery, pvConfig, inverterConfig, systemCosts, lossCalculationMode,
    pvsystConfig, productionReductionPercent, advancedConfig, moduleCount,
    batteryStrategy, dispatchConfig, chargeTouPeriod, dischargeTouSelection,
    batteryChargeCRate, batteryDischargeCRate, batteryDoD, batteryMinSoC, batteryMaxSoC,
    blendedRateType, useHourlyTouRates, selectedBlendedRate, annualBlendedRates,
    annualEnergyResults, financialResults, hasFinancialData, tenantCount,
    hasInitializedFromSaved, isFetched,
  } = config;

  // Reset on project change
  useEffect(() => {
    hasInitialLoadComplete.current = false;
  }, [projectId]);

  const autoSaveMutation = useMutation({
    mutationFn: async () => {
      const simulationName = `Auto-saved ${format(new Date(), "MMM d, HH:mm")}`;

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
          blendedSolarRate: selectedBlendedRate,
          blendedRateType,
          useHourlyTouRates,
          blendedRates: annualBlendedRates ? {
            allHours: annualBlendedRates.allHours.annual,
            solarHours: annualBlendedRates.solarHours.annual,
          } : null,
          lossCalculationMode,
          pvsystConfig,
          productionReductionPercent,
          advancedConfig,
          moduleCount,
          inverterCount: inverterConfig.inverterCount,
          batteryStrategy,
          dispatchConfig,
          chargeTouPeriod,
          dischargeTouSelection,
          batteryChargeCRate,
          batteryDischargeCRate,
          batteryDoD,
          batteryMinSoC,
          batteryMaxSoC,
        })),
      };

      if (existingId) {
        const { error } = await supabase
          .from("project_simulations")
          .update(simulationData)
          .eq("id", existingId);
        if (error) throw error;
      } else {
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
    if (!hasInitializedFromSaved || !isFetched) return;

    if (!hasInitialLoadComplete.current) {
      hasInitialLoadComplete.current = true;
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (tenantCount === 0) return;

    autoSaveTimeoutRef.current = setTimeout(async () => {
      setIsAutoSaving(true);
      try {
        await autoSaveMutation.mutateAsync();
      } finally {
        setIsAutoSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    solarCapacity, batteryCapacity, batteryPower,
    pvConfig, inverterConfig, pvsystConfig, advancedConfig,
    lossCalculationMode, productionReductionPercent, solarDataSource,
    systemCosts, blendedRateType, batteryStrategy, dispatchConfig,
    batteryChargeCRate, batteryDischargeCRate, batteryMinSoC, batteryMaxSoC,
    chargeTouPeriod, dischargeTouSelection, useHourlyTouRates,
  ]);

  /** Trigger an immediate save (cancels pending debounce). */
  const triggerSave = async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (tenantCount > 0) {
      await autoSaveMutation.mutateAsync();
    }
  };

  return { isAutoSaving, lastSavedAt, triggerSave };
}
