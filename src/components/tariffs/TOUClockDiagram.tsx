import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TimeOfUseType = "Peak" | "Standard" | "Off-Peak";
type DayType = "Weekday" | "Saturday" | "Sunday";

interface TOUPeriodData {
  day_type: DayType;
  time_of_use: TimeOfUseType;
  start_hour: number;
  end_hour: number;
}

interface TOUClockDiagramProps {
  title: string;
  periods: TOUPeriodData[];
  size?: number;
  showAnnotations?: boolean;
}

const TIME_OF_USE_COLORS: Record<TimeOfUseType, string> = {
  Peak: "#ef4444",      // Red
  Standard: "#eab308",  // Yellow
  "Off-Peak": "#22c55e", // Green
};

const TIME_OF_USE_DESCRIPTIONS: Record<TimeOfUseType, string> = {
  Peak: "Highest tariff rates - avoid heavy usage",
  Standard: "Moderate tariff rates",
  "Off-Peak": "Lowest tariff rates - ideal for high consumption",
};

// Ring definitions - outer to inner order for clarity
const DAY_RINGS: { type: DayType; innerRadius: number; outerRadius: number; label: string }[] = [
  { type: "Weekday", innerRadius: 0.72, outerRadius: 0.95, label: "WD" },
  { type: "Saturday", innerRadius: 0.52, outerRadius: 0.70, label: "Sat" },
  { type: "Sunday", innerRadius: 0.32, outerRadius: 0.50, label: "Sun" },
];

// Convert hour to angle (0/24 = top, clockwise)
const hourToAngle = (hour: number): number => {
  // Normalize to 0-24 range
  const normalizedHour = ((hour % 24) + 24) % 24;
  // Convert to radians: 0 at top, clockwise
  return ((normalizedHour / 24) * 2 * Math.PI) - (Math.PI / 2);
};

// Format hour for display
const formatHour = (hour: number): string => {
  const h = hour % 24;
  return `${h.toString().padStart(2, '0')}:00`;
};

// Create SVG arc path for a segment
const createArcPath = (
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startHour: number,
  endHour: number
): string => {
  const startAngle = hourToAngle(startHour);
  const endAngle = hourToAngle(endHour);
  
  // Calculate points
  const innerStartX = cx + innerR * Math.cos(startAngle);
  const innerStartY = cy + innerR * Math.sin(startAngle);
  const innerEndX = cx + innerR * Math.cos(endAngle);
  const innerEndY = cy + innerR * Math.sin(endAngle);
  const outerStartX = cx + outerR * Math.cos(startAngle);
  const outerStartY = cy + outerR * Math.sin(startAngle);
  const outerEndX = cx + outerR * Math.cos(endAngle);
  const outerEndY = cy + outerR * Math.sin(endAngle);

  // Determine if arc is larger than 180 degrees
  const angleDiff = endHour - startHour;
  const largeArc = angleDiff > 12 ? 1 : 0;

  return `
    M ${outerStartX} ${outerStartY}
    A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEndX} ${outerEndY}
    L ${innerEndX} ${innerEndY}
    A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStartX} ${innerStartY}
    Z
  `;
};

// Build complete period coverage for a day type
const buildDayPeriods = (dayType: DayType, periods: TOUPeriodData[]): { start: number; end: number; type: TimeOfUseType }[] => {
  const dayPeriods = periods.filter(p => p.day_type === dayType);
  const result: { start: number; end: number; type: TimeOfUseType }[] = [];
  
  // Create a 24-hour array to track coverage
  const hourTypes: TimeOfUseType[] = Array(24).fill("Off-Peak");
  
  // Mark hours based on periods
  for (const period of dayPeriods) {
    for (let h = period.start_hour; h < period.end_hour; h++) {
      hourTypes[h] = period.time_of_use;
    }
  }
  
  // Convert to contiguous segments
  let currentType = hourTypes[0];
  let startHour = 0;
  
  for (let h = 1; h <= 24; h++) {
    const type = h === 24 ? hourTypes[0] : hourTypes[h];
    if (h === 24 || type !== currentType) {
      result.push({ start: startHour, end: h, type: currentType });
      if (h < 24) {
        currentType = type;
        startHour = h;
      }
    }
  }
  
  return result;
};

interface ArcData {
  key: string;
  path: string;
  color: string;
  dayType: DayType;
  touType: TimeOfUseType;
  startHour: number;
  endHour: number;
  duration: number;
}

export function TOUClockDiagram({ title, periods, size = 280, showAnnotations = true }: TOUClockDiagramProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 20;
  const [hoveredArc, setHoveredArc] = useState<string | null>(null);

  // Generate arcs for all periods across all day types
  const allArcs = useMemo(() => {
    const arcs: ArcData[] = [];
    
    for (const ring of DAY_RINGS) {
      const dayPeriods = buildDayPeriods(ring.type, periods);
      
      for (const period of dayPeriods) {
        arcs.push({
          key: `${ring.type}-${period.start}-${period.end}-${period.type}`,
          path: createArcPath(
            cx,
            cy,
            ring.innerRadius * radius,
            ring.outerRadius * radius,
            period.start,
            period.end
          ),
          color: TIME_OF_USE_COLORS[period.type],
          dayType: ring.type,
          touType: period.type,
          startHour: period.start,
          endHour: period.end,
          duration: period.end - period.start,
        });
      }
    }
    
    return arcs;
  }, [periods, cx, cy, radius]);

  // Generate hour labels (every 2 hours for clarity)
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let hour = 0; hour < 24; hour += 2) {
      const angle = hourToAngle(hour);
      const labelRadius = radius + 12;
      const x = cx + labelRadius * Math.cos(angle);
      const y = cy + labelRadius * Math.sin(angle);
      labels.push({ hour: hour === 0 ? 24 : hour, x, y });
    }
    return labels;
  }, [cx, cy, radius]);

  // Generate hour tick marks
  const hourTicks = useMemo(() => {
    const ticks = [];
    for (let hour = 0; hour < 24; hour++) {
      const angle = hourToAngle(hour);
      const innerR = 0.30 * radius;
      const outerR = 0.97 * radius;
      const isMajor = hour % 6 === 0;
      ticks.push({
        hour,
        x1: cx + innerR * Math.cos(angle),
        y1: cy + innerR * Math.sin(angle),
        x2: cx + outerR * Math.cos(angle),
        y2: cy + outerR * Math.sin(angle),
        isMajor,
      });
    }
    return ticks;
  }, [cx, cy, radius]);

  // Ring separators for clarity
  const ringBorders = useMemo(() => {
    return DAY_RINGS.map((ring, i) => ({
      key: `ring-${i}`,
      r: ring.innerRadius * radius,
    }));
  }, [radius]);

  // Key annotations for the diagram
  const annotations = useMemo(() => {
    if (!showAnnotations) return [];
    
    return [
      {
        key: "morning-peak",
        text: "Morning Peak",
        hour: 8,
        radius: radius * 1.15,
        visible: periods.some(p => p.time_of_use === "Peak" && p.start_hour >= 6 && p.start_hour < 10),
      },
      {
        key: "evening-peak",
        text: "Evening Peak",
        hour: 18.5,
        radius: radius * 1.15,
        visible: periods.some(p => p.time_of_use === "Peak" && p.start_hour >= 17),
      },
      {
        key: "sunday-evening",
        text: "NEW: Sun Evening Std",
        hour: 19,
        radius: radius * 0.15,
        visible: periods.some(p => p.day_type === "Sunday" && p.time_of_use === "Standard" && p.start_hour === 18),
        isNew: true,
      },
    ].filter(a => a.visible);
  }, [periods, radius, showAnnotations]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Period arcs with tooltips */}
          {allArcs.map((arc) => (
            <Tooltip key={arc.key}>
              <TooltipTrigger asChild>
                <path
                  d={arc.path}
                  fill={arc.color}
                  className="cursor-pointer transition-opacity duration-150"
                  opacity={hoveredArc && hoveredArc !== arc.key ? 0.5 : 1}
                  onMouseEnter={() => setHoveredArc(arc.key)}
                  onMouseLeave={() => setHoveredArc(null)}
                  stroke={hoveredArc === arc.key ? "white" : "transparent"}
                  strokeWidth={hoveredArc === arc.key ? 2 : 0}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <div className="space-y-1">
                  <div className="font-semibold flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: arc.color }}
                    />
                    {arc.touType}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>{arc.dayType}</strong>
                  </div>
                  <div className="text-xs">
                    {formatHour(arc.startHour)} - {formatHour(arc.endHour)}
                    <span className="text-muted-foreground ml-1">
                      ({arc.duration}h)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground italic">
                    {TIME_OF_USE_DESCRIPTIONS[arc.touType]}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Ring separators */}
          {ringBorders.map((border) => (
            <circle
              key={border.key}
              cx={cx}
              cy={cy}
              r={border.r}
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              opacity={0.8}
              className="pointer-events-none"
            />
          ))}

          {/* Hour tick marks */}
          {hourTicks.map((tick) => (
            <line
              key={`tick-${tick.hour}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="white"
              strokeWidth={tick.isMajor ? 2 : 0.5}
              opacity={tick.isMajor ? 1 : 0.5}
              className="pointer-events-none"
            />
          ))}

          {/* Center circle with day labels */}
          <circle cx={cx} cy={cy} r={radius * 0.28} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />

          {/* Day type labels in center */}
          <text x={cx} y={cy - 12} textAnchor="middle" className="text-[8px] font-bold fill-foreground pointer-events-none">
            WD
          </text>
          <text x={cx} y={cy + 2} textAnchor="middle" className="text-[7px] fill-muted-foreground pointer-events-none">
            SAT
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" className="text-[7px] fill-muted-foreground pointer-events-none">
            SUN
          </text>

          {/* Hour labels */}
          {hourLabels.map((label) => (
            <text
              key={`label-${label.hour}`}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[9px] font-medium fill-foreground pointer-events-none"
            >
              {label.hour}
            </text>
          ))}
        </svg>

        <h3 className="mt-2 font-semibold text-foreground text-sm">{title}</h3>
        
        {/* Ring legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>Outer: <span className="font-medium text-foreground">Weekday</span></span>
          <span>Middle: <span className="font-medium text-foreground">Saturday</span></span>
          <span>Inner: <span className="font-medium text-foreground">Sunday</span></span>
        </div>

        {/* Annotations */}
        {showAnnotations && annotations.length > 0 && (
          <div className="mt-3 space-y-1">
            {annotations.map((annotation) => (
              <div 
                key={annotation.key} 
                className={`text-xs flex items-center gap-1 ${annotation.isNew ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}
              >
                {annotation.isNew && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[10px]">2025</span>}
                <span>{annotation.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Pre-defined Eskom TOU periods - Updated for 2025/2026
// Per NERSA approval: Morning peak 3h→2h, Evening peak 2h→3h, New Sunday evening standard
// Source: Eskom Tariffs & Charges Booklet 2025/2026, Appendix A, Page 47
export const ESKOM_HIGH_DEMAND_PERIODS: TOUPeriodData[] = [
  // Weekday Peak (2h morning, 3h evening)
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 7, end_hour: 9 },
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 17, end_hour: 20 },
  // Weekday Standard
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 6, end_hour: 7 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 9, end_hour: 17 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 20, end_hour: 22 },
  // Weekday Off-Peak: 22:00-06:00 (default background)
  
  // Saturday Standard (morning only - NO evening standard)
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  // Saturday Off-Peak: 00:00-07:00, 12:00-24:00 (default background)
  
  // Sunday Standard (NEW 2025: includes evening period 18-20)
  { day_type: "Sunday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  { day_type: "Sunday", time_of_use: "Standard", start_hour: 18, end_hour: 20 },
  // Sunday Off-Peak: 00:00-07:00, 12:00-18:00, 20:00-24:00 (default background)
];

export const ESKOM_LOW_DEMAND_PERIODS: TOUPeriodData[] = [
  // Weekday Peak (2h morning, 3h evening - same as high demand in 2025)
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 7, end_hour: 9 },
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 17, end_hour: 20 },
  // Weekday Standard
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 6, end_hour: 7 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 9, end_hour: 17 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 20, end_hour: 22 },
  // Weekday Off-Peak: 22:00-06:00 (default background)
  
  // Saturday Standard (morning only - NO evening standard)
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  // Saturday Off-Peak: 00:00-07:00, 12:00-24:00 (default background)
  
  // Sunday Standard (NEW 2025: includes evening period 18-20)
  { day_type: "Sunday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  { day_type: "Sunday", time_of_use: "Standard", start_hour: 18, end_hour: 20 },
  // Sunday Off-Peak: 00:00-07:00, 12:00-18:00, 20:00-24:00 (default background)
];

// Pre-2025 Eskom TOU periods (for comparison)
// Old structure: 3h morning peak, 2h evening peak, no Sunday evening standard
export const ESKOM_PRE_2025_HIGH_DEMAND_PERIODS: TOUPeriodData[] = [
  // Weekday Peak (3h morning, 2h evening) - OLD
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 6, end_hour: 9 },
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 17, end_hour: 19 },
  // Weekday Standard
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 9, end_hour: 17 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 19, end_hour: 22 },
  // Weekday Off-Peak: 22:00-06:00 (default background)
  
  // Saturday Standard (morning only)
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  // Saturday Off-Peak: 00:00-07:00, 12:00-24:00 (default background)
  
  // Sunday - ALL Off-Peak (no standard period) - OLD
  // Sunday Off-Peak: 00:00-24:00 (default background)
];

export const ESKOM_PRE_2025_LOW_DEMAND_PERIODS: TOUPeriodData[] = [
  // Weekday Peak (3h morning, 2h evening) - OLD
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 6, end_hour: 9 },
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 17, end_hour: 19 },
  // Weekday Standard
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 9, end_hour: 17 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 19, end_hour: 22 },
  // Weekday Off-Peak: 22:00-06:00 (default background)
  
  // Saturday Standard (morning only)
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  // Saturday Off-Peak: 00:00-07:00, 12:00-24:00 (default background)
  
  // Sunday - ALL Off-Peak (no standard period) - OLD
  // Sunday Off-Peak: 00:00-24:00 (default background)
];

export function TOUClockLegend() {
  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-red-500" />
        <span className="text-sm text-foreground">Peak</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-yellow-500" />
        <span className="text-sm text-foreground">Standard</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-green-500" />
        <span className="text-sm text-foreground">Off-Peak</span>
      </div>
    </div>
  );
}

// Comparison component showing pre-2025 vs 2025/2026 with animated toggle
export function TOUComparisonView() {
  const [showNew, setShowNew] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewMode, setViewMode] = useState<'toggle' | 'sideBySide'>('toggle');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleToggle = useCallback(() => {
    setIsAnimating(true);
    setProgress(0);
    setTimeout(() => {
      setShowNew(prev => !prev);
      setTimeout(() => setIsAnimating(false), 300);
    }, 150);
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (!isAutoPlaying || viewMode !== 'toggle') {
      setProgress(0);
      return;
    }

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 0;
        return prev + (100 / 30); // 30 steps over 3 seconds
      });
    }, 100);

    // Toggle interval
    const toggleInterval = setInterval(() => {
      handleToggle();
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(toggleInterval);
    };
  }, [isAutoPlaying, viewMode, handleToggle]);

  // Reset progress when manually toggling
  useEffect(() => {
    if (isAutoPlaying) {
      setProgress(0);
    }
  }, [showNew, isAutoPlaying]);

  const changes = [
    { label: "Morning Peak", old: "06:00-09:00 (3h)", new: "07:00-09:00 (2h)", impact: "reduced", description: "1 hour shorter" },
    { label: "Evening Peak", old: "17:00-19:00 (2h)", new: "17:00-20:00 (3h)", impact: "increased", description: "1 hour longer" },
    { label: "Sunday Evening", old: "Off-Peak all day", new: "Standard 18:00-20:00", impact: "new", description: "New standard period" },
    { label: "Peak:Off-Peak Ratio", old: "8:1", new: "6:1", impact: "reduced", description: "Lower price differential" },
  ];

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => {
            setViewMode('toggle');
            setIsAutoPlaying(false);
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
            viewMode === 'toggle' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Animated Toggle
        </button>
        <button
          onClick={() => {
            setViewMode('sideBySide');
            setIsAutoPlaying(false);
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
            viewMode === 'sideBySide' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Side by Side
        </button>
      </div>

      {/* Key Changes Summary */}
      <div className="grid gap-3">
        {changes.map((change, index) => (
          <div 
            key={change.label}
            className={`p-3 rounded-lg border flex items-center justify-between transition-all duration-300 animate-fade-in ${
              change.impact === 'new' 
                ? 'border-amber-500/30 bg-amber-500/10' 
                : change.impact === 'increased'
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-green-500/30 bg-green-500/10'
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div>
              <div className="font-medium text-sm">{change.label}</div>
              <div className="text-xs text-muted-foreground">{change.description}</div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className={`transition-all duration-300 ${
                viewMode === 'toggle' && showNew ? 'text-muted-foreground line-through opacity-50' : 'text-foreground font-medium'
              }`}>{change.old}</span>
              <span className="text-muted-foreground">→</span>
              <span className={`transition-all duration-300 ${
                viewMode === 'toggle' && !showNew ? 'opacity-50' : `font-medium ${
                  change.impact === 'new' 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : change.impact === 'increased'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`
              }`}>{change.new}</span>
            </div>
          </div>
        ))}
      </div>

      {viewMode === 'toggle' ? (
        <>
          {/* Animated Toggle View */}
          <div className="flex flex-col items-center gap-4">
            {/* Controls Row */}
            <div className="flex items-center gap-4">
              {/* Auto-play Button */}
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${
                  isAutoPlaying 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {isAutoPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                <span className="text-sm font-medium">
                  {isAutoPlaying ? 'Pause' : 'Auto-play'}
                </span>
              </button>

              {/* Toggle Button */}
              <button
                onClick={() => {
                  handleToggle();
                  if (isAutoPlaying) setIsAutoPlaying(false);
                }}
                className="group relative flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-muted to-muted/50 hover:from-primary/20 hover:to-primary/10 border border-border hover:border-primary/30 transition-all duration-300 hover:scale-105"
              >
                <span className={`text-sm font-medium transition-all duration-300 ${!showNew ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Pre-2025
                </span>
                <div className="relative w-14 h-7 bg-muted rounded-full border border-border overflow-hidden">
                  {/* Progress bar for auto-play */}
                  {isAutoPlaying && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-primary/50 transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  <div 
                    className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 ease-out ${
                      showNew 
                        ? 'left-[calc(100%-1.625rem)] bg-primary shadow-lg shadow-primary/30' 
                        : 'left-0.5 bg-muted-foreground'
                    }`}
                  />
                </div>
                <span className={`text-sm font-medium transition-all duration-300 ${showNew ? 'text-foreground' : 'text-muted-foreground'}`}>
                  2025/2026
                </span>
              </button>
            </div>

            {/* Auto-play indicator */}
            {isAutoPlaying && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span>Auto-cycling every 3 seconds</span>
              </div>
            )}

            {/* Animated Clock Container */}
            <div className="relative">
              <div 
                className={`transition-all duration-300 ease-out ${
                  isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}
              >
                <div className={`p-6 rounded-xl border-2 transition-all duration-500 ${
                  showNew 
                    ? 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/10' 
                    : 'border-muted bg-muted/30'
                }`}>
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                      showNew 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {showNew ? '2025/2026' : 'Pre-2025'}
                    </span>
                    <span className={`text-sm font-semibold transition-colors duration-300 ${
                      showNew ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {showNew ? 'Current Structure' : 'Previous Structure'}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <TOUClockDiagram 
                      title={showNew ? "High-Demand (2025/2026)" : "High-Demand (Pre-2025)"} 
                      periods={showNew ? ESKOM_HIGH_DEMAND_PERIODS : ESKOM_PRE_2025_HIGH_DEMAND_PERIODS} 
                      size={280}
                      showAnnotations={showNew}
                    />
                  </div>
                  <div className="mt-4 text-xs text-center space-y-1">
                    {showNew ? (
                      <>
                        <p className="text-muted-foreground">• 2-hour morning peak (07:00-09:00)</p>
                        <p className="text-muted-foreground">• 3-hour evening peak (17:00-20:00)</p>
                        <p className="text-amber-600 dark:text-amber-400 font-medium animate-pulse">• NEW: Sunday 18:00-20:00 Standard</p>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground">• 3-hour morning peak (06:00-09:00)</p>
                        <p className="text-muted-foreground">• 2-hour evening peak (17:00-19:00)</p>
                        <p className="text-muted-foreground">• Sunday entirely Off-Peak</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!isAutoPlaying && (
              <p className="text-xs text-muted-foreground text-center">
                Click the toggle or enable auto-play to compare the TOU period changes
              </p>
            )}
          </div>
        </>
      ) : (
        /* Side-by-side clock comparison */
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pre-2025 */}
          <div className="p-4 rounded-lg border border-muted bg-muted/30 transition-all duration-300 hover:border-muted-foreground/30 animate-fade-in">
            <div className="flex items-center gap-2 mb-4 justify-center">
              <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">Pre-2025</span>
              <span className="text-sm font-semibold text-muted-foreground">Previous Structure</span>
            </div>
            <div className="flex justify-center">
              <TOUClockDiagram 
                title="High-Demand (Pre-2025)" 
                periods={ESKOM_PRE_2025_HIGH_DEMAND_PERIODS} 
                size={240}
                showAnnotations={false}
              />
            </div>
            <div className="mt-4 text-xs text-center text-muted-foreground space-y-1">
              <p>• 3-hour morning peak (06:00-09:00)</p>
              <p>• 2-hour evening peak (17:00-19:00)</p>
              <p>• Sunday entirely Off-Peak</p>
            </div>
          </div>

          {/* 2025/2026 */}
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-2 mb-4 justify-center">
              <span className="px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground">2025/2026</span>
              <span className="text-sm font-semibold">Current Structure</span>
            </div>
            <div className="flex justify-center">
              <TOUClockDiagram 
                title="High-Demand (2025/2026)" 
                periods={ESKOM_HIGH_DEMAND_PERIODS} 
                size={240}
                showAnnotations={false}
              />
            </div>
            <div className="mt-4 text-xs text-center text-muted-foreground space-y-1">
              <p>• 2-hour morning peak (07:00-09:00)</p>
              <p>• 3-hour evening peak (17:00-20:00)</p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">• NEW: Sunday 18:00-20:00 Standard</p>
            </div>
          </div>
        </div>
      )}

      <TOUClockLegend />
    </div>
  );
}
