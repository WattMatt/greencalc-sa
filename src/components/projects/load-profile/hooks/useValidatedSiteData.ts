import { useMemo } from "react";
import { Tenant } from "../types";
import { parseRawData } from "../utils/parseRawData";

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

        dateMap.set(dateKey, hourlyKw);
      });

      if (dateMap.size > 0) {
        tenantDateMaps.set(tenant.id, dateMap);
        tenantsWithRawData.push(tenant.id);
      }
    }

    // === Pass 1.5: Per-tenant IQR-based outlier removal ===
    // Only removes extreme spikes (stuck meters etc.) — requires BOTH:
    //   1. Daily total > Q3 + 3*IQR  (statistical outlier)
    //   2. Daily total > 5x median   (sanity check to avoid over-filtering)
    let outlierCount = 0;
    for (const tenantId of tenantsWithRawData) {
      const dateMap = tenantDateMaps.get(tenantId)!;
      if (dateMap.size < 20) continue; // need enough data for meaningful statistics

      // Collect daily totals
      const dailyTotals: { date: string; total: number }[] = [];
      dateMap.forEach((hourly, dateKey) => {
        dailyTotals.push({ date: dateKey, total: hourly.reduce((a, b) => a + b, 0) });
      });

      // Sort by total
      const sorted = dailyTotals.map(d => d.total).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const upperFence = q3 + 3 * iqr;
      const medianGate = median * 5;

      // Remove outlier dates — must exceed BOTH thresholds
      for (const { date, total } of dailyTotals) {
        if (total > upperFence && total > medianGate) {
          dateMap.delete(date);
          outlierCount++;
        }
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

    // === Pass 2: Find overlapping DATE RANGE across all SCADA tenants ===
    // For each meter, find its earliest and latest valid date.
    // The overlap is [max of all starts, min of all ends].
    // Within that range, sum whatever meters have data on each date.
    let allValidatedDates: string[] = [];

    if (tenantsWithRawData.length > 0) {
      let rangeStart = "";
      let rangeEnd = "9999-12-31";

      for (const tenantId of tenantsWithRawData) {
        const dateMap = tenantDateMaps.get(tenantId)!;
        const dates = Array.from(dateMap.keys()).sort();
        if (dates.length === 0) continue;
        const first = dates[0];
        const last = dates[dates.length - 1];
        if (first > rangeStart) rangeStart = first;
        if (last < rangeEnd) rangeEnd = last;
      }

      // Collect all unique dates from any meter that fall within the overlap range
      if (rangeStart <= rangeEnd) {
        const dateSet = new Set<string>();
        for (const tenantId of tenantsWithRawData) {
          const dateMap = tenantDateMaps.get(tenantId)!;
          dateMap.forEach((_, dateKey) => {
            if (dateKey >= rangeStart && dateKey <= rangeEnd) {
              dateSet.add(dateKey);
            }
          });
        }
        allValidatedDates = Array.from(dateSet).sort();
      }
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
