import { TOU_COLORS, SEASON_COLORS } from "../types";

interface TOULegendProps {
  isHighSeason?: boolean;
}

export function TOULegend({ isHighSeason }: TOULegendProps) {
  const seasonLabel = isHighSeason !== undefined
    ? (isHighSeason ? SEASON_COLORS.high.label : SEASON_COLORS.low.label)
    : undefined;

  return (
    <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-primary/60" />
        <span>Load Profile</span>
        {seasonLabel && (
          <span className="text-muted-foreground ml-1">— {seasonLabel} Season</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {Object.entries(TOU_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: val.fill, opacity: 0.7 }} />
            <span className="text-muted-foreground">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
