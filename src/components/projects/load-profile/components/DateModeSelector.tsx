import { Separator } from "@/components/ui/separator";
import { WeekdaySelector } from "./WeekdaySelector";
import { MonthSelector } from "./MonthSelector";
import { SeasonPresets } from "./SeasonPresets";
import { DayPresets } from "./DayPresets";

interface DateModeSelectorProps {
  // Weekday multi-select props
  selectedDays?: Set<number>;
  onDaysChange?: (days: Set<number>) => void;
  // Month multi-select props for filtering
  selectedMonthsFilter?: Set<number>;
  onMonthsFilterChange?: (months: Set<number>) => void;
}

export function DateModeSelector({
  selectedDays,
  onDaysChange,
  selectedMonthsFilter,
  onMonthsFilterChange,
}: DateModeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Month multi-select for filtering */}
      {selectedMonthsFilter && onMonthsFilterChange && (
        <>
          <MonthSelector 
            selectedMonths={selectedMonthsFilter} 
            onMonthsChange={onMonthsFilterChange} 
          />
          <SeasonPresets 
            selectedMonths={selectedMonthsFilter} 
            onMonthsChange={onMonthsFilterChange} 
          />
          <Separator orientation="vertical" className="h-5" />
        </>
      )}

      {/* Weekday multi-select */}
      {selectedDays && onDaysChange && (
        <>
          <WeekdaySelector selectedDays={selectedDays} onDaysChange={onDaysChange} />
          <DayPresets selectedDays={selectedDays} onDaysChange={onDaysChange} />
        </>
      )}
    </div>
  );
}
