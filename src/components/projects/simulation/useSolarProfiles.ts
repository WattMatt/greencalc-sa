/**
 * useSolarProfiles — Solar data fetching and profile generation
 *
 * Extracts from SimulationPanel:
 * - Solcast / PVGIS data fetching hooks and auto-fetch effects
 * - Solar profile generation (simplified + PVsyst modes)
 * - Annual GHI calculation
 * - PVsyst annual & hourly result calculation
 * - TMY 8,760-hour conversion
 * - Solcast PV profile for charts
 */

import { useMemo, useEffect } from "react";
import { useSolcastForecast } from "@/hooks/useSolcastForecast";
import { usePVGISProfile } from "@/hooks/usePVGISProfile";
import { convertTMYToSolarGeneration } from "@/utils/calculators/tmySolarConversion";
import { useSolcastPVProfile } from "../load-profile/hooks/useSolcastPVProfile";
import {
  PVSystemConfigData,
  generateSolarProfile,
  generateAverageSolcastProfile,
  SA_SOLAR_LOCATIONS,
  HourlyIrradianceData,
} from "../PVSystemConfig";
import {
  type LossCalculationMode,
  type PVsystLossChainConfig,
  type AnnualPVsystResult,
  DEFAULT_PVSYST_CONFIG,
  calculateAnnualPVsystOutput,
} from "@/lib/pvsystLossChain";
import { InverterConfig } from "../InverterSizing";

// Solar data source type
export type SolarDataSource = "solcast" | "pvgis_monthly" | "pvgis_tmy";

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

interface UseSolarProfilesConfig {
  pvConfig: PVSystemConfigData;
  moduleMetrics: {
    actualDcCapacityKwp: number;
    stcEfficiency: number;
    collectorAreaM2: number;
    moduleCount: number;
    moduleName: string;
  };
  solarDataSource: SolarDataSource;
  lossCalculationMode: LossCalculationMode;
  pvsystConfig: PVsystLossChainConfig;
  productionReductionPercent: number;
  inverterConfig: InverterConfig;
  project: any;
  projectId: string;
  includesSolar: boolean;
}

