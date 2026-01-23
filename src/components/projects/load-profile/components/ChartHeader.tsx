import { format, addDays, subDays, addMonths, subMonths, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, ChevronLeft, ChevronRight, Battery, Download, FileSpreadsheet, FileText, Image, FileCode, MessageSquare } from "lucide-react";
import { DayOfWeek, DisplayUnit } from "../types";
import { AccuracyBadge } from "@/components/simulation/AccuracyBadge";
import { DateModeSelector, DateMode } from "./DateModeSelector";

interface AvailableMonth {
  value: string;
  label: string;
  daysWithData: number;
  totalKwh: number;
}

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
  // Date mode props
  dateMode: DateMode;
  onDateModeChange: (mode: DateMode) => void;
  specificDate: Date | undefined;
  onSpecificDateChange: (date: Date | undefined) => void;
  availableDates: Date[];
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  hasRawData: boolean;
  // Monthly mode props
  selectedMonth?: string | null;
  onMonthChange?: (month: string | null) => void;
  availableMonths?: AvailableMonth[];
  monthlyStats?: { totalKwh: number; peakKw: number; daysWithData: number } | null;
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
  dateMode,
  onDateModeChange,
  specificDate,
  onSpecificDateChange,
  availableDates,
  dateRangeStart,
  dateRangeEnd,
  hasRawData,
  selectedMonth,
  onMonthChange,
  availableMonths = [],
  monthlyStats,
  selectedDays,
  onDaysChange,
  selectedMonthsFilter,
  onMonthsFilterChange,
}: ChartHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Top row: Date mode toggle */}
      <div className="flex items-center justify-between">
        <DateModeSelector
          mode={dateMode}
          onModeChange={onDateModeChange}
          selectedDate={specificDate}
          onDateChange={onSpecificDateChange}
          availableDates={availableDates}
          startDate={dateRangeStart}
          endDate={dateRangeEnd}
          hasRawData={hasRawData}
          selectedMonth={selectedMonth}
          onMonthChange={onMonthChange}
          availableMonths={availableMonths}
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

      {/* Second row: Navigation & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Day display - only show in average mode (multi-select handles navigation) */}
          {dateMode === "average" && selectedDays && (
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

          {/* Month Navigation */}
          {dateMode === "month" && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                disabled={!selectedMonth || availableMonths.length === 0}
                onClick={() => {
                  if (!selectedMonth || !onMonthChange) return;
                  const currentIndex = availableMonths.findIndex(m => m.value === selectedMonth);
                  // availableMonths is sorted most recent first, so "prev" means older (higher index)
                  if (currentIndex < availableMonths.length - 1) {
                    onMonthChange(availableMonths[currentIndex + 1].value);
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[140px] text-center">
                {selectedMonth && monthlyStats ? (
                  <>
                    <span className="font-medium text-sm">
                      {availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}
                    </span>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {monthlyStats.daysWithData}d
                    </Badge>
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">Select month</span>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                disabled={!selectedMonth || availableMonths.length === 0}
                onClick={() => {
                  if (!selectedMonth || !onMonthChange) return;
                  const currentIndex = availableMonths.findIndex(m => m.value === selectedMonth);
                  // "next" means more recent (lower index)
                  if (currentIndex > 0) {
                    onMonthChange(availableMonths[currentIndex - 1].value);
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {monthlyStats && (
                <div className="text-xs text-muted-foreground border-l pl-3 ml-2">
                  <span className="font-medium text-foreground">{Math.round(monthlyStats.totalKwh).toLocaleString()}</span> kWh
                  <span className="mx-2">·</span>
                  <span className="font-medium text-foreground">{Math.round(monthlyStats.peakKw)}</span> kW peak
                </div>
              )}
            </div>
          )}

          {/* Day Navigation */}
          {dateMode === "specific" && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                disabled={!specificDate || availableDates.length === 0}
                onClick={() => {
                  if (!specificDate) return;
                  // Find the previous available date
                  const currentDateStr = specificDate.toISOString().split("T")[0];
                  const sortedDates = [...availableDates].sort((a, b) => a.getTime() - b.getTime());
                  const currentIndex = sortedDates.findIndex(d => d.toISOString().split("T")[0] === currentDateStr);
                  if (currentIndex > 0) {
                    onSpecificDateChange(sortedDates[currentIndex - 1]);
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[200px] text-center">
                {specificDate ? (
                  <>
                    <span className="font-medium">{format(specificDate, "EEE, d MMM yyyy")}</span>
                    <Badge variant={isWeekend ? "secondary" : "outline"} className="ml-2 text-[10px]">
                      {isWeekend ? "WE" : "WD"}
                    </Badge>
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">Select date</span>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                disabled={!specificDate || availableDates.length === 0}
                onClick={() => {
                  if (!specificDate) return;
                  // Find the next available date
                  const currentDateStr = specificDate.toISOString().split("T")[0];
                  const sortedDates = [...availableDates].sort((a, b) => a.getTime() - b.getTime());
                  const currentIndex = sortedDates.findIndex(d => d.toISOString().split("T")[0] === currentDateStr);
                  if (currentIndex < sortedDates.length - 1) {
                    onSpecificDateChange(sortedDates[currentIndex + 1]);
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
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
