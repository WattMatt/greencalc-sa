import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, Layers, BarChart3 } from "lucide-react";
import { getTOUPeriod, TOU_COLORS } from "../types";
import { EnvelopePoint } from "../hooks/useEnvelopeData";
import { StackedMeterChart } from "./StackedMeterChart";
import { StackedMeterPoint } from "../hooks/useStackedMeterData";

export type ChartViewMode = "envelope" | "stacked";

interface LoadEnvelopeChartProps {
  envelopeData: EnvelopePoint[];
  availableYears: number[];
  yearFrom: number;
  yearTo: number;
  setYearFrom: (y: number | null) => void;
  setYearTo: (y: number | null) => void;
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
  isLoading?: boolean;
  outlierCount?: number;
  viewMode: ChartViewMode;
  onViewModeChange: (mode: ChartViewMode) => void;
  stackedData?: StackedMeterPoint[];
  stackedTenantKeys?: { id: string; label: string; color: string }[];
}

export function LoadEnvelopeChart({
  envelopeData,
  availableYears,
  yearFrom,
  yearTo,
  setYearFrom,
  setYearTo,
  showTOU,
  isWeekend,
  unit,
  isLoading,
  outlierCount = 0,
  viewMode,
  onViewModeChange,
  stackedData,
  stackedTenantKeys,
}: LoadEnvelopeChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Load Envelope</p>
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!envelopeData.length) return null;

  const chartData = envelopeData.map((d) => ({
    hour: d.hour,
    base: d.min,
    band: d.max - d.min,
    avg: d.avg,
    min: d.min,
    max: d.max,
  }));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">Load Profile</p>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => { if (v) onViewModeChange(v as ChartViewMode); }}
          size="sm"
          variant="outline"
          className="h-6"
        >
          <ToggleGroupItem value="envelope" aria-label="Envelope view" className="h-6 px-2 text-[10px] gap-1">
            <Layers className="h-3 w-3" />
            Envelope
          </ToggleGroupItem>
          <ToggleGroupItem value="stacked" aria-label="By meter view" className="h-6 px-2 text-[10px] gap-1">
            <BarChart3 className="h-3 w-3" />
            By Meter
          </ToggleGroupItem>
        </ToggleGroup>
        {outlierCount > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {outlierCount} outlier day{outlierCount !== 1 ? "s" : ""} excluded
          </Badge>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <Select value={String(yearFrom)} onValueChange={(v) => setYearFrom(Number(v))}>
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)} disabled={y > yearTo}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">to</span>
          <Select value={String(yearTo)} onValueChange={(v) => setYearTo(Number(v))}>
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)} disabled={y < yearFrom}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewMode === "stacked" && stackedData && stackedTenantKeys ? (
        <StackedMeterChart
          data={stackedData}
          tenantKeys={stackedTenantKeys}
          showTOU={showTOU}
          isWeekend={isWeekend}
          unit={unit}
        />
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} syncId="loadProfileSync">
              <defs>
                <linearGradient id="envelopeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              {showTOU &&
                Array.from({ length: 24 }, (_, h) => {
                  const period = getTOUPeriod(h, isWeekend);
                  const nextHour = h === 23 ? 23 : h + 1;
                  return (
                    <ReferenceArea
                      key={h}
                      x1={`${h.toString().padStart(2, "0")}:00`}
                      x2={`${nextHour.toString().padStart(2, "0")}:00`}
                      fill={TOU_COLORS[period].fill}
                      fillOpacity={0.12}
                      stroke="none"
                    />
                  );
                })}

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())}
                width={45}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  const hourNum = parseInt(label?.toString() || "0");
                  const period = getTOUPeriod(hourNum, isWeekend);
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-medium">{label}</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ borderColor: TOU_COLORS[period].stroke, color: TOU_COLORS[period].stroke }}
                        >
                          {TOU_COLORS[period].label}
                        </Badge>
                      </div>
                      <div className="space-y-0.5 text-sm">
                        <p>
                          <span className="text-muted-foreground">Max:</span>{" "}
                          <span className="font-semibold">{d.max.toFixed(1)} {unit}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Avg:</span>{" "}
                          <span className="font-semibold">{d.avg.toFixed(1)} {unit}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Min:</span>{" "}
                          <span className="font-semibold">{d.min.toFixed(1)} {unit}</span>
                        </p>
                      </div>
                    </div>
                  );
                }}
              />

              <Area type="monotone" dataKey="base" stackId="envelope" stroke="none" fill="transparent" dot={false} activeDot={false} />
              <Area type="monotone" dataKey="band" stackId="envelope" stroke="none" fill="url(#envelopeFill)" dot={false} activeDot={false} />
              <Line type="monotone" dataKey="max" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} activeDot={false} />
              <Line type="monotone" dataKey="min" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} activeDot={false} />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 4, stroke: "hsl(var(--muted-foreground))", strokeWidth: 2, fill: "hsl(var(--background))" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
