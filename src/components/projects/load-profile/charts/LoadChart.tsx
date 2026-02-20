import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ChartDataPoint, getTOUPeriod, TOU_COLORS } from "../types";

interface LoadChartProps {
  chartData: ChartDataPoint[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
}

export function LoadChart({ chartData, showTOU, isWeekend, unit }: LoadChartProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Load Profile</p>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} syncId="loadProfileSync">
            <defs>
              <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
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
                const loadValue = Number(payload.find((p) => p.dataKey === "total")?.value) || 0;
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
                    <p className="text-lg font-bold">
                      {loadValue.toFixed(1)} {unit}
                    </p>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#totalGradient)"
              dot={false}
              activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--background))" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
