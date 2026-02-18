/**
 * Computation utility for Monthly Report data pipeline.
 * Extracts the same logic used by PerformanceSummaryTable into a standalone
 * pure async function that returns a fully computed MonthlyReportData object.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface DailyMetrics {
  day: number;
  yieldGuarantee: number;       // kWh
  meteredGeneration: number;    // kWh
  downtimeSlots: number;        // count of 30-min intervals
  downtimeEnergy: number;       // kWh lost
  theoreticalGeneration: number; // metered + downtimeEnergy
  surplusDeficit: number;       // metered - guarantee
}

export interface SourceDayMetrics {
  actual: number;
  downtimeSlots: number;
  downtimeEnergy: number;
  guarantee: number;
}

export interface MonthlyReportData {
  month: number;
  year: number;
  totalDays: number;
  dailyRows: DailyMetrics[];
  totals: {
    yieldGuarantee: number;
    meteredGeneration: number;
    downtimeSlots: number;
    downtimeEnergy: number;
    theoreticalGeneration: number;
    surplusDeficit: number;
  };
  /** Per-source display labels (sorted), e.g. ["Tie-In 1", "Tie-In 2"] */
  sourceLabels: string[];
  /** key = "day-readingSource" */
  sourceDayMap: Map<string, SourceDayMetrics>;
  /** Per-source aggregated totals */
  sourceTotals: Map<string, { actual: number; downtimeSlots: number; downtimeEnergy: number; guarantee: number }>;
  /** Display name map: readingSource -> label */
  sourceDisplayNames: Map<string, string>;
  /** day -> comment */
  comments: Map<number, string>;
  /** R/kWh energy rate */
  tariffRate: number;
  /** Monthly guarantee from generation_records */
  monthlyGuarantee: number;
  /** Monthly actual from generation_records */
  monthlyActual: number;
}

// ── Helpers ──

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

// ── Main computation ──

