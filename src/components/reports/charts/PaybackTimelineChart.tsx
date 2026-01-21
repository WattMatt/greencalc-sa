import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PaybackData {
  year: number;
  cumulative_savings: number;
  system_cost: number;
  net_position: number;
}

interface PaybackTimelineChartProps {
  data: PaybackData[];
  paybackYear: number;
  totalSystemCost: number;
  className?: string;
}

export function PaybackTimelineChart({
  data,
  paybackYear,
  totalSystemCost,
  className,
}: PaybackTimelineChartProps) {
  const finalYear = data[data.length - 1];
  const totalSavings = finalYear?.cumulative_savings || 0;
  const roi = totalSystemCost > 0 
    ? ((totalSavings - totalSystemCost) / totalSystemCost * 100).toFixed(1)
    : "0";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Payback Timeline</span>
          <Badge variant={paybackYear <= 7 ? "default" : "secondary"}>
            {paybackYear} year payback
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="year"
                className="text-xs"
                tickFormatter={(y) => `Y${y}`}
              />
              <YAxis
                className="text-xs"
                tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <p className="font-medium">Year {label}</p>
                      {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color }} className="text-sm">
                          {p.name}: R{Number(p.value).toLocaleString()}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <ReferenceLine
                y={totalSystemCost}
                stroke="hsl(var(--destructive))"
                strokeDasharray="5 5"
                label={{
                  value: "System Cost",
                  position: "right",
                  className: "text-xs fill-destructive",
                }}
              />
              <ReferenceLine
                x={paybackYear}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{
                  value: "Payback",
                  position: "top",
                  className: "text-xs fill-primary",
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative_savings"
                name="Cumulative Savings"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.2}
              />
              <Line
                type="monotone"
                dataKey="net_position"
                name="Net Position"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-destructive">
              R{totalSystemCost.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">System Cost</p>
          </div>
          <div>
            <p className="text-xl font-bold text-chart-1">
              R{totalSavings.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">20-Year Savings</p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary">{roi}%</p>
            <p className="text-xs text-muted-foreground">ROI</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
