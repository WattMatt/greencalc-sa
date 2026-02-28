/**
 * useInitialSimulationState – reads the React Query cache once
 * and returns stable initial values for all simulation state atoms.
 * This replaces repeated getCachedSimulation() calls.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getDefaultDispatchConfig, type BatteryDispatchStrategy, type DispatchConfig } from "./EnergySimulationEngine";
import { DEFAULT_DISCHARGE_TOU_SELECTION, type DischargeTOUSelection } from "../load-profile/types";

type TOUPeriod = 'off-peak' | 'standard' | 'peak';

export interface InitialSimulationValues {
  solarCapacity: number;
  batteryAcCapacity: number;
  batteryChargeCRate: number;
  batteryDischargeCRate: number;
  batteryMinSoC: number;
  batteryMaxSoC: number;
  batteryStrategy: BatteryDispatchStrategy;
  dispatchConfig: DispatchConfig;
  chargeTouPeriod: TOUPeriod | undefined;
  dischargeTouSelection: DischargeTOUSelection;
}

export function getInitialSimulationValues(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  includesBattery: boolean,
): InitialSimulationValues {
  const cached = queryClient.getQueryData<any>(["last-simulation", projectId]);
  const json = cached?.results_json as any;

  if (!cached) {
    return {
      solarCapacity: 0,
      batteryAcCapacity: 0,
      batteryChargeCRate: 0,
      batteryDischargeCRate: 0,
      batteryMinSoC: 0,
      batteryMaxSoC: 0,
      batteryStrategy: 'none',
      dispatchConfig: getDefaultDispatchConfig('none'),
      chargeTouPeriod: undefined,
      dischargeTouSelection: DEFAULT_DISCHARGE_TOU_SELECTION,
    };
  }

  const minSoC = json?.batteryMinSoC ?? 0;
  const maxSoC = json?.batteryMaxSoC ?? 0;
  const dod = maxSoC - minSoC;
  const dcCap = includesBattery ? (cached.battery_capacity_kwh || 0) : 0;

  return {
    solarCapacity: cached.solar_capacity_kwp ?? 0,
    batteryAcCapacity: Math.round(dcCap * dod / 100),
    batteryChargeCRate: json?.batteryChargeCRate ?? json?.batteryCRate ?? 0,
    batteryDischargeCRate: json?.batteryDischargeCRate ?? json?.batteryCRate ?? 0,
    batteryMinSoC: minSoC,
    batteryMaxSoC: maxSoC,
    batteryStrategy: json?.batteryStrategy ?? 'none',
    dispatchConfig: json?.dispatchConfig ?? getDefaultDispatchConfig('none'),
    chargeTouPeriod: json?.chargeTouPeriod ?? undefined,
    dischargeTouSelection: json?.dischargeTouSelection ?? DEFAULT_DISCHARGE_TOU_SELECTION,
  };
}
