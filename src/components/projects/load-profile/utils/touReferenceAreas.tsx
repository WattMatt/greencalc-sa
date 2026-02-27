import { TOU_COLORS, TOUPeriod } from "../types";

export interface TOUBoundaryLine {
  hour: string;
  color: string;
  period: TOUPeriod;
  /** The raw hour number (0-23) for keying */
  hourNum: number;
}

/**
 * Detect TOU period transitions and return vertical boundary lines.
 * Each line marks where a new period begins, coloured by that incoming period.
 */
export function buildTOUBoundaryLines(
  getPeriod: (hour: number) => TOUPeriod
): TOUBoundaryLine[] {
  const lines: TOUBoundaryLine[] = [];
  let prevPeriod: TOUPeriod | null = null;

  for (let h = 0; h < 24; h++) {
    const period = getPeriod(h);
    if (period !== prevPeriod) {
      lines.push({
        hour: `${h.toString().padStart(2, "0")}:00`,
        color: TOU_COLORS[period].stroke,
        period,
        hourNum: h,
      });
      prevPeriod = period;
    }
  }

  return lines;
}

/**
 * Custom ReferenceLine shape that shifts the line right by half a bar-category gap.
 * Recharts passes the full chart layout via props; we compute the pixel offset
 * from the category bandwidth.
 */
export function ShiftedReferenceLine(props: any) {
  const { x, yAxis, stroke, strokeDasharray, strokeWidth } = props;
  if (x == null || !yAxis) return null;

  const y1 = yAxis.y ?? 0;
  const y2 = (yAxis.y ?? 0) + (yAxis.height ?? 0);

  // Shift right by half the gap between two adjacent category ticks.
  // xAxis.bandSize gives the distance between two tick centres.
  const bandSize = props.xAxis?.bandSize ?? 0;
  const offset = bandSize / 2;

  return (
    <line
      x1={x + offset}
      y1={y1}
      x2={x + offset}
      y2={y2}
      stroke={stroke}
      strokeDasharray={strokeDasharray}
      strokeWidth={strokeWidth}
    />
  );
}
