import { TOU_COLORS, TOUPeriod } from "../types";

/**
 * Custom XAxis tick that renders ONLY the text label.
 * When showTOU is true, shifts the label down to leave room for the
 * TOUBarsLayer rendered via <Customized>.
 */
export function TOUXAxisTick(props: any) {
  const { x, y, payload, showTOU } = props;

  return (
    <text
      x={x}
      y={showTOU ? y + 17 : y + 12}
      textAnchor="middle"
      fontSize={10}
      fill="hsl(var(--muted-foreground))"
    >
      {payload?.value}
    </text>
  );
}

/**
 * Renders continuous TOU coloured bars along the x-axis.
 * Must be used inside <Customized component={<TOUBarsLayer ... />} />.
 *
 * Recharts injects full chart state (xAxisMap, offset, etc.) as props.
 */
export function TOUBarsLayer(props: any) {
  const { xAxisMap, offset, getPeriod, showTOU } = props;

  if (!showTOU || !xAxisMap || !offset) return null;

  const xAxis = Object.values(xAxisMap)[0] as any;
  if (!xAxis) return null;

  const { scale, bandSize } = xAxis;
  const barY = offset.top + offset.height + 4;
  const barHeight = 5;

  // Build bars for hours 0-23
  const bars: React.ReactElement[] = [];
  for (let h = 0; h < 24; h++) {
    const hourLabel = `${String(h).padStart(2, "0")}:00`;
    const cx = scale(hourLabel);
    if (cx == null || isNaN(cx)) continue;

    const period: TOUPeriod | undefined = getPeriod?.(h);
    const color = period ? TOU_COLORS[period]?.stroke : undefined;
    if (!color) continue;

    bars.push(
      <rect
        key={h}
        x={cx - bandSize}
        y={barY}
        width={bandSize}
        height={barHeight}
        fill={color}
        opacity={0.55}
        rx={1}
      />
    );
  }

  return <g className="tou-bars-layer">{bars}</g>;
}
