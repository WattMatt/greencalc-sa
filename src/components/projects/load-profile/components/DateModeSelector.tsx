import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, BarChart3, Calendar, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WeekdaySelector } from "./WeekdaySelector";

export type DateMode = "average" | "specific" | "month";

interface AvailableMonth {
  value: string;
  label: string;
  daysWithData: number;
  totalKwh: number;
}

interface DateModeSelectorProps {
  mode: DateMode;
  onModeChange: (mode: DateMode) => void;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  availableDates: Date[];
  startDate: Date | null;
  endDate: Date | null;
  hasRawData: boolean;
  // Monthly mode props
  selectedMonth?: string | null;
  onMonthChange?: (month: string | null) => void;
  availableMonths?: AvailableMonth[];
  // Weekday multi-select props for average mode
  selectedDays?: Set<number>;
  onDaysChange?: (days: Set<number>) => void;
}

export function DateModeSelector({
  mode,
  onModeChange,
  selectedDate,
  onDateChange,
  availableDates,
  startDate,
  endDate,
  hasRawData,
  selectedMonth,
  onMonthChange,
  availableMonths = [],
  selectedDays,
  onDaysChange,
}: DateModeSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Create a Set for quick lookup of available dates
  const availableDateStrings = new Set(
    availableDates.map((d) => d.toISOString().split("T")[0])
  );

  const isDateAvailable = (date: Date) => {
    return availableDateStrings.has(date.toISOString().split("T")[0]);
  };

  const selectedMonthData = availableMonths.find((m) => m.value === selectedMonth);

  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && onModeChange(value as DateMode)}
        className="h-7"
      >
        <ToggleGroupItem
          value="average"
          aria-label="Averaged profile"
          className="h-7 px-2 text-xs gap-1"
        >
          <BarChart3 className="h-3 w-3" />
          Averaged
        </ToggleGroupItem>
        <ToggleGroupItem
          value="month"
          aria-label="Monthly data"
          className="h-7 px-2 text-xs gap-1"
          disabled={!hasRawData}
        >
          <CalendarDays className="h-3 w-3" />
          Month
        </ToggleGroupItem>
        <ToggleGroupItem
          value="specific"
          aria-label="Specific date"
          className="h-7 px-2 text-xs gap-1"
          disabled={!hasRawData}
        >
          <Calendar className="h-3 w-3" />
          Day
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Weekday multi-select for average mode */}
      {mode === "average" && selectedDays && onDaysChange && (
        <WeekdaySelector selectedDays={selectedDays} onDaysChange={onDaysChange} />
      )}

      {/* Month selector */}
      {mode === "month" && hasRawData && availableMonths.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            value={selectedMonth || ""}
            onValueChange={(value) => onMonthChange?.(value || null)}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span>{m.label}</span>
                    <Badge variant="secondary" className="text-[9px] px-1">
                      {m.daysWithData}d
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMonthData && (
            <span className="text-[10px] text-muted-foreground">
              {selectedMonthData.daysWithData} days · {Math.round(selectedMonthData.totalKwh).toLocaleString()} kWh
            </span>
          )}
        </div>
      )}

      {/* Day selector */}
      {mode === "specific" && hasRawData && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs justify-start font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {selectedDate ? format(selectedDate, "dd MMM yyyy") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                onDateChange(date);
                setCalendarOpen(false);
              }}
              disabled={(date) => !isDateAvailable(date)}
              modifiers={{
                available: (date) => isDateAvailable(date),
              }}
              modifiersClassNames={{
                available: "bg-primary/10 font-medium",
              }}
              fromDate={startDate || undefined}
              toDate={endDate || undefined}
              initialFocus
              className="p-3 pointer-events-auto"
            />
            <div className="px-3 pb-3 text-[10px] text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                {availableDates.length} days with data
              </Badge>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {(mode === "specific" || mode === "month") && !hasRawData && (
        <span className="text-[10px] text-muted-foreground">
          No raw SCADA data available
        </span>
      )}
    </div>
  );
}
