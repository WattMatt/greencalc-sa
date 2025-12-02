import { useMemo } from "react";

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
}

const TIME_OF_USE_COLORS: Record<TimeOfUseType, string> = {
  Peak: "#ef4444",      // Red
  Standard: "#eab308",  // Yellow
  "Off-Peak": "#22c55e", // Green
};

const DAY_RINGS: { type: DayType; innerRadius: number; outerRadius: number }[] = [
  { type: "Sunday", innerRadius: 0.35, outerRadius: 0.55 },
  { type: "Saturday", innerRadius: 0.55, outerRadius: 0.75 },
  { type: "Weekday", innerRadius: 0.75, outerRadius: 0.95 },
];

// Convert hour to angle (0 = top, clockwise)
const hourToAngle = (hour: number) => {
  return ((hour / 24) * 360 - 90) * (Math.PI / 180);
};

// Create SVG arc path
const createArcPath = (
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) => {
  const innerStartX = cx + innerRadius * Math.cos(startAngle);
  const innerStartY = cy + innerRadius * Math.sin(startAngle);
  const innerEndX = cx + innerRadius * Math.cos(endAngle);
  const innerEndY = cy + innerRadius * Math.sin(endAngle);
  const outerStartX = cx + outerRadius * Math.cos(startAngle);
  const outerStartY = cy + outerRadius * Math.sin(startAngle);
  const outerEndX = cx + outerRadius * Math.cos(endAngle);
  const outerEndY = cy + outerRadius * Math.sin(endAngle);

  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return `
    M ${outerStartX} ${outerStartY}
    A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY}
    L ${innerEndX} ${innerEndY}
    A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY}
    Z
  `;
};

export function TOUClockDiagram({ title, periods, size = 280 }: TOUClockDiagramProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 20;

  // Generate default 24-hour Off-Peak background for each ring
  const backgroundArcs = useMemo(() => {
    return DAY_RINGS.map((ring) => ({
      dayType: ring.type,
      path: createArcPath(
        cx,
        cy,
        ring.innerRadius * radius,
        ring.outerRadius * radius,
        hourToAngle(0),
        hourToAngle(24)
      ),
      color: TIME_OF_USE_COLORS["Off-Peak"],
    }));
  }, [cx, cy, radius]);

  // Generate arcs for each period
  const periodArcs = useMemo(() => {
    return periods.map((period, index) => {
      const ring = DAY_RINGS.find((r) => r.type === period.day_type);
      if (!ring) return null;

      const startAngle = hourToAngle(period.start_hour);
      let endAngle = hourToAngle(period.end_hour);
      
      // Handle periods that wrap around midnight
      if (period.end_hour <= period.start_hour) {
        endAngle = hourToAngle(24);
      }

      return {
        key: `${period.day_type}-${period.start_hour}-${period.end_hour}-${index}`,
        path: createArcPath(
          cx,
          cy,
          ring.innerRadius * radius,
          ring.outerRadius * radius,
          startAngle,
          endAngle
        ),
        color: TIME_OF_USE_COLORS[period.time_of_use],
      };
    }).filter(Boolean);
  }, [periods, cx, cy, radius]);

  // Generate hour labels
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let hour = 0; hour < 24; hour++) {
      const angle = hourToAngle(hour);
      const labelRadius = radius + 12;
      const x = cx + labelRadius * Math.cos(angle);
      const y = cy + labelRadius * Math.sin(angle);
      labels.push({ hour, x, y });
    }
    return labels;
  }, [cx, cy, radius]);

  // Generate hour tick marks
  const hourTicks = useMemo(() => {
    const ticks = [];
    for (let hour = 0; hour < 24; hour++) {
      const angle = hourToAngle(hour);
      const innerR = 0.33 * radius;
      const outerR = 0.97 * radius;
      ticks.push({
        hour,
        x1: cx + innerR * Math.cos(angle),
        y1: cy + innerR * Math.sin(angle),
        x2: cx + outerR * Math.cos(angle),
        y2: cy + outerR * Math.sin(angle),
      });
    }
    return ticks;
  }, [cx, cy, radius]);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background arcs (Off-Peak by default) */}
        {backgroundArcs.map((arc, i) => (
          <path key={`bg-${i}`} d={arc.path} fill={arc.color} />
        ))}

        {/* Period arcs */}
        {periodArcs.map((arc) => arc && (
          <path key={arc.key} d={arc.path} fill={arc.color} />
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
            strokeWidth={1}
          />
        ))}

        {/* Center circle */}
        <circle cx={cx} cy={cy} r={radius * 0.33} fill="white" />

        {/* Day type labels in center */}
        <text x={cx} y={cy - 15} textAnchor="middle" className="text-[9px] font-semibold fill-foreground">
          WEEKDAYS
        </text>
        <text x={cx} y={cy} textAnchor="middle" className="text-[8px] fill-muted-foreground">
          SATURDAY
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" className="text-[8px] fill-muted-foreground">
          SUNDAY
        </text>

        {/* Hour labels */}
        {hourLabels.map((label) => (
          <text
            key={`label-${label.hour}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] font-medium fill-foreground"
          >
            {label.hour === 0 ? "24" : label.hour}
          </text>
        ))}
      </svg>

      <h3 className="mt-2 font-semibold text-foreground">{title}</h3>
    </div>
  );
}

// Pre-defined Eskom TOU periods
export const ESKOM_HIGH_DEMAND_PERIODS: TOUPeriodData[] = [
  // Weekday Peak
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 6, end_hour: 9 },
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 17, end_hour: 20 },
  // Weekday Standard
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 9, end_hour: 17 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 20, end_hour: 22 },
  // Weekday Off-Peak (default, 22-6)
  
  // Saturday Standard
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 18, end_hour: 20 },
  
  // Sunday Standard (new 2-hour period in evening)
  { day_type: "Sunday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  { day_type: "Sunday", time_of_use: "Standard", start_hour: 18, end_hour: 20 },
];

export const ESKOM_LOW_DEMAND_PERIODS: TOUPeriodData[] = [
  // Weekday Peak (reduced)
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 7, end_hour: 10 },
  { day_type: "Weekday", time_of_use: "Peak", start_hour: 18, end_hour: 20 },
  // Weekday Standard
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 6, end_hour: 7 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 10, end_hour: 18 },
  { day_type: "Weekday", time_of_use: "Standard", start_hour: 20, end_hour: 22 },
  
  // Saturday Standard
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
  { day_type: "Saturday", time_of_use: "Standard", start_hour: 18, end_hour: 20 },
  
  // Sunday Standard
  { day_type: "Sunday", time_of_use: "Standard", start_hour: 7, end_hour: 12 },
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
