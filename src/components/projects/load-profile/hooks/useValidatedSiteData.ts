import { useMemo } from "react";
import { Tenant } from "../types";
import { parseRawData } from "../utils/parseRawData";
import { RawDataMap, RawDataEntry } from "./useRawScadaData";

/** Energy units where sub-hourly readings should be SUMMED to get hourly kW */
const ENERGY_UNITS = new Set(["kwh", "wh", "mwh", "kvah"]);

function isEnergyUnit(unit?: string | null): boolean {
  if (!unit) return true; // default to kWh (energy) for backwards compatibility
  return ENERGY_UNITS.has(unit.toLowerCase());
}

/** Minimum kW daily total at the SITE level to exclude outage/power-off days */
const SITE_OUTAGE_THRESHOLD_KW = 75;

export interface ValidatedSiteData {
  /** Unified site-level hourly kW totals per validated date */
  siteDataByDate: Map<string, number[]>;
  /** Per-tenant hourly kW arrays per validated date (for stacked chart breakdown) */
  tenantDateMaps: Map<string, Map<string, number[]>>;
  /** Tenant ID -> display key mapping */
  tenantKeyMap: Map<string, string>;
  /** IDs of tenants that have valid raw SCADA data */
  tenantsWithRawData: string[];
  /** Tenants without raw SCADA data (need fallback) */
  nonScadaTenants: Tenant[];
  /** Number of validated dates (all SCADA meters overlap) */
  validatedDateCount: number;
  /** Count of tenants with any form of SCADA data */
  scadaCount: number;
  /** Count of tenants using pure estimates */
  estimatedCount: number;
  /** Available years across all raw data */
  availableYears: number[];
  /** Number of outlier days removed across all tenants */
  outlierCount: number;
}

interface UseValidatedSiteDataProps {
  tenants: Tenant[];
  rawDataMap?: RawDataMap;
}

