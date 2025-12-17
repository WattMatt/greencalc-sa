import { useMemo, useState } from "react";
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
