import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Battery } from "lucide-react";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS, TOUPeriod } from "../types";

interface BatteryChartProps {
  chartData: ChartDataPoint[];
  batteryCapacity: number;
  batteryAcCapacity?: number;
  batteryPower: number;
  showTOU?: boolean;
  isWeekend?: boolean;
  touPeriodsOverride?: TOUPeriod[];
}

export function BatteryChart({ chartData, batteryCapacity, batteryAcCapacity, batteryPower, showTOU = false, isWeekend = false, touPeriodsOverride }: BatteryChartProps) {
  const displayCapacity = batteryAcCapacity ?? batteryCapacity;

  const getPeriod = (h: number): TOUPeriod => {
    if (touPeriodsOverride && touPeriodsOverride[h]) return touPeriodsOverride[h];
    return getTOUPeriod(h, isWeekend);
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Battery className="h-3 w-3 text-green-500" />
          Battery Storage ({displayCapacity} kWh / {batteryPower} kW)
        </p>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-green-500/60" />
            Charge
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-orange-500/60" />
            Discharge
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-blue-500" />
            SoC
          </span>
        </div>
      </div>
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={[...chartData, ...(showTOU ? [{ hour: "24:00" }] : [])]} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
            {showTOU &&
              Array.from({ length: 24 }, (_, h) => {
                const period = getPeriod(h);
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
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={2}
            />
            <YAxis
              yAxisId="power"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
              width={45}
            />
            <YAxis
              yAxisId="soc"
              orientation="right"
              domain={[0, batteryCapacity]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${Math.round((v / batteryCapacity) * 100)}%`}
              width={40}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const charge = Number(payload.find((p) => p.dataKey === "batteryCharge")?.value) || 0;
                const discharge = Number(payload.find((p) => p.dataKey === "batteryDischarge")?.value) || 0;
                const soc = Number(payload.find((p) => p.dataKey === "batterySoC")?.value) || 0;
                return (
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
                    <p className="font-medium">{label}</p>
                    {charge > 0 && <p className="text-green-500">Charging: {charge.toFixed(1)} kW</p>}
                    {discharge > 0 && <p className="text-orange-500">Discharging: {discharge.toFixed(1)} kW</p>}
                    <p className="text-blue-500">
                      SoC: {Math.round((soc / batteryCapacity) * 100)}% ({soc.toFixed(0)} kWh)
                    </p>
                  </div>
                );
              }}
            />

            <Bar
              yAxisId="power"
              dataKey="batteryCharge"
              fill="hsl(142 76% 36%)"
              fillOpacity={0.6}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              yAxisId="power"
              dataKey="batteryDischarge"
              fill="hsl(25 95% 53%)"
              fillOpacity={0.6}
              radius={[2, 2, 0, 0]}
            />
            <Line yAxisId="soc" type="monotone" dataKey="batterySoC" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
