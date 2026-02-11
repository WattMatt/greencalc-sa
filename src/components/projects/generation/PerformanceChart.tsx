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

function formatTimeLabel(date: Date, timeframe: Timeframe, month: number): string {
  if (timeframe === "30min" || timeframe === "hourly") {
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${d}-${MONTH_SHORT[month - 1]} ${h}:${m}`;
  }
  if (timeframe === "daily") {
    return `${date.getDate()}-${MONTH_SHORT[month - 1]}`;
  }
  return MONTH_SHORT[month - 1];
}

export function PerformanceChart({ projectId, month, year, monthData }: PerformanceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [hoursFilter, setHoursFilter] = useState<"all" | "sun">("all");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [stackBars, setStackBars] = useState(false);
  const [displayUnit, setDisplayUnit] = useState<"kWh" | "kW">("kWh");

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const days = daysInMonth(month, year);
  const endDate = `${year}-${String(month).padStart(2, "0")}-${days}`;

  const [dateStart, setDateStart] = useState<string>(startDate);
  const [dateEnd, setDateEnd] = useState<string>(endDate);

  // Query raw readings for interval views - paginate to avoid 1000 row limit
  const { data: readings } = useQuery({
    queryKey: ["generation-readings-chart", projectId, year, month],
    queryFn: async () => {
      const allReadings: { timestamp: string; actual_kwh: number | null; building_load_kwh: number | null }[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("generation_readings")
          .select("timestamp, actual_kwh, building_load_kwh")
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

  // Aggregate readings across all sources by timestamp
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

  const filteredReadings = hoursFilter === "sun" && aggregatedReadings
    ? aggregatedReadings.filter(r => isSunHour(r.timestamp))
    : aggregatedReadings;

  // Apply date range filter
  const dateFilteredReadings = useMemo(() => {
    if (!filteredReadings) return filteredReadings;
    return filteredReadings.filter(r => {
      const d = r.timestamp.slice(0, 10);
      return d >= dateStart && d <= dateEnd;
    });
  }, [filteredReadings, dateStart, dateEnd]);

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
      return dateFilteredReadings.map((r) => {
        const d = parseLocal(r.timestamp);
        return {
          name: formatTimeLabel(d, "30min", month),
          actual: r.actual_kwh ?? 0,
          building_load: r.building_load_kwh ?? 0,
        };
      });
    }

    if (timeframe === "hourly") {
      const hourlyMap = new Map<string, { actual: number; building_load: number }>();
      for (const r of dateFilteredReadings) {
        const d = parseLocal(r.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
        const existing = hourlyMap.get(key) ?? { actual: 0, building_load: 0 };
        existing.actual += r.actual_kwh ?? 0;
        existing.building_load += r.building_load_kwh ?? 0;
        hourlyMap.set(key, existing);
      }
      return Array.from(hourlyMap.entries()).map(([key, val]) => {
        const parts = key.split("-").map(Number);
        const d = new Date(parts[0], parts[1], parts[2], parts[3]);
        return { name: formatTimeLabel(d, "hourly", month), ...val };
      });
    }

    // daily - aggregate readings by day
    const dailyMap = new Map<number, { actual: number; building_load: number }>();
    for (const r of dateFilteredReadings) {
      const d = parseLocal(r.timestamp);
      const day = d.getDate();
      const existing = dailyMap.get(day) ?? { actual: 0, building_load: 0 };
      existing.actual += r.actual_kwh ?? 0;
      existing.building_load += r.building_load_kwh ?? 0;
      dailyMap.set(day, existing);
    }

    // Only show days within the selected date range
    const rangeStartDay = dateStart >= startDate ? new Date(dateStart).getDate() : 1;
    const rangeEndDay = dateEnd <= endDate ? new Date(dateEnd).getDate() : days;
    const monthShort = MONTH_SHORT[month - 1];
    return Array.from({ length: rangeEndDay - rangeStartDay + 1 }, (_, i) => {
      const day = rangeStartDay + i;
      const rec = dailyMap.get(day);
      return {
        name: `${day}-${monthShort}`,
        actual: rec?.actual ?? 0,
        building_load: rec?.building_load ?? 0,
      };
    });
  })();

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
  const enrichedData = chartData.map((d) => ({
    ...d,
    actual: d.actual / kwDivisor,
    building_load: d.building_load / kwDivisor,
    guarantee: (guaranteeValue ?? 0) / kwDivisor,
  }));

  const hasData = enrichedData.length > 0 && enrichedData.some((d) => d.actual > 0 || d.building_load > 0);

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
            variant={displayUnit === "kW" ? "default" : "outline"}
            size="sm"
            className="text-xs px-2 h-8"
            onClick={() => setDisplayUnit(displayUnit === "kWh" ? "kW" : "kWh")}
          >
            {displayUnit === "kW" ? "kW" : "kWh"}
          </Button>
          <Button
            variant={stackBars ? "default" : "outline"}
            size="sm"
            className="text-xs px-2 h-8"
            onClick={() => setStackBars(!stackBars)}
          >
            Building
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
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ComposedChart data={enrichedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={60} interval={labelInterval} />
              <YAxis fontSize={12} label={{ value: displayUnit, angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: "pointer" }} />
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
              <Bar
                dataKey="building_load"
                name="Council Demand"
                fill="var(--color-building_load)"
                stroke="#d9d9d9"
                strokeWidth={1}
                radius={stackBars ? [2, 2, 0, 0] : undefined}
                hide={hiddenSeries.has("building_load")}
                stackId={stackBars ? "building" : undefined}
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
        )}
      </CardContent>
    </Card>
  );
}