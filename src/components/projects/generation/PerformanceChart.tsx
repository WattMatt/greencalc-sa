import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
}

interface PerformanceChartProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
}

type Timeframe = "30min" | "hourly" | "daily" | "monthly";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const chartConfig = {
  actual: { label: "Solar Generation", color: "#f0e442" },
  building_load: { label: "Council Demand", color: "#898989" },
  guarantee: { label: "Guaranteed Generation", color: "#00b0f0" },
};

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/** Parse timestamp as local time, stripping any timezone suffix */
function parseLocal(ts: string): Date {
  // Remove trailing Z or +HH:MM / -HH:MM so Date treats it as local
  const stripped = ts.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  return new Date(stripped);
}

function formatTimeLabel(date: Date, timeframe: Timeframe, month: number, singleDay?: boolean): string {
  if (timeframe === "30min" || timeframe === "hourly") {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    if (singleDay) return `${h}:${m}`;
    const d = date.getDate();
    return `${d}-${MONTH_SHORT[month - 1]} ${h}:${m}`;
  }
  if (timeframe === "daily") {
    return `${date.getDate()}-${MONTH_SHORT[month - 1]}`;
  }
  return MONTH_SHORT[month - 1];
}

const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SOURCE_COLORS = ["#f0e442", "#e6c619", "#d4a017", "#c2842a", "#b0683d", "#9e4c50", "#8b6914", "#c9a832"];

