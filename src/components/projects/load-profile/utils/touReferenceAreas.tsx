import { ReferenceArea } from "recharts";
import { TOU_COLORS, TOUPeriod } from "../types";

interface TOUBlock {
  startHour: number;
  endHour: number;
  period: TOUPeriod;
}

/**
 * Merge consecutive hours with the same TOU period into contiguous blocks,
 * then return one ReferenceArea per block. This eliminates SVG anti-aliasing
 * seams that appear when 24 separate semi-transparent rectangles share edges.
 */
export function buildTOUReferenceAreas(
  getPeriod: (hour: number) => TOUPeriod,
  fillOpacity = 0.18
): React.ReactElement[] {
  const blocks: TOUBlock[] = [];
  let current: TOUBlock = { startHour: 0, endHour: 1, period: getPeriod(0) };

  for (let h = 1; h < 24; h++) {
    const period = getPeriod(h);
    if (period === current.period) {
      current.endHour = h + 1;
    } else {
      blocks.push(current);
      current = { startHour: h, endHour: h + 1, period };
    }
  }
  blocks.push(current);

  return blocks.map((block) => (
    <ReferenceArea
      key={`tou-${block.startHour}-${block.endHour}`}
      x1={`${block.startHour.toString().padStart(2, "0")}:00`}
      x2={`${block.endHour.toString().padStart(2, "0")}:00`}
      fill={TOU_COLORS[block.period].fill}
      fillOpacity={fillOpacity}
      stroke={TOU_COLORS[block.period].fill}
      strokeOpacity={fillOpacity}
      strokeWidth={0.5}
      shapeRendering="crispEdges"
    />
  ));
}
