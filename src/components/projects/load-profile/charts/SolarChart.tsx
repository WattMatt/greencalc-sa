import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Customized } from "recharts";
import { TOUXAxisTick, TOUBarsLayer } from "../utils/touReferenceAreas";
import { Badge } from "@/components/ui/badge";
import { Sun } from "lucide-react";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS, TOUPeriod } from "../types";

interface SolarChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  dcAcRatio: number;
  show1to1Comparison: boolean;
  unit: string;
  maxPvAcKva?: number;
  touPeriodsOverride?: TOUPeriod[];
  month?: number;
  dayOfWeek?: number;
}

export function SolarChart({ chartData, showTOU, isWeekend, dcAcRatio, show1to1Comparison, unit, maxPvAcKva, touPeriodsOverride, month, dayOfWeek }: SolarChartProps) {
  const getPeriod = (h: number): TOUPeriod => {
    if (touPeriodsOverride && touPeriodsOverride[h]) return touPeriodsOverride[h];
    return getTOUPeriod(h, isWeekend, undefined, month, dayOfWeek);
  };

  const totalPv = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
  const totalDc = chartData.reduce((sum, d) => sum + (d.pvDcOutput || 0), 0);
  const total1to1 = chartData.reduce((sum, d) => sum + (d.pv1to1Baseline || 0), 0);
  const peakDc = Math.max(...chartData.map((d) => d.pvDcOutput || 0));
  const totalClipping = chartData.reduce((sum, d) => sum + (d.pvClipping || 0), 0);
  const totalSolarUsed = chartData.reduce((sum, d) => sum + (d.solarUsed ?? d.pvGeneration ?? 0), 0);
  const totalBatteryCharge = chartData.reduce((sum, d) => sum + (d.batteryCharge || 0), 0);
  const totalGridExport = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);
  const hasSolarUsedData = chartData.some(d => d.solarUsed !== undefined);
  const effectiveGeneration = hasSolarUsedData ? totalSolarUsed : totalPv;
  const energyGained = totalPv - total1to1;
  const netBenefit = energyGained - totalClipping;
  const yAxisMax = dcAcRatio > 1 ? Math.max(peakDc * 1.1, (maxPvAcKva || 0) * 1.3) : undefined;

  return (
    <div className="space-y-1">
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
          {(!dcAcRatio || dcAcRatio <= 1) ? (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-amber-500/60" />
              Total: {totalPv.toFixed(0)} {unit}
            </span>
          ) : null}
          {show1to1Comparison && dcAcRatio > 1 && (
            <>
              <span className="flex items-center gap-1 text-muted-foreground">
                <div className="w-3 h-0.5 border-b-2 border-dashed border-muted-foreground" />
                1:1: {total1to1.toFixed(0)} {unit}
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <div className="w-2 h-2 rounded-sm bg-emerald-500/50" />
                Gain
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Stats badges */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {hasSolarUsedData && (
          <>
            <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-500/10">
              To Load: {totalSolarUsed.toFixed(0)} {unit}
            </Badge>
            {totalBatteryCharge > 0 && (
              <Badge variant="outline" className="text-blue-600 border-blue-600/30 bg-blue-500/10">
                To Battery: {totalBatteryCharge.toFixed(0)} {unit}
              </Badge>
            )}
            {totalGridExport > 0 && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-500/10">
                Exported: {totalGridExport.toFixed(0)} {unit}
              </Badge>
            )}
            {totalPv > 0 && (totalPv - totalSolarUsed - totalBatteryCharge - totalGridExport) > 0.5 && (
              <Badge variant="outline" className="text-muted-foreground border-border">
                Curtailed: {(totalPv - totalSolarUsed - totalBatteryCharge - totalGridExport).toFixed(0)} {unit}
              </Badge>
            )}
          </>
        )}
        {dcAcRatio > 1 && (
          <>
            {energyGained > 0 && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-500/10">
                +{energyGained.toFixed(0)} {unit} gained vs 1:1
              </Badge>
            )}
            {totalClipping > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-600/30 bg-orange-500/10">
                -{totalClipping.toFixed(0)} {unit} clipped ({((totalClipping / totalDc) * 100).toFixed(1)}%)
              </Badge>
            )}
            {(energyGained > 0 || totalClipping > 0) && (
              <Badge 
                variant="outline" 
                className={`font-semibold ${
                  netBenefit >= 0 
                    ? "text-blue-600 border-blue-600/30 bg-blue-500/10" 
                    : "text-red-600 border-red-600/30 bg-red-500/10"
                }`}
              >
                Net: {netBenefit >= 0 ? "+" : ""}{netBenefit.toFixed(0)} {unit} ({netBenefit >= 0 ? "✓" : "✗"} oversizing {netBenefit >= 0 ? "beneficial" : "not beneficial"})
              </Badge>
            )}
          </>
        )}
      </div>
      
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: showTOU ? 10 : 0 }} barGap={1} barCategoryGap="5%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="hour" tick={<TOUXAxisTick getPeriod={getPeriod} showTOU={showTOU} />} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())} width={45} domain={yAxisMax ? [0, yAxisMax] : ["auto", "auto"]} />
            
            {dcAcRatio > 1 && maxPvAcKva && (
              <ReferenceLine y={maxPvAcKva} stroke="hsl(var(--destructive))" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Inverter AC Limit`, position: "insideTopRight", fontSize: 9, fill: "hsl(var(--destructive))" }} />
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
                const gain = Math.max(0, pv - baseline);
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
                    {dcAcRatio > 1 && (
                      <p className="text-blue-500 font-medium">DC Panel Output: {dcOutput.toFixed(1)} {unit}</p>
                    )}
                    <p className="text-amber-600">
                      {hasSolarUsedData ? "Consumed" : "AC Inverter Output"}: {(dataPoint?.solarUsed ?? pv).toFixed(1)} {unit}
                    </p>
                    {dcAcRatio > 1 && clipping > 0 && (
                      <p className="text-orange-500">Clipping Loss: {clipping.toFixed(1)} {unit}</p>
                    )}
                    {show1to1Comparison && dcAcRatio > 1 && (
                      <p className="text-muted-foreground">1:1 Baseline: {baseline.toFixed(1)} {unit}</p>
                    )}
                    {show1to1Comparison && dcAcRatio > 1 && gain > 0 && (
                      <p className="text-emerald-600">Energy Gained: +{gain.toFixed(1)} {unit}</p>
                    )}
                    
                  </div>
                );
              }}
            />

            {show1to1Comparison && dcAcRatio > 1 && (
              <Line type="monotone" dataKey="pv1to1Baseline" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} name="1:1 Baseline" />
            )}
            {dcAcRatio > 1 && (
              <Line type="monotone" dataKey="pvDcOutput" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={false} name="DC Output" />
            )}
            <Bar dataKey="pvGeneration" fill="hsl(38 92% 50%)" fillOpacity={0.6} radius={[2, 2, 0, 0]} name="PV Generation" />
            
            <Customized component={<TOUBarsLayer getPeriod={getPeriod} showTOU={showTOU} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
