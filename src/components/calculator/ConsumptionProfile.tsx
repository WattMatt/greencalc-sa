import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

// Typical residential consumption profile (percentage per hour, sums to 100%)
export const RESIDENTIAL_PROFILE = [
  2, 1.5, 1.5, 1.5, 2, 4, 6, 7, 5, 4, 3.5, 3.5, // 00:00 - 11:00
  4, 4, 3.5, 3.5, 4, 6, 8, 8, 7, 5, 4, 3 // 12:00 - 23:00
];

// Commercial profile (higher during work hours)
export const COMMERCIAL_PROFILE = [
  1, 1, 1, 1, 1, 2, 4, 7, 8, 8, 8, 8, // 00:00 - 11:00
  7, 7, 7, 7, 7, 6, 5, 3, 2, 2, 1.5, 1.5 // 12:00 - 23:00
];

// Solar-optimized profile (higher during daylight)
export const SOLAR_OPTIMIZED_PROFILE = [
  1, 1, 1, 1, 2, 3, 5, 7, 9, 10, 10, 10, // 00:00 - 11:00
  9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1 // 12:00 - 23:00
];

export type ProfileType = "residential" | "commercial" | "solar-optimized" | "custom";

interface ConsumptionProfileProps {
  profileType: ProfileType;
  onProfileTypeChange: (type: ProfileType) => void;
  customProfile: number[];
  onCustomProfileChange: (profile: number[]) => void;
  weekdayPercentage: number;
  onWeekdayPercentageChange: (value: number) => void;
}

export function ConsumptionProfile({
  profileType,
  onProfileTypeChange,
  customProfile,
  onCustomProfileChange,
  weekdayPercentage,
  onWeekdayPercentageChange,
}: ConsumptionProfileProps) {
  const getActiveProfile = () => {
    switch (profileType) {
      case "residential": return RESIDENTIAL_PROFILE;
      case "commercial": return COMMERCIAL_PROFILE;
      case "solar-optimized": return SOLAR_OPTIMIZED_PROFILE;
      default: return customProfile;
    }
  };

  const profile = getActiveProfile();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Consumption Profile
        </CardTitle>
        <CardDescription className="text-xs">
          How your electricity usage is distributed across the day
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Profile Type</Label>
          <Select value={profileType} onValueChange={(v) => onProfileTypeChange(v as ProfileType)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="residential">Residential (typical home)</SelectItem>
              <SelectItem value="commercial">Commercial (business hours)</SelectItem>
              <SelectItem value="solar-optimized">Solar Optimized (daytime heavy)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Weekday vs Weekend Split</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[weekdayPercentage]}
              onValueChange={([v]) => onWeekdayPercentageChange(v)}
              min={50}
              max={90}
              step={5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-20">
              {weekdayPercentage}% weekday
            </span>
          </div>
        </div>

        {/* Mini hourly chart visualization */}
        <div className="space-y-1">
          <Label className="text-xs">Hourly Distribution</Label>
          <div className="flex items-end gap-[1px] h-12 bg-muted/20 rounded p-1">
            {profile.map((value, hour) => (
              <div
                key={hour}
                className="flex-1 bg-primary/60 rounded-sm transition-all"
                style={{ height: `${(value / Math.max(...profile)) * 100}%` }}
                title={`${hour}:00 - ${value.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function getProfileData(profileType: ProfileType, customProfile: number[]) {
  switch (profileType) {
    case "residential": return RESIDENTIAL_PROFILE;
    case "commercial": return COMMERCIAL_PROFILE;
    case "solar-optimized": return SOLAR_OPTIMIZED_PROFILE;
    default: return customProfile;
  }
}
