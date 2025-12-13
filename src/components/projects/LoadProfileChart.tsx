import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Line, ComposedChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sun, ChevronLeft, ChevronRight, Battery } from "lucide-react";

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
// Bell curve centered around midday (solar noon ~12:00-13:00)
const PV_PROFILE_NORMALIZED = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.02,  // 00:00 - 05:00
  0.08, 0.20, 0.38, 0.58, 0.78, 0.92,  // 06:00 - 11:00
  1.00, 0.98, 0.90, 0.75, 0.55, 0.32,  // 12:00 - 17:00
  0.12, 0.02, 0.00, 0.00, 0.00, 0.00,  // 18:00 - 23:00
];

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

export function LoadProfileChart({ tenants, shopTypes, connectionSizeKva }: LoadProfileChartProps) {
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("kwh");
  const [powerFactor, setPowerFactor] = useState(0.9);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Monday");
  const [showTOU, setShowTOU] = useState(true);
  const [showPVProfile, setShowPVProfile] = useState(false);
  const [showBattery, setShowBattery] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState(500); // kWh
  const [batteryPower, setBatteryPower] = useState(250); // kW max charge/discharge rate
  const [dcAcRatio, setDcAcRatio] = useState(1.3); // DC/AC ratio (1.0 = no oversize, 1.3 = 130% DC)
  const [showBaselineComparison, setShowBaselineComparison] = useState(false); // Show 1:1 ratio comparison

  // Max AC PV size is 70% of connection size
  const maxPvAcKva = connectionSizeKva ? connectionSizeKva * 0.7 : null;
  // DC capacity can be oversized based on DC/AC ratio
  const dcCapacityKwp = maxPvAcKva ? maxPvAcKva * dcAcRatio : null;

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

  // Convert to display unit (kWh or kVA) and add PV profile + battery simulation
  const chartData = useMemo(() => {
    // First pass: calculate base data with PV
    const baseData = baseChartData.map((hourData, index) => {
      const result: { 
        hour: string; 
        total: number; 
        pvGeneration?: number;
        pvClipping?: number;
        pvDcOutput?: number;
        pvBaseline?: number; // 1:1 ratio output for comparison
        pvOverpanelGain?: number; // Extra energy gained from over-paneling
        netLoad?: number;
        gridImport?: number;
        gridExport?: number;
        batteryCharge?: number;
        batteryDischarge?: number;
        batterySoC?: number;
        gridImportWithBattery?: number;
        gridExportWithBattery?: number;
        [key: string]: number | string | undefined;
      } = {
        hour: hourData.hour,
        total: 0,
      };

      Object.keys(hourData).forEach(key => {
        if (key === "hour") return;
        const kwhValue = hourData[key] as number;
        const value = displayUnit === "kwh" ? kwhValue : kwhValue / powerFactor;
        result[key] = value;
        if (key === "total") {
          result.total = value;
        }
      });

      // Add PV generation profile if enabled and connection size is set
      if (showPVProfile && maxPvAcKva && dcCapacityKwp) {
        // OVER-PANELING LOGIC:
        // With DC/AC ratio > 1.0, the DC array is larger than the inverter capacity
        // This produces MORE energy during morning/evening (fatter profile)
        // but clips during peak solar hours when DC output exceeds AC inverter limit
        
        // Calculate DC output based on oversized DC capacity
        const dcOutput = PV_PROFILE_NORMALIZED[index] * dcCapacityKwp;
        // Clip at AC inverter limit (maxPvAcKva) - this is what actually goes to the grid/load
        const pvValue = Math.min(dcOutput, maxPvAcKva);
        
        // Track values for visualization:
        result.pvGeneration = pvValue; // Actual AC output after clipping
        result.pvDcOutput = dcOutput;  // Theoretical DC output before clipping (the "fatter" profile)
        result.pvClipping = dcOutput > maxPvAcKva ? dcOutput - maxPvAcKva : 0; // Energy lost to clipping
        
        // Calculate 1:1 baseline for comparison (DC = AC, no oversizing)
        // This is the SMALLER profile - what you'd get without over-paneling
        const baselineDcOutput = PV_PROFILE_NORMALIZED[index] * maxPvAcKva;
        result.pvBaseline = baselineDcOutput;
        
        // Calculate the extra energy gained from over-paneling at this hour
        // (positive during shoulder hours, zero/negative during peak when clipping occurs)
        result.pvOverpanelGain = pvValue - baselineDcOutput;
        
        const netLoad = result.total - pvValue;
        result.netLoad = netLoad;
        // Split into grid import (positive) and export (negative, stored as positive for chart)
        result.gridImport = netLoad > 0 ? netLoad : 0;
        result.gridExport = netLoad < 0 ? Math.abs(netLoad) : 0;
      }

      return result;
    });

    // Second pass: simulate battery if enabled
    if (showBattery && showPVProfile && maxPvAcKva) {
      let soc = batteryCapacity * 0.2; // Start at 20% SoC
      const minSoC = batteryCapacity * 0.1; // 10% minimum
      const maxSoC = batteryCapacity * 0.95; // 95% maximum

      baseData.forEach((hourData, index) => {
        const hour = index;
        const period = getTOUPeriod(hour, isWeekend);
        const netLoad = hourData.netLoad || 0;
        const excessPV = hourData.gridExport || 0;
        const gridNeed = hourData.gridImport || 0;

        let charge = 0;
        let discharge = 0;

        // Battery strategy:
        // 1. Charge from excess PV (when gridExport > 0)
        // 2. Discharge during peak periods to reduce grid import
        // 3. Also discharge during standard if grid import needed

        if (excessPV > 0) {
          // Charge battery from excess PV
          const availableCapacity = maxSoC - soc;
          const maxCharge = Math.min(batteryPower, excessPV, availableCapacity);
          charge = maxCharge;
          soc += charge;
        } else if (gridNeed > 0 && (period === "peak" || period === "standard")) {
          // Discharge to offset grid import during peak/standard
          const availableEnergy = soc - minSoC;
          const maxDischarge = Math.min(batteryPower, gridNeed, availableEnergy);
          discharge = maxDischarge;
          soc -= discharge;
        }

        hourData.batteryCharge = charge;
        hourData.batteryDischarge = discharge;
        hourData.batterySoC = soc;
        
        // Recalculate grid import/export with battery
        hourData.gridImportWithBattery = Math.max(0, gridNeed - discharge);
        hourData.gridExportWithBattery = Math.max(0, excessPV - charge);
      });
    }

    return baseData;
  }, [baseChartData, displayUnit, powerFactor, showPVProfile, maxPvAcKva, dcCapacityKwp, showBattery, batteryCapacity, batteryPower, isWeekend]);

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

  // Calculate daily PV stats when enabled
  const pvStats = useMemo(() => {
    if (!showPVProfile || !maxPvAcKva) return null;
    
    const totalGeneration = chartData.reduce((sum, d) => sum + (d.pvGeneration || 0), 0);
    const totalClipping = chartData.reduce((sum, d) => sum + (d.pvClipping || 0), 0);
    const totalDcOutput = chartData.reduce((sum, d) => sum + (d.pvDcOutput || 0), 0);
    const totalBaseline = chartData.reduce((sum, d) => sum + (d.pvBaseline || 0), 0);
    const totalImport = chartData.reduce((sum, d) => sum + (d.gridImport || 0), 0);
    const totalExport = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);
    const selfConsumption = totalGeneration - totalExport;
    const selfConsumptionRate = totalGeneration > 0 ? (selfConsumption / totalGeneration) * 100 : 0;
    const solarCoverage = totalDaily > 0 ? (selfConsumption / totalDaily) * 100 : 0;
    const clippingLoss = totalDcOutput > 0 ? (totalClipping / totalDcOutput) * 100 : 0;
    
    // Benefit of over-paneling: extra kWh from higher DC capacity
    const overPanelBenefit = totalGeneration - totalBaseline;
    const overPanelBenefitPercent = totalBaseline > 0 ? (overPanelBenefit / totalBaseline) * 100 : 0;
    
    return {
      totalGeneration,
      totalClipping,
      totalDcOutput,
      totalBaseline,
      totalImport,
      totalExport,
      selfConsumption,
      selfConsumptionRate,
      solarCoverage,
      clippingLoss,
      overPanelBenefit,
      overPanelBenefitPercent,
    };
  }, [chartData, showPVProfile, maxPvAcKva, totalDaily]);

  // Calculate battery stats when enabled
  const batteryStats = useMemo(() => {
    if (!showBattery || !showPVProfile || !maxPvAcKva) return null;
    
    const totalCharged = chartData.reduce((sum, d) => sum + (d.batteryCharge || 0), 0);
    const totalDischarged = chartData.reduce((sum, d) => sum + (d.batteryDischarge || 0), 0);
    const gridImportWithBattery = chartData.reduce((sum, d) => sum + (d.gridImportWithBattery || 0), 0);
    const gridExportWithBattery = chartData.reduce((sum, d) => sum + (d.gridExportWithBattery || 0), 0);
    const gridImportWithoutBattery = chartData.reduce((sum, d) => sum + (d.gridImport || 0), 0);
    const gridExportWithoutBattery = chartData.reduce((sum, d) => sum + (d.gridExport || 0), 0);
    
    const importReduction = gridImportWithoutBattery - gridImportWithBattery;
    const exportReduction = gridExportWithoutBattery - gridExportWithBattery;
    const importReductionPercent = gridImportWithoutBattery > 0 ? (importReduction / gridImportWithoutBattery) * 100 : 0;
    
    // Find min/max SoC
    const socValues = chartData.map(d => d.batterySoC || 0);
    const minSoC = Math.min(...socValues);
    const maxSoC = Math.max(...socValues);
    
    return {
      totalCharged,
      totalDischarged,
      gridImportWithBattery,
      gridExportWithBattery,
      importReduction,
      exportReduction,
      importReductionPercent,
      minSoC,
      maxSoC,
      cycles: totalDischarged / batteryCapacity,
    };
  }, [chartData, showBattery, showPVProfile, maxPvAcKva, batteryCapacity]);

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
              {maxPvAcKva && (
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Switch checked={showPVProfile} onCheckedChange={setShowPVProfile} />
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  PV Profile ({maxPvAcKva.toFixed(0)} kVA AC)
                </Label>
              )}
              {showPVProfile && maxPvAcKva && (
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Switch checked={showBattery} onCheckedChange={setShowBattery} />
                  <Battery className="h-3.5 w-3.5 text-green-500" />
                  Battery Storage
                </Label>
              )}
            </div>

            {/* PV Configuration - DC/AC Ratio */}
            {showPVProfile && maxPvAcKva && (
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px] max-w-[200px] space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">DC/AC Ratio</Label>
                    <span className="text-xs font-medium">{(dcAcRatio * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[dcAcRatio]}
                    onValueChange={([v]) => setDcAcRatio(v)}
                    min={1.0}
                    max={1.5}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    DC: {dcCapacityKwp?.toFixed(0)} kWp → AC: {maxPvAcKva.toFixed(0)} kVA
                  </p>
                </div>
                {dcAcRatio > 1 && (
                  <Label className="text-xs text-muted-foreground flex items-center gap-2 pb-4">
                    <Switch checked={showBaselineComparison} onCheckedChange={setShowBaselineComparison} />
                    Show Overpanel Benefit vs 1:1
                  </Label>
                )}
              </div>
            )}

            {/* Battery Configuration */}
            {showBattery && showPVProfile && (
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px] max-w-[200px] space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Capacity</Label>
                    <span className="text-xs font-medium">{batteryCapacity} kWh</span>
                  </div>
                  <Slider
                    value={[batteryCapacity]}
                    onValueChange={([v]) => setBatteryCapacity(v)}
                    min={100}
                    max={2000}
                    step={50}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 min-w-[150px] max-w-[200px] space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Power Rating</Label>
                    <span className="text-xs font-medium">{batteryPower} kW</span>
                  </div>
                  <Slider
                    value={[batteryPower]}
                    onValueChange={([v]) => setBatteryPower(v)}
                    min={50}
                    max={1000}
                    step={25}
                    className="w-full"
                  />
                </div>
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

      {/* PV Stats Summary - shown when PV profile enabled */}
      {pvStats && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-lg">Solar PV Analysis</CardTitle>
            </div>
            <CardDescription>DC: {dcCapacityKwp?.toFixed(0)} kWp ({(dcAcRatio * 100).toFixed(0)}% DC/AC) • AC: {maxPvAcKva?.toFixed(0)} kVA max (70% of connection)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-8">
              <div>
                <p className="text-xs text-muted-foreground">DC Output</p>
                <p className="text-lg font-semibold text-amber-500">{Math.round(pvStats.totalDcOutput).toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AC Generation</p>
                <p className="text-lg font-semibold text-amber-600">{Math.round(pvStats.totalGeneration).toLocaleString()} {unit}</p>
                {pvStats.totalClipping > 0 && (
                  <p className="text-[10px] text-orange-500">-{Math.round(pvStats.totalClipping)} clipped</p>
                )}
              </div>
              {dcAcRatio > 1 && (
                <div className="bg-emerald-500/10 rounded-md p-2 -my-1">
                  <p className="text-xs text-muted-foreground">1:1 Baseline</p>
                  <p className="text-lg font-semibold text-muted-foreground">{Math.round(pvStats.totalBaseline).toLocaleString()} {unit}</p>
                  <p className="text-[10px] text-emerald-600">
                    +{Math.round(pvStats.overPanelBenefit)} ({pvStats.overPanelBenefitPercent.toFixed(1)}%) from over-panel
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Self-Consumed</p>
                <p className="text-lg font-semibold text-green-600">{Math.round(pvStats.selfConsumption).toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Grid Import</p>
                <p className="text-lg font-semibold text-red-500">{Math.round(pvStats.totalImport).toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Grid Export</p>
                <p className="text-lg font-semibold text-blue-500">{Math.round(pvStats.totalExport).toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Self-Consumption</p>
                <p className="text-lg font-semibold">{pvStats.selfConsumptionRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clipping Loss</p>
                <p className="text-lg font-semibold" style={{ color: pvStats.clippingLoss > 5 ? 'hsl(25 95% 53%)' : 'inherit' }}>
                  {pvStats.clippingLoss.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Battery Stats Summary - shown when battery enabled */}
      {batteryStats && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Battery className="h-4 w-4 text-green-500" />
              <CardTitle className="text-lg">Battery Storage Analysis</CardTitle>
            </div>
            <CardDescription>{batteryCapacity} kWh capacity / {batteryPower} kW power rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-6">
              <div>
                <p className="text-xs text-muted-foreground">Energy Charged</p>
                <p className="text-lg font-semibold text-green-600">{Math.round(batteryStats.totalCharged).toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Energy Discharged</p>
                <p className="text-lg font-semibold text-orange-500">{Math.round(batteryStats.totalDischarged).toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Grid Import (w/ Battery)</p>
                <p className="text-lg font-semibold text-red-500">{Math.round(batteryStats.gridImportWithBattery).toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Import Reduction</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {Math.round(batteryStats.importReduction).toLocaleString()} {unit}
                  <span className="text-xs ml-1">({batteryStats.importReductionPercent.toFixed(0)}%)</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SoC Range</p>
                <p className="text-lg font-semibold">
                  {((batteryStats.minSoC / batteryCapacity) * 100).toFixed(0)}% - {((batteryStats.maxSoC / batteryCapacity) * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Daily Cycles</p>
                <p className="text-lg font-semibold">{batteryStats.cycles.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: showTOU ? 24 : 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="gridImportGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="gridExportGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210 100% 50%)" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="hsl(210 100% 50%)" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="batteryChargeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="batteryDischargeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(25 95% 53%)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="hsl(25 95% 53%)" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="overpanelGainGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                
                {/* TOU Period Full-Height Background Bands - per hour for seamless look */}
                {showTOU && Array.from({ length: 24 }, (_, h) => {
                  const period = getTOUPeriod(h, isWeekend);
                  const nextHour = h === 23 ? 23 : h + 1;
                  return (
                    <ReferenceArea
                      key={h}
                      x1={`${h.toString().padStart(2, "0")}:00`}
                      x2={`${nextHour.toString().padStart(2, "0")}:00`}
                      fill={TOU_COLORS[period].fill}
                      fillOpacity={0.15}
                      stroke="none"
                    />
                  );
                })}
                
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
                    const loadEntry = payload.find(p => p.dataKey === "total");
                    const pvEntry = payload.find(p => p.dataKey === "pvGeneration");
                    const chargeEntry = payload.find(p => p.dataKey === "batteryCharge");
                    const dischargeEntry = payload.find(p => p.dataKey === "batteryDischarge");
                    const socEntry = payload.find(p => p.dataKey === "batterySoC");
                    const loadValue = Number(loadEntry?.value) || 0;
                    const pvValue = Number(pvEntry?.value) || 0;
                    const chargeValue = Number(chargeEntry?.value) || 0;
                    const dischargeValue = Number(dischargeEntry?.value) || 0;
                    const socValue = Number(socEntry?.value) || 0;
                    const hourNum = parseInt(label?.toString() || "0");
                    const period = getTOUPeriod(hourNum, isWeekend);
                    const netLoad = loadValue - pvValue;
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
                        <p className="text-xl font-bold">{loadValue.toFixed(1)} {unit}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {((loadValue / peakHour.val) * 100).toFixed(0)}% of peak
                        </p>
                        {showPVProfile && pvValue > 0 && (
                          <div className="mt-2 pt-2 border-t border-border space-y-1">
                            <div className="flex items-center gap-2">
                              <Sun className="h-3 w-3 text-amber-500" />
                              <span className="text-xs">PV AC Output: {pvValue.toFixed(1)} {unit}</span>
                            </div>
                            {(() => {
                              const dcEntry = payload.find(p => p.dataKey === "pvDcOutput");
                              const clippingEntry = payload.find(p => p.dataKey === "pvClipping");
                              const baselineEntry = payload.find(p => p.dataKey === "pvBaseline");
                              const dcValue = Number(dcEntry?.value) || 0;
                              const clippingValue = Number(clippingEntry?.value) || 0;
                              const baselineValue = Number(baselineEntry?.value) || 0;
                              const overpanelGain = pvValue - baselineValue;
                              
                              return (
                                <>
                                  {dcAcRatio > 1 && (
                                    <>
                                      <p className="text-xs text-orange-500">
                                        DC Output: {dcValue.toFixed(1)} {unit}
                                      </p>
                                      {clippingValue > 0 && (
                                        <p className="text-xs text-red-400">
                                          Clipped: {clippingValue.toFixed(1)} {unit}
                                        </p>
                                      )}
                                      {showBaselineComparison && baselineValue > 0 && (
                                        <>
                                          <p className="text-xs text-muted-foreground">
                                            1:1 Baseline: {baselineValue.toFixed(1)} {unit}
                                          </p>
                                          <p className="text-xs font-medium" style={{ color: overpanelGain > 0 ? 'hsl(142 76% 36%)' : 'hsl(0 72% 51%)' }}>
                                            {overpanelGain > 0 ? '+' : ''}{overpanelGain.toFixed(1)} {unit} from overpanel
                                          </p>
                                        </>
                                      )}
                                    </>
                                  )}
                                </>
                              );
                            })()}
                            <p className="text-xs font-medium" style={{ color: netLoad > 0 ? 'inherit' : 'hsl(160 84% 39%)' }}>
                              Net Load: {netLoad.toFixed(1)} {unit}
                            </p>
                          </div>
                        )}
                        {showBattery && (chargeValue > 0 || dischargeValue > 0) && (
                          <div className="mt-2 pt-2 border-t border-border space-y-1">
                            <div className="flex items-center gap-2">
                              <Battery className="h-3 w-3 text-green-500" />
                              <span className="text-xs">
                                {chargeValue > 0 ? `Charging: ${chargeValue.toFixed(1)} ${unit}` : `Discharging: ${dischargeValue.toFixed(1)} ${unit}`}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              SoC: {((socValue / batteryCapacity) * 100).toFixed(0)}% ({socValue.toFixed(0)} kWh)
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Single smooth area for total load */}
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
                {/* PV Generation area (AC output - clipped) */}
                {showPVProfile && maxPvAcKva && (
                  <Area
                    type="monotone"
                    dataKey="pvGeneration"
                    stroke="hsl(38 92% 50%)"
                    strokeWidth={2}
                    fill="url(#pvGradient)"
                    dot={false}
                    activeDot={{ 
                      r: 5, 
                      stroke: "hsl(38 92% 50%)", 
                      strokeWidth: 2,
                      fill: "hsl(var(--background))"
                    }}
                  />
                )}
                {/* DC Output line (theoretical before clipping) - dashed line showing clipped energy */}
                {showPVProfile && maxPvAcKva && dcAcRatio > 1 && (
                  <Line
                    type="monotone"
                    dataKey="pvDcOutput"
                    stroke="hsl(25 95% 53%)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{ 
                      r: 4, 
                      stroke: "hsl(25 95% 53%)", 
                      strokeWidth: 2,
                      fill: "hsl(var(--background))"
                    }}
                  />
                )}
                {/* 1:1 DC/AC Baseline - dotted line for comparison */}
                {showPVProfile && maxPvAcKva && showBaselineComparison && dcAcRatio > 1 && (
                  <>
                    {/* Overpanel gain area - shaded between AC output and baseline */}
                    <Area
                      type="monotone"
                      dataKey="pvOverpanelGain"
                      stroke="none"
                      fill="url(#overpanelGainGradient)"
                      baseValue="dataMin"
                      dot={false}
                    />
                    {/* Baseline line (1:1 ratio) */}
                    <Line
                      type="monotone"
                      dataKey="pvBaseline"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={false}
                      activeDot={{ 
                        r: 4, 
                        stroke: "hsl(var(--muted-foreground))", 
                        strokeWidth: 2,
                        fill: "hsl(var(--background))"
                      }}
                      name="1:1 Baseline"
                    />
                  </>
                )}
                {/* Grid Import area (load exceeds PV) */}
                {showPVProfile && maxPvAcKva && (
                  <Area
                    type="monotone"
                    dataKey="gridImport"
                    stroke="hsl(0 72% 51%)"
                    strokeWidth={1.5}
                    fill="url(#gridImportGradient)"
                    dot={false}
                  />
                )}
                {/* Grid Export area (PV exceeds load) */}
                {showPVProfile && maxPvAcKva && !showBattery && (
                  <Area
                    type="monotone"
                    dataKey="gridExport"
                    stroke="hsl(210 100% 50%)"
                    strokeWidth={1.5}
                    fill="url(#gridExportGradient)"
                    dot={false}
                  />
                )}
                {/* Battery Charge area */}
                {showBattery && showPVProfile && (
                  <Area
                    type="monotone"
                    dataKey="batteryCharge"
                    stroke="hsl(142 76% 36%)"
                    strokeWidth={2}
                    fill="url(#batteryChargeGradient)"
                    dot={false}
                  />
                )}
                {/* Battery Discharge area */}
                {showBattery && showPVProfile && (
                  <Area
                    type="monotone"
                    dataKey="batteryDischarge"
                    stroke="hsl(25 95% 53%)"
                    strokeWidth={2}
                    fill="url(#batteryDischargeGradient)"
                    dot={false}
                  />
                )}
                {/* Grid Import with Battery (replaces base grid import when battery enabled) */}
                {showBattery && showPVProfile && (
                  <Area
                    type="monotone"
                    dataKey="gridImportWithBattery"
                    stroke="hsl(0 72% 51%)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    fill="none"
                    dot={false}
                  />
                )}
              </ComposedChart>
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

          {/* PV Legend */}
          {showPVProfile && maxPvAcKva && !showBattery && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Solar PV & Grid Flow</p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))', opacity: 0.6 }} />
                  <span className="text-xs font-medium">Total Load</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded-sm" style={{ backgroundColor: 'hsl(38 92% 50%)' }} />
                  <span className="text-xs font-medium">PV AC Output</span>
                </div>
                {dcAcRatio > 1 && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-0 border-t-2 border-dashed" style={{ borderColor: 'hsl(25 95% 53%)' }} />
                    <span className="text-xs font-medium text-orange-500">DC Output ({(dcAcRatio * 100).toFixed(0)}%)</span>
                  </div>
                )}
                {showBaselineComparison && dcAcRatio > 1 && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--muted-foreground))', opacity: 0.15 }} />
                    <div className="w-5 h-0 border-t-2 border-dotted -ml-5" style={{ borderColor: 'hsl(var(--muted-foreground))' }} />
                    <span className="text-xs font-medium text-muted-foreground">1:1 Baseline (no overpanel)</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(0 72% 51%)', opacity: 0.5 }} />
                  <span className="text-xs font-medium text-red-500">Grid Import</span>
                  <span className="text-xs text-muted-foreground">(load &gt; PV)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(210 100% 50%)', opacity: 0.5 }} />
                  <span className="text-xs font-medium text-blue-500">Grid Export</span>
                  <span className="text-xs text-muted-foreground">(PV &gt; load)</span>
                </div>
              </div>
            </div>
          )}

          {/* Battery + PV Legend */}
          {showBattery && showPVProfile && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Solar PV + Battery Storage</p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))', opacity: 0.6 }} />
                  <span className="text-xs font-medium">Total Load</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded-sm" style={{ backgroundColor: 'hsl(38 92% 50%)' }} />
                  <span className="text-xs font-medium">PV AC Output</span>
                </div>
                {dcAcRatio > 1 && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-0 border-t-2 border-dashed" style={{ borderColor: 'hsl(25 95% 53%)' }} />
                    <span className="text-xs font-medium text-orange-500">DC Output ({(dcAcRatio * 100).toFixed(0)}%)</span>
                  </div>
                )}
                {showBaselineComparison && dcAcRatio > 1 && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--muted-foreground))', opacity: 0.15 }} />
                    <div className="w-5 h-0 border-t-2 border-dotted -ml-5" style={{ borderColor: 'hsl(var(--muted-foreground))' }} />
                    <span className="text-xs font-medium text-muted-foreground">1:1 Baseline (no overpanel)</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(142 76% 36%)', opacity: 0.6 }} />
                  <span className="text-xs font-medium text-green-600">Battery Charge</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(25 95% 53%)', opacity: 0.6 }} />
                  <span className="text-xs font-medium text-orange-500">Battery Discharge</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded-sm" style={{ backgroundColor: 'hsl(0 72% 51%)', opacity: 0.5 }} />
                  <span className="text-xs font-medium text-red-500">Grid Import</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded-sm" style={{ borderTop: '2px dashed hsl(0 72% 51%)' }} />
                  <span className="text-xs font-medium text-red-400">Import (w/ Battery)</span>
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
