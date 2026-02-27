import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { buildTOUReferenceAreas } from "../utils/touReferenceAreas";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS, TOUPeriod } from "../types";

interface GridFlowChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
  touPeriodsOverride?: TOUPeriod[];
  month?: number;
  dayOfWeek?: number;
}

export function GridFlowChart({ chartData, showTOU, isWeekend, unit, touPeriodsOverride, month, dayOfWeek }: GridFlowChartProps) {
  const totalImport = chartData.reduce((sum, d) => sum + (d.gridImport || 0), 0);
  const totalExport = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);

  const getPeriod = (h: number): TOUPeriod => {
    if (touPeriodsOverride && touPeriodsOverride[h]) return touPeriodsOverride[h];
    return getTOUPeriod(h, isWeekend, undefined, month, dayOfWeek);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <ArrowDownToLine className="h-3 w-3 text-red-500" />
          Grid Flow
        </p>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-red-500/60" />
            Import: {totalImport.toFixed(0)} {unit}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-green-500/60" />
            Export: {totalExport.toFixed(0)} {unit}
          </span>
        </div>
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={[...chartData, ...(showTOU ? [{ hour: "24:00" }] : [])]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={1} barCategoryGap="5%">
            {showTOU && buildTOUReferenceAreas(getPeriod)}

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())} width={45} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const gridImport = Number(payload.find((p) => p.dataKey === "gridImport")?.value) || 0;
                const gridExport = Number(payload.find((p) => p.dataKey === "gridExport")?.value) || 0;
                const hourNum = parseInt(label?.toString() || "0");
                const period = getPeriod(hourNum);

                return (
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{label}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: TOU_COLORS[period].stroke, color: TOU_COLORS[period].stroke }}>
                        {TOU_COLORS[period].label}
                      </Badge>
                    </div>
                    {gridImport > 0 && (
                      <p className="text-red-500 flex items-center gap-1">
                        <ArrowDownToLine className="h-3 w-3" />
                        Import: {gridImport.toFixed(1)} {unit}
                      </p>
                    )}
                    {gridExport > 0 && (
                      <p className="text-green-500 flex items-center gap-1">
                        <ArrowUpFromLine className="h-3 w-3" />
                        Export: {gridExport.toFixed(1)} {unit}
                      </p>
                    )}
                    {gridImport === 0 && gridExport === 0 && (
                      <p className="text-muted-foreground">Self-sufficient</p>
                    )}
                  </div>
                );
              }}
            />

            <Bar dataKey="gridImport" stackId="grid" fill="hsl(0 72% 51%)" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
            <Bar dataKey="gridExport" stackId="grid" fill="hsl(142 76% 36%)" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
