import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS, TOUPeriod } from "../types";
import { TOUXAxisTick } from "../utils/touReferenceAreas";

interface LoadChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
  isLoading?: boolean;
  touPeriodsOverride?: TOUPeriod[];
  month?: number;
  dayOfWeek?: number;
}

export function LoadChart({ chartData, showTOU, isWeekend, unit, isLoading, touPeriodsOverride, month, dayOfWeek }: LoadChartProps) {
  const getPeriod = (h: number): TOUPeriod => {
    if (touPeriodsOverride && touPeriodsOverride[h]) return touPeriodsOverride[h];
    return getTOUPeriod(h, isWeekend, undefined, month, dayOfWeek);
  };

  if (isLoading) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Load Profile</p>
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Load Profile</p>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: showTOU ? 10 : 0 }} syncId="loadProfileSync" barGap={1} barCategoryGap="5%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="hour" tick={<TOUXAxisTick getPeriod={getPeriod} showTOU={showTOU} />} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())} width={45} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const loadValue = Number(payload.find((p) => p.dataKey === "total")?.value) || 0;
                const hourNum = parseInt(label?.toString() || "0");
                const period = getPeriod(hourNum);
                return (
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium">{label}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: TOU_COLORS[period].stroke, color: TOU_COLORS[period].stroke }}>
                        {TOU_COLORS[period].label}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold">{loadValue.toFixed(1)} {unit}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="total" fill="hsl(var(--primary))" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
