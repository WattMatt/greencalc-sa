import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Clock } from "lucide-react";
import { useTOUSettings } from "@/hooks/useTOUSettings";
import { useState } from "react";
import {
  TOUPeriod,
  TOUHourMap,
  TOUSeasonConfig,
  TOUSettings,
  TOU_COLORS,
  SEASON_COLORS,
  MONTH_NAMES,
} from "@/components/projects/load-profile/types";


const PERIOD_CYCLE: TOUPeriod[] = ["off-peak", "standard", "peak"];
const DAY_TYPES = ["weekday", "saturday", "sunday"] as const;
const DAY_TYPE_LABELS: Record<string, string> = {
  weekday: "Weekday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function cyclePeriod(current: TOUPeriod): TOUPeriod {
  const idx = PERIOD_CYCLE.indexOf(current);
  return PERIOD_CYCLE[(idx + 1) % PERIOD_CYCLE.length];
}

interface HourGridProps {
  seasonConfig: TOUSeasonConfig;
  onCellClick: (dayType: keyof TOUSeasonConfig, hour: number) => void;
}

function HourGrid({ seasonConfig, onCellClick }: HourGridProps) {
  return (
    <div className="relative space-y-3">
      {/* Vertical dashed tick lines at every 3-hour interval */}
      {Array.from({ length: 8 }, (_, i) => {
        const hour = i * 3;
        // Account for 0.5 gap between cells: each cell is ~(100/24)% wide
        const leftPct = (hour / 24) * 100;
        return (
          <div
            key={hour}
            className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/20 pointer-events-none z-10"
            style={{ left: `${leftPct}%` }}
          />
        );
      })}
      {DAY_TYPES.map((dayType) => (
        <div key={dayType} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{DAY_TYPE_LABELS[dayType]}</p>
          <div className="flex gap-0.5">
            {Array.from({ length: 24 }, (_, h) => {
              const period = seasonConfig[dayType][h] || "off-peak";
              const colors = TOU_COLORS[period];
              return (
                <button
                  key={h}
                  onClick={() => onCellClick(dayType, h)}
                  className="flex-1 h-8 rounded-sm text-[9px] font-mono leading-none flex items-center justify-center transition-colors hover:opacity-80 border border-transparent hover:border-foreground/20"
                  style={{ backgroundColor: colors.fill, color: "#fff" }}
                  title={`${h}:00 - ${h + 1}:00 — ${TOU_COLORS[period].label}`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {/* Hour axis labels */}
      <div className="flex gap-0.5">
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="flex-1 text-[7px] text-center text-muted-foreground pt-1"
          >
            {h % 3 === 0 ? `${h}:00` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TOUSettingsCard() {
  const { touSettings, updateTOUSettings } = useTOUSettings();
  const [locked, setLocked] = useState(true);

  const handleCellClick = (
    seasonKey: "highSeason" | "lowSeason",
    dayType: keyof TOUSeasonConfig,
    hour: number
  ) => {
    if (locked) return;
    const currentPeriod = touSettings[seasonKey][dayType][hour] || "off-peak";
    const newPeriod = cyclePeriod(currentPeriod);
    const newHourMap: TOUHourMap = { ...touSettings[seasonKey][dayType], [hour]: newPeriod };
    const newSeasonConfig: TOUSeasonConfig = { ...touSettings[seasonKey], [dayType]: newHourMap };
    const newSettings: TOUSettings = { ...touSettings, [seasonKey]: newSeasonConfig };
    updateTOUSettings(newSettings);
  };

  const toggleMonth = (monthIndex: number) => {
    if (locked) return;
    const current = touSettings.highSeasonMonths;
    const newMonths = current.includes(monthIndex)
      ? current.filter((m) => m !== monthIndex)
      : [...current, monthIndex].sort((a, b) => a - b);
    updateTOUSettings({ ...touSettings, highSeasonMonths: newMonths });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Clock className="h-5 w-5" />
              Time-of-Use Period Definitions
            </CardTitle>
            <CardDescription>
              Define Peak, Standard, and Off-Peak windows for each season. Click a cell to cycle through periods.
            </CardDescription>
          </div>
          <Button variant={locked ? "outline" : "default"} size="sm" onClick={() => setLocked(!locked)}>
            {locked ? <Lock className="h-4 w-4 mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
            {locked ? "Locked" : "Unlocked"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {(["high", "low"] as const).map((season) => (
            <div key={season} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: SEASON_COLORS[season].fill }}
              />
              <span className="text-foreground">{SEASON_COLORS[season].label}</span>
            </div>
          ))}
          {PERIOD_CYCLE.map((period) => (
            <div key={period} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: TOU_COLORS[period].fill }}
              />
              <span className="text-foreground">{TOU_COLORS[period].label}</span>
            </div>
          ))}
        </div>

        {/* Demand Season Month Selector */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Demand Season Months</p>
          <div className="flex flex-wrap gap-1.5">
            {MONTH_NAMES.map((name, idx) => {
              const isHigh = touSettings.highSeasonMonths.includes(idx);
              const color = isHigh ? SEASON_COLORS.high.fill : SEASON_COLORS.low.fill;
              return (
                <Badge
                  key={idx}
                  variant="outline"
                  className="cursor-pointer select-none border-transparent text-white hover:opacity-80"
                  style={{ backgroundColor: color }}
                  onClick={() => toggleMonth(idx)}
                >
                  {name}
                </Badge>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* High-Demand Season */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">High-Demand Season</p>
          <HourGrid
            seasonConfig={touSettings.highSeason}
            onCellClick={(dayType, hour) => handleCellClick("highSeason", dayType, hour)}
          />
        </div>

        <Separator />

        {/* Low-Demand Season */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Low-Demand Season</p>
          <HourGrid
            seasonConfig={touSettings.lowSeason}
            onCellClick={(dayType, hour) => handleCellClick("lowSeason", dayType, hour)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
