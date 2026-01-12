import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, BarChart3, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";

export type DateMode = "average" | "specific";

interface DateModeSelectorProps {
  mode: DateMode;
  onModeChange: (mode: DateMode) => void;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  availableDates: Date[];
  startDate: Date | null;
  endDate: Date | null;
  hasRawData: boolean;
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
}: DateModeSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Create a Set for quick lookup of available dates
  const availableDateStrings = new Set(
    availableDates.map((d) => d.toISOString().split("T")[0])
  );

  const isDateAvailable = (date: Date) => {
    return availableDateStrings.has(date.toISOString().split("T")[0]);
  };

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
          value="specific"
          aria-label="Specific date"
          className="h-7 px-2 text-xs gap-1"
          disabled={!hasRawData}
        >
          <Calendar className="h-3 w-3" />
          Date
        </ToggleGroupItem>
      </ToggleGroup>

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

      {mode === "specific" && !hasRawData && (
        <span className="text-[10px] text-muted-foreground">
          No raw SCADA data available
        </span>
      )}
    </div>
  );
}
