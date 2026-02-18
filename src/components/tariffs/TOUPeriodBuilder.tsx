import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type SeasonType = Database["public"]["Enums"]["season_type"];
type TimeOfUseType = Database["public"]["Enums"]["tou_period"];
type DayType = string; // day_type enum was removed in schema migration

export type { SeasonType, TimeOfUseType, DayType };

export interface TOUPeriod {
  id: string;
  season: SeasonType;
  day_type: DayType;
  time_of_use: TimeOfUseType;
  start_hour: number;
  end_hour: number;
  rate_per_kwh: number;
  demand_charge_per_kva?: number;
}

interface TOUPeriodBuilderProps {
  periods: TOUPeriod[];
  onChange: (periods: TOUPeriod[]) => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);

const formatHour = (hour: number) => {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour === 24) return "12:00 AM (next day)";
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
};

const TIME_OF_USE_COLORS: Record<string, string> = {
  peak: "bg-red-100 border-red-300 text-red-800",
  Peak: "bg-red-100 border-red-300 text-red-800",
  standard: "bg-yellow-100 border-yellow-300 text-yellow-800",
  Standard: "bg-yellow-100 border-yellow-300 text-yellow-800",
  "off_peak": "bg-green-100 border-green-300 text-green-800",
  "Off-Peak": "bg-green-100 border-green-300 text-green-800",
  all: "bg-gray-100 border-gray-300 text-gray-800",
  Any: "bg-gray-100 border-gray-300 text-gray-800",
};

export function TOUPeriodBuilder({ periods, onChange }: TOUPeriodBuilderProps) {
  const addPeriod = (season: SeasonType) => {
    const newPeriod: TOUPeriod = {
      id: crypto.randomUUID(),
      season,
      day_type: "Weekday" as any,
      time_of_use: "peak" as any,
      start_hour: 6,
      end_hour: 9,
      rate_per_kwh: 0,
    };
    onChange([...periods, newPeriod]);
  };

  const updatePeriod = (id: string, field: keyof TOUPeriod, value: any) => {
    onChange(periods.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const removePeriod = (id: string) => {
    onChange(periods.filter((p) => p.id !== id));
  };

  const duplicatePeriodForSeason = (fromSeason: SeasonType, toSeason: SeasonType) => {
    const sourcePeriods = periods.filter((p) => p.season === fromSeason);
    const newPeriods = sourcePeriods.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      season: toSeason,
    }));
    onChange([...periods, ...newPeriods]);
  };

  const highSeasonPeriods = periods.filter((p) => p.season === "high");
  const lowSeasonPeriods = periods.filter((p) => p.season === "low");

  const renderPeriodRow = (period: TOUPeriod) => (
    <div
      key={period.id}
      className={`flex items-end gap-2 p-3 rounded-lg border ${TIME_OF_USE_COLORS[period.time_of_use]}`}
    >
      <div className="space-y-1 w-28">
        <Label className="text-xs">Day Type</Label>
        <Select
          value={period.day_type}
          onValueChange={(v) => updatePeriod(period.id, "day_type", v)}
        >
          <SelectTrigger className="h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Weekday">Weekday</SelectItem>
            <SelectItem value="Saturday">Saturday</SelectItem>
            <SelectItem value="Sunday">Sunday</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 w-28">
        <Label className="text-xs">Period Type</Label>
        <Select
          value={period.time_of_use}
          onValueChange={(v) => updatePeriod(period.id, "time_of_use", v)}
        >
          <SelectTrigger className="h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Peak">Peak</SelectItem>
            <SelectItem value="Standard">Standard</SelectItem>
            <SelectItem value="Off-Peak">Off-Peak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 w-32">
        <Label className="text-xs">Start Time</Label>
        <Select
          value={period.start_hour.toString()}
          onValueChange={(v) => updatePeriod(period.id, "start_hour", parseInt(v))}
        >
          <SelectTrigger className="h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.slice(0, 24).map((h) => (
              <SelectItem key={h} value={h.toString()}>
                {formatHour(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 w-32">
        <Label className="text-xs">End Time</Label>
        <Select
          value={period.end_hour.toString()}
          onValueChange={(v) => updatePeriod(period.id, "end_hour", parseInt(v))}
        >
          <SelectTrigger className="h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.slice(1).map((h) => (
              <SelectItem key={h} value={h.toString()}>
                {formatHour(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 w-28">
        <Label className="text-xs">Rate (c/kWh)</Label>
        <Input
          type="number"
          step="0.01"
          className="h-9 bg-background"
          value={period.rate_per_kwh}
          onChange={(e) => updatePeriod(period.id, "rate_per_kwh", parseFloat(e.target.value) || 0)}
        />
      </div>

      <div className="space-y-1 w-28">
        <Label className="text-xs">Demand (R/kVA)</Label>
        <Input
          type="number"
          step="0.01"
          className="h-9 bg-background"
          value={period.demand_charge_per_kva ?? ""}
          onChange={(e) =>
            updatePeriod(period.id, "demand_charge_per_kva", e.target.value ? parseFloat(e.target.value) : undefined)
          }
          placeholder="Optional"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => removePeriod(period.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );

  const renderSeasonSection = (
    season: SeasonType,
    title: string,
    description: string,
    seasonPeriods: TOUPeriod[]
  ) => (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-card-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {title}
            </CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {season === "low" && highSeasonPeriods.length > 0 && lowSeasonPeriods.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => duplicatePeriodForSeason("high", "low")}
              >
                Copy from High Season
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => addPeriod(season)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Period
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {seasonPeriods.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No TOU periods defined. Click "Add Period" to define time-based rates.
          </p>
        ) : (
          <div className="space-y-2">{seasonPeriods.map(renderPeriodRow)}</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" /> Peak
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500" /> Standard
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" /> Off-Peak
        </div>
      </div>

      {renderSeasonSection(
        "high",
        "High-Demand Season (June - August)",
        "Winter months with higher electricity demand",
        highSeasonPeriods
      )}

      {renderSeasonSection(
        "low",
        "Low-Demand Season (September - May)",
        "Summer months with lower electricity demand",
        lowSeasonPeriods
      )}
    </div>
  );
}
