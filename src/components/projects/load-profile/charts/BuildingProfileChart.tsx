import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS } from "../types";
import { Badge } from "@/components/ui/badge";

interface BuildingProfileChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
  includesBattery: boolean;
  isHighSeason?: boolean;
}

export function BuildingProfileChart({ chartData, showTOU, isWeekend, unit, includesBattery, isHighSeason = false }: BuildingProfileChartProps) {
  const representativeMonth = isHighSeason ? 5 : 0;
  const extendedData = [...chartData, { ...chartData[chartData.length - 1], hour: "24:00" }];

  const totalLoad = chartData.reduce((sum, d) => sum + (d.total || 0), 0);
  const totalSolarUsed = chartData.reduce((sum, d) => sum + (d.solarUsed ?? d.pvGeneration ?? 0), 0);
  const totalPvRaw = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
  const totalImport = chartData.reduce((sum, d) => sum + (d.gridImport || 0), 0);
  const totalExport = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);
  const totalCharge = chartData.reduce((sum, d) => sum + (d.batteryCharge || 0), 0);
  const totalDischarge = chartData.reduce((sum, d) => sum + (d.batteryDischarge || 0), 0);

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-primary/60" />
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
              <div className="w-3 h-0.5" style={{ backgroundColor: "hsl(142 76% 36%)" }} />
              Charge: {totalCharge.toFixed(0)} {unit}h
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5" style={{ backgroundColor: "hsl(25 95% 53%)" }} />
              Discharge: {totalDischarge.toFixed(0)} {unit}h
            </span>
          </>
        )}
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={extendedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="bpLoadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="bpPvGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="bpImportGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="bpExportGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {showTOU &&
              Array.from({ length: 24 }, (_, h) => {
                const period = getTOUPeriod(h, isWeekend, undefined, representativeMonth);
                return (
                  <ReferenceArea
                    key={h}
                    x1={`${h.toString().padStart(2, "0")}:00`}
                    x2={`${(h + 1).toString().padStart(2, "0")}:00`}
                    fill={TOU_COLORS[period].fill}
                    fillOpacity={0.08}
                    stroke="none"
                  />
                );
              })}

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())} width={45} />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const dp = chartData.find(d => d.hour === label);
                if (!dp) return null;
                const hourNum = parseInt(label?.toString() || "0");
                const period = getTOUPeriod(hourNum, isWeekend, undefined, representativeMonth);

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

            <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#bpLoadGradient)" dot={false} name="Load" />
            <Area type="monotone" dataKey="solarUsed" stroke="hsl(38 92% 50%)" strokeWidth={1.5} fill="url(#bpPvGradient)" dot={false} name="PV to Load" />
            <Area type="monotone" dataKey="gridImport" stroke="hsl(0 72% 51%)" strokeWidth={1.5} fill="url(#bpImportGradient)" dot={false} name="Grid Import" />
            <Area type="monotone" dataKey="gridExport" stroke="hsl(142 76% 36%)" strokeWidth={1.5} fill="url(#bpExportGradient)" dot={false} name="Grid Export" />

            {includesBattery && (
              <Line type="monotone" dataKey="batteryCharge" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} name="Battery Charge" />
            )}
            {includesBattery && (
              <Line type="monotone" dataKey="batteryDischarge" stroke="hsl(25 95% 53%)" strokeWidth={2} dot={false} name="Battery Discharge" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
