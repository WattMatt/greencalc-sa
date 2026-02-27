import { TOU_COLORS } from "../types";

export function TOULegend() {
  return (
    <div className="mt-3 pt-3 border-t flex items-center justify-end text-xs">
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
