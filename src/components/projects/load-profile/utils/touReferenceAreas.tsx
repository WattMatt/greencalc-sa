import { TOU_COLORS, TOUPeriod } from "../types";

/**
 * Custom XAxis tick that renders a coloured TOU period bar
 * between the axis line and the tick label.
 *
 * Inject `getPeriod` and `showTOU` as props via
 *   <XAxis tick={<TOUXAxisTick getPeriod={fn} showTOU={flag} />} />
 */
export function TOUXAxisTick(props: any) {
  const { x, y, payload, visibleTicksCount, index, getPeriod, showTOU } = props;

  // Parse hour number from the tick value (e.g. "06:00" → 6)
  const hourNum = parseInt(payload?.value?.toString() || "0", 10);

  // Estimate band width from the xAxis metadata Recharts injects
  const bandSize: number = props.xAxis?.bandSize ?? 0;

  const period: TOUPeriod | undefined = getPeriod?.(hourNum);
  const color = period ? TOU_COLORS[period]?.stroke : undefined;

  const barHeight = 5;
  const barY = y + 2; // just below the axis line
  const labelY = barY + barHeight + 10; // label below the bar

  return (
    <g>
      {/* TOU colour bar – always rendered per tick so the strip is continuous */}
      {showTOU && color && (
        <rect
          x={x - bandSize / 2}
          y={barY}
          width={bandSize}
          height={barHeight}
          fill={color}
          opacity={0.55}
          rx={1}
        />
      )}

      {/* Normal tick label */}
      <text
        x={x}
        y={showTOU ? labelY : y + 12}
        textAnchor="middle"
        fontSize={10}
        fill="hsl(var(--muted-foreground))"
      >
        {payload?.value}
      </text>
    </g>
  );
}