export function useSolarProfiles(config: UseSolarProfilesConfig) {
  const {
    pvConfig,
    moduleMetrics,
    solarDataSource,
    lossCalculationMode,
    pvsystConfig,
    productionReductionPercent,
    inverterConfig,
    project,
    projectId,
    includesSolar,
  } = config;

  const reductionFactor = 1 - productionReductionPercent / 100;

  // ── Data fetching hooks ──
  const { data: solcastData, isLoading: solcastLoading, error: solcastError, fetchForecast } = useSolcastForecast();

  const {
    tmyData: pvgisTmyData,
    monthlyData: pvgisMonthlyData,
    isLoadingTMY: pvgisLoadingTMY,
    isLoadingMonthly: pvgisLoadingMonthly,
    fetchTMY,
    fetchMonthlyRadiation,
  } = usePVGISProfile();

  // ── Location coordinates ──
  const selectedLocation = SA_SOLAR_LOCATIONS[pvConfig.location];
  const hasCoordinates = selectedLocation?.lat !== undefined || (project?.latitude && project?.longitude);
  const effectiveLat = project?.latitude ?? selectedLocation?.lat;
  const effectiveLng = project?.longitude ?? SA_LOCATION_LONGITUDES[pvConfig.location] ?? 28.0;

  // ── Auto-fetch effects ──
  useEffect(() => {
    if (solarDataSource === "solcast" && hasCoordinates && !solcastData && !solcastLoading && !solcastError) {
      fetchForecast({ latitude: effectiveLat, longitude: effectiveLng, hours: 168, period: "PT60M" });
    }
  }, [solarDataSource, hasCoordinates, effectiveLat, effectiveLng, solcastError]);

  useEffect(() => {
    if (solarDataSource === "pvgis_tmy" && hasCoordinates && !pvgisTmyData && !pvgisLoadingTMY) {
      fetchTMY({ latitude: effectiveLat, longitude: effectiveLng, projectId });
    }
  }, [solarDataSource, hasCoordinates, effectiveLat, effectiveLng, pvgisTmyData, pvgisLoadingTMY, projectId]);

  useEffect(() => {
    if (solarDataSource === "pvgis_monthly" && hasCoordinates && !pvgisMonthlyData && !pvgisLoadingMonthly) {
      fetchMonthlyRadiation({ latitude: effectiveLat, longitude: effectiveLng, projectId });
    }
  }, [solarDataSource, hasCoordinates, effectiveLat, effectiveLng, pvgisMonthlyData, pvgisLoadingMonthly, projectId]);

  // ── Hourly irradiance profiles ──
  const solcastHourlyProfile = useMemo<HourlyIrradianceData[] | undefined>(() => {
    if (!solcastData?.hourly || solcastData.hourly.length === 0) return undefined;
    return generateAverageSolcastProfile(solcastData.hourly);
  }, [solcastData]);

  const pvgisHourlyProfile = useMemo<HourlyIrradianceData[] | undefined>(() => {
    const activeData = solarDataSource === "pvgis_tmy" ? pvgisTmyData : pvgisMonthlyData;
    if (!activeData?.typicalDay?.hourlyGhi) return undefined;
    return activeData.typicalDay.hourlyGhi.map((ghi, hour) => ({
      hour,
      ghi,
      dni: activeData.typicalDay.hourlyDni?.[hour] ?? 0,
      dhi: activeData.typicalDay.hourlyDhi?.[hour] ?? 0,
      temp: activeData.typicalDay.hourlyTemp?.[hour] ?? 25,
    }));
  }, [solarDataSource, pvgisTmyData, pvgisMonthlyData]);

  // ── Solcast PV Profile for chart rendering ──
  const {
    pvProfile: solcastPvProfileData,
    useSolcast: useSolcastForCharts,
    toggleSolcast: toggleSolcastForCharts,
  } = useSolcastPVProfile({
    latitude: effectiveLat,
    longitude: effectiveLng,
    enabled: solarDataSource === "solcast",
  });

  // ── Simplified solar profiles ──
  const solarProfileSolcastSimplified = useMemo(() => {
    if (!solcastHourlyProfile) return null;
    const baseProfile = generateSolarProfile(pvConfig, moduleMetrics.actualDcCapacityKwp, solcastHourlyProfile);
    return baseProfile.map(v => v * reductionFactor);
  }, [pvConfig, moduleMetrics.actualDcCapacityKwp, solcastHourlyProfile, reductionFactor]);

  const solarProfilePVGISSimplified = useMemo(() => {
    if (!pvgisHourlyProfile) return null;
    const baseProfile = generateSolarProfile(pvConfig, moduleMetrics.actualDcCapacityKwp, pvgisHourlyProfile);
    return baseProfile.map(v => v * reductionFactor);
  }, [pvConfig, moduleMetrics.actualDcCapacityKwp, pvgisHourlyProfile, reductionFactor]);

  const solarProfileGenericSimplified = useMemo(() => {
    const baseProfile = generateSolarProfile(pvConfig, moduleMetrics.actualDcCapacityKwp, undefined);
    return baseProfile.map(v => v * reductionFactor);
  }, [pvConfig, moduleMetrics.actualDcCapacityKwp, reductionFactor]);

  // ── Annual GHI ──
  const annualGHI = useMemo(() => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (solarDataSource === "pvgis_monthly" && pvgisMonthlyData?.monthly) {
      return pvgisMonthlyData.monthly.reduce((sum, m) => {
        const days = daysInMonth[m.month - 1] || 30;
        return sum + m.avgDailyGhi * days;
      }, 0);
    }

    if (solarDataSource === "pvgis_tmy" && pvgisTmyData?.summary?.annualGhiKwh) {
      return pvgisTmyData.summary.annualGhiKwh;
    }

    if (pvgisHourlyProfile) {
      const dailySum = pvgisHourlyProfile.reduce((sum, h) => sum + h.ghi / 1000, 0);
      return dailySum * 365;
    }

    return selectedLocation.ghi * 365;
  }, [solarDataSource, pvgisMonthlyData, pvgisTmyData, pvgisHourlyProfile, selectedLocation.ghi]);

  // ── PVsyst ANNUAL result ──
  const annualPVsystResult = useMemo<AnnualPVsystResult | null>(() => {
    if (lossCalculationMode !== "pvsyst") return null;

    const configWithModuleData: PVsystLossChainConfig = {
      ...pvsystConfig,
      stcEfficiency: moduleMetrics.stcEfficiency,
      collectorAreaM2: moduleMetrics.collectorAreaM2,
      lossesAfterInverter: {
        ...DEFAULT_PVSYST_CONFIG.lossesAfterInverter,
        ...pvsystConfig.lossesAfterInverter,
      },
    };

    return calculateAnnualPVsystOutput(
      annualGHI,
      moduleMetrics.collectorAreaM2,
      moduleMetrics.stcEfficiency,
      moduleMetrics.actualDcCapacityKwp,
      configWithModuleData,
      false,
    );
  }, [lossCalculationMode, annualGHI, moduleMetrics, pvsystConfig]);

  // ── PVsyst HOURLY profile ──
  const solarProfilePVsyst = useMemo(() => {
    const activeProfile = solarDataSource === "solcast" ? solcastHourlyProfile : pvgisHourlyProfile;
    if (lossCalculationMode !== "pvsyst" || !activeProfile || !annualPVsystResult) return null;

    const dailyEGrid = annualPVsystResult.eGrid / 365;
    const hourlyGhi = activeProfile.map(h => h.ghi);
    const totalDailyGhi = hourlyGhi.reduce((a, b) => a + b, 0);
    if (totalDailyGhi <= 0) return Array(24).fill(0);

    return hourlyGhi.map(ghi => (ghi / totalDailyGhi) * dailyEGrid * reductionFactor);
  }, [lossCalculationMode, solarDataSource, solcastHourlyProfile, pvgisHourlyProfile, annualPVsystResult, reductionFactor]);

  // ── Active solar profile ──
  const solarProfile = useMemo(() => {
    if (lossCalculationMode === "pvsyst" && solarProfilePVsyst) return solarProfilePVsyst;

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

  // ── TMY 8,760-hour conversion ──
  const tmyConversionResult = useMemo(() => {
    if (solarDataSource !== "pvgis_tmy" || !pvgisTmyData?.hourlyGhi8760 || !includesSolar) return undefined;
    if (lossCalculationMode !== "pvsyst") return undefined;

    const configWithModuleData: PVsystLossChainConfig = {
      ...pvsystConfig,
      stcEfficiency: moduleMetrics.stcEfficiency,
      collectorAreaM2: moduleMetrics.collectorAreaM2,
      lossesAfterInverter: {
        ...DEFAULT_PVSYST_CONFIG.lossesAfterInverter,
        ...pvsystConfig.lossesAfterInverter,
      },
    };

    const inverterTotalKw = inverterConfig.inverterSize * inverterConfig.inverterCount;

    return convertTMYToSolarGeneration({
      hourlyGhiWm2: pvgisTmyData.hourlyGhi8760,
      collectorAreaM2: moduleMetrics.collectorAreaM2,
      stcEfficiency: moduleMetrics.stcEfficiency,
      pvsystConfig: configWithModuleData,
      reductionFactor,
      maxAcOutputKw: inverterTotalKw,
    });
  }, [solarDataSource, pvgisTmyData, includesSolar, lossCalculationMode, pvsystConfig, moduleMetrics, productionReductionPercent, inverterConfig.inverterSize, inverterConfig.inverterCount]);

  const tmyDcProfile8760 = tmyConversionResult?.dcOutput;
  const tmySolarProfile8760 = tmyConversionResult?.acOutput;
  const tmyInverterLossMultiplier = tmyConversionResult?.inverterLossMultiplier ?? 1;

  // ── Loading / status flags ──
  const isLoadingData = solarDataSource === "solcast"
    ? solcastLoading
    : solarDataSource === "pvgis_tmy"
      ? pvgisLoadingTMY
      : pvgisLoadingMonthly;

  const hasRealData = solarDataSource === "solcast" ? !!solcastHourlyProfile : !!pvgisHourlyProfile;

  // ── Active data source label ──
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

  return {
    // Data sources
    solcastData,
    solcastLoading,
    solcastError,
    pvgisTmyData,
    pvgisMonthlyData,
    pvgisLoadingTMY,
    pvgisLoadingMonthly,

    // Profiles
    solarProfile,
    solarProfileSolcast: solarProfileSolcastSimplified,
    solarProfileGenericSimplified,
    solcastPvProfileData,

    // PVsyst
    annualPVsystResult,
    annualGHI,

    // TMY 8760
    tmyDcProfile8760,
    tmySolarProfile8760,
    tmyInverterLossMultiplier,

    // Location
    selectedLocation,
    effectiveLat,
    effectiveLng,

    // Status
    isLoadingData,
    hasRealData,
    activeDataSourceLabel,
    reductionFactor,
  };
}
