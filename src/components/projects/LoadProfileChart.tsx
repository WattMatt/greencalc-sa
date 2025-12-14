import { useMemo, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Line, ComposedChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, ChevronLeft, ChevronRight, Battery, Settings2, ChevronDown, Download, FileSpreadsheet, FileText, Image, FileCode, MessageSquare, X, Plus } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface Annotation {
  id: string;
  hour: number;
  text: string;
  color: string;
}

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
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
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

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ["Hour", `Load (${unit})`];
    if (showPVProfile) {
      headers.push("PV Generation", "Grid Import", "Grid Export", "Net Load");
    }
    if (showBattery) {
      headers.push("Battery Charge", "Battery Discharge", "Battery SoC");
    }
    headers.push("TOU Period");

    const rows = chartData.map((d, i) => {
      const row = [d.hour, d.total.toFixed(2)];
      if (showPVProfile) {
        row.push(
          (d.pvGeneration || 0).toFixed(2),
          (d.gridImport || 0).toFixed(2),
          (d.gridExport || 0).toFixed(2),
          (d.netLoad || 0).toFixed(2)
        );
      }
      if (showBattery) {
        row.push(
          (d.batteryCharge || 0).toFixed(2),
          (d.batteryDischarge || 0).toFixed(2),
          (d.batterySoC || 0).toFixed(2)
        );
      }
      row.push(TOU_COLORS[getTOUPeriod(i, isWeekend)].label);
      return row;
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `load-profile-${selectedDay.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  }, [chartData, unit, showPVProfile, showBattery, selectedDay, isWeekend]);

  // Export to PDF
  const exportToPDF = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to export PDF");
      return;
    }

    const tableRows = chartData.map((d, i) => {
      const period = getTOUPeriod(i, isWeekend);
      return `
        <tr>
          <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${d.hour}</td>
          <td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${d.total.toFixed(1)}</td>
          ${showPVProfile ? `<td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${(d.pvGeneration || 0).toFixed(1)}</td>` : ""}
          ${showPVProfile ? `<td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${(d.gridImport || 0).toFixed(1)}</td>` : ""}
          <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${TOU_COLORS[period].label}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Load Profile Report - ${selectedDay}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .meta { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 8px; border-bottom: 2px solid #333; font-weight: 600; }
          .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
          .stat { background: #f5f5f5; padding: 12px; border-radius: 6px; }
          .stat-label { font-size: 12px; color: #666; }
          .stat-value { font-size: 20px; font-weight: 600; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Load Profile Report</h1>
        <p class="meta">${selectedDay} • ${isWeekend ? "Weekend" : "Weekday"} • Generated ${new Date().toLocaleDateString()}</p>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-label">Daily ${unit}</div>
            <div class="stat-value">${Math.round(totalDaily).toLocaleString()}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Peak</div>
            <div class="stat-value">${Math.round(peakHour.val).toLocaleString()} ${unit}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Load Factor</div>
            <div class="stat-value">${loadFactor.toFixed(0)}%</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Hour</th>
              <th style="text-align: right;">Load (${unit})</th>
              ${showPVProfile ? '<th style="text-align: right;">PV Gen</th>' : ""}
              ${showPVProfile ? '<th style="text-align: right;">Grid Import</th>' : ""}
              <th>TOU Period</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          ${tenants.length} tenants • ${tenantsWithScada} SCADA meters, ${tenantsEstimated} estimated
        </p>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
    toast.success("PDF ready for printing");
  }, [chartData, unit, selectedDay, isWeekend, totalDaily, peakHour, loadFactor, showPVProfile, tenants.length, tenantsWithScada, tenantsEstimated]);

  // Export to PNG
  const exportToPNG = useCallback(async () => {
    if (!chartRef.current) {
      toast.error("Chart not available");
      return;
    }
    
    try {
      toast.loading("Generating image...", { id: "png-export" });
      
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2, // Higher resolution
        logging: false,
      });
      
      const link = document.createElement("a");
      link.download = `load-profile-${selectedDay.toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast.success("PNG exported successfully", { id: "png-export" });
    } catch (error) {
      console.error("PNG export error:", error);
      toast.error("Failed to export PNG", { id: "png-export" });
    }
  }, [selectedDay]);

  // Export to SVG
  const exportToSVG = useCallback(() => {
    if (!chartRef.current) {
      toast.error("Chart not available");
      return;
    }
    
    const svgElement = chartRef.current.querySelector("svg");
    if (!svgElement) {
      toast.error("Chart SVG not found");
      return;
    }
    
    try {
      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;
      
      // Add white background
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", "100%");
      rect.setAttribute("height", "100%");
      rect.setAttribute("fill", "white");
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);
      
      // Serialize and download
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `load-profile-${selectedDay.toLowerCase()}.svg`;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success("SVG exported successfully");
    } catch (error) {
      console.error("SVG export error:", error);
      toast.error("Failed to export SVG");
    }
  }, [selectedDay]);

  // Annotation handlers
  const addAnnotation = useCallback((hour: number) => {
    const newAnnotation: Annotation = {
      id: `${Date.now()}`,
      hour,
      text: "",
      color: "hsl(var(--primary))"
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setEditingAnnotation(newAnnotation.id);
  }, []);

  const updateAnnotation = useCallback((id: string, text: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    setEditingAnnotation(null);
  }, []);

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([]);
    toast.success("All annotations cleared");
  }, []);

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
                <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Switch checked={showAnnotations} onCheckedChange={setShowAnnotations} className="scale-75" />
                  <MessageSquare className="h-3 w-3 text-blue-500" />
                  Notes
                </Label>
              </div>

              {/* Data Source Badges */}
              <div className="flex gap-1">
                {tenantsWithScada > 0 && <Badge className="text-[10px]">{tenantsWithScada} SCADA</Badge>}
                {tenantsEstimated > 0 && <Badge variant="secondary" className="text-[10px]">{tenantsEstimated} Est.</Badge>}
              </div>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToCSV} className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPNG} className="gap-2">
                    <Image className="h-4 w-4" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToSVG} className="gap-2">
                    <FileCode className="h-4 w-4" />
                    Export as SVG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

          {/* Load Profile Chart */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Load Profile</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
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

          {/* PV Generation Chart */}
          {showPVProfile && maxPvAcKva && (
            <div className="space-y-1 mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sun className="h-3 w-3 text-amber-500" />
                  Solar Generation vs Load
                </p>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-amber-500/60" />
                    PV ({maxPvAcKva.toFixed(0)} kVA)
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-red-500/40" />
                    Grid Import
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-green-500/40" />
                    Export
                  </span>
                </div>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    
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
                        const pvValue = Number(payload.find(p => p.dataKey === "pvGeneration")?.value) || 0;
                        const loadValue = Number(payload.find(p => p.dataKey === "total")?.value) || 0;
                        const gridImport = Number(payload.find(p => p.dataKey === "gridImport")?.value) || 0;
                        const gridExport = Number(payload.find(p => p.dataKey === "gridExport")?.value) || 0;
                        return (
                          <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
                            <p className="font-medium">{label}</p>
                            <p className="text-amber-500">PV: {pvValue.toFixed(1)} {unit}</p>
                            <p className="text-muted-foreground">Load: {loadValue.toFixed(1)} {unit}</p>
                            {gridImport > 0 && <p className="text-red-400">Grid Import: {gridImport.toFixed(1)} {unit}</p>}
                            {gridExport > 0 && <p className="text-green-500">Export: {gridExport.toFixed(1)} {unit}</p>}
                          </div>
                        );
                      }}
                    />
                    
                    {/* Load as reference line */}
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1}
                      strokeDasharray="4 2"
                      dot={false}
                    />
                    
                    {/* PV Generation */}
                    <Area
                      type="monotone"
                      dataKey="pvGeneration"
                      stroke="hsl(38 92% 50%)"
                      strokeWidth={2}
                      fill="url(#pvGradient)"
                      dot={false}
                    />
                    
                    {/* DC Output Line (when oversizing) */}
                    {dcAcRatio > 1 && (
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
                    <Area
                      type="monotone"
                      dataKey="gridImport"
                      stroke="hsl(0 72% 51%)"
                      strokeWidth={1}
                      fill="hsl(0 72% 51%)"
                      fillOpacity={0.25}
                      dot={false}
                    />
                    
                    {/* Grid Export */}
                    <Area
                      type="monotone"
                      dataKey="gridExport"
                      stroke="hsl(142 76% 36%)"
                      strokeWidth={1}
                      fill="hsl(142 76% 36%)"
                      fillOpacity={0.25}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Battery Chart */}
          {showBattery && showPVProfile && maxPvAcKva && (
            <div className="space-y-1 mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Battery className="h-3 w-3 text-green-500" />
                  Battery Storage ({batteryCapacity} kWh / {batteryPower} kW)
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
                  <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
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
                        const charge = Number(payload.find(p => p.dataKey === "batteryCharge")?.value) || 0;
                        const discharge = Number(payload.find(p => p.dataKey === "batteryDischarge")?.value) || 0;
                        const soc = Number(payload.find(p => p.dataKey === "batterySoC")?.value) || 0;
                        return (
                          <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
                            <p className="font-medium">{label}</p>
                            {charge > 0 && <p className="text-green-500">Charging: {charge.toFixed(1)} kW</p>}
                            {discharge > 0 && <p className="text-orange-500">Discharging: {discharge.toFixed(1)} kW</p>}
                            <p className="text-blue-500">SoC: {Math.round((soc / batteryCapacity) * 100)}% ({soc.toFixed(0)} kWh)</p>
                          </div>
                        );
                      }}
                    />
                    
                    <Area 
                      yAxisId="power"
                      type="monotone" 
                      dataKey="batteryCharge" 
                      stroke="hsl(142 76% 36%)" 
                      strokeWidth={1.5} 
                      fill="hsl(142 76% 36%)" 
                      fillOpacity={0.4} 
                      dot={false} 
                    />
                    <Area 
                      yAxisId="power"
                      type="monotone" 
                      dataKey="batteryDischarge" 
                      stroke="hsl(25 95% 53%)" 
                      strokeWidth={1.5} 
                      fill="hsl(25 95% 53%)" 
                      fillOpacity={0.4} 
                      dot={false} 
                    />
                    <Line
                      yAxisId="soc"
                      type="monotone"
                      dataKey="batterySoC"
                      stroke="hsl(217 91% 60%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TOU Legend (only shown when TOU is enabled) */}
          {showTOU && (
            <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary/60" />
                <span>Load Profile</span>
              </div>
              <div className="flex items-center gap-3">
                {Object.entries(TOU_COLORS).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: val.fill, opacity: 0.7 }} />
                    <span className="text-muted-foreground">{val.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Annotations Panel */}
          {showAnnotations && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Chart Notes</span>
                  <Badge variant="secondary" className="text-[10px]">{annotations.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" />
                        Add Note
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 bg-popover z-50" align="end">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Select Hour</p>
                        <div className="grid grid-cols-6 gap-1">
                          {Array.from({ length: 24 }, (_, h) => (
                            <Button
                              key={h}
                              variant={annotations.some(a => a.hour === h) ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs p-0"
                              onClick={() => {
                                if (!annotations.some(a => a.hour === h)) {
                                  addAnnotation(h);
                                }
                              }}
                            >
                              {h.toString().padStart(2, "0")}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {annotations.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAllAnnotations}>
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Annotation List */}
              {annotations.length > 0 && (
                <div className="space-y-1.5">
                  {annotations.sort((a, b) => a.hour - b.hour).map((annotation) => (
                    <div key={annotation.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                      <Badge variant="outline" className="text-[10px] min-w-[40px] justify-center">
                        {annotation.hour.toString().padStart(2, "0")}:00
                      </Badge>
                      <Input
                        value={annotation.text}
                        onChange={(e) => updateAnnotation(annotation.id, e.target.value)}
                        placeholder="Add note..."
                        className="h-7 text-xs flex-1"
                        autoFocus={editingAnnotation === annotation.id}
                        onBlur={() => setEditingAnnotation(null)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAnnotation(annotation.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {annotations.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Click "Add Note" to annotate specific hours on the chart
                </p>
              )}
            </div>
          )}
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
