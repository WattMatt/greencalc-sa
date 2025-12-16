import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MonthlyData {
  month: string;
  generation_kwh: number;
  consumption_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  self_consumption_kwh: number;
}

interface MonthlyYieldChartProps {
  data: MonthlyData[];
  className?: string;
}

export function MonthlyYieldChart({ data, className }: MonthlyYieldChartProps) {
  const totalGeneration = data.reduce((sum, m) => sum + m.generation_kwh, 0);
  const totalConsumption = data.reduce((sum, m) => sum + m.consumption_kwh, 0);
  const totalSelfConsumption = data.reduce((sum, m) => sum + m.self_consumption_kwh, 0);
  const selfConsumptionRate = totalGeneration > 0 
    ? (totalSelfConsumption / totalGeneration * 100).toFixed(1) 
    : "0";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Monthly Energy Yield</span>
          <span className="text-sm font-normal text-muted-foreground">
            Self-consumption: {selfConsumptionRate}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <p className="font-medium">{label}</p>
                      {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color }} className="text-sm">
                          {p.name}: {Number(p.value).toLocaleString()} kWh
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar
                dataKey="generation_kwh"
                name="Solar Generation"
                fill="hsl(var(--chart-1))"
                stackId="generation"
              />
              <Bar
                dataKey="grid_export_kwh"
                name="Grid Export"
                fill="hsl(var(--chart-2))"
                stackId="export"
              />
              <Line
                type="monotone"
                dataKey="consumption_kwh"
                name="Consumption"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-chart-1">
              {totalGeneration.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">kWh Generated</p>
          </div>
          <div>
            <p className="text-xl font-bold">
              {totalConsumption.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">kWh Consumed</p>
          </div>
          <div>
            <p className="text-xl font-bold text-chart-1">
              {totalSelfConsumption.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">kWh Self-consumed</p>
          </div>
          <div>
            <p className="text-xl font-bold text-chart-2">
              {data.reduce((sum, m) => sum + m.grid_export_kwh, 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">kWh Exported</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
