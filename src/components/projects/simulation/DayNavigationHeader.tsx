import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";

interface DayNavigationHeaderProps {
  showAnnualAverage: boolean;
  setShowAnnualAverage: (v: boolean) => void;
  selectedDayIndex: number;
  setSelectedDayIndex: (idx: number) => void;
  navigateDayIndex: (dir: "prev" | "next") => void;
  dayDateInfo: {
    dayName: string;
    dayLabel: string;
    dayNumber: number;
  };
}

export function DayNavigationHeader({
  showAnnualAverage,
  setShowAnnualAverage,
  selectedDayIndex,
  setSelectedDayIndex,
  navigateDayIndex,
  dayDateInfo,
}: DayNavigationHeaderProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selectedDate = useMemo(
    () => new Date(2026, 0, 1 + selectedDayIndex),
    [selectedDayIndex]
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const startOfYear = new Date(2026, 0, 1);
    const diffMs = date.getTime() - startOfYear.getTime();
    const dayIdx = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (dayIdx >= 0 && dayIdx <= 364) {
      setSelectedDayIndex(dayIdx);
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {!showAnnualAverage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => navigateDayIndex("prev")}
            disabled={selectedDayIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {showAnnualAverage ? (
          <CardTitle className="text-base">Annual Average (Year 1)</CardTitle>
        ) : (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="text-left cursor-pointer hover:opacity-80 transition-opacity w-[260px]">
                <CardTitle className="text-base">
                  {dayDateInfo.dayName}, {dayDateInfo.dayLabel} (Day {dayDateInfo.dayNumber})
                </CardTitle>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                defaultMonth={selectedDate}
                fromDate={new Date(2026, 0, 1)}
                toDate={new Date(2026, 11, 31)}
                formatters={{
                  formatCaption: (date) =>
                    date.toLocaleDateString("en-GB", { month: "long" }),
                }}
                classNames={{
                  caption_label: "text-sm font-medium",
                }}
              />
            </PopoverContent>
          </Popover>
        )}

        {!showAnnualAverage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => navigateDayIndex("next")}
            disabled={selectedDayIndex === 364}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
        <Switch
          checked={showAnnualAverage}
          onCheckedChange={setShowAnnualAverage}
          className="scale-75"
        />
        Annual Avg
      </Label>
    </div>
  );
}
