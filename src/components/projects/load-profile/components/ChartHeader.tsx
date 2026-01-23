import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, Battery, Download, FileSpreadsheet, FileText, Image, FileCode, MessageSquare } from "lucide-react";
import { DayOfWeek, DisplayUnit } from "../types";
import { AccuracyBadge } from "@/components/simulation/AccuracyBadge";
import { DateModeSelector } from "./DateModeSelector";

interface ChartHeaderProps {
  selectedDay: DayOfWeek;
  isWeekend: boolean;
  displayUnit: DisplayUnit;
  setDisplayUnit: (unit: DisplayUnit) => void;
  navigateDay: (direction: "prev" | "next") => void;
  peakHour: { val: number; hour: number };
  unit: string;
  showTOU: boolean;
  setShowTOU: (show: boolean) => void;
  showPVProfile: boolean;
  setShowPVProfile: (show: boolean) => void;
  showBattery: boolean;
  setShowBattery: (show: boolean) => void;
  showAnnotations: boolean;
  setShowAnnotations: (show: boolean) => void;
  maxPvAcKva: number | null;
  tenantsWithScada: number;
  tenantsEstimated: number;
  exportToCSV: () => void;
  exportToPDF: () => void;
  exportToPNG: () => void;
  exportToSVG: () => void;
  // Weekday multi-select props
  selectedDays?: Set<number>;
  onDaysChange?: (days: Set<number>) => void;
  // Month multi-select props for average mode filtering
  selectedMonthsFilter?: Set<number>;
  onMonthsFilterChange?: (months: Set<number>) => void;
}

export function ChartHeader({
  selectedDay,
  isWeekend,
  displayUnit,
  setDisplayUnit,
  navigateDay,
  peakHour,
  unit,
  showTOU,
  setShowTOU,
  showPVProfile,
  setShowPVProfile,
  showBattery,
  setShowBattery,
  showAnnotations,
  setShowAnnotations,
  maxPvAcKva,
  tenantsWithScada,
  tenantsEstimated,
  exportToCSV,
  exportToPDF,
  exportToPNG,
  exportToSVG,
  selectedDays,
  onDaysChange,
  selectedMonthsFilter,
  onMonthsFilterChange,
}: ChartHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Top row: Date selectors and unit toggle */}
      <div className="flex items-center justify-between">
        <DateModeSelector
          selectedDays={selectedDays}
          onDaysChange={onDaysChange}
          selectedMonthsFilter={selectedMonthsFilter}
          onMonthsFilterChange={onMonthsFilterChange}
        />
        
        {/* Unit Toggle */}
        <div className="flex items-center gap-2">
          <Button variant={displayUnit === "kw" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setDisplayUnit("kw")}>
            kW
          </Button>
          <Button variant={displayUnit === "kva" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setDisplayUnit("kva")}>
            kVA
          </Button>
        </div>
      </div>

      {/* Second row: Selection summary & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Day display summary */}
          {selectedDays && (
            <div className="flex items-center gap-2">
              <div className="text-center">
                <span className="font-medium text-sm">
                  {selectedDays.size === 7 ? "All Days" : 
                   selectedDays.size === 5 && !selectedDays.has(0) && !selectedDays.has(6) ? "Weekdays" :
                   selectedDays.size === 2 && selectedDays.has(0) && selectedDays.has(6) ? "Weekends" :
                   Array.from(selectedDays).map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}
                </span>
                <Badge variant={isWeekend ? "secondary" : "outline"} className="ml-2 text-[10px]">
                  {selectedDays.size}d avg
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Key Stats & Controls */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              {Math.round(peakHour.val).toLocaleString()} {unit}
            </p>
            <p className="text-xs text-muted-foreground">Peak at {peakHour.hour.toString().padStart(2, "0")}:00</p>
          </div>

          {/* Quick Toggles - All always visible */}
          <div className="flex items-center gap-3 border-l pl-4">
            <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Switch checked={showTOU} onCheckedChange={setShowTOU} className="scale-75" />
              TOU
            </Label>
            <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Switch checked={showPVProfile} onCheckedChange={setShowPVProfile} className="scale-75" />
              <Sun className="h-3 w-3 text-amber-500" />
              PV
            </Label>
            <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Switch checked={showBattery} onCheckedChange={setShowBattery} className="scale-75" />
              <Battery className="h-3 w-3 text-green-500" />
              Battery
            </Label>
            <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Switch checked={showAnnotations} onCheckedChange={setShowAnnotations} className="scale-75" />
              <MessageSquare className="h-3 w-3 text-blue-500" />
              Notes
            </Label>
          </div>

          {/* Data Source Badges */}
          <div className="flex gap-1.5">
            {tenantsWithScada > 0 && (
              <AccuracyBadge level="actual" label={`${tenantsWithScada} SCADA`} showIcon={false} />
            )}
            {tenantsEstimated > 0 && (
              <AccuracyBadge level="estimated" label={`${tenantsEstimated} Est.`} showIcon={false} />
            )}
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
    </div>
  );
}
