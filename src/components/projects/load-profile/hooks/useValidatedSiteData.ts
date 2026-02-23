import { useMemo } from "react";
import { Tenant } from "../types";
import { parseRawData } from "../utils/parseRawData";

/** Minimum kW daily total to exclude outage/power-off days */
const OUTAGE_THRESHOLD_KW = 75;

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
}

interface UseValidatedSiteDataProps {
  tenants: Tenant[];
  rawDataMap?: Record<string, unknown>;
}

export function useValidatedSiteData({ tenants, rawDataMap }: UseValidatedSiteDataProps): ValidatedSiteData {
  return useMemo(() => {
    const includedTenants = tenants.filter(t => t.include_in_load_profile !== false);

    // Helper: get raw data for a tenant
    const getRawData = (tenant: Tenant): unknown =>
      (rawDataMap && tenant.scada_import_id ? rawDataMap[tenant.scada_import_id] : undefined)
      || tenant.scada_imports?.raw_data;

    // === Pass 1: Build per-tenant, per-date hourly maps ===
    const tenantDateMaps = new Map<string, Map<string, number[]>>();
    const tenantsWithRawData: string[] = [];
    const tenantKeyMap = new Map<string, string>();
    const yearsSet = new Set<number>();

    for (const tenant of includedTenants) {
      const tenantArea = Number(tenant.area_sqm) || 0;
      const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
      tenantKeyMap.set(tenant.id, key);

      const points = parseRawData(getRawData(tenant));
      if (points.length === 0) continue;

      const areaScale =
        tenant.scada_imports?.area_sqm && tenant.scada_imports.area_sqm > 0 && tenantArea > 0
          ? tenantArea / tenant.scada_imports.area_sqm
          : 1;

      // Group by date -> hour -> { sum, count }
      const dateHourMap = new Map<string, Map<number, { sum: number; count: number }>>();

      for (const point of points) {
        if (!point.date || !point.time) continue;
        const hour = parseInt(point.time.split(":")[0] || "0", 10);
        if (hour < 0 || hour >= 24) continue;

        const kwValue = (point.value || 0) * areaScale;

        // Track years
        const year = parseInt(point.date.split("-")[0], 10);
        if (!isNaN(year)) yearsSet.add(year);

        if (!dateHourMap.has(point.date)) {
          dateHourMap.set(point.date, new Map());
        }
        const hourMap = dateHourMap.get(point.date)!;
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { sum: 0, count: 0 });
        }
        const entry = hourMap.get(hour)!;
        entry.sum += kwValue;
        entry.count += 1;
      }

      // Convert to per-date hourly kW arrays, filtering outage days
      const dateMap = new Map<string, number[]>();

      dateHourMap.forEach((hourMap, dateKey) => {
        const hourlyKw = Array(24).fill(0);
        let dailyTotal = 0;
        hourMap.forEach((entry, hour) => {
          const avgKw = entry.sum / entry.count;
          hourlyKw[hour] = avgKw;
          dailyTotal += avgKw;
        });

        // Skip outage days
        if (dailyTotal < OUTAGE_THRESHOLD_KW) return;

        dateMap.set(dateKey, hourlyKw);
      });

      if (dateMap.size > 0) {
        tenantDateMaps.set(tenant.id, dateMap);
        tenantsWithRawData.push(tenant.id);
      }
    }

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

    // === Pass 2: Find validated dates (all SCADA tenants have data) ===
    let allValidatedDates: string[] = [];

    if (tenantsWithRawData.length > 0) {
      const firstMap = tenantDateMaps.get(tenantsWithRawData[0])!;
      const candidateDates = Array.from(firstMap.keys());
      allValidatedDates = candidateDates.filter((dateKey) => {
        for (let i = 1; i < tenantsWithRawData.length; i++) {
          const otherMap = tenantDateMaps.get(tenantsWithRawData[i])!;
          if (!otherMap.has(dateKey)) return false;
        }
        return true;
      });
    }

    // === Pass 3: Sum all tenants at each interval to produce site-level data ===
    const siteDataByDate = new Map<string, number[]>();

    for (const dateKey of allValidatedDates) {
      const siteHourly = Array(24).fill(0);
      for (const tenantId of tenantsWithRawData) {
        const dateMap = tenantDateMaps.get(tenantId)!;
        const tenantHourly = dateMap.get(dateKey)!;
        for (let h = 0; h < 24; h++) {
          siteHourly[h] += tenantHourly[h];
        }
      }
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
    };
  }, [tenants, rawDataMap]);
}
