import { TOU_COLORS, TOUPeriod } from "../types";

export interface TOUBoundaryLine {
  hour: string;
  color: string;
  period: TOUPeriod;
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
      });
      prevPeriod = period;
    }
  }

  return lines;
}
