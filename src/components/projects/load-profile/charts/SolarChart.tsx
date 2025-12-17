import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Sun } from "lucide-react";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS } from "../types";

interface SolarChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  dcAcRatio: number;
  show1to1Comparison: boolean;
  unit: string;
}

export function SolarChart({ chartData, showTOU, isWeekend, dcAcRatio, show1to1Comparison, unit }: SolarChartProps) {
  const totalPv = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
  const totalLoad = chartData.reduce((sum, d) => sum + d.total, 0);
  const peakPv = Math.max(...chartData.map((d) => d.pvGeneration || 0));

  return (
    <div className="space-y-1 mt-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sun className="h-3 w-3 text-amber-500" />
          PV Generation
        </p>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-amber-500/60" />
            Total: {totalPv.toFixed(0)} {unit}
          </span>
          <span className="flex items-center gap-1">
            Peak: {peakPv.toFixed(0)} {unit}
          </span>
          {dcAcRatio > 1 && (
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-orange-400" style={{ borderBottom: "1px dashed" }} />
              DC ({(dcAcRatio * 100).toFixed(0)}%)
            </span>
          )}
          {show1to1Comparison && dcAcRatio > 1 && (
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-gray-400" style={{ borderBottom: "2px dotted" }} />
              1:1
            </span>
          )}
        </div>
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            {/* TOU Background */}
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
                    fillOpacity={0.08}
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
                const pv = Number(payload.find((p) => p.dataKey === "pvGeneration")?.value) || 0;
                const load = Number(payload.find((p) => p.dataKey === "total")?.value) || 0;
                const dcOutput = Number(payload.find((p) => p.dataKey === "pvDcOutput")?.value) || 0;
                const clipping = Number(payload.find((p) => p.dataKey === "pvClipping")?.value) || 0;
                const baseline = Number(payload.find((p) => p.dataKey === "pv1to1Baseline")?.value) || 0;
                const hourNum = parseInt(label?.toString() || "0");
                const period = getTOUPeriod(hourNum, isWeekend);

                return (
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{label}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: TOU_COLORS[period].stroke, color: TOU_COLORS[period].stroke }}
                      >
                        {TOU_COLORS[period].label}
                      </Badge>
                    </div>
                    <p className="text-amber-500">
                      PV AC Output: {pv.toFixed(1)} {unit}
                    </p>
                    {dcAcRatio > 1 && (
                      <>
                        <p className="text-orange-400">DC Output: {dcOutput.toFixed(1)} kWh</p>
                        {clipping > 0 && <p className="text-orange-600">Clipping: {clipping.toFixed(1)} kWh</p>}
                      </>
                    )}
                    {show1to1Comparison && dcAcRatio > 1 && (
                      <p className="text-muted-foreground">1:1 Baseline: {baseline.toFixed(1)} kWh</p>
                    )}
                    <p className="text-muted-foreground border-t pt-1 mt-1">Load: {load.toFixed(1)} {unit}</p>
                  </div>
                );
              }}
            />

            {/* Load Line (reference) */}
            <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 4" dot={false} opacity={0.5} />

            {/* PV Generation Area */}
            <Area type="monotone" dataKey="pvGeneration" stroke="hsl(38 92% 50%)" strokeWidth={2} fill="url(#pvGradient)" dot={false} />

            {/* DC Output Line (when oversizing) */}
            {dcAcRatio > 1 && (
              <Line type="monotone" dataKey="pvDcOutput" stroke="hsl(25 95% 53%)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            )}

            {/* 1:1 Baseline Comparison Line */}
            {show1to1Comparison && dcAcRatio > 1 && (
              <Line type="monotone" dataKey="pv1to1Baseline" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="2 4" dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
