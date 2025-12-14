import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Line, ComposedChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sun, ChevronLeft, ChevronRight, Battery, Settings2, ChevronDown } from "lucide-react";

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
  connectionSizeKva?: number | null;
}

// Typical PV generation profile (normalized to peak = 1.0)
const PV_PROFILE_NORMALIZED = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.02,
  0.08, 0.20, 0.38, 0.58, 0.78, 0.92,
  1.00, 0.98, 0.90, 0.75, 0.55, 0.32,
  0.12, 0.02, 0.00, 0.00, 0.00, 0.00,
];

type DisplayUnit = "kwh" | "kva";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayOfWeek = typeof DAYS_OF_WEEK[number];

const DAY_MULTIPLIERS: Record<DayOfWeek, number> = {
  Monday: 0.92,
  Tuesday: 0.96,
  Wednesday: 1.00,
  Thursday: 1.04,
  Friday: 1.08,
  Saturday: 1.05,
  Sunday: 0.88,
};

const DEFAULT_PROFILE_PERCENT = Array(24).fill(4.17);

type TOUPeriod = "peak" | "standard" | "off-peak";

const getTOUPeriod = (hour: number, isWeekend: boolean): TOUPeriod => {
  if (isWeekend) return "off-peak";
  if ((hour >= 7 && hour < 10) || (hour >= 18 && hour < 20)) return "peak";
  if (hour >= 22 || hour < 6) return "off-peak";
  return "standard";
};

const TOU_COLORS: Record<TOUPeriod, { fill: string; stroke: string; label: string }> = {
  "peak": { fill: "hsl(0 72% 51%)", stroke: "hsl(0 72% 40%)", label: "Peak" },
  "standard": { fill: "hsl(38 92% 50%)", stroke: "hsl(38 92% 40%)", label: "Standard" },
  "off-peak": { fill: "hsl(160 84% 39%)", stroke: "hsl(160 84% 30%)", label: "Off-Peak" }
};

