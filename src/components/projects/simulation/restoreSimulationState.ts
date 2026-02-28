/**
 * restoreSimulationState
 * 
 * Consolidates the state-restoration logic that was duplicated in:
 *   1. The auto-load useEffect (initial page load)
 *   2. The onLoadSimulation callback (manual load from SavedSimulations)
 * 
 * Both paths call this single function, which dispatches to the correct
 * React state setters.
 */

import { mergePvsystConfig, mergeAdvancedConfig } from "@/utils/simulationConfig";
import { getDefaultInverterConfig } from "../InverterSizing";
import { getDefaultDispatchConfig, type BatteryDispatchStrategy } from "./EnergySimulationEngine";
import type { SystemCostsData } from "../SystemCostsManager";

type TOUPeriod = 'off-peak' | 'standard' | 'peak';

/** The bag of setters that the calling component must provide. */
export interface SimulationStateSetters {
  setSolarCapacity: (v: number) => void;
  setBatteryAcCapacity: (v: number) => void;
  setBatteryMinSoC: (v: number) => void;
  setBatteryMaxSoC: (v: number) => void;
  setBatteryChargeCRate: (v: number) => void;
  setBatteryDischargeCRate: (v: number) => void;
  setBatteryStrategy: (v: BatteryDispatchStrategy) => void;
  setDispatchConfig: (v: any) => void;
  setChargeTouPeriod: (v: TOUPeriod | undefined) => void;
  setDischargeTouSelection: (v: any) => void;
  setPvConfig: (v: any) => void;
  setInverterConfig: (v: any) => void;
  setSolarDataSource: (v: any) => void;
  setPvsystConfig: (v: any) => void;
  setLossCalculationMode: (v: any) => void;
  setProductionReductionPercent: (v: number) => void;
  setAdvancedConfig: (v: any) => void;
  setLoadedSimulationName: (v: string | null) => void;
  setLoadedSimulationDate: (v: string | null) => void;
  onSystemCostsChange?: (v: SystemCostsData) => void;
}

/**
 * Normalised input shape.  Both auto-load and manual-load callers map their
 * data into this shape before calling `restoreSimulationState`.
 */
export interface SimulationSnapshot {
  // Top-level DB columns
  solarCapacity: number;
  batteryCapacityDc: number; // DC kWh from DB
  batteryPower: number;      // kW from DB
  simulationType?: string;
  simulationName?: string;
  simulationDate?: string;

  // results_json fields
  batteryMinSoC?: number;
  batteryMaxSoC?: number;
  batteryDoD?: number;
  batteryChargeCRate?: number;
  batteryDischargeCRate?: number;
  batteryCRate?: number; // Legacy single-rate field

  batteryStrategy?: string;
  dispatchConfig?: any;
  chargeTouPeriod?: string;
  dischargeTouPeriod?: string; // Legacy field
  dischargeTouSelection?: any;

  pvConfig?: any;
  inverterConfig?: any;
  solarDataSource?: string;
  pvsystConfig?: any;
  lossCalculationMode?: string;
  productionReductionPercent?: number;
  advancedConfig?: any;
  systemCosts?: any;
}

/**
 * Apply a simulation snapshot to the component's state via the provided setters.
 */
