import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS } from "../types";

interface NetLoadChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
}

export function NetLoadChart({ chartData, showTOU, isWeekend, unit }: NetLoadChartProps) {
  // Calculate net load data (load - PV generation)
  const netLoadData = chartData.map((d) => ({
    ...d,
    netLoad: d.total - (d.pvGeneration || 0),
    positiveNet: Math.max(0, d.total - (d.pvGeneration || 0)),
    negativeNet: Math.min(0, d.total - (d.pvGeneration || 0)),
  }));

  const maxNetLoad = Math.max(...netLoadData.map((d) => d.netLoad));
  const minNetLoad = Math.min(...netLoadData.map((d) => d.netLoad));
  const peakDeficit = Math.max(...netLoadData.map((d) => d.positiveNet));
  const peakSurplus = Math.abs(Math.min(...netLoadData.map((d) => d.negativeNet)));
  
  const totalDeficit = netLoadData.reduce((sum, d) => sum + d.positiveNet, 0);
  const totalSurplus = netLoadData.reduce((sum, d) => sum + Math.abs(d.negativeNet), 0);

  return (
    <div className="space-y-1 mt-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-purple-500" />
          Net Load (Load − PV)
        </p>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-purple-500/60" />
            Deficit: {totalDeficit.toFixed(0)} {unit}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-cyan-500/60" />
            Surplus: {totalSurplus.toFixed(0)} {unit}
          </span>
        </div>
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={netLoadData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="netDeficitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(270 60% 50%)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="hsl(270 60% 50%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="netSurplusGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor="hsl(185 70% 45%)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="hsl(185 70% 45%)" stopOpacity={0.05} />
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
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())}
              width={45}
              domain={[Math.min(minNetLoad * 1.1, 0), Math.max(maxNetLoad * 1.1, 0)]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} strokeOpacity={0.3} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const netLoad = Number(payload.find((p) => p.dataKey === "netLoad")?.value) || 0;
                const load = Number(payload.find((p) => p.dataKey === "total")?.value) || 0;
                const pv = Number(payload.find((p) => p.dataKey === "pvGeneration")?.value) || 0;
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
                    <p className="text-muted-foreground">Load: {load.toFixed(1)} {unit}</p>
                    <p className="text-amber-500">PV: {pv.toFixed(1)} {unit}</p>
                    <div className="border-t pt-1 mt-1">
                      <p className={netLoad >= 0 ? "text-purple-500 font-medium" : "text-cyan-500 font-medium"}>
                        Net: {netLoad >= 0 ? "+" : ""}{netLoad.toFixed(1)} {unit}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        {netLoad >= 0 ? "Grid needed" : "Surplus available"}
                      </p>
                    </div>
                  </div>
                );
              }}
            />

            {/* Deficit Area (positive net load - need grid) */}
            <Area
              type="monotone"
              dataKey="positiveNet"
              stroke="hsl(270 60% 50%)"
              strokeWidth={1.5}
              fill="url(#netDeficitGradient)"
              dot={false}
            />

            {/* Surplus Area (negative net load - excess PV) */}
            <Area
              type="monotone"
              dataKey="negativeNet"
              stroke="hsl(185 70% 45%)"
              strokeWidth={1.5}
              fill="url(#netSurplusGradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 text-[10px] text-muted-foreground">
        <span>Peak Deficit: {peakDeficit.toFixed(0)} {unit}/h</span>
        <span>Peak Surplus: {peakSurplus.toFixed(0)} {unit}/h</span>
      </div>
    </div>
  );
}
