import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from "recharts";
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
  maxPvAcKva?: number;
}

export function SolarChart({ chartData, showTOU, isWeekend, dcAcRatio, show1to1Comparison, unit, maxPvAcKva }: SolarChartProps) {
  const totalPv = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
  const totalDc = chartData.reduce((sum, d) => sum + (d.pvDcOutput || 0), 0);
  const total1to1 = chartData.reduce((sum, d) => sum + (d.pv1to1Baseline || 0), 0);
  const peakDc = Math.max(...chartData.map((d) => d.pvDcOutput || 0));
  const totalClipping = chartData.reduce((sum, d) => sum + (d.pvClipping || 0), 0);
  const energyGained = totalPv - total1to1;

  // Y-axis must accommodate the DC curve going above AC limit
  const yAxisMax = dcAcRatio > 1 ? Math.max(peakDc * 1.1, (maxPvAcKva || 0) * 1.3) : undefined;

  return (
    <div className="space-y-1 mt-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sun className="h-3 w-3 text-amber-500" />
          PV Generation {dcAcRatio > 1 && `(DC/AC: ${(dcAcRatio * 100).toFixed(0)}%)`}
        </p>
        <div className="flex items-center gap-3 text-[10px]">
          {dcAcRatio > 1 && (
            <>
              <span className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-blue-500" style={{ height: 2 }} />
                DC: {totalDc.toFixed(0)} {unit}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-amber-500/60" />
                AC: {totalPv.toFixed(0)} {unit}
              </span>
              {totalClipping > 0 && (
                <span className="text-orange-500">
                  Clipped: {totalClipping.toFixed(0)} {unit}
                </span>
              )}
            </>
          )}
          {!dcAcRatio || dcAcRatio <= 1 ? (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-amber-500/60" />
              Total: {totalPv.toFixed(0)} {unit}
            </span>
          ) : null}
          {show1to1Comparison && dcAcRatio > 1 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <div className="w-3 h-0.5 border-b-2 border-dashed border-muted-foreground" />
              1:1: {total1to1.toFixed(0)} {unit}
            </span>
          )}
        </div>
      </div>
      
      {/* Stats badges for DC/AC comparison */}
      {dcAcRatio > 1 && (
        <div className="flex gap-2 text-[10px]">
          {energyGained > 0 && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-500/10">
              +{energyGained.toFixed(0)} {unit} gained vs 1:1
            </Badge>
          )}
          {totalClipping > 0 && (
            <Badge variant="outline" className="text-orange-600 border-orange-600/30 bg-orange-500/10">
              {totalClipping.toFixed(0)} {unit} clipped ({((totalClipping / totalDc) * 100).toFixed(1)}%)
            </Badge>
          )}
        </div>
      )}
      
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pvAcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="pv1to1Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05} />
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
              domain={yAxisMax ? [0, yAxisMax] : ["auto", "auto"]}
            />
            
            {/* Inverter AC limit reference line (dashed horizontal) */}
            {dcAcRatio > 1 && maxPvAcKva && (
              <ReferenceLine 
                y={maxPvAcKva} 
                stroke="hsl(var(--destructive))" 
                strokeDasharray="6 4" 
                strokeWidth={1.5}
                label={{ 
                  value: `Inverter AC Limit`, 
                  position: "insideTopRight", 
                  fontSize: 9,
                  fill: "hsl(var(--destructive))"
                }}
              />
            )}
            
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                
                const dataPoint = chartData.find(d => d.hour === label);
                const pv = dataPoint?.pvGeneration || 0;
                const load = dataPoint?.total || 0;
                const dcOutput = dataPoint?.pvDcOutput || 0;
                const clipping = dataPoint?.pvClipping || 0;
                const baseline = dataPoint?.pv1to1Baseline || 0;
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
                    {dcAcRatio > 1 && (
                      <p className="text-blue-500 font-medium">
                        DC Panel Output: {dcOutput.toFixed(1)} {unit}
                      </p>
                    )}
                    <p className="text-amber-600">
                      AC Inverter Output: {pv.toFixed(1)} {unit}
                    </p>
                    {dcAcRatio > 1 && clipping > 0 && (
                      <p className="text-orange-500">Clipping Loss: {clipping.toFixed(1)} {unit}</p>
                    )}
                    {show1to1Comparison && dcAcRatio > 1 && (
                      <p className="text-muted-foreground">1:1 Baseline: {baseline.toFixed(1)} {unit}</p>
                    )}
                    <p className="text-muted-foreground border-t pt-1 mt-1">Site Load: {load.toFixed(1)} {unit}</p>
                  </div>
                );
              }}
            />

            {/* 1:1 Baseline Comparison Area (gray - smallest curve) */}
            {show1to1Comparison && dcAcRatio > 1 && (
              <Area 
                type="monotone" 
                dataKey="pv1to1Baseline" 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={1.5} 
                strokeDasharray="4 4"
                fill="url(#pv1to1Gradient)" 
                dot={false} 
              />
            )}

            {/* DC Output curve (blue line - the larger bell curve showing panel capability) */}
            {dcAcRatio > 1 && (
              <Line 
                type="monotone" 
                dataKey="pvDcOutput" 
                stroke="hsl(217 91% 60%)" 
                strokeWidth={2.5} 
                dot={false}
                name="DC Output"
              />
            )}

            {/* AC Output Area (amber - clips flat at inverter limit) */}
            <Area 
              type="monotone" 
              dataKey="pvGeneration" 
              stroke="hsl(38 92% 50%)" 
              strokeWidth={2} 
              fill="url(#pvAcGradient)" 
              dot={false}
              name="AC Output"
            />

            {/* Load Line (reference) */}
            <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 4" dot={false} opacity={0.4} name="Load" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}