import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Sparkles } from "lucide-react";

interface LoadProfileEditorProps {
  weekdayProfile: number[];
  weekendProfile: number[];
  onWeekdayChange: (profile: number[]) => void;
  onWeekendChange: (profile: number[]) => void;
}

const DEFAULT_PROFILE = Array(24).fill(100 / 24);

// Preset templates with realistic 24-hour consumption patterns (values are percentages that sum to 100)
const PROFILE_PRESETS = {
  flat: {
    name: "Flat (Equal)",
    weekday: Array(24).fill(100 / 24),
    weekend: Array(24).fill(100 / 24),
  },
  restaurant: {
    name: "Restaurant",
    // Low overnight, ramp up for lunch (11-14), dinner peak (18-21)
    weekday: [1, 0.5, 0.5, 0.5, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 8, 5, 4, 5, 7, 10, 10, 8, 6, 4, 2],
    weekend: [1, 0.5, 0.5, 0.5, 0.5, 1, 1.5, 2, 3, 5, 7, 10, 12, 10, 6, 5, 5, 7, 10, 10, 8, 6, 4, 2],
  },
  retail: {
    name: "Retail Store",
    // Opens ~9am, steady through day, closes ~21:00
    weekday: [1, 1, 1, 1, 1, 1, 2, 3, 5, 7, 8, 8, 8, 8, 7, 6, 6, 7, 7, 6, 5, 3, 2, 1],
    weekend: [1, 1, 1, 1, 1, 1, 1, 2, 4, 7, 9, 10, 10, 9, 8, 7, 6, 6, 5, 4, 3, 2, 2, 1],
  },
  office: {
    name: "Office",
    // 8am-18:00 with lunch dip, minimal evenings/nights
    weekday: [1, 1, 1, 1, 1, 2, 3, 6, 9, 10, 10, 9, 7, 9, 10, 9, 7, 4, 2, 1, 1, 1, 1, 1],
    weekend: [2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2],
  },
  supermarket: {
    name: "Supermarket",
    // Refrigeration baseline + shopping hours
    weekday: [3, 3, 3, 3, 3, 3, 4, 5, 6, 7, 7, 7, 7, 6, 6, 5, 5, 6, 6, 5, 4, 4, 3, 3],
    weekend: [3, 3, 3, 3, 3, 3, 3, 4, 6, 8, 9, 9, 8, 7, 6, 5, 5, 5, 4, 4, 3, 3, 3, 3],
  },
  gym: {
    name: "Gym / Fitness",
    // Early morning + evening peaks
    weekday: [2, 1, 1, 1, 1, 3, 7, 9, 6, 4, 3, 4, 5, 4, 3, 4, 6, 9, 10, 8, 5, 3, 2, 2],
    weekend: [2, 1, 1, 1, 1, 2, 3, 5, 8, 10, 10, 9, 7, 6, 5, 5, 5, 5, 4, 3, 3, 2, 2, 2],
  },
  cafe: {
    name: "Café / Coffee Shop",
    // Morning rush, lunch, afternoon tapering
    weekday: [1, 0.5, 0.5, 0.5, 1, 3, 7, 10, 10, 8, 7, 8, 9, 7, 6, 5, 4, 4, 3, 2, 1, 1, 1, 1],
    weekend: [1, 0.5, 0.5, 0.5, 0.5, 1, 3, 6, 9, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1],
  },
  cinema: {
    name: "Cinema / Entertainment",
    // Afternoon and evening heavy
    weekday: [1, 1, 1, 1, 1, 1, 2, 3, 3, 4, 5, 6, 8, 10, 10, 8, 8, 10, 12, 10, 7, 4, 2, 1],
    weekend: [1, 1, 1, 1, 1, 1, 1, 2, 3, 5, 7, 9, 10, 11, 11, 10, 10, 11, 12, 10, 7, 4, 2, 1],
  },
  hotel: {
    name: "Hotel / Accommodation",
    // Morning peak (breakfast, checkout), evening peak (check-in, dinner)
    weekday: [3, 2, 2, 2, 2, 3, 5, 8, 9, 7, 5, 4, 4, 4, 4, 5, 6, 8, 8, 7, 5, 4, 3, 3],
    weekend: [3, 2, 2, 2, 2, 3, 4, 7, 9, 8, 6, 5, 5, 5, 5, 5, 6, 8, 8, 7, 5, 4, 3, 3],
  },
  warehouse: {
    name: "Warehouse / Industrial",
    // Daytime operations only
    weekday: [2, 2, 2, 2, 2, 3, 6, 9, 10, 10, 10, 9, 8, 9, 10, 9, 7, 4, 2, 2, 2, 2, 2, 2],
    weekend: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  },
};

// Normalize a profile to sum to 100%
const normalizeToPercent = (profile: number[]): number[] => {
  const sum = profile.reduce((a, b) => a + b, 0);
  if (sum === 0) return DEFAULT_PROFILE;
  return profile.map((v) => (v / sum) * 100);
};

export function LoadProfileEditor({
  weekdayProfile,
  weekendProfile,
  onWeekdayChange,
  onWeekendChange,
}: LoadProfileEditorProps) {
  const [activeTab, setActiveTab] = useState<"weekday" | "weekend">("weekday");
  
  const currentProfile = activeTab === "weekday" ? weekdayProfile : weekendProfile;
  const setCurrentProfile = activeTab === "weekday" ? onWeekdayChange : onWeekendChange;

  const normalizeProfile = (profile: number[]): number[] => {
    const sum = profile.reduce((a, b) => a + b, 0);
    if (sum === 0) return DEFAULT_PROFILE;
    return profile.map((v) => (v / sum) * 100);
  };

  const handleReset = () => {
    setCurrentProfile([...DEFAULT_PROFILE]);
  };

  const handleCopyToOther = () => {
    if (activeTab === "weekday") {
      onWeekendChange([...currentProfile]);
    } else {
      onWeekdayChange([...currentProfile]);
    }
  };

  const handleApplyPreset = (presetKey: string) => {
    const preset = PROFILE_PRESETS[presetKey as keyof typeof PROFILE_PRESETS];
    if (preset) {
      onWeekdayChange(normalizeToPercent(preset.weekday));
      onWeekendChange(normalizeToPercent(preset.weekend));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium">24-Hour Load Profile</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select onValueChange={handleApplyPreset}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Apply preset..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROFILE_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopyToOther}>
              Copy to {activeTab === "weekday" ? "Weekend" : "Weekday"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "weekday" | "weekend")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="weekday">Weekday</TabsTrigger>
            <TabsTrigger value="weekend">Weekend</TabsTrigger>
          </TabsList>
          <TabsContent value="weekday" className="mt-4">
            <InteractiveChart
              profile={normalizeProfile(weekdayProfile)}
              onChange={onWeekdayChange}
            />
          </TabsContent>
          <TabsContent value="weekend" className="mt-4">
            <InteractiveChart
              profile={normalizeProfile(weekendProfile)}
              onChange={onWeekendChange}
            />
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total: {Math.round(currentProfile.reduce((a, b) => a + b, 0))}%</span>
          <span>Peak Hour: {currentProfile.indexOf(Math.max(...currentProfile))}:00 ({Math.round(Math.max(...currentProfile))}%)</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface InteractiveChartProps {
  profile: number[];
  onChange: (profile: number[]) => void;
}

function InteractiveChart({ profile, onChange }: InteractiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const maxValue = Math.max(...profile, 10);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const calculateValueFromY = useCallback((clientY: number, rect: DOMRect): number => {
    const chartHeight = rect.height - 24; // Account for labels
    const relativeY = clientY - rect.top;
    const percentage = Math.max(0, Math.min(100, ((chartHeight - relativeY) / chartHeight) * 100));
    return Math.round(percentage * 10) / 10;
  }, []);

  const getBarIndexFromX = useCallback((clientX: number, rect: DOMRect): number => {
    const barWidth = rect.width / 24;
    const relativeX = clientX - rect.left;
    return Math.max(0, Math.min(23, Math.floor(relativeX / barWidth)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const index = getBarIndexFromX(e.clientX, rect);
    const value = calculateValueFromY(e.clientY, rect);
    
    const newProfile = [...profile];
    newProfile[index] = value;
    onChange(newProfile);
    
    setIsDragging(true);
    setDragIndex(index);
  }, [profile, onChange, getBarIndexFromX, calculateValueFromY]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const index = getBarIndexFromX(e.clientX, rect);
    const value = calculateValueFromY(e.clientY, rect);
    
    const newProfile = [...profile];
    
    // Fill in gaps if dragging quickly
    if (dragIndex !== null && index !== dragIndex) {
      const start = Math.min(dragIndex, index);
      const end = Math.max(dragIndex, index);
      for (let i = start; i <= end; i++) {
        newProfile[i] = value;
      }
    } else {
      newProfile[index] = value;
    }
    
    onChange(newProfile);
    setDragIndex(index);
  }, [isDragging, dragIndex, profile, onChange, getBarIndexFromX, calculateValueFromY]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragIndex(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const index = getBarIndexFromX(touch.clientX, rect);
    const value = calculateValueFromY(touch.clientY, rect);
    
    const newProfile = [...profile];
    newProfile[index] = value;
    onChange(newProfile);
    
    setIsDragging(true);
    setDragIndex(index);
  }, [profile, onChange, getBarIndexFromX, calculateValueFromY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const index = getBarIndexFromX(touch.clientX, rect);
    const value = calculateValueFromY(touch.clientY, rect);
    
    const newProfile = [...profile];
    newProfile[index] = value;
    onChange(newProfile);
    setDragIndex(index);
  }, [isDragging, profile, onChange, getBarIndexFromX, calculateValueFromY]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setDragIndex(null);
  }, []);

  const getBarColor = (hour: number): string => {
    // Peak hours: 7-10, 18-20
    if ((hour >= 7 && hour <= 10) || (hour >= 18 && hour <= 20)) {
      return "bg-destructive";
    }
    // Standard hours: 6-7, 10-18, 20-22
    if ((hour >= 6 && hour < 7) || (hour > 10 && hour < 18) || (hour > 20 && hour <= 22)) {
      return "bg-primary";
    }
    // Off-peak: 22-6
    return "bg-muted-foreground/50";
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs">
        <Badge variant="outline" className="bg-destructive/10 border-destructive/30">
          <span className="w-2 h-2 rounded-full bg-destructive mr-1"></span>
          Peak
        </Badge>
        <Badge variant="outline" className="bg-primary/10 border-primary/30">
          <span className="w-2 h-2 rounded-full bg-primary mr-1"></span>
          Standard
        </Badge>
        <Badge variant="outline" className="bg-muted">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 mr-1"></span>
          Off-Peak
        </Badge>
      </div>
      
      <div
        ref={containerRef}
        className="relative h-48 bg-muted/30 rounded-lg cursor-crosshair select-none touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2">
          {[0, 25, 50, 75, 100].reverse().map((val) => (
            <div key={val} className="flex items-center">
              <span className="text-[10px] text-muted-foreground w-6 text-right pr-1">{val}%</span>
              <div className="flex-1 border-t border-border/30" />
            </div>
          ))}
        </div>
        
        {/* Bars */}
        <div className="absolute left-7 right-1 top-2 bottom-6 flex items-end gap-[2px]">
          {hours.map((hour) => {
            const heightPct = Math.min(100, (profile[hour] / 100) * 100);
            return (
              <div
                key={hour}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                <div
                  className={`w-full rounded-t transition-all duration-75 ${getBarColor(hour)} ${
                    dragIndex === hour ? "ring-2 ring-primary ring-offset-1" : ""
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        
        {/* Hour labels */}
        <div className="absolute left-7 right-1 bottom-0 flex">
          {hours.map((hour) => (
            <div key={hour} className="flex-1 text-center">
              {hour % 3 === 0 && (
                <span className="text-[9px] text-muted-foreground">{hour}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Click and drag to adjust hourly consumption percentages
      </p>
    </div>
  );
}
