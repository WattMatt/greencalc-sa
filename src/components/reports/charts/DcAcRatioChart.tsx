import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DcAcAnalysis } from "../types";
import { getDcAcRecommendation } from "../calculations";

interface DcAcRatioChartProps {
  analysis: DcAcAnalysis;
  dcAcRatio: number;
  className?: string;
}

export function DcAcRatioChart({ analysis, dcAcRatio, className }: DcAcRatioChartProps) {
  const recommendation = getDcAcRecommendation(analysis, dcAcRatio);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>DC/AC Ratio Analysis ({dcAcRatio}:1)</span>
          <span className="text-sm font-normal text-muted-foreground">
            Net Gain: +{analysis.net_gain_percent}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="hourly" className="space-y-4">
          <TabsList>
            <TabsTrigger value="hourly">Hourly Profile</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Yield</TabsTrigger>
          </TabsList>

          <TabsContent value="hourly" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.hourly_comparison}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${h}:00`}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <p className="font-medium">{label}:00</p>
                          {payload.map((p, i) => (
                            <p key={i} style={{ color: p.color }} className="text-sm">
                              {p.name}: {Number(p.value).toFixed(2)} kW
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="baseline_kw"
                    name="1:1 Baseline"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted))"
                    strokeDasharray="5 5"
                  />
                  <Area
                    type="monotone"
                    dataKey="oversized_ac_kw"
                    name="AC Output"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="clipping_kw"
                    name="Clipping Loss"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-muted-foreground">{recommendation}</p>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.monthly_comparison}>
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
                    dataKey="baseline_kwh"
                    name="1:1 Baseline"
                    fill="hsl(var(--muted-foreground))"
                  />
                  <Bar
                    dataKey="oversized_kwh"
                    name={`${dcAcRatio}:1 Output`}
                    fill="hsl(var(--primary))"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  +{analysis.net_gain_kwh.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">kWh/year gained</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">
                  -{analysis.clipping_loss_kwh.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">kWh/year clipped</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analysis.clipping_percent}%
                </p>
                <p className="text-xs text-muted-foreground">Clipping rate</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
