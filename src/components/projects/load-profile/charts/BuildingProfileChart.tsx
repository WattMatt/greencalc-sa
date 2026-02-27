import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from "recharts";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS, TOUPeriod } from "../types";
import { Badge } from "@/components/ui/badge";

interface BuildingProfileChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
  includesBattery: boolean;
  touPeriodsOverride?: TOUPeriod[];
  month?: number;
  dayOfWeek?: number;
}

export function BuildingProfileChart({ chartData, showTOU, isWeekend, unit, includesBattery, touPeriodsOverride, month, dayOfWeek }: BuildingProfileChartProps) {
  const totalLoad = chartData.reduce((sum, d) => sum + (d.total || 0), 0);
  const totalSolarUsed = chartData.reduce((sum, d) => sum + (d.solarUsed ?? d.pvGeneration ?? 0), 0);
  const totalPvRaw = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
  const totalImport = chartData.reduce((sum, d) => sum + (d.gridImport || 0), 0);
  const totalExport = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);
  const totalCharge = chartData.reduce((sum, d) => sum + (d.batteryCharge || 0), 0);
  const totalDischarge = chartData.reduce((sum, d) => sum + (d.batteryDischarge || 0), 0);

  // Pre-process data: add negative values for stacking below zero
  const stackedData = chartData.map(d => ({
    ...d,
    gridExportNeg: -(d.gridExport || 0),
    batteryChargeNeg: -(d.batteryCharge || 0),
  }));

  const getPeriod = (h: number): TOUPeriod => {
    if (touPeriodsOverride && touPeriodsOverride[h]) return touPeriodsOverride[h];
    return getTOUPeriod(h, isWeekend, undefined, month, dayOfWeek);
  };

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-primary" />
          Load: {totalLoad.toFixed(0)} {unit}h
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "hsl(38 92% 50%)", opacity: 0.7 }} />
          PV to Load: {totalSolarUsed.toFixed(0)} {unit}h
          {totalPvRaw > 0 && totalSolarUsed < totalPvRaw && (
            <span className="text-muted-foreground ml-0.5">({totalPvRaw.toFixed(0)} gen.)</span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "hsl(0 72% 51%)", opacity: 0.7 }} />
          Import: {totalImport.toFixed(0)} {unit}h
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "hsl(142 76% 36%)", opacity: 0.7 }} />
          Export: {totalExport.toFixed(0)} {unit}h
        </span>
        {includesBattery && (
          <>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "hsl(142 76% 36%)", opacity: 0.5 }} />
              Charge: {totalCharge.toFixed(0)} {unit}h
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "hsl(25 95% 53%)", opacity: 0.7 }} />
              Discharge: {totalDischarge.toFixed(0)} {unit}h
            </span>
          </>
        )}
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={[...stackedData, ...(showTOU ? [{ hour: "24:00" }] : [])]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={1} barCategoryGap="5%">
            {showTOU &&
              Array.from({ length: 24 }, (_, h) => {
                const period = getPeriod(h);
                return (
                  <ReferenceArea
                    key={h}
                    x1={`${h.toString().padStart(2, "0")}:00`}
                    x2={`${(h + 1).toString().padStart(2, "0")}:00`}
                    fill={TOU_COLORS[period].fill}
                    fillOpacity={0.18}
                    stroke="none"
                  />
                );
              })}

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v <= -1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())} width={45} />

            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const dp = chartData.find(d => d.hour === label);
                if (!dp) return null;
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
                    <p style={{ color: "hsl(var(--primary))" }}>Load: {(dp.total || 0).toFixed(1)} {unit}</p>
                    <p className="text-amber-500">PV to Load: {(dp.solarUsed ?? dp.pvGeneration ?? 0).toFixed(1)} {unit}</p>
                    <p className="text-red-500">Grid Import: {(dp.gridImport || 0).toFixed(1)} {unit}</p>
                    <p className="text-emerald-600">Grid Export: {(dp.gridExport || 0).toFixed(1)} {unit}</p>
                    {includesBattery && (
                      <>
                        <p className="text-green-600">Battery Charge: {(dp.batteryCharge || 0).toFixed(1)} {unit}</p>
                        <p className="text-orange-500">Battery Discharge: {(dp.batteryDischarge || 0).toFixed(1)} {unit}</p>
                      </>
                    )}
                  </div>
                );
              }}
            />

            {/* Positive stacked bars */}
            <Bar dataKey="solarUsed" stackId="building" fill="hsl(38 92% 50%)" fillOpacity={0.6} radius={[0, 0, 0, 0]} name="PV to Load" />
            <Bar dataKey="gridImport" stackId="building" fill="hsl(0 72% 51%)" fillOpacity={0.5} radius={[0, 0, 0, 0]} name="Grid Import" />
            {includesBattery && (
              <Bar dataKey="batteryDischarge" stackId="building" fill="hsl(25 95% 53%)" fillOpacity={0.6} radius={[0, 0, 0, 0]} name="Battery Discharge" />
            )}

            {/* Negative stacked bars (below zero) */}
            <Bar dataKey="gridExportNeg" stackId="building" fill="hsl(142 76% 36%)" fillOpacity={0.5} radius={[0, 0, 0, 0]} name="Grid Export" />
            {includesBattery && (
              <Bar dataKey="batteryChargeNeg" stackId="building" fill="hsl(142 76% 36%)" fillOpacity={0.3} radius={[0, 0, 0, 0]} name="Battery Charge" />
            )}

            {/* Load as stepped line overlay */}
            <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Load" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
