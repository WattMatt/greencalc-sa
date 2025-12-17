import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TimeOfUseType = "Peak" | "Standard" | "Off-Peak";
type DayType = "Weekday" | "Saturday" | "Sunday";
type SeasonType = "High" | "Low";

interface TOUPeriod {
  start: number;
  end: number;
  type: TimeOfUseType;
}

// 2025/2026 Eskom TOU periods - Updated per NERSA approval
// Changes: Morning peak 3h→2h, Evening peak 2h→3h, New Sunday evening standard period
const TOU_PERIODS: Record<SeasonType, Record<DayType, TOUPeriod[]>> = {
  High: {
    Weekday: [
      { start: 0, end: 6, type: "Off-Peak" },
      { start: 6, end: 7, type: "Standard" },
      { start: 7, end: 9, type: "Peak" },
      { start: 9, end: 17, type: "Standard" },
      { start: 17, end: 20, type: "Peak" },
      { start: 20, end: 22, type: "Standard" },
      { start: 22, end: 24, type: "Off-Peak" },
    ],
    Saturday: [
      { start: 0, end: 7, type: "Off-Peak" },
      { start: 7, end: 12, type: "Standard" },
      { start: 12, end: 18, type: "Off-Peak" },
      { start: 18, end: 20, type: "Standard" },
      { start: 20, end: 24, type: "Off-Peak" },
    ],
    Sunday: [
      { start: 0, end: 7, type: "Off-Peak" },
      { start: 7, end: 12, type: "Standard" },
      { start: 12, end: 18, type: "Off-Peak" },
      { start: 18, end: 20, type: "Standard" }, // New 2025 period
      { start: 20, end: 24, type: "Off-Peak" },
    ],
  },
  Low: {
    Weekday: [
      { start: 0, end: 6, type: "Off-Peak" },
      { start: 6, end: 7, type: "Standard" },
      { start: 7, end: 9, type: "Peak" },
      { start: 9, end: 17, type: "Standard" },
      { start: 17, end: 20, type: "Peak" },
      { start: 20, end: 22, type: "Standard" },
      { start: 22, end: 24, type: "Off-Peak" },
    ],
    Saturday: [
      { start: 0, end: 7, type: "Off-Peak" },
      { start: 7, end: 12, type: "Standard" },
      { start: 12, end: 18, type: "Off-Peak" },
      { start: 18, end: 20, type: "Standard" },
      { start: 20, end: 24, type: "Off-Peak" },
    ],
    Sunday: [
      { start: 0, end: 7, type: "Off-Peak" },
      { start: 7, end: 12, type: "Standard" },
      { start: 12, end: 18, type: "Off-Peak" },
      { start: 18, end: 20, type: "Standard" }, // New 2025 period
      { start: 20, end: 24, type: "Off-Peak" },
    ],
  },
};

const getTOUTypeForHour = (hour: number, dayType: DayType, season: SeasonType): TimeOfUseType => {
  const periods = TOU_PERIODS[season][dayType];
  for (const period of periods) {
    if (hour >= period.start && hour < period.end) {
      return period.type;
    }
  }
  return "Off-Peak";
};

const getTOUColor = (type: TimeOfUseType): string => {
  switch (type) {
    case "Peak":
      return "bg-red-500";
    case "Standard":
      return "bg-yellow-500";
    case "Off-Peak":
      return "bg-green-500";
  }
};

const getTOUBgColor = (type: TimeOfUseType): string => {
  switch (type) {
    case "Peak":
      return "bg-red-500/20 border-red-500/50";
    case "Standard":
      return "bg-yellow-500/20 border-yellow-500/50";
    case "Off-Peak":
      return "bg-green-500/20 border-green-500/50";
  }
};

interface TOUTimeGridProps {
  season: SeasonType;
  showLegend?: boolean;
}

export function TOUTimeGrid({ season, showLegend = true }: TOUTimeGridProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayTypes: DayType[] = ["Weekday", "Saturday", "Sunday"];

  return (
    <div className="space-y-4">
      {showLegend && (
        <div className="flex items-center gap-4 justify-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-sm font-medium">Peak</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span className="text-sm font-medium">Standard</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span className="text-sm font-medium">Off-Peak</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Hour labels */}
          <div className="flex mb-1">
            <div className="w-24 shrink-0" />
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex-1 text-center text-[10px] text-muted-foreground font-medium"
              >
                {hour.toString().padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {dayTypes.map((dayType) => (
            <div key={dayType} className="flex items-center mb-1">
              <div className="w-24 shrink-0 text-sm font-medium text-foreground pr-2">
                {dayType}
              </div>
              <div className="flex flex-1 gap-[1px]">
                {hours.map((hour) => {
                  const touType = getTOUTypeForHour(hour, dayType, season);
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 h-8 rounded-sm transition-all",
                        getTOUColor(touType),
                        "hover:opacity-80"
                      )}
                      title={`${hour}:00-${hour + 1}:00 - ${touType}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Time markers */}
          <div className="flex mt-2">
            <div className="w-24 shrink-0" />
            <div className="flex-1 flex justify-between text-xs text-muted-foreground">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact summary showing time periods
export function TOUPeriodSummary({ season }: { season: SeasonType }) {
  const periods = TOU_PERIODS[season];

  const formatPeriod = (p: TOUPeriod) => 
    `${p.start.toString().padStart(2, "0")}:00-${p.end.toString().padStart(2, "0")}:00`;

  const getPeriodsByType = (dayType: DayType, touType: TimeOfUseType) =>
    periods[dayType]
      .filter((p) => p.type === touType)
      .map(formatPeriod)
      .join(", ");

  return (
    <div className="grid gap-3">
      {(["Weekday", "Saturday", "Sunday"] as DayType[]).map((dayType) => (
        <div key={dayType} className={cn("p-3 rounded-lg border", "bg-muted/50")}>
          <div className="font-semibold text-sm mb-2">{dayType}</div>
          <div className="space-y-1 text-sm">
            {getPeriodsByType(dayType, "Peak") && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">Peak</Badge>
                <span className="text-muted-foreground">{getPeriodsByType(dayType, "Peak")}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-600 text-xs">Standard</Badge>
              <span className="text-muted-foreground">{getPeriodsByType(dayType, "Standard")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600 text-xs">Off-Peak</Badge>
              <span className="text-muted-foreground">{getPeriodsByType(dayType, "Off-Peak")}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Export the periods for use elsewhere
export { TOU_PERIODS, getTOUTypeForHour, getTOUColor, getTOUBgColor };
export type { SeasonType, DayType, TimeOfUseType, TOUPeriod };
