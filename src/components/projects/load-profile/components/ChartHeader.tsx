import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, ChevronLeft, ChevronRight, Battery, Download, FileSpreadsheet, FileText, Image, FileCode, MessageSquare } from "lucide-react";
import { DayOfWeek, DisplayUnit } from "../types";

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
}: ChartHeaderProps) {
  return (
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
          <Button variant={displayUnit === "kwh" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setDisplayUnit("kwh")}>
            kWh
          </Button>
          <Button variant={displayUnit === "kva" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setDisplayUnit("kva")}>
            kVA
          </Button>
        </div>
      </div>

      {/* Right Side - Key Stats & Controls */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">
            {Math.round(peakHour.val).toLocaleString()} {unit}
          </p>
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
          {tenantsEstimated > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {tenantsEstimated} Est.
            </Badge>
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
  );
}
