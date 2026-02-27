import { TOU_COLORS, TOUPeriod } from "../types";

export interface TOUBlock {
  startHour: number;
  endHour: number;
  period: TOUPeriod;
  x1: string;
  x2: string;
  fill: string;
}

/**
 * Merge consecutive hours with the same TOU period into contiguous blocks.
 * Returns block data (not JSX) so callers can render ReferenceArea inline
 * within the ComposedChart — Recharts requires direct children.
 */
export function buildTOUBlocks(
  getPeriod: (hour: number) => TOUPeriod
): TOUBlock[] {
  const blocks: TOUBlock[] = [];
  let current = { startHour: 0, endHour: 1, period: getPeriod(0) };

  for (let h = 1; h < 24; h++) {
    const period = getPeriod(h);
    if (period === current.period) {
      current.endHour = h + 1;
    } else {
      blocks.push({
        ...current,
        x1: `${current.startHour.toString().padStart(2, "0")}:00`,
        x2: `${current.endHour.toString().padStart(2, "0")}:00`,
        fill: TOU_COLORS[current.period].fill,
      });
      current = { startHour: h, endHour: h + 1, period };
    }
  }
  blocks.push({
    ...current,
    x1: `${current.startHour.toString().padStart(2, "0")}:00`,
    x2: `${current.endHour.toString().padStart(2, "0")}:00`,
    fill: TOU_COLORS[current.period].fill,
  });

  return blocks;
}