export function useValidatedSiteData({ tenants, rawDataMap }: UseValidatedSiteDataProps): ValidatedSiteData {
  return useMemo(() => {
    const includedTenants = tenants.filter(t => t.include_in_load_profile !== false);

    // Helper: get all raw data entries for a tenant (supports multi-meter)
    const getRawEntries = (tenant: Tenant): { entry: RawDataEntry; areaScale: number }[] => {
      const results: { entry: RawDataEntry; areaScale: number }[] = [];
      const tenantArea = Number(tenant.area_sqm) || 0;

      // 1. Direct scada_import_id link (single-meter)
      if (rawDataMap && tenant.scada_import_id && rawDataMap[tenant.scada_import_id]) {
        const areaScale =
          tenant.scada_imports?.area_sqm && tenant.scada_imports.area_sqm > 0 && tenantArea > 0
            ? tenantArea / tenant.scada_imports.area_sqm
            : 1;
        results.push({ entry: rawDataMap[tenant.scada_import_id], areaScale });
      }
      // 2. Inline raw_data on tenant.scada_imports
      else if (tenant.scada_imports?.raw_data) {
        const areaScale =
          tenant.scada_imports?.area_sqm && tenant.scada_imports.area_sqm > 0 && tenantArea > 0
            ? tenantArea / tenant.scada_imports.area_sqm
            : 1;
        results.push({ entry: { raw_data: tenant.scada_imports.raw_data, value_unit: null }, areaScale });
      }
      // 3. Multi-meter: iterate tenant_meters
      else if (tenant.tenant_meters && tenant.tenant_meters.length > 0 && rawDataMap) {
        for (const meter of tenant.tenant_meters) {
          if (meter.scada_import_id && rawDataMap[meter.scada_import_id]) {
            const meterArea = meter.scada_imports?.area_sqm;
            const areaScale =
              meterArea && meterArea > 0 && tenantArea > 0
                ? tenantArea / meterArea
                : 1;
            results.push({ entry: rawDataMap[meter.scada_import_id], areaScale });
          }
        }
      }
      return results;
    };

    // === Pass 1: Build per-tenant, per-date hourly maps ===
    const tenantDateMaps = new Map<string, Map<string, number[]>>();
    const tenantsWithRawData: string[] = [];
    const tenantKeyMap = new Map<string, string>();
    const yearsSet = new Set<number>();

    for (const tenant of includedTenants) {
      const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
      tenantKeyMap.set(tenant.id, key);

      const rawEntries = getRawEntries(tenant);
      if (rawEntries.length === 0) continue;

      // Group by date -> hour -> { sum, count } across ALL meters for this tenant
      const dateHourMap = new Map<string, Map<number, { sum: number; count: number }>>();

      for (const { entry, areaScale } of rawEntries) {
        const points = parseRawData(entry.raw_data);
        if (points.length === 0) continue;
        const useSum = isEnergyUnit(entry.value_unit);

        for (const point of points) {
          if (!point.date || !point.time) continue;
          const hour = parseInt(point.time.split(":")[0] || "0", 10);
          if (hour < 0 || hour >= 24) continue;

          const kwValue = (point.value || 0) * areaScale;

          const year = parseInt(point.date.split("-")[0], 10);
          if (!isNaN(year)) yearsSet.add(year);

          if (!dateHourMap.has(point.date)) {
            dateHourMap.set(point.date, new Map());
          }
          const hourMap = dateHourMap.get(point.date)!;
          if (!hourMap.has(hour)) {
            hourMap.set(hour, { sum: 0, count: 0 });
          }
          const hourEntry = hourMap.get(hour)!;
          // For multi-meter: sum across meters (each meter contributes its value)
          hourEntry.sum += useSum ? kwValue : kwValue;
          hourEntry.count += 1;
        }
      }

      // Convert to per-date hourly kW arrays
      const dateMap = new Map<string, number[]>();
      // Track whether this tenant has mixed energy/power units (unlikely but safe)
      const firstEntry = rawEntries[0];
      const useSum = isEnergyUnit(firstEntry.entry.value_unit);

      dateHourMap.forEach((hourMap, dateKey) => {
        const hourlyKw = Array(24).fill(0);
        hourMap.forEach((hourEntry, hour) => {
          // For energy units: sum gives total kWh in the hour = avg kW
          // For power units: average the readings
          const hourlyValue = useSum ? hourEntry.sum : hourEntry.sum / hourEntry.count;
          hourlyKw[hour] = hourlyValue;
        });
        dateMap.set(dateKey, hourlyKw);
      });

      if (dateMap.size > 0) {
        tenantDateMaps.set(tenant.id, dateMap);
        tenantsWithRawData.push(tenant.id);
      }
    }

    let outlierCount = 0;

    // === Identify non-SCADA tenants ===
    const rawDataTenantIds = new Set(tenantsWithRawData);
    const nonScadaTenants = includedTenants.filter(t => !rawDataTenantIds.has(t.id));

    // Count tenants with any form of profile data vs pure estimates
    let scadaCount = tenantsWithRawData.length;
    let estimatedCount = 0;
    for (const t of nonScadaTenants) {
      const hasMultiMeter = (t.tenant_meters?.length || 0) > 0 &&
        t.tenant_meters?.some(m => {
          const len = m.scada_imports?.load_profile_weekday?.length;
          return len && [24, 48, 96].includes(len);
        });
      const hasSingleScada = t.scada_imports?.load_profile_weekday &&
        [24, 48, 96].includes(t.scada_imports.load_profile_weekday.length);
      if (hasMultiMeter || hasSingleScada) scadaCount++;
      else estimatedCount++;
    }

    // === Pass 2: Union of ALL dates from ALL SCADA tenants ===
    // Use every date where ANY meter has data, summing whichever meters
    // are available on each date. This is correct for sites with many
    // independently-metered tenants whose date ranges may not overlap.
    let allValidatedDates: string[] = [];

    if (tenantsWithRawData.length > 0) {
      const dateSet = new Set<string>();
      for (const tenantId of tenantsWithRawData) {
        const dateMap = tenantDateMaps.get(tenantId)!;
        dateMap.forEach((_, dateKey) => dateSet.add(dateKey));
      }
      allValidatedDates = Array.from(dateSet).sort();
    }

    // === Pass 3: Sum all tenants at each interval to produce site-level data ===
    const siteDataByDate = new Map<string, number[]>();

    for (const dateKey of allValidatedDates) {
      const siteHourly = Array(24).fill(0);
      for (const tenantId of tenantsWithRawData) {
        const dateMap = tenantDateMaps.get(tenantId)!;
        const tenantHourly = dateMap.get(dateKey);
        if (!tenantHourly) continue; // meter may not have this specific date
        for (let h = 0; h < 24; h++) {
          siteHourly[h] += tenantHourly[h];
        }
      }
      // Site-level outage filter: skip dates where total site consumption is negligible
      const siteDailyTotal = siteHourly.reduce((a, b) => a + b, 0);
      if (siteDailyTotal < SITE_OUTAGE_THRESHOLD_KW) continue;

      siteDataByDate.set(dateKey, siteHourly);
    }

    const availableYears = Array.from(yearsSet).sort((a, b) => a - b);

    return {
      siteDataByDate,
      tenantDateMaps,
      tenantKeyMap,
      tenantsWithRawData,
      nonScadaTenants,
      validatedDateCount: allValidatedDates.length,
      scadaCount,
      estimatedCount,
      availableYears,
      outlierCount,
    };
  }, [tenants, rawDataMap]);
}