export function restoreSimulationState(
  snapshot: SimulationSnapshot,
  setters: SimulationStateSetters,
  includesBattery: boolean,
) {
  // ── Solar ──
  setters.setSolarCapacity(snapshot.solarCapacity);

  // ── Battery ──
  if (includesBattery) {
    const dcCap = snapshot.batteryCapacityDc || 0;
    const pwr = snapshot.batteryPower || 0;
    const minSoC = snapshot.batteryMinSoC ?? 0;
    const maxSoC = snapshot.batteryMaxSoC ?? 0;
    const dod = snapshot.batteryDoD ?? ((maxSoC - minSoC) || 85);
    const savedChargeCRate = snapshot.batteryChargeCRate ?? snapshot.batteryCRate;
    const savedDischargeCRate = snapshot.batteryDischargeCRate ?? snapshot.batteryCRate;

    setters.setBatteryMinSoC(minSoC);
    setters.setBatteryMaxSoC(maxSoC);

    const ac = Math.round(dcCap * dod / 100);
    setters.setBatteryAcCapacity(ac);

    const fallbackCRate = ac > 0 ? Math.round(pwr / ac * 100) / 100 : 0.5;
    setters.setBatteryChargeCRate(savedChargeCRate ?? fallbackCRate);
    setters.setBatteryDischargeCRate(savedDischargeCRate ?? fallbackCRate);

    // Override SoC from explicit snapshot values if present (manual-load may set these directly)
    if (snapshot.batteryMinSoC !== undefined) setters.setBatteryMinSoC(snapshot.batteryMinSoC);
    if (snapshot.batteryMaxSoC !== undefined) setters.setBatteryMaxSoC(snapshot.batteryMaxSoC);
  }

  // ── Battery dispatch strategy ──
  if (snapshot.batteryStrategy) {
    setters.setBatteryStrategy(snapshot.batteryStrategy as BatteryDispatchStrategy);
    setters.setDispatchConfig(snapshot.dispatchConfig ?? getDefaultDispatchConfig(snapshot.batteryStrategy as BatteryDispatchStrategy));
  }

  if (snapshot.chargeTouPeriod) {
    setters.setChargeTouPeriod(snapshot.chargeTouPeriod as TOUPeriod);
  }

  // Discharge TOU — new multi-period format or legacy single-period
  if (snapshot.dischargeTouSelection) {
    setters.setDischargeTouSelection(snapshot.dischargeTouSelection);
  } else if (snapshot.dischargeTouPeriod) {
    const period = snapshot.dischargeTouPeriod as TOUPeriod;
    const flags = { peak: period === 'peak', standard: period === 'standard', offPeak: period === 'off-peak' };
    setters.setDischargeTouSelection({
      highSeason: { weekday: { ...flags }, weekend: { peak: false, standard: false, offPeak: false } },
      lowSeason: { weekday: { ...flags }, weekend: { peak: false, standard: false, offPeak: false } },
    });
  }

  // ── PV & Inverter ──
  if (snapshot.pvConfig && Object.keys(snapshot.pvConfig).length > 0) {
    setters.setPvConfig((prev: any) => ({ ...prev, ...snapshot.pvConfig }));
  }
  if (snapshot.inverterConfig) {
    setters.setInverterConfig((prev: any) => ({
      ...getDefaultInverterConfig(),
      ...prev,
      ...snapshot.inverterConfig,
    }));
  }

  // ── Data source ──
  if (snapshot.solarDataSource) {
    setters.setSolarDataSource(snapshot.solarDataSource);
  } else if (snapshot.simulationType) {
    const t = snapshot.simulationType;
    if (t === "solcast" || t === "pvgis_monthly" || t === "pvgis_tmy") {
      setters.setSolarDataSource(t);
    } else if (t === "generic") {
      setters.setSolarDataSource("pvgis_monthly");
    }
  }

  // ── Loss chain ──
  if (snapshot.pvsystConfig) {
    setters.setPvsystConfig(mergePvsystConfig(snapshot.pvsystConfig));
  }
  if (snapshot.lossCalculationMode) {
    setters.setLossCalculationMode(snapshot.lossCalculationMode);
  }
  if (snapshot.productionReductionPercent !== undefined) {
    setters.setProductionReductionPercent(snapshot.productionReductionPercent);
  }

  // ── Advanced config ──
  if (snapshot.advancedConfig) {
    setters.setAdvancedConfig(mergeAdvancedConfig(snapshot.advancedConfig));
  }

  // ── System costs (only from manual load — auto-load delegates to ProjectDetail) ──
  if (snapshot.systemCosts && setters.onSystemCostsChange) {
    const c = snapshot.systemCosts;
    setters.onSystemCostsChange({
      solarCostPerKwp: c.solarCostPerKwp,
      batteryCostPerKwh: c.batteryCostPerKwh,
      solarMaintenancePercentage: c.solarMaintenancePercentage ?? c.maintenancePercentage ?? 3.5,
      batteryMaintenancePercentage: c.batteryMaintenancePercentage ?? 1.5,
      maintenancePerYear: c.maintenancePerYear ?? 0,
      healthAndSafetyCost: c.healthAndSafetyCost ?? 0,
      waterPointsCost: c.waterPointsCost ?? 0,
      cctvCost: c.cctvCost ?? 0,
      mvSwitchGearCost: c.mvSwitchGearCost ?? 0,
      insuranceCostPerYear: c.insuranceCostPerYear ?? 0,
      insuranceRatePercent: c.insuranceRatePercent ?? 1.0,
      professionalFeesPercent: c.professionalFeesPercent ?? 0,
      projectManagementPercent: c.projectManagementPercent ?? 0,
      contingencyPercent: c.contingencyPercent ?? 0,
      replacementYear: c.replacementYear ?? 10,
      equipmentCostPercent: c.equipmentCostPercent ?? 45,
      moduleSharePercent: c.moduleSharePercent ?? 70,
      inverterSharePercent: c.inverterSharePercent ?? 30,
      solarModuleReplacementPercent: c.solarModuleReplacementPercent ?? 10,
      inverterReplacementPercent: c.inverterReplacementPercent ?? 50,
      batteryReplacementPercent: c.batteryReplacementPercent ?? 30,
      costOfCapital: c.costOfCapital ?? 9.0,
      cpi: c.cpi ?? 6.0,
      electricityInflation: c.electricityInflation ?? 10.0,
      projectDurationYears: c.projectDurationYears ?? 20,
      lcoeDiscountRate: c.lcoeDiscountRate ?? 9.0,
      mirrFinanceRate: c.mirrFinanceRate ?? 9.0,
      mirrReinvestmentRate: c.mirrReinvestmentRate ?? 10.0,
    });
  }

  // ── UI tracking ──
  if (snapshot.simulationName !== undefined) {
    setters.setLoadedSimulationName(snapshot.simulationName ?? null);
  }
  if (snapshot.simulationDate !== undefined) {
    setters.setLoadedSimulationDate(snapshot.simulationDate ?? null);
  }
}