export function LoadProfileChart({ tenants, shopTypes, connectionSizeKva }: LoadProfileChartProps) {
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kwh");
  const [powerFactor, setPowerFactor] = useState(0.9);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Wednesday");
  const [showTOU, setShowTOU] = useState(true);
  const [showPVProfile, setShowPVProfile] = useState(false);
  const [showBattery, setShowBattery] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState(500);
  const [batteryPower, setBatteryPower] = useState(250);
  const [dcAcRatio, setDcAcRatio] = useState(1.3);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const maxPvAcKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  const dcCapacityKwp = maxPvAcKva ? maxPvAcKva * dcAcRatio : null;
  const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
  const isWeekend = selectedDay === "Saturday" || selectedDay === "Sunday";

  const navigateDay = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? (dayIndex - 1 + 7) % 7 : (dayIndex + 1) % 7;
    setSelectedDay(DAYS_OF_WEEK[newIndex]);
  };

  // Count tenants with actual SCADA data
  const { tenantsWithScada, tenantsEstimated } = useMemo(() => {
    let scadaCount = 0;
    let estimatedCount = 0;
    tenants.forEach((t) => {
      if (t.scada_imports?.load_profile_weekday?.length === 24) scadaCount++;
      else estimatedCount++;
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
      const hourData: { hour: string; total: number; [key: string]: number | string } = { hour: hourLabel, total: 0 };

      tenants.forEach((tenant) => {
        const tenantArea = Number(tenant.area_sqm) || 0;
        const scadaWeekday = tenant.scada_imports?.load_profile_weekday;
        const scadaWeekend = tenant.scada_imports?.load_profile_weekend;
        const scadaProfile = isWeekendDay ? (scadaWeekend || scadaWeekday) : scadaWeekday;
        
        if (scadaProfile?.length === 24) {
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
          const scaledHourlyKwh = (scadaProfile[h] || 0) * areaScaleFactor * dayMultiplier;
          const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
          hourData[key] = (hourData[key] as number || 0) + scaledHourlyKwh;
          hourData.total += scaledHourlyKwh;
          return;
        }

        const shopType = tenant.shop_type_id ? shopTypes.find((st) => st.id === tenant.shop_type_id) : null;
        const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
        const dailyKwh = monthlyKwh / 30;
        const shopTypeProfile = isWeekendDay ? (shopType?.load_profile_weekend || shopType?.load_profile_weekday) : shopType?.load_profile_weekday;
        const profile = shopTypeProfile?.length === 24 ? shopTypeProfile.map(Number) : DEFAULT_PROFILE_PERCENT;
        const hourlyKwh = dailyKwh * (profile[h] / 100) * dayMultiplier;
        const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
        hourData[key] = (hourData[key] as number || 0) + hourlyKwh;
        hourData.total += hourlyKwh;
      });

      hourlyData.push(hourData);
    }

    return hourlyData;
  }, [tenants, shopTypes, selectedDay]);

  // Convert to display unit and add PV/battery
  const chartData = useMemo(() => {
    const baseData = baseChartData.map((hourData, index) => {
      const result: any = { hour: hourData.hour, total: 0 };

      Object.keys(hourData).forEach(key => {
        if (key === "hour") return;
        const kwhValue = hourData[key] as number;
        const value = displayUnit === "kwh" ? kwhValue : kwhValue / powerFactor;
        result[key] = value;
        if (key === "total") result.total = value;
      });

      if (showPVProfile && maxPvAcKva && dcCapacityKwp) {
        const dcOutput = PV_PROFILE_NORMALIZED[index] * dcCapacityKwp;
        const pvValue = Math.min(dcOutput, maxPvAcKva);
        result.pvGeneration = pvValue;
        result.pvDcOutput = dcOutput;
        result.pvClipping = dcOutput > maxPvAcKva ? dcOutput - maxPvAcKva : 0;
        const netLoad = result.total - pvValue;
        result.netLoad = netLoad;
        result.gridImport = netLoad > 0 ? netLoad : 0;
        result.gridExport = netLoad < 0 ? Math.abs(netLoad) : 0;
      }

      return result;
    });

    // Battery simulation
    if (showBattery && showPVProfile && maxPvAcKva) {
      let soc = batteryCapacity * 0.2;
      const minSoC = batteryCapacity * 0.1;
      const maxSoC = batteryCapacity * 0.95;

      baseData.forEach((hourData, index) => {
        const period = getTOUPeriod(index, isWeekend);
        const excessPV = hourData.gridExport || 0;
        const gridNeed = hourData.gridImport || 0;
        let charge = 0, discharge = 0;

        if (excessPV > 0) {
          const availableCapacity = maxSoC - soc;
          charge = Math.min(batteryPower, excessPV, availableCapacity);
          soc += charge;
        } else if (gridNeed > 0 && (period === "peak" || period === "standard")) {
          const availableEnergy = soc - minSoC;
          discharge = Math.min(batteryPower, gridNeed, availableEnergy);
          soc -= discharge;
        }

        hourData.batteryCharge = charge;
        hourData.batteryDischarge = discharge;
        hourData.batterySoC = soc;
        hourData.gridImportWithBattery = Math.max(0, gridNeed - discharge);
      });
    }

    return baseData;
  }, [baseChartData, displayUnit, powerFactor, showPVProfile, maxPvAcKva, dcCapacityKwp, showBattery, batteryCapacity, batteryPower, isWeekend]);

  // Stats
  const totalDaily = chartData.reduce((sum, d) => sum + d.total, 0);
  const peakHour = chartData.reduce((max, d, i) => (d.total > max.val ? { val: d.total, hour: i } : max), { val: 0, hour: 0 });
  const avgHourly = totalDaily / 24;
  const loadFactor = peakHour.val > 0 ? (avgHourly / peakHour.val) * 100 : 0;
  const unit = displayUnit === "kwh" ? "kWh" : "kVA";

  // PV Stats
  const pvStats = useMemo(() => {
    if (!showPVProfile || !maxPvAcKva) return null;
    const totalGeneration = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
    const totalExport = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);
    const selfConsumption = totalGeneration - totalExport;
    return {
      totalGeneration,
      selfConsumption,
      selfConsumptionRate: totalGeneration > 0 ? (selfConsumption / totalGeneration) * 100 : 0,
      solarCoverage: totalDaily > 0 ? (selfConsumption / totalDaily) * 100 : 0,
    };
  }, [chartData, showPVProfile, maxPvAcKva, totalDaily]);

  if (tenants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">Add tenants to see the combined load profile</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Chart Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Day Navigation */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay("prev")}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="w-28 text-center">
                  <span className="font-medium">{selectedDay}</span>
                  <Badge variant={isWeekend ? "secondary" : "outline"} className="ml-2 text-[10px]">
                    {isWeekend ? "WE" : "WD"}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay("next")}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Unit Toggle */}
              <div className="flex items-center gap-2 border-l pl-4">
                <Button
                  variant={displayUnit === "kwh" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDisplayUnit("kwh")}
                >
                  kWh
                </Button>
                <Button
                  variant={displayUnit === "kva" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDisplayUnit("kva")}
                >
                  kVA
                </Button>
              </div>
            </div>

            {/* Right Side - Key Stats & Controls */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{Math.round(peakHour.val).toLocaleString()} {unit}</p>
                <p className="text-xs text-muted-foreground">Peak at {peakHour.hour.toString().padStart(2, "0")}:00</p>
              </div>
              
              {/* Quick Toggles */}
              <div className="flex items-center gap-3 border-l pl-4">
                <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Switch checked={showTOU} onCheckedChange={setShowTOU} className="scale-75" />
                  TOU
                </Label>
                {maxPvAcKva && (
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showPVProfile} onCheckedChange={setShowPVProfile} className="scale-75" />
                    <Sun className="h-3 w-3 text-amber-500" />
                    PV
                  </Label>
                )}
                {showPVProfile && maxPvAcKva && (
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch checked={showBattery} onCheckedChange={setShowBattery} className="scale-75" />
                    <Battery className="h-3 w-3 text-green-500" />
                    Battery
                  </Label>
                )}
              </div>

              {/* Data Source Badges */}
              <div className="flex gap-1">
                {tenantsWithScada > 0 && <Badge className="text-[10px]">{tenantsWithScada} SCADA</Badge>}
                {tenantsEstimated > 0 && <Badge variant="secondary" className="text-[10px]">{tenantsEstimated} Est.</Badge>}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Advanced Settings Collapsible */}
          <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mb-2 h-7 text-xs text-muted-foreground gap-1">
                <Settings2 className="h-3 w-3" />
                Settings
                <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="flex flex-wrap gap-6">
                {displayUnit === "kva" && (
                  <div className="w-40 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Power Factor</span>
                      <span className="font-medium">{powerFactor.toFixed(2)}</span>
                    </div>
                    <Slider value={[powerFactor]} onValueChange={([v]) => setPowerFactor(v)} min={0.7} max={1.0} step={0.01} />
                  </div>
                )}
                {showPVProfile && maxPvAcKva && (
                  <div className="w-40 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">DC/AC Ratio</span>
                      <span className="font-medium">{(dcAcRatio * 100).toFixed(0)}%</span>
                    </div>
                    <Slider value={[dcAcRatio]} onValueChange={([v]) => setDcAcRatio(v)} min={1.0} max={1.5} step={0.05} />
                    <p className="text-[10px] text-muted-foreground">DC: {dcCapacityKwp?.toFixed(0)} kWp → AC: {maxPvAcKva.toFixed(0)} kVA</p>
                  </div>
                )}
                {showBattery && (
                  <>
                    <div className="w-40 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capacity</span>
                        <span className="font-medium">{batteryCapacity} kWh</span>
                      </div>
                      <Slider value={[batteryCapacity]} onValueChange={([v]) => setBatteryCapacity(v)} min={100} max={2000} step={50} />
                    </div>
                    <div className="w-40 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Power</span>
                        <span className="font-medium">{batteryPower} kW</span>
                      </div>
                      <Slider value={[batteryPower]} onValueChange={([v]) => setBatteryPower(v)} min={50} max={1000} step={25} />
                    </div>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Chart */}
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                
                {/* TOU Background */}
                {showTOU && Array.from({ length: 24 }, (_, h) => {
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
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toString()}
                  width={45}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const loadValue = Number(payload.find(p => p.dataKey === "total")?.value) || 0;
                    const pvValue = Number(payload.find(p => p.dataKey === "pvGeneration")?.value) || 0;
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
                        <p className="text-lg font-bold">{loadValue.toFixed(1)} {unit}</p>
                        {showPVProfile && pvValue > 0 && (
                          <div className="mt-1 pt-1 border-t text-xs space-y-0.5">
                            <p className="text-amber-500">PV: {pvValue.toFixed(1)} {unit}</p>
                            <p className={loadValue - pvValue > 0 ? "text-red-400" : "text-green-500"}>
                              Net: {(loadValue - pvValue).toFixed(1)} {unit}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                
                {/* Load Area */}
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#totalGradient)"
                  dot={false}
                  activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--background))" }}
                />
                
                {/* PV Generation */}
                {showPVProfile && maxPvAcKva && (
                  <Area
                    type="monotone"
                    dataKey="pvGeneration"
                    stroke="hsl(38 92% 50%)"
                    strokeWidth={2}
                    fill="url(#pvGradient)"
                    dot={false}
                  />
                )}
                
                {/* DC Output Line (when oversizing) */}
                {showPVProfile && maxPvAcKva && dcAcRatio > 1 && (
                  <Line
                    type="monotone"
                    dataKey="pvDcOutput"
                    stroke="hsl(25 95% 53%)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                )}
                
                {/* Grid Import */}
                {showPVProfile && (
                  <Area
                    type="monotone"
                    dataKey="gridImport"
                    stroke="hsl(0 72% 51%)"
                    strokeWidth={1}
                    fill="hsl(0 72% 51%)"
                    fillOpacity={0.2}
                    dot={false}
                  />
                )}
                
                {/* Battery */}
                {showBattery && (
                  <>
                    <Area type="monotone" dataKey="batteryCharge" stroke="hsl(142 76% 36%)" strokeWidth={1.5} fill="hsl(142 76% 36%)" fillOpacity={0.3} dot={false} />
                    <Area type="monotone" dataKey="batteryDischarge" stroke="hsl(25 95% 53%)" strokeWidth={1.5} fill="hsl(25 95% 53%)" fillOpacity={0.3} dot={false} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Compact Legend */}
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary/60" />
              <span>Load</span>
            </div>
            {showPVProfile && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(38 92% 50%)", opacity: 0.6 }} />
                  <span>PV ({maxPvAcKva?.toFixed(0)} kVA)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0 72% 51%)", opacity: 0.4 }} />
                  <span>Grid Import</span>
                </div>
              </>
            )}
            {showBattery && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142 76% 36%)", opacity: 0.6 }} />
                  <span>Charge</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(25 95% 53%)", opacity: 0.6 }} />
                  <span>Discharge</span>
                </div>
              </>
            )}
            {showTOU && (
              <div className="flex items-center gap-3 ml-auto">
                {Object.entries(TOU_COLORS).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: val.fill, opacity: 0.7 }} />
                    <span className="text-muted-foreground">{val.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compact Stats Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Daily {unit}</p>
          <p className="text-xl font-semibold">{Math.round(totalDaily).toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Avg Hourly</p>
          <p className="text-xl font-semibold">{avgHourly.toFixed(1)} {unit}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Load Factor</p>
          <p className="text-xl font-semibold">{loadFactor.toFixed(0)}%</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Monthly Est.</p>
          <p className="text-xl font-semibold">{Math.round(totalDaily * 30).toLocaleString()}</p>
        </Card>
        {pvStats && (
          <>
            <Card className="p-3 border-amber-500/30">
              <p className="text-xs text-muted-foreground">PV Generated</p>
              <p className="text-xl font-semibold text-amber-500">{Math.round(pvStats.totalGeneration).toLocaleString()} {unit}</p>
            </Card>
            <Card className="p-3 border-green-500/30">
              <p className="text-xs text-muted-foreground">Solar Coverage</p>
              <p className="text-xl font-semibold text-green-600">{pvStats.solarCoverage.toFixed(0)}%</p>
            </Card>
          </>
        )}
      </div>

      {/* Top Contributors */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs text-muted-foreground">Top Contributors</p>
          <Badge variant="outline" className="text-[10px]">{tenants.length} tenants</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tenants
            .map(t => {
              const key = t.name.length > 15 ? t.name.slice(0, 15) + "…" : t.name;
              const total = chartData.reduce((sum, h) => sum + (Number(h[key]) || 0), 0);
              return { name: t.name, total };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 6)
            .map((t, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal">
                {t.name.length > 12 ? t.name.slice(0, 12) + "…" : t.name}: {Math.round(t.total).toLocaleString()}
              </Badge>
            ))
          }
          {tenants.length > 6 && (
            <Badge variant="outline" className="text-xs font-normal">+{tenants.length - 6} more</Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