export async function computeMonthlyReportData(
  projectId: string,
  month: number,
  year: number,
): Promise<MonthlyReportData> {
  const totalDays = daysInMonth(month, year);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}T23:59:59`;

  // Parallel fetches
  const [readingsResult, guaranteesResult, commentsResult, overridesResult, tariffResult, recordsResult] =
    await Promise.all([
      // 1. Paginated generation_readings
      fetchAllReadings(projectId, startDate, endDate),
      // 2. Source guarantees
      supabase
        .from("generation_source_guarantees")
        .select("source_label, guaranteed_kwh, meter_type, reading_source")
        .eq("project_id", projectId)
        .eq("month", month)
        .eq("year", year),
      // 3. Downtime comments
      supabase
        .from("downtime_comments")
        .select("day, comment")
        .eq("project_id", projectId)
        .eq("year", year)
        .eq("month", month),
      // 4. Slot overrides
      supabase
        .from("downtime_slot_overrides")
        .select("day, reading_source, slot_override")
        .eq("project_id", projectId)
        .eq("year", year)
        .eq("month", month),
      // 5. Tariff rate
      fetchTariffRate(projectId),
      // 6. Monthly records
      supabase
        .from("generation_records")
        .select("actual_kwh, guaranteed_kwh")
        .eq("project_id", projectId)
        .eq("month", month)
        .eq("year", year),
    ]);

  const readings = readingsResult;
  const sourceGuarantees = guaranteesResult.data ?? [];
  const commentsData = commentsResult.data ?? [];
  const overridesData = overridesResult.data ?? [];
  const tariffRate = tariffResult;
  const recordsData = recordsResult.data ?? [];

  // Build comments map
  const comments = new Map<number, string>();
  for (const row of commentsData) {
    comments.set(row.day, row.comment);
  }

  // Build slot overrides map
  const slotOverrides = new Map<string, number>();
  for (const row of overridesData) {
    slotOverrides.set(`${row.day}-${row.reading_source}`, row.slot_override);
  }

  // Monthly aggregates from generation_records
  let monthlyGuarantee = 0;
  let monthlyActual = 0;
  for (const rec of recordsData) {
    monthlyGuarantee += Number(rec.guaranteed_kwh ?? 0);
    monthlyActual += Number(rec.actual_kwh ?? 0);
  }

  // ── Core computation (mirrors PerformanceSummaryTable useMemo) ──

  const dayMap = new Map<number, { actual: number; downtimeSlots: number; downtimeEnergy: number }>();
  const sdMap = new Map<string, SourceDayMetrics>();
  const distinctReadingSources = new Set<string>();

  for (let d = 1; d <= totalDays; d++) {
    dayMap.set(d, { actual: 0, downtimeSlots: 0, downtimeEnergy: 0 });
  }

  // Identify sources with actual kWh data
  for (const r of readings) {
    if (r.actual_kwh != null && Number(r.actual_kwh) > 0) {
      distinctReadingSources.add(r.source || "csv");
    }
  }

  // Remove council sources
  if (sourceGuarantees.length > 0) {
    const councilSources = new Set<string>();
    for (const sg of sourceGuarantees) {
      if (sg.meter_type === "council") {
        if (sg.reading_source) councilSources.add(sg.reading_source);
        councilSources.add(sg.source_label);
      }
    }
    for (const src of distinctReadingSources) {
      if (councilSources.has(src)) distinctReadingSources.delete(src);
    }
  }

  // Build guarantee map & display name map (3-tier fallback)
  const guaranteeMap = new Map<string, number>();
  const displayNameMap = new Map<string, string>();

  if (sourceGuarantees.length > 0) {
    let mappedCount = 0;
    // First pass: explicit reading_source
    for (const sg of sourceGuarantees) {
      if (sg.meter_type === "council") continue;
      if (sg.reading_source && distinctReadingSources.has(sg.reading_source)) {
        guaranteeMap.set(sg.reading_source, sg.guaranteed_kwh);
        displayNameMap.set(sg.reading_source, sg.source_label);
        mappedCount++;
      }
    }
    // Second pass: direct label match
    if (mappedCount === 0) {
      for (const sg of sourceGuarantees) {
        if (sg.meter_type === "council") continue;
        if (distinctReadingSources.has(sg.source_label)) {
          guaranteeMap.set(sg.source_label, sg.guaranteed_kwh);
          displayNameMap.set(sg.source_label, sg.source_label);
          mappedCount++;
        }
      }
    }
    // Fallback: distribute evenly
    if (mappedCount === 0 && distinctReadingSources.size > 0) {
      const solarGuarantees = sourceGuarantees.filter(sg => sg.meter_type !== "council");
      const totalSG = solarGuarantees.reduce((sum, sg) => sum + sg.guaranteed_kwh, 0);
      const perSource = totalSG / distinctReadingSources.size;
      const arr = Array.from(distinctReadingSources);
      for (let i = 0; i < arr.length; i++) {
        guaranteeMap.set(arr[i], perSource);
        if (i < solarGuarantees.length) displayNameMap.set(arr[i], solarGuarantees[i].source_label);
      }
    }
  }

  // Init sourceDayMap
  for (let d = 1; d <= totalDays; d++) {
    for (const src of distinctReadingSources) {
      sdMap.set(`${d}-${src}`, { actual: 0, downtimeSlots: 0, downtimeEnergy: 0, guarantee: (guaranteeMap.get(src) ?? 0) / totalDays });
    }
  }

  // Detect interval
  let intervalHours = 0.5;
  if (readings.length >= 2) {
    const t0 = new Date(readings[0].timestamp).getTime();
    const t1 = new Date(readings[1].timestamp).getTime();
    const diffH = (t1 - t0) / (1000 * 60 * 60);
    if (diffH > 0 && diffH <= 2) intervalHours = diffH;
  }
  const sunHourSlots = ((1050 - 360) / (intervalHours * 60)) + 1;

  const totalGuarantee = monthlyGuarantee || 0;
  const dailyGuarantee = totalGuarantee / totalDays;

  // Build reading lookup
  const readingLookup = new Map<string, number | null>();
  for (const r of readings) {
    const tsStr = String(r.timestamp);
    const tsMatch = tsStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!tsMatch) continue;
    const day = parseInt(tsMatch[3], 10);
    const minutes = parseInt(tsMatch[4], 10) * 60 + parseInt(tsMatch[5], 10);
    const sourceLabel = r.source || "csv";
    if (!distinctReadingSources.has(sourceLabel)) continue;
    const key = `${day}-${minutes}-${sourceLabel}`;
    const existing = readingLookup.get(key);
    if (existing !== undefined) {
      readingLookup.set(key, (existing ?? 0) + (Number(r.actual_kwh) || 0));
    } else {
      readingLookup.set(key, r.actual_kwh != null ? Number(r.actual_kwh) : null);
    }

    const entry = dayMap.get(day);
    if (entry) entry.actual += Number(r.actual_kwh) || 0;

    const sdKey = `${day}-${sourceLabel}`;
    const sd = sdMap.get(sdKey);
    if (sd) sd.actual += Number(r.actual_kwh) || 0;
  }

  // Downtime calculation (06:00–17:30 sun window, 0.05% threshold, consecutive-slot rule)
  const sunStartMin = 360;
  const sunEndMin = 1050;
  const slotIntervalMin = intervalHours * 60;

  for (let d = 1; d <= totalDays; d++) {
    const entry = dayMap.get(d)!;
    for (const sourceLabel of distinctReadingSources) {
      const sourceGuarantee = guaranteeMap.get(sourceLabel) ?? 0;
      const sourceDailyGuarantee = sourceGuarantee / totalDays;
      const perSlotEnergy = sourceDailyGuarantee / sunHourSlots;
      const sdKey = `${d}-${sourceLabel}`;
      const sd = sdMap.get(sdKey)!;

      const slotTimes: number[] = [];
      const belowThreshold: boolean[] = [];
      for (let min = sunStartMin; min <= sunEndMin; min += slotIntervalMin) {
        slotTimes.push(min);
        const key = `${d}-${min}-${sourceLabel}`;
        const val = readingLookup.get(key);
        const actualVal = (val !== undefined && val !== null) ? val : 0;
        const threshold = perSlotEnergy * 0.0005;
        belowThreshold.push(actualVal < threshold);
      }

      for (let i = 0; i < slotTimes.length; i++) {
        if (!belowThreshold[i]) continue;
        const hasConsecutive =
          (i > 0 && belowThreshold[i - 1]) ||
          (i < slotTimes.length - 1 && belowThreshold[i + 1]);
        if (hasConsecutive) {
          const key = `${d}-${slotTimes[i]}-${sourceLabel}`;
          const val = readingLookup.get(key);
          const actualVal = (val !== undefined && val !== null) ? val : 0;
          entry.downtimeSlots += 1;
          entry.downtimeEnergy += (perSlotEnergy - actualVal);
          sd.downtimeSlots += 1;
          sd.downtimeEnergy += (perSlotEnergy - actualVal);
        }
      }
    }
  }

  // Apply slot overrides
  if (slotOverrides.size > 0) {
    for (let d = 1; d <= totalDays; d++) {
      const entry = dayMap.get(d)!;
      for (const sourceLabel of distinctReadingSources) {
        const overrideKey = `${d}-${sourceLabel}`;
        const override = slotOverrides.get(overrideKey);
        if (override === undefined) continue;

        const sdKey = `${d}-${sourceLabel}`;
        const sd = sdMap.get(sdKey)!;
        const sourceGuaranteeVal = guaranteeMap.get(sourceLabel) ?? 0;
        const perSlotEnergy = (sourceGuaranteeVal / totalDays) / sunHourSlots;
        const newEnergy = override * perSlotEnergy;
        const energyDelta = newEnergy - sd.downtimeEnergy;
        const slotDelta = override - sd.downtimeSlots;

        sd.downtimeEnergy = newEnergy;
        sd.downtimeSlots = override;
        entry.downtimeEnergy += energyDelta;
        entry.downtimeSlots += slotDelta;
      }
    }
  }

  // Build daily rows
  const dailyRows: DailyMetrics[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const entry = dayMap.get(d)!;
    const metered = entry.actual;
    const theoretical = metered + entry.downtimeEnergy;
    const surplus = metered - dailyGuarantee;

    dailyRows.push({
      day: d,
      yieldGuarantee: dailyGuarantee,
      meteredGeneration: metered,
      downtimeSlots: entry.downtimeSlots,
      downtimeEnergy: entry.downtimeEnergy,
      theoreticalGeneration: theoretical,
      surplusDeficit: surplus,
    });
  }

  // Totals
  const totals = dailyRows.reduce(
    (acc, r) => ({
      yieldGuarantee: acc.yieldGuarantee + r.yieldGuarantee,
      meteredGeneration: acc.meteredGeneration + r.meteredGeneration,
      downtimeSlots: acc.downtimeSlots + r.downtimeSlots,
      downtimeEnergy: acc.downtimeEnergy + r.downtimeEnergy,
      theoreticalGeneration: acc.theoreticalGeneration + r.theoreticalGeneration,
      surplusDeficit: acc.surplusDeficit + r.surplusDeficit,
    }),
    { yieldGuarantee: 0, meteredGeneration: 0, downtimeSlots: 0, downtimeEnergy: 0, theoreticalGeneration: 0, surplusDeficit: 0 },
  );

  // Source totals
  const sortedSources = Array.from(distinctReadingSources).sort((a, b) => {
    const nameA = displayNameMap.get(a) || a;
    const nameB = displayNameMap.get(b) || b;
    return nameA.localeCompare(nameB, undefined, { numeric: true });
  });

  const sourceLabels = sortedSources.map(src => displayNameMap.get(src) || src);

  const sourceTotals = new Map<string, { actual: number; downtimeSlots: number; downtimeEnergy: number; guarantee: number }>();
  for (const src of sortedSources) {
    const t = { actual: 0, downtimeSlots: 0, downtimeEnergy: 0, guarantee: 0 };
    for (let d = 1; d <= totalDays; d++) {
      const sd = sdMap.get(`${d}-${src}`);
      if (sd) {
        t.actual += sd.actual;
        t.downtimeSlots += sd.downtimeSlots;
        t.downtimeEnergy += sd.downtimeEnergy;
        t.guarantee += sd.guarantee;
      }
    }
    sourceTotals.set(src, t);
  }

  return {
    month,
    year,
    totalDays,
    dailyRows,
    totals,
    sourceLabels,
    sourceDayMap: sdMap,
    sourceTotals,
    sourceDisplayNames: displayNameMap,
    comments,
    tariffRate,
    monthlyGuarantee,
    monthlyActual,
  };
}

// ── Data fetching helpers ──

async function fetchAllReadings(
  projectId: string,
  startDate: string,
  endDate: string,
): Promise<{ timestamp: string; actual_kwh: number | null; building_load_kwh: number | null; source: string | null }[]> {
  const allReadings: { timestamp: string; actual_kwh: number | null; building_load_kwh: number | null; source: string | null }[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("generation_readings")
      .select("timestamp, actual_kwh, building_load_kwh, source")
      .eq("project_id", projectId)
      .gte("timestamp", startDate)
      .lte("timestamp", endDate)
      .order("timestamp", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    allReadings.push(...(data ?? []));
    hasMore = (data?.length ?? 0) === pageSize;
    from += pageSize;
  }
  return allReadings;
}

async function fetchTariffRate(projectId: string): Promise<number> {
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("tariff_id")
    .eq("id", projectId)
    .single();
  if (pErr || !project?.tariff_id) return 0;

  const { data: rates, error: rErr } = await supabase
    .from("tariff_rates")
    .select("amount, season, tou, charge, unit")
    .eq("tariff_plan_id", project.tariff_id)
    .eq("charge", "energy");
  if (rErr || !rates?.length) return 0;

  const anyAll = rates.find((r: any) => r.tou === "all" && r.season === "all");
  const anySeasonAll = rates.find((r: any) => r.tou === "all" && (r.season === "high" || r.season === "low"));
  const firstRate = rates[0];

  const raw = Number(anyAll?.amount ?? anySeasonAll?.amount ?? firstRate?.amount ?? 0);
  const unit = (anyAll ?? anySeasonAll ?? firstRate)?.unit || "c/kWh";
  return unit.startsWith("c") ? raw / 100 : raw;
}
