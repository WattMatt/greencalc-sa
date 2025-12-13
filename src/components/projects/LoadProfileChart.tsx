import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  shop_type_id: string | null;
  scada_import_id: string | null;
  monthly_kwh_override: number | null;
  shop_types?: {
    name: string;
    kwh_per_sqm_month: number;
    load_profile_weekday: number[];
    load_profile_weekend: number[];
  } | null;
  scada_imports?: {
    shop_name: string | null;
    area_sqm: number | null;
    load_profile_weekday: number[] | null;
  } | null;
}

interface ShopType {
  id: string;
  name: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
}

interface LoadProfileChartProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
}

type DisplayUnit = "kwh" | "kva";

// Default flat profile if none defined (percentage per hour for 100% daily)
const DEFAULT_PROFILE_PERCENT = Array(24).fill(4.17);

export function LoadProfileChart({ tenants, shopTypes }: LoadProfileChartProps) {
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kwh");
  const [powerFactor, setPowerFactor] = useState(0.9);

  // Count tenants with actual SCADA data vs estimated
  const { tenantsWithScada, tenantsEstimated } = useMemo(() => {
    let scadaCount = 0;
    let estimatedCount = 0;
    tenants.forEach((t) => {
      if (t.scada_imports?.load_profile_weekday?.length === 24) {
        scadaCount++;
      } else {
        estimatedCount++;
      }
    });
    return { tenantsWithScada: scadaCount, tenantsEstimated: estimatedCount };
  }, [tenants]);

  // Calculate base kWh data
  const baseChartData = useMemo(() => {
    const hourlyData: { hour: string; total: number; [key: string]: number | string }[] = [];

    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData: { hour: string; total: number; [key: string]: number | string } = {
        hour: hourLabel,
        total: 0,
      };

      tenants.forEach((tenant) => {
        const tenantArea = Number(tenant.area_sqm) || 0;
        
        // Priority 1: Use assigned SCADA profile with area scaling
        if (tenant.scada_imports?.load_profile_weekday?.length === 24) {
          const scadaArea = tenant.scada_imports.area_sqm || tenantArea;
          const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
          
          const baseHourlyKwh = tenant.scada_imports.load_profile_weekday[h] || 0;
          const scaledHourlyKwh = baseHourlyKwh * areaScaleFactor;
          
          const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
          hourData[key] = (hourData[key] as number || 0) + scaledHourlyKwh;
          hourData.total += scaledHourlyKwh;
          return;
        }

        // Priority 2: Fallback to shop_type profile (percentage-based estimation)
        const shopType = tenant.shop_type_id
          ? shopTypes.find((st) => st.id === tenant.shop_type_id)
          : null;

        const monthlyKwh =
          tenant.monthly_kwh_override ||
          (shopType?.kwh_per_sqm_month || 50) * tenantArea;

        const dailyKwh = monthlyKwh / 30;

        const profile = shopType?.load_profile_weekday?.length === 24
          ? shopType.load_profile_weekday.map(Number)
          : DEFAULT_PROFILE_PERCENT;
        
        const hourlyPercent = profile[h] / 100;
        const hourlyKwh = dailyKwh * hourlyPercent;

        const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
        hourData[key] = (hourData[key] as number || 0) + hourlyKwh;
        hourData.total += hourlyKwh;
      });

      hourlyData.push(hourData);
    }

    return hourlyData;
  }, [tenants, shopTypes]);

  // Convert to display unit (kWh or kVA)
  const chartData = useMemo(() => {
    if (displayUnit === "kwh") return baseChartData;

    // Convert kWh to kVA: kVA = kW / PF (and kW = kWh for hourly data)
    return baseChartData.map(hourData => {
      const converted: typeof hourData = { hour: hourData.hour, total: 0 };
      Object.keys(hourData).forEach(key => {
        if (key === "hour") return;
        const kwhValue = hourData[key] as number;
        const kvaValue = kwhValue / powerFactor;
        converted[key] = kvaValue;
        if (key === "total") {
          converted.total = kvaValue;
        }
      });
      return converted;
    });
  }, [baseChartData, displayUnit, powerFactor]);

  // Get unique tenant names for stacked areas
  const tenantKeys = useMemo(() => {
    return tenants.map((t) =>
      t.name.length > 15 ? t.name.slice(0, 15) + "…" : t.name
    );
  }, [tenants]);

  // Generate colors for each tenant
  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(142 76% 36%)",
    "hsl(280 60% 50%)",
    "hsl(30 90% 55%)",
    "hsl(190 70% 45%)",
  ];

  // Summary stats
  const totalDaily = chartData.reduce((sum, d) => sum + d.total, 0);
  const peakHour = chartData.reduce(
    (max, d, i) => (d.total > max.val ? { val: d.total, hour: i } : max),
    { val: 0, hour: 0 }
  );
  const avgHourly = totalDaily / 24;

  const unit = displayUnit === "kwh" ? "kWh" : "kVA";
  const demandUnit = displayUnit === "kwh" ? "kW" : "kVA";

  if (tenants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            Add tenants to see the combined load profile
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Display Unit</Label>
              <Tabs value={displayUnit} onValueChange={(v) => setDisplayUnit(v as DisplayUnit)}>
                <TabsList>
                  <TabsTrigger value="kwh">kWh</TabsTrigger>
                  <TabsTrigger value="kva">kVA</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {displayUnit === "kva" && (
              <div className="flex-1 min-w-[200px] max-w-[300px] space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Power Factor</Label>
                  <span className="text-sm font-medium">{powerFactor.toFixed(2)}</span>
                </div>
                <Slider
                  value={[powerFactor]}
                  onValueChange={([v]) => setPowerFactor(v)}
                  min={0.7}
                  max={1.0}
                  step={0.01}
                  className="w-full"
                />
              </div>
            )}

            <div className="flex gap-2 ml-auto">
              {tenantsWithScada > 0 && (
                <Badge variant="default">{tenantsWithScada} actual profiles</Badge>
              )}
              {tenantsEstimated > 0 && (
                <Badge variant="secondary">{tenantsEstimated} estimated</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Est. Daily Consumption</CardDescription>
            <CardTitle className="text-2xl">{Math.round(totalDaily).toLocaleString()} {unit}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Hour</CardDescription>
            <CardTitle className="text-2xl">
              {peakHour.hour.toString().padStart(2, "0")}:00 ({Math.round(peakHour.val)} {unit})
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. Hourly Demand</CardDescription>
            <CardTitle className="text-2xl">{avgHourly.toFixed(1)} {demandUnit}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Demand</CardDescription>
            <CardTitle className="text-2xl">{peakHour.val.toFixed(1)} {demandUnit}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Combined Load Profile (Weekday) - {displayUnit.toUpperCase()}</CardTitle>
          <CardDescription>
            Stacked hourly {displayUnit === "kwh" ? "energy consumption" : "apparent power"} by tenant
            {displayUnit === "kva" && ` (PF: ${powerFactor.toFixed(2)})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(v) => `${v} ${unit}`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)} ${unit}`, ""]}
                />
                <Legend />
                {tenantKeys.map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="1"
                    stroke={colors[i % colors.length]}
                    fill={colors[i % colors.length]}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