export function PerformanceChart({ projectId, month, year, monthData }: PerformanceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [hoursFilter, setHoursFilter] = useState<"all" | "sun">("all");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [stackBars, setStackBars] = useState(false);
  const [displayUnit, setDisplayUnit] = useState<"kWh" | "kW">("kWh");
  const [showSources, setShowSources] = useState(false);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const days = daysInMonth(month, year);
  const endDate = `${year}-${String(month).padStart(2, "0")}-${days}`;

  const [dateStart, setDateStart] = useState<string>(startDate);
  const [dateEnd, setDateEnd] = useState<string>(endDate);

  // Query raw readings for interval views - paginate to avoid 1000 row limit
  const { data: readings } = useQuery({
    queryKey: ["generation-readings-chart", projectId, year, month],
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
          .gte("timestamp", `${startDate}T00:00:00`)
          .lte("timestamp", `${endDate}T23:59:59`)
          .order("timestamp")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allReadings.push(...(data ?? []));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      return allReadings;
    },
    enabled: timeframe !== "monthly",
  });

  const dailyGuarantee = monthData.guaranteed_kwh ? monthData.guaranteed_kwh / days : null;

  function isSunHour(timestamp: string): boolean {
    const d = parseLocal(timestamp);
    const timeInMinutes = d.getHours() * 60 + d.getMinutes();
    return timeInMinutes >= 360 && timeInMinutes <= 1050;
  }

  // Extract unique source labels
  const sourceLabels = useMemo(() => {
    if (!readings) return [];
    const set = new Set<string>();
    for (const r of readings) if (r.source) set.add(r.source);
    return Array.from(set).sort();
  }, [readings]);

  // Aggregate readings across all sources by timestamp (used when showSources is false)
  const aggregatedReadings = useMemo(() => {
    if (!readings) return null;
    const map = new Map<string, { timestamp: string; actual_kwh: number; building_load_kwh: number }>();
    for (const r of readings) {
      const key = r.timestamp;
      const existing = map.get(key);
      if (existing) {
        existing.actual_kwh += r.actual_kwh ?? 0;
        existing.building_load_kwh += r.building_load_kwh ?? 0;
      } else {
        map.set(key, { timestamp: key, actual_kwh: r.actual_kwh ?? 0, building_load_kwh: r.building_load_kwh ?? 0 });
      }
    }
    return Array.from(map.values());
  }, [readings]);

  // Per-source readings keyed by timestamp (used when showSources is true)
  const perSourceReadings = useMemo(() => {
    if (!readings || !showSources) return null;
    const map = new Map<string, { timestamp: string; building_load_kwh: number; [key: string]: any }>();
    for (const r of readings) {
      const key = r.timestamp;
      const sourceIdx = r.source ? sourceLabels.indexOf(r.source) : -1;
      const sourceKey = sourceIdx >= 0 ? `source_${sourceIdx}` : "actual";
      const existing = map.get(key);
      if (existing) {
        existing[sourceKey] = (existing[sourceKey] ?? 0) + (r.actual_kwh ?? 0);
        existing.building_load_kwh += r.building_load_kwh ?? 0;
      } else {
        const entry: any = { timestamp: key, building_load_kwh: r.building_load_kwh ?? 0 };
        entry[sourceKey] = r.actual_kwh ?? 0;
        map.set(key, entry);
      }
    }
    return Array.from(map.values());
  }, [readings, showSources, sourceLabels]);

  // Choose aggregated or per-source readings based on toggle
  const activeReadings = showSources ? perSourceReadings : aggregatedReadings;

  const filteredReadings = hoursFilter === "sun" && activeReadings
    ? activeReadings.filter((r: any) => isSunHour(r.timestamp))
    : activeReadings;

  // Apply date range filter
  const dateFilteredReadings = useMemo(() => {
    if (!filteredReadings) return filteredReadings;
    return filteredReadings.filter((r: any) => {
      const d = r.timestamp.slice(0, 10);
      return d >= dateStart && d <= dateEnd;
    });
  }, [filteredReadings, dateStart, dateEnd]);

  const isSingleDay = dateStart === dateEnd;

  // Source data keys for per-source mode
  const sourceKeys = sourceLabels.map((_, i) => `source_${i}`);

  const chartData = (() => {
    if (timeframe === "monthly") {
      return [{
        name: MONTH_SHORT[month - 1],
        actual: monthData.actual_kwh ?? 0,
        building_load: monthData.building_load_kwh ?? 0,
      }];
    }

    if (!dateFilteredReadings || dateFilteredReadings.length === 0) return [];

    if (timeframe === "30min") {
      return dateFilteredReadings.map((r: any) => {
        const d = parseLocal(r.timestamp);
        const entry: any = {
          name: formatTimeLabel(d, "30min", month, isSingleDay),
          building_load: r.building_load_kwh ?? 0,
        };
        if (showSources) {
          for (const sk of sourceKeys) entry[sk] = r[sk] ?? 0;
        } else {
          entry.actual = r.actual_kwh ?? 0;
        }
        return entry;
      });
    }

    if (timeframe === "hourly") {
      const hourlyMap = new Map<string, any>();
      for (const r of dateFilteredReadings as any[]) {
        const d = parseLocal(r.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
        const existing = hourlyMap.get(key) ?? { building_load: 0 };
        if (showSources) {
          for (const sk of sourceKeys) existing[sk] = (existing[sk] ?? 0) + (r[sk] ?? 0);
        } else {
          existing.actual = (existing.actual ?? 0) + (r.actual_kwh ?? 0);
        }
        existing.building_load += r.building_load_kwh ?? 0;
        hourlyMap.set(key, existing);
      }
      return Array.from(hourlyMap.entries()).map(([key, val]) => {
        const parts = key.split("-").map(Number);
        const d = new Date(parts[0], parts[1], parts[2], parts[3]);
        return { name: formatTimeLabel(d, "hourly", month, isSingleDay), ...val };
      });
    }

    // daily
    const dailyMap = new Map<number, any>();
    for (const r of dateFilteredReadings as any[]) {
      const d = parseLocal(r.timestamp);
      const day = d.getDate();
      const existing = dailyMap.get(day) ?? { building_load: 0 };
      if (showSources) {
        for (const sk of sourceKeys) existing[sk] = (existing[sk] ?? 0) + (r[sk] ?? 0);
      } else {
        existing.actual = (existing.actual ?? 0) + (r.actual_kwh ?? 0);
      }
      existing.building_load += r.building_load_kwh ?? 0;
      dailyMap.set(day, existing);
    }

     const rangeStartDay = dateStart >= startDate ? parseInt(dateStart.slice(8, 10)) : 1;
     const rangeEndDay = dateEnd <= endDate ? parseInt(dateEnd.slice(8, 10)) : days;
    const monthShort = MONTH_SHORT[month - 1];
    return Array.from({ length: rangeEndDay - rangeStartDay + 1 }, (_, i) => {
      const day = rangeStartDay + i;
      const rec = dailyMap.get(day) ?? {};
      const entry: any = { name: `${day}-${monthShort}`, building_load: rec.building_load ?? 0 };
      if (showSources) {
        for (const sk of sourceKeys) entry[sk] = rec[sk] ?? 0;
      } else {
        entry.actual = rec.actual ?? 0;
      }
      return entry;
    });
  })();

  // Single day label for display between x-axis and legend
  const singleDayLabel = isSingleDay
    ? `${new Date(dateStart).getDate()} ${MONTH_FULL[month - 1]}`
    : null;

  // Sun hours (06:00–17:30) = 11.5 hours = 23 half-hour intervals
  const sunHourIntervals = 23;
  const allHourIntervals = 48;
  const intervalsPerDay = hoursFilter === "sun" ? sunHourIntervals : allHourIntervals;
  const hoursPerDay = hoursFilter === "sun" ? 11.5 : 24;

  const guaranteeValue = timeframe === "monthly"
    ? monthData.guaranteed_kwh
    : timeframe === "daily"
      ? dailyGuarantee
      : timeframe === "hourly"
        ? (dailyGuarantee ? dailyGuarantee / hoursPerDay : null)
        : (dailyGuarantee ? dailyGuarantee / intervalsPerDay : null);

  // Divisor to convert kWh → kW based on timeframe interval duration
  const kwDivisor = displayUnit === "kW"
    ? (timeframe === "30min" ? 0.5 : timeframe === "hourly" ? 1 : timeframe === "daily" ? 24 : days * 24)
    : 1;

  // Add guarantee field to each data point, applying unit conversion
  const enrichedData = chartData.map((d: any) => {
    const entry: any = { ...d, building_load: d.building_load / kwDivisor, guarantee: (guaranteeValue ?? 0) / kwDivisor };
    if (showSources) {
      for (const sk of sourceKeys) entry[sk] = (d[sk] ?? 0) / kwDivisor;
    } else {
      entry.actual = (d.actual ?? 0) / kwDivisor;
    }
    return entry;
  });

  // Compute global Y-axis max from full month data (not date-filtered)
  const yAxisMax = useMemo(() => {
    if (timeframe === "monthly") {
      const vals: number[] = [];
      if (!hiddenSeries.has("actual") && !showSources) vals.push((monthData.actual_kwh ?? 0) / kwDivisor);
      if (showSources) vals.push((monthData.actual_kwh ?? 0) / kwDivisor); // approx
      if (!hiddenSeries.has("building_load") && stackBars) {
        // stacked: add building on top
        const top = ((monthData.actual_kwh ?? 0) + (monthData.building_load_kwh ?? 0)) / kwDivisor;
        vals.push(top);
      } else if (!hiddenSeries.has("building_load")) {
        vals.push((monthData.building_load_kwh ?? 0) / kwDivisor);
      }
      if (guaranteeValue != null && !hiddenSeries.has("guarantee")) vals.push(guaranteeValue / kwDivisor);
      return Math.ceil((Math.max(0, ...vals) * 1.05) || 1);
    }

    if (!filteredReadings || filteredReadings.length === 0) return undefined;

    // Aggregate full month readings at current timeframe granularity
    const bucketMap = new Map<string, any>();
    for (const r of filteredReadings as any[]) {
      const d = parseLocal(r.timestamp);
      let key: string;
      if (timeframe === "30min") key = r.timestamp;
      else if (timeframe === "hourly") key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      else key = `${d.getDate()}`;

      const existing = bucketMap.get(key) ?? { building_load: 0 };
      if (showSources) {
        for (const sk of sourceKeys) existing[sk] = (existing[sk] ?? 0) + ((r as any)[sk] ?? 0);
      } else {
        existing.actual = (existing.actual ?? 0) + ((r as any).actual_kwh ?? (r as any).actual ?? 0);
      }
      existing.building_load += (r as any).building_load_kwh ?? (r as any).building_load ?? 0;
      bucketMap.set(key, existing);
    }

    let globalMax = 0;
    for (const val of bucketMap.values()) {
      let barHeight = 0;
      if (showSources) {
        for (const sk of sourceKeys) {
          if (!hiddenSeries.has(sk)) barHeight += ((val[sk] ?? 0) / kwDivisor);
        }
      } else {
        if (!hiddenSeries.has("actual")) barHeight += ((val.actual ?? 0) / kwDivisor);
      }
      if (stackBars && !hiddenSeries.has("building_load")) {
        barHeight += ((val.building_load ?? 0) / kwDivisor);
      }
      // Also check building_load alone (unstacked)
      if (!stackBars && !hiddenSeries.has("building_load")) {
        globalMax = Math.max(globalMax, (val.building_load ?? 0) / kwDivisor);
      }
      globalMax = Math.max(globalMax, barHeight);
    }
    if (guaranteeValue != null && !hiddenSeries.has("guarantee")) {
      globalMax = Math.max(globalMax, guaranteeValue / kwDivisor);
    }
    return Math.ceil(globalMax * 1.05) || undefined;
  }, [filteredReadings, timeframe, kwDivisor, hiddenSeries, showSources, sourceKeys, stackBars, guaranteeValue, monthData]);

  const hasData = enrichedData.length > 0 && enrichedData.some((d: any) => {
    if (showSources) return sourceKeys.some(sk => (d[sk] ?? 0) > 0);
    return (d.actual ?? 0) > 0 || (d.building_load ?? 0) > 0;
  });

  // Dynamic chart config for sources mode
  const activeChartConfig = useMemo(() => {
    if (!showSources) return chartConfig;
    const cfg: Record<string, { label: string; color: string }> = {
      building_load: chartConfig.building_load,
      guarantee: chartConfig.guarantee,
    };
    sourceLabels.forEach((label, i) => {
      cfg[`source_${i}`] = { label, color: SOURCE_COLORS[i % SOURCE_COLORS.length] };
    });
    return cfg;
  }, [showSources, sourceLabels]);

  const handleLegendClick = (e: any) => {
    const key = e.dataKey;
    if (!key) return;
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Calculate interval for X-axis labels based on data size
  const labelInterval = chartData.length > 50 ? Math.ceil(chartData.length / 30) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">System Performance — {monthData.fullName} {year}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant={showSources ? "default" : "outline"}
            size="sm"
            className="text-xs px-2 h-8"
            onClick={() => setShowSources(!showSources)}
          >
            Sources
          </Button>
          <Button
            variant={stackBars ? "default" : "outline"}
            size="sm"
            className="text-xs px-2 h-8"
            onClick={() => setStackBars(!stackBars)}
          >
            Building
          </Button>
          <Button
            variant={displayUnit === "kW" ? "default" : "outline"}
            size="sm"
            className="text-xs px-2 h-8"
            onClick={() => setDisplayUnit(displayUnit === "kWh" ? "kW" : "kWh")}
          >
            {displayUnit === "kW" ? "kW" : "kWh"}
          </Button>
          <ToggleGroup type="single" value={hoursFilter} onValueChange={(v) => v && setHoursFilter(v as "all" | "sun")} size="sm" variant="outline">
            <ToggleGroupItem value="all" className="text-xs px-2 h-8">All Hours</ToggleGroupItem>
            <ToggleGroupItem value="sun" className="text-xs px-2 h-8">Sun Hours</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30min">30 Min</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <div className="px-6 pb-2 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateStart}
            min={startDate}
            max={dateEnd}
            onChange={(e) => setDateStart(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateEnd}
            min={dateStart}
            max={endDate}
            onChange={(e) => setDateEnd(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={dateStart <= startDate}
            onClick={() => {
              const stepDays = Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000) + 1;
              const shift = (d: string, n: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
              let newStart = shift(dateStart, -stepDays);
              let newEnd = shift(dateEnd, -stepDays);
              if (newStart < startDate) { newStart = startDate; newEnd = shift(newStart, stepDays - 1); }
              if (newEnd > endDate) newEnd = endDate;
              setDateStart(newStart);
              setDateEnd(newEnd);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={dateEnd >= endDate}
            onClick={() => {
              const stepDays = Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000) + 1;
              const shift = (d: string, n: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
              let newStart = shift(dateStart, stepDays);
              let newEnd = shift(dateEnd, stepDays);
              if (newEnd > endDate) { newEnd = endDate; newStart = shift(newEnd, -(stepDays - 1)); }
              if (newStart < startDate) newStart = startDate;
              setDateStart(newStart);
              setDateEnd(newEnd);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Upload CSV data to see the performance chart
          </div>
        ) : (
          <div>
            <ChartContainer config={activeChartConfig} className="h-[300px] w-full">
              <ComposedChart data={enrichedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={isSingleDay ? 40 : 60} interval={labelInterval} />
                <YAxis fontSize={12} domain={yAxisMax ? [0, yAxisMax] : undefined} allowDataOverflow label={{ value: displayUnit, angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {!singleDayLabel && <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: "pointer" }} />}
                {showSources ? (
                  sourceLabels.map((label, i) => (
                    <Bar
                      key={`source_${i}`}
                      dataKey={`source_${i}`}
                      name={label}
                      fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      stroke="#d9d9d9"
                      strokeWidth={1}
                      radius={i === sourceLabels.length - 1 && !stackBars ? [2, 2, 0, 0] : undefined}
                      hide={hiddenSeries.has(`source_${i}`)}
                      stackId="solar"
                    />
                  ))
                ) : (
                  <Bar
                    dataKey="actual"
                    name="Solar Generation"
                    fill="var(--color-actual)"
                    stroke="#d9d9d9"
                    strokeWidth={1}
                    radius={stackBars ? undefined : [2, 2, 0, 0]}
                    hide={hiddenSeries.has("actual")}
                    stackId={stackBars ? "building" : undefined}
                  />
                )}
                <Bar
                  dataKey="building_load"
                  name="Council Demand"
                  fill="var(--color-building_load)"
                  stroke="#d9d9d9"
                  strokeWidth={1}
                  radius={stackBars ? [2, 2, 0, 0] : undefined}
                  hide={hiddenSeries.has("building_load")}
                  stackId={stackBars ? (showSources ? "solar" : "building") : undefined}
                />
                {guaranteeValue != null && (
                  <Line
                    dataKey="guarantee"
                    name="Guaranteed Generation"
                    stroke="var(--color-guarantee)"
                    strokeWidth={2}
                    dot={false}
                    hide={hiddenSeries.has("guarantee")}
                  />
                )}
              </ComposedChart>
            </ChartContainer>
            {singleDayLabel && (
              <div className="text-center space-y-1 -mt-1">
                <p className="text-xs font-medium text-muted-foreground">{singleDayLabel}</p>
                <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
                  {showSources ? (
                    sourceLabels.map((label, i) => {
                      const key = `source_${i}`;
                      const hidden = hiddenSeries.has(key);
                      return (
                        <span key={i} className="flex items-center gap-1.5 cursor-pointer select-none" style={{ opacity: hidden ? 0.4 : 1 }} onClick={() => setHiddenSeries(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; })}>
                          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length], border: "1px solid #d9d9d9" }} />
                          {label}
                        </span>
                      );
                    })
                  ) : (
                    <span className="flex items-center gap-1.5 cursor-pointer select-none" style={{ opacity: hiddenSeries.has("actual") ? 0.4 : 1 }} onClick={() => setHiddenSeries(prev => { const next = new Set(prev); next.has("actual") ? next.delete("actual") : next.add("actual"); return next; })}><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#f0e442", border: "1px solid #d9d9d9" }} /> Solar Generation</span>
                  )}
                  <span className="flex items-center gap-1.5 cursor-pointer select-none" style={{ opacity: hiddenSeries.has("building_load") ? 0.4 : 1 }} onClick={() => setHiddenSeries(prev => { const next = new Set(prev); next.has("building_load") ? next.delete("building_load") : next.add("building_load"); return next; })}><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#898989", border: "1px solid #d9d9d9" }} /> Council Demand</span>
                  <span className="flex items-center gap-1.5 cursor-pointer select-none" style={{ opacity: hiddenSeries.has("guarantee") ? 0.4 : 1 }} onClick={() => setHiddenSeries(prev => { const next = new Set(prev); next.has("guarantee") ? next.delete("guarantee") : next.add("guarantee"); return next; })}><span className="inline-block w-3 h-1" style={{ background: "#00b0f0" }} /> Guaranteed Generation</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}