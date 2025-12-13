import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    load_profile_weekend?: number[] | null;
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

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Realistic day-of-week multipliers to simulate natural shopping centre variation
// Based on typical retail patterns: Monday slow, Friday busy, Saturday peak, Sunday quieter
const DAY_MULTIPLIERS: Record<DayOfWeek, number> = {
  Monday: 0.92,    // Post-weekend, slower start
  Tuesday: 0.96,   // Building up
  Wednesday: 1.00, // Baseline weekday
  Thursday: 1.04,  // Pre-weekend pickup
  Friday: 1.08,    // Payday, pre-weekend peak
  Saturday: 1.05,  // Weekend peak (applied to weekend profile)
  Sunday: 0.88,    // Quieter weekend day (applied to weekend profile)
};

// Default flat profile if none defined (percentage per hour for 100% daily)
const DEFAULT_PROFILE_PERCENT = Array(24).fill(4.17);

// South African TOU period definitions
// Weekday: Peak 7-10am & 6-8pm, Standard 6-7am & 10am-6pm & 8-10pm, Off-Peak 10pm-6am
// Weekend: All Off-Peak
type TOUPeriod = "peak" | "standard" | "off-peak";

const getTOUPeriod = (hour: number, isWeekend: boolean): TOUPeriod => {
  if (isWeekend) return "off-peak";
  
  // Peak: 7-10 (7,8,9) and 18-20 (18,19)
  if ((hour >= 7 && hour < 10) || (hour >= 18 && hour < 20)) return "peak";
  
  // Off-Peak: 22-6 (22,23,0,1,2,3,4,5)
  if (hour >= 22 || hour < 6) return "off-peak";
  
  // Standard: 6-7, 10-18, 20-22
  return "standard";
};

const TOU_COLORS: Record<TOUPeriod, { fill: string; stroke: string; label: string }> = {
  "peak": { 
    fill: "hsl(0 72% 51%)",        // Vivid red
    stroke: "hsl(0 72% 40%)",
    label: "Peak"
  },
  "standard": { 
    fill: "hsl(38 92% 50%)",       // Orange/Amber - more distinct from yellow
    stroke: "hsl(38 92% 40%)",
    label: "Standard"
  },
  "off-peak": { 
    fill: "hsl(160 84% 39%)",      // Teal/green - more distinct
    stroke: "hsl(160 84% 30%)",
    label: "Off-Peak"
  }
};

const TOU_BG_OPACITY = 0.25; // Increased opacity for better visibility

export function LoadProfileChart({ tenants, shopTypes }: LoadProfileChartProps) {
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kwh");
  const [powerFactor, setPowerFactor] = useState(0.9);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Monday");
  const [showTOU, setShowTOU] = useState(true);

  const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
  const isWeekend = selectedDay === "Saturday" || selectedDay === "Sunday";

  // Generate TOU period ranges for ReferenceArea components
  const touRanges = useMemo(() => {
    const ranges: { start: number; end: number; period: TOUPeriod }[] = [];
    let currentPeriod = getTOUPeriod(0, isWeekend);
    let rangeStart = 0;

    for (let h = 1; h <= 24; h++) {
      const period = h < 24 ? getTOUPeriod(h, isWeekend) : currentPeriod;
      if (period !== currentPeriod || h === 24) {
        ranges.push({ start: rangeStart, end: h - 1, period: currentPeriod });
        currentPeriod = period;
        rangeStart = h;
      }
    }
    return ranges;
  }, [isWeekend]);

  const navigateDay = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" 
      ? (dayIndex - 1 + 7) % 7 
      : (dayIndex + 1) % 7;
    setSelectedDay(DAYS_OF_WEEK[newIndex]);
  };

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

  // Calculate base kWh data based on selected day
  const baseChartData = useMemo(() => {
    const isWeekendDay = selectedDay === "Saturday" || selectedDay === "Sunday";
    const dayMultiplier = DAY_MULTIPLIERS[selectedDay];
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
        const scadaWeekday = tenant.scada_imports?.load_profile_weekday;
        const scadaWeekend = tenant.scada_imports?.load_profile_weekend;
        const scadaProfile = isWeekendDay ? (scadaWeekend || scadaWeekday) : scadaWeekday;
        
        if (scadaProfile?.length === 24) {
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
          
          const baseHourlyKwh = scadaProfile[h] || 0;
          // Apply both area scaling and day-of-week multiplier
          const scaledHourlyKwh = baseHourlyKwh * areaScaleFactor * dayMultiplier;
          
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

        const shopTypeProfile = isWeekendDay 
          ? (shopType?.load_profile_weekend || shopType?.load_profile_weekday)
          : shopType?.load_profile_weekday;
        
        const profile = shopTypeProfile?.length === 24
          ? shopTypeProfile.map(Number)
          : DEFAULT_PROFILE_PERCENT;
        
        const hourlyPercent = profile[h] / 100;
        // Apply day-of-week multiplier
        const hourlyKwh = dailyKwh * hourlyPercent * dayMultiplier;

        const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
        hourData[key] = (hourData[key] as number || 0) + hourlyKwh;
        hourData.total += hourlyKwh;
      });

      hourlyData.push(hourData);
    }

    return hourlyData;
  }, [tenants, shopTypes, selectedDay]);

  // Calculate weekly totals (need both weekday and weekend data)
  const weeklyStats = useMemo(() => {
    const calculateDayTotal = (useWeekend: boolean) => {
      let total = 0;
      for (let h = 0; h < 24; h++) {
        tenants.forEach((tenant) => {
          const tenantArea = Number(tenant.area_sqm) || 0;
          
          const scadaWeekday = tenant.scada_imports?.load_profile_weekday;
          const scadaWeekend = tenant.scada_imports?.load_profile_weekend;
          const scadaProfile = useWeekend ? (scadaWeekend || scadaWeekday) : scadaWeekday;
          
          if (scadaProfile?.length === 24) {
            const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
            const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
            total += (scadaProfile[h] || 0) * areaScaleFactor;
            return;
          }

          const shopType = tenant.shop_type_id
            ? shopTypes.find((st) => st.id === tenant.shop_type_id)
            : null;

          const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
          const dailyKwh = monthlyKwh / 30;
          const shopTypeProfile = useWeekend 
            ? (shopType?.load_profile_weekend || shopType?.load_profile_weekday)
            : shopType?.load_profile_weekday;
          const profile = shopTypeProfile?.length === 24 ? shopTypeProfile.map(Number) : DEFAULT_PROFILE_PERCENT;
          total += dailyKwh * (profile[h] / 100);
        });
      }
      return total;
    };

    const weekdayTotal = calculateDayTotal(false);
    const weekendTotal = calculateDayTotal(true);
    const weeklyTotal = (weekdayTotal * 5) + (weekendTotal * 2);
    const weeklyPeakDemand = Math.max(weekdayTotal, weekendTotal) / 24; // Rough peak from avg

    return {
      weekdayDaily: weekdayTotal,
      weekendDaily: weekendTotal,
      weeklyTotal,
      monthlyEstimate: weeklyTotal * 4.33,
      avgWeeklyDemand: weeklyTotal / (24 * 7),
    };
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

  // Daily stats for selected day
  const totalDaily = chartData.reduce((sum, d) => sum + d.total, 0);
  const peakHour = chartData.reduce(
    (max, d, i) => (d.total > max.val ? { val: d.total, hour: i } : max),
    { val: 0, hour: 0 }
  );
  const avgHourly = totalDaily / 24;
  const loadFactor = peakHour.val > 0 ? (avgHourly / peakHour.val) * 100 : 0;

  const unit = displayUnit === "kwh" ? "kWh" : "kVA";

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
            {/* Day Navigation */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Day of Week</Label>
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => navigateDay("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="w-24 text-center">
                  <span className="text-sm font-medium">{selectedDay}</span>
                  <Badge variant={isWeekend ? "secondary" : "outline"} className="ml-2 text-xs">
                    {isWeekend ? "Weekend" : "Weekday"}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => navigateDay("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

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

            <div className="flex items-center gap-4">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <Switch checked={showTOU} onCheckedChange={setShowTOU} />
                TOU Periods
              </Label>
            </div>

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

      {/* Weekly Summary - contextual based on display unit */}
      {displayUnit === "kwh" ? (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Weekly Energy Summary</CardTitle>
            <CardDescription>Total consumption across Mon-Sun</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Weekday Daily Avg</p>
                <p className="text-lg font-semibold">{Math.round(weeklyStats.weekdayDaily).toLocaleString()} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weekend Daily Avg</p>
                <p className="text-lg font-semibold">{Math.round(weeklyStats.weekendDaily).toLocaleString()} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weekly Total</p>
                <p className="text-lg font-semibold">{Math.round(weeklyStats.weeklyTotal).toLocaleString()} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Estimate</p>
                <p className="text-lg font-semibold">{Math.round(weeklyStats.monthlyEstimate).toLocaleString()} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual Estimate</p>
                <p className="text-lg font-semibold">{Math.round(weeklyStats.weeklyTotal * 52).toLocaleString()} kWh</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Weekly Demand Summary</CardTitle>
            <CardDescription>Apparent power demand analysis (PF: {powerFactor.toFixed(2)})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Weekday Peak Demand</p>
                <p className="text-lg font-semibold">{(Math.max(...Array(24).fill(0).map((_, h) => weeklyStats.weekdayDaily / 24)) / powerFactor * 1.3).toFixed(0)} kVA</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weekend Peak Demand</p>
                <p className="text-lg font-semibold">{(Math.max(...Array(24).fill(0).map((_, h) => weeklyStats.weekendDaily / 24)) / powerFactor * 1.2).toFixed(0)} kVA</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg. Hourly Demand</p>
                <p className="text-lg font-semibold">{((weeklyStats.weekdayDaily / 24) / powerFactor).toFixed(1)} kVA</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Diversified Demand</p>
                <p className="text-lg font-semibold">{(peakHour.val * 0.85).toFixed(1)} kVA</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recommended NMD</p>
                <p className="text-lg font-semibold">{(peakHour.val * 1.1).toFixed(0)} kVA</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Stats - contextual based on display unit */}
      {displayUnit === "kwh" ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{selectedDay} Consumption</CardDescription>
              <CardTitle className="text-2xl">{Math.round(totalDaily).toLocaleString()} kWh</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Peak Hour</CardDescription>
              <CardTitle className="text-2xl">
                {peakHour.hour.toString().padStart(2, "0")}:00 ({Math.round(peakHour.val)} kWh)
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg. Hourly Consumption</CardDescription>
              <CardTitle className="text-2xl">{avgHourly.toFixed(1)} kWh</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Load Factor</CardDescription>
              <CardTitle className="text-2xl">{loadFactor.toFixed(1)}%</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Peak Demand</CardDescription>
              <CardTitle className="text-2xl">{peakHour.val.toFixed(1)} kVA</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg. Demand</CardDescription>
              <CardTitle className="text-2xl">{avgHourly.toFixed(1)} kVA</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Peak Hour</CardDescription>
              <CardTitle className="text-2xl">
                {peakHour.hour.toString().padStart(2, "0")}:00
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Load Factor</CardDescription>
              <CardTitle className="text-2xl">{loadFactor.toFixed(1)}%</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {selectedDay} Load Profile
              </CardTitle>
              <CardDescription>
                {tenants.length} tenants • {displayUnit === "kwh" ? "Energy consumption" : "Apparent power demand"}
                {displayUnit === "kva" && ` (PF: ${powerFactor.toFixed(2)})`}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{Math.round(peakHour.val).toLocaleString()} {unit}</p>
              <p className="text-xs text-muted-foreground">Peak at {peakHour.hour.toString().padStart(2, "0")}:00</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[350px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: showTOU ? 24 : 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                
                {/* TOU Period Full-Height Background Bands */}
                {showTOU && touRanges.map((range, i) => (
                  <ReferenceArea
                    key={i}
                    x1={`${range.start.toString().padStart(2, "0")}:00`}
                    x2={`${range.end.toString().padStart(2, "0")}:00`}
                    fill={TOU_COLORS[range.period].fill}
                    fillOpacity={0.12}
                    stroke={TOU_COLORS[range.period].fill}
                    strokeOpacity={0.3}
                    strokeWidth={1}
                  />
                ))}
                
                <CartesianGrid
                  strokeDasharray="3 3" 
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="hour"
                  tick={({ x, y, payload }) => {
                    const hour = parseInt(payload.value);
                    const period = getTOUPeriod(hour, isWeekend);
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={12}
                          textAnchor="middle"
                          fill="hsl(var(--muted-foreground))"
                          fontSize={11}
                        >
                          {payload.value}
                        </text>
                        {showTOU && (
                          <rect
                            x={-16}
                            y={18}
                            width={32}
                            height={6}
                            rx={1}
                            fill={TOU_COLORS[period].fill}
                          />
                        )}
                      </g>
                    );
                  }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  interval={0}
                  height={showTOU ? 30 : 20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toString()}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                    const hourNum = parseInt(label?.toString() || "0");
                    const period = getTOUPeriod(hourNum, isWeekend);
                    return (
                      <div className="bg-popover border border-border rounded-lg px-4 py-3 shadow-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0"
                            style={{ 
                              borderColor: TOU_COLORS[period].stroke,
                              color: TOU_COLORS[period].stroke,
                              backgroundColor: `${TOU_COLORS[period].fill}20`
                            }}
                          >
                            {TOU_COLORS[period].label}
                          </Badge>
                        </div>
                        <p className="text-xl font-bold">{total.toFixed(1)} {unit}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {((total / peakHour.val) * 100).toFixed(0)}% of peak
                        </p>
                      </div>
                    );
                  }}
                />
                {/* Single smooth area for total */}
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#totalGradient)"
                  dot={false}
                  activeDot={{ 
                    r: 6, 
                    stroke: "hsl(var(--primary))", 
                    strokeWidth: 2,
                    fill: "hsl(var(--background))"
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* TOU Legend */}
          {showTOU && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Time of Use Periods {isWeekend ? "(Weekend - All Off-Peak)" : "(Weekday)"}</p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm border" style={{ backgroundColor: TOU_COLORS["peak"].fill, borderColor: TOU_COLORS["peak"].stroke, opacity: 0.8 }} />
                  <span className="text-xs font-medium">Peak</span>
                  <span className="text-xs text-muted-foreground">(7-10h, 18-20h)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm border" style={{ backgroundColor: TOU_COLORS["standard"].fill, borderColor: TOU_COLORS["standard"].stroke, opacity: 0.8 }} />
                  <span className="text-xs font-medium">Standard</span>
                  <span className="text-xs text-muted-foreground">(6-7h, 10-18h, 20-22h)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm border" style={{ backgroundColor: TOU_COLORS["off-peak"].fill, borderColor: TOU_COLORS["off-peak"].stroke, opacity: 0.8 }} />
                  <span className="text-xs font-medium">Off-Peak</span>
                  <span className="text-xs text-muted-foreground">(22-6h)</span>
                </div>
              </div>
            </div>
          )}

          {/* Compact tenant breakdown */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Top contributors by daily {unit}</p>
            <div className="flex flex-wrap gap-2">
              {tenants
                .map(t => {
                  const key = t.name.length > 15 ? t.name.slice(0, 15) + "…" : t.name;
                  const total = chartData.reduce((sum, h) => sum + (Number(h[key]) || 0), 0);
                  return { name: t.name, total };
                })
                .sort((a, b) => b.total - a.total)
                .slice(0, 8)
                .map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {t.name.length > 12 ? t.name.slice(0, 12) + "…" : t.name}: {Math.round(t.total).toLocaleString()} {unit}
                  </Badge>
                ))
              }
              {tenants.length > 8 && (
                <Badge variant="outline" className="text-xs font-normal">
                  +{tenants.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
