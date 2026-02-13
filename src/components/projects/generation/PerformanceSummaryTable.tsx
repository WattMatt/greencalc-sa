import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
}

interface PerformanceSummaryTableProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
}

const TABS = ["Production", "Down Time", "Revenue", "Performance"] as const;

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function formatNum(val: number | null | undefined): string {
  if (val == null) return "—";
  return val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRand(val: number | null | undefined): string {
  if (val == null) return "—";
  return "R " + val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDayOfWeek(year: number, month: number, day: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(year, month - 1, day).getDay()];
}

function formatDate(year: number, month: number, day: number): string {
  const dow = getDayOfWeek(year, month, day);
  return `${dow} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

interface DailyRow {
  day: number;
  date: string;
  yieldGuarantee: number;
  meteredGeneration: number;
  downtimeSlots: number;
  downtimeEnergy: number;
  theoreticalGeneration: number;
  surplusDeficit: number;
}

interface SourceDayData {
  actual: number;
  downtimeSlots: number;
  downtimeEnergy: number;
  guarantee: number;
}

export function PerformanceSummaryTable({ projectId, month, year, monthData }: PerformanceSummaryTableProps) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);

  const totalDays = daysInMonth(month, year);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}T23:59:59`;

  // Fetch all generation_readings for this month
  const { data: readings } = useQuery({
    queryKey: ["generation-readings-daily", projectId, year, month],
    queryFn: async () => {
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
    },
  });

  // Fetch per-source guarantees for this month
  const { data: sourceGuarantees } = useQuery({
    queryKey: ["source-guarantees", projectId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_source_guarantees")
        .select("source_label, guaranteed_kwh")
        .eq("project_id", projectId)
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch tariff rate for Revenue tab
  const { data: tariffRate } = useQuery({
    queryKey: ["project-tariff-rate", projectId],
    queryFn: async () => {
      // Get project's tariff_id
      const { data: project, error: pErr } = await supabase
        .from("projects")
        .select("tariff_id")
        .eq("id", projectId)
        .single();
      if (pErr || !project?.tariff_id) return 0;

      // Get rate from tariff_rates (flat rate fallback)
      const { data: rates, error: rErr } = await supabase
        .from("tariff_rates")
        .select("rate_per_kwh, season, time_of_use")
        .eq("tariff_id", project.tariff_id);
      if (rErr || !rates?.length) return 0;

      // Use three-tier fallback: specific TOU > Any TOU for season > Any/All Year
      const anyAllYear = rates.find(r => r.time_of_use === "Any" && r.season === "All Year");
      const anyCurrentSeason = rates.find(r => r.time_of_use === "Any" && (r.season === "High/Winter" || r.season === "Low/Summer"));
      const firstRate = rates[0];

      return Number(anyAllYear?.rate_per_kwh ?? anyCurrentSeason?.rate_per_kwh ?? firstRate?.rate_per_kwh ?? 0);
    },
  });

  const rate = tariffRate ?? 0;

  const { dailyRows, sourceDayMap, distinctSources } = useMemo(() => {
    const dayMap = new Map<number, { actual: number; downtimeSlots: number; downtimeEnergy: number }>();
    const sdMap = new Map<string, SourceDayData>();
    const distinctReadingSources = new Set<string>();

    for (let d = 1; d <= totalDays; d++) {
      dayMap.set(d, { actual: 0, downtimeSlots: 0, downtimeEnergy: 0 });
    }

    if (readings) {
      for (const r of readings) {
        distinctReadingSources.add(r.source || "csv");
      }
    }

    // Build guarantee map
    const guaranteeMap = new Map<string, number>();
    if (sourceGuarantees && sourceGuarantees.length > 0) {
      let hasMatch = false;
      for (const sg of sourceGuarantees) {
        if (distinctReadingSources.has(sg.source_label)) {
          guaranteeMap.set(sg.source_label, sg.guaranteed_kwh);
          hasMatch = true;
        }
      }
      if (!hasMatch && distinctReadingSources.size > 0) {
        const totalSourceGuarantee = sourceGuarantees.reduce((sum, sg) => sum + sg.guaranteed_kwh, 0);
        const perSource = totalSourceGuarantee / distinctReadingSources.size;
        for (const src of distinctReadingSources) {
          guaranteeMap.set(src, perSource);
        }
      }
    }

    // Init sourceDay map
    for (let d = 1; d <= totalDays; d++) {
      for (const src of distinctReadingSources) {
        sdMap.set(`${d}-${src}`, { actual: 0, downtimeSlots: 0, downtimeEnergy: 0, guarantee: (guaranteeMap.get(src) ?? 0) / totalDays });
      }
    }

    // Detect interval
    let intervalHours = 0.5;
    if (readings && readings.length >= 2) {
      const t0 = new Date(readings[0].timestamp).getTime();
      const t1 = new Date(readings[1].timestamp).getTime();
      const diffH = (t1 - t0) / (1000 * 60 * 60);
      if (diffH > 0 && diffH <= 2) intervalHours = diffH;
    }
    const sunHourSlots = ((1050 - 360) / (intervalHours * 60)) + 1;

    const totalGuarantee = monthData.guaranteed_kwh ?? 0;
    const dailyGuarantee = totalGuarantee / totalDays;

    // Build reading lookup
    const readingLookup = new Map<string, number | null>();
    if (readings) {
      for (const r of readings) {
        const ts = new Date(r.timestamp);
        const day = ts.getDate();
        const minutes = ts.getHours() * 60 + ts.getMinutes();
        const sourceLabel = r.source || "csv";
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
    }

    // Downtime calculation
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

        for (let min = sunStartMin; min <= sunEndMin; min += slotIntervalMin) {
          const key = `${d}-${min}-${sourceLabel}`;
          const val = readingLookup.get(key);
          const actualVal = (val !== undefined && val !== null) ? val : 0;
          const threshold = perSlotEnergy * 0.01;
          if (actualVal < threshold) {
            entry.downtimeSlots += 1;
            entry.downtimeEnergy += (perSlotEnergy - actualVal);
            sd.downtimeSlots += 1;
            sd.downtimeEnergy += (perSlotEnergy - actualVal);
          }
        }
      }
    }

    const rows: DailyRow[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const entry = dayMap.get(d)!;
      const metered = entry.actual;
      const theoretical = metered + entry.downtimeEnergy;
      const surplus = metered - dailyGuarantee;

      rows.push({
        day: d,
        date: `${d}`,
        yieldGuarantee: dailyGuarantee,
        meteredGeneration: metered,
        downtimeSlots: entry.downtimeSlots,
        downtimeEnergy: entry.downtimeEnergy,
        theoreticalGeneration: theoretical,
        surplusDeficit: surplus,
      });
    }

    return { dailyRows: rows, sourceDayMap: sdMap, distinctSources: Array.from(distinctReadingSources) };
  }, [readings, totalDays, monthData.guaranteed_kwh, sourceGuarantees]);

  const totals = useMemo(() => {
    return dailyRows.reduce(
      (acc, r) => ({
        yieldGuarantee: acc.yieldGuarantee + r.yieldGuarantee,
        meteredGeneration: acc.meteredGeneration + r.meteredGeneration,
        downtimeSlots: acc.downtimeSlots + r.downtimeSlots,
        downtimeEnergy: acc.downtimeEnergy + r.downtimeEnergy,
        theoreticalGeneration: acc.theoreticalGeneration + r.theoreticalGeneration,
        surplusDeficit: acc.surplusDeficit + r.surplusDeficit,
      }),
      { yieldGuarantee: 0, meteredGeneration: 0, downtimeSlots: 0, downtimeEnergy: 0, theoreticalGeneration: 0, surplusDeficit: 0 }
    );
  }, [dailyRows]);

  // Source-level totals for Down Time and Performance tabs
  const sourceTotals = useMemo(() => {
    const map = new Map<string, { actual: number; downtimeSlots: number; downtimeEnergy: number; guarantee: number }>();
    for (const src of distinctSources) {
      const t = { actual: 0, downtimeSlots: 0, downtimeEnergy: 0, guarantee: 0 };
      for (let d = 1; d <= totalDays; d++) {
        const sd = sourceDayMap.get(`${d}-${src}`);
        if (sd) {
          t.actual += sd.actual;
          t.downtimeSlots += sd.downtimeSlots;
          t.downtimeEnergy += sd.downtimeEnergy;
          t.guarantee += sd.guarantee;
        }
      }
      map.set(src, t);
    }
    return map;
  }, [distinctSources, sourceDayMap, totalDays]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">System Summary — {monthData.fullName} {year}</CardTitle>
      </CardHeader>

      <div className="px-6 flex items-end gap-0 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium border border-b-0 rounded-t-md transition-colors -mb-px",
              activeTab === tab
                ? "bg-background text-foreground border-border"
                : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <CardContent className="pt-3 px-3">
        {/* Production Tab */}
        {activeTab === "Production" && (
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2 px-2 w-12">Days</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Yield Guarantee</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Metered Generation</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Down Time kWh (06:00–17:30)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Theoretical Generation</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Surplus / Deficit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.map((row, i) => (
                    <TableRow key={row.day} className={cn(i % 2 === 0 ? "bg-muted/30" : "")}>
                      <TableCell className="text-xs py-1.5 px-2 font-medium">{row.day}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.yieldGuarantee)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.meteredGeneration)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.downtimeEnergy)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.theoreticalGeneration)}</TableCell>
                      <TableCell className={cn("text-xs py-1.5 px-2 text-right tabular-nums font-medium", row.surplusDeficit < 0 ? "text-destructive" : "text-primary")}>
                        {formatNum(row.surplusDeficit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="text-xs py-2 px-2 font-bold">Total</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.yieldGuarantee)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.meteredGeneration)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.downtimeEnergy)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.theoreticalGeneration)}</TableCell>
                    <TableCell className={cn("text-xs py-2 px-2 text-right tabular-nums font-bold", totals.surplusDeficit < 0 ? "text-destructive" : "text-primary")}>
                      {formatNum(totals.surplusDeficit)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        {/* Down Time Tab */}
        {activeTab === "Down Time" && (
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2 px-2 w-12">Days</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Down Time (06:00–18:00)</TableHead>
                    {distinctSources.map(src => (
                      <TableHead key={src} className="text-xs py-2 px-2 text-right" colSpan={2}>
                        {src}
                      </TableHead>
                    ))}
                    <TableHead className="text-xs py-2 px-2">Comment</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-xs py-1 px-2"></TableHead>
                    <TableHead className="text-xs py-1 px-2 text-right">Slots</TableHead>
                    {distinctSources.map(src => (
                      <>
                        <TableHead key={`${src}-prod`} className="text-xs py-1 px-2 text-right">Production (kWh)</TableHead>
                        <TableHead key={`${src}-dt`} className="text-xs py-1 px-2 text-right">DT Slots</TableHead>
                      </>
                    ))}
                    <TableHead className="text-xs py-1 px-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.map((row, i) => (
                    <TableRow key={row.day} className={cn(i % 2 === 0 ? "bg-muted/30" : "")}>
                      <TableCell className="text-xs py-1.5 px-2 font-medium">{row.day}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{row.downtimeSlots}</TableCell>
                      {distinctSources.map(src => {
                        const sd = sourceDayMap.get(`${row.day}-${src}`);
                        return (
                          <>
                            <TableCell key={`${src}-prod-${row.day}`} className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(sd?.actual ?? 0)}</TableCell>
                            <TableCell key={`${src}-dt-${row.day}`} className="text-xs py-1.5 px-2 text-right tabular-nums">{sd?.downtimeSlots ?? 0}</TableCell>
                          </>
                        );
                      })}
                      <TableCell className="text-xs py-1.5 px-2 text-muted-foreground">—</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="text-xs py-2 px-2 font-bold">Total</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{totals.downtimeSlots}</TableCell>
                    {distinctSources.map(src => {
                      const st = sourceTotals.get(src);
                      return (
                        <>
                          <TableCell key={`${src}-prod-total`} className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(st?.actual ?? 0)}</TableCell>
                          <TableCell key={`${src}-dt-total`} className="text-xs py-2 px-2 text-right tabular-nums font-bold">{st?.downtimeSlots ?? 0}</TableCell>
                        </>
                      );
                    })}
                    <TableCell className="text-xs py-2 px-2"></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        {/* Revenue Tab */}
        {activeTab === "Revenue" && (
          <ScrollArea className="w-full">
            <div className="min-w-[1100px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2 px-2 w-40">Days</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Yield Guarantee (R)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Metered Generation (R)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Down Time (R)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Theoretical Gen (R)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Over Production (R)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Realised Consumption (R)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Guaranteed Gen Actual (R)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.map((row, i) => {
                    const overProd = Math.max(0, row.meteredGeneration - row.yieldGuarantee);
                    const guaranteedActual = row.meteredGeneration - row.yieldGuarantee;
                    return (
                      <TableRow key={row.day} className={cn(i % 2 === 0 ? "bg-muted/30" : "")}>
                        <TableCell className="text-xs py-1.5 px-2 font-medium">{row.day}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatRand(row.yieldGuarantee * rate)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatRand(row.meteredGeneration * rate)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatRand(row.downtimeEnergy * rate)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatRand(row.theoreticalGeneration * rate)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatRand(overProd * rate)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatRand(row.theoreticalGeneration * rate)}</TableCell>
                        <TableCell className={cn("text-xs py-1.5 px-2 text-right tabular-nums font-medium", guaranteedActual < 0 ? "text-destructive" : "text-primary")}>
                          {formatRand(guaranteedActual * rate)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  {(() => {
                    const totalOverProd = Math.max(0, totals.meteredGeneration - totals.yieldGuarantee);
                    const totalGuarActual = totals.meteredGeneration - totals.yieldGuarantee;
                    return (
                      <TableRow className="bg-primary/10 font-bold">
                        <TableCell className="text-xs py-2 px-2 font-bold">Total</TableCell>
                        <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatRand(totals.yieldGuarantee * rate)}</TableCell>
                        <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatRand(totals.meteredGeneration * rate)}</TableCell>
                        <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatRand(totals.downtimeEnergy * rate)}</TableCell>
                        <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatRand(totals.theoreticalGeneration * rate)}</TableCell>
                        <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatRand(totalOverProd * rate)}</TableCell>
                        <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatRand(totals.theoreticalGeneration * rate)}</TableCell>
                        <TableCell className={cn("text-xs py-2 px-2 text-right tabular-nums font-bold", totalGuarActual < 0 ? "text-destructive" : "text-primary")}>
                          {formatRand(totalGuarActual * rate)}
                        </TableCell>
                      </TableRow>
                    );
                  })()}
                </TableFooter>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        {/* Performance Tab */}
        {activeTab === "Performance" && (
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2 px-2 w-40">Days</TableHead>
                    {distinctSources.map(src => (
                      <TableHead key={src} className="text-xs py-2 px-2 text-center" colSpan={2}>
                        {src}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-xs py-1 px-2"></TableHead>
                    {distinctSources.map(src => (
                      <>
                        <TableHead key={`${src}-yg`} className="text-xs py-1 px-2 text-right">Yield Guarantee</TableHead>
                        <TableHead key={`${src}-mg`} className="text-xs py-1 px-2 text-right">Metered Gen</TableHead>
                      </>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.map((row, i) => (
                    <TableRow key={row.day} className={cn(i % 2 === 0 ? "bg-muted/30" : "")}>
                      <TableCell className="text-xs py-1.5 px-2 font-medium">{row.day}</TableCell>
                      {distinctSources.map(src => {
                        const sd = sourceDayMap.get(`${row.day}-${src}`);
                        const guarantee = sd?.guarantee ?? 0;
                        const actual = sd?.actual ?? 0;
                        const ratio = guarantee > 0 ? actual / guarantee : actual > 0 ? 1 : 0;
                        let colorClass = "";
                        if (guarantee > 0) {
                          if (ratio >= 1) colorClass = "bg-green-500/20 text-green-700 dark:text-green-400";
                          else if (ratio >= 0.5) colorClass = "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
                          else colorClass = "bg-red-500/20 text-destructive";
                        }
                        return (
                          <>
                            <TableCell key={`${src}-yg-${row.day}`} className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(guarantee)}</TableCell>
                            <TableCell key={`${src}-mg-${row.day}`} className={cn("text-xs py-1.5 px-2 text-right tabular-nums font-medium", colorClass)}>
                              {formatNum(actual)}
                            </TableCell>
                          </>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="text-xs py-2 px-2 font-bold">Total</TableCell>
                    {distinctSources.map(src => {
                      const st = sourceTotals.get(src);
                      return (
                        <>
                          <TableCell key={`${src}-yg-total`} className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(st?.guarantee ?? 0)}</TableCell>
                          <TableCell key={`${src}-mg-total`} className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(st?.actual ?? 0)}</TableCell>
                        </>
                      );
                    })}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
