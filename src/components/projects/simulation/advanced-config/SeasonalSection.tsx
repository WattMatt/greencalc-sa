import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { SeasonalConfig } from "../AdvancedSimulationTypes";

export function SeasonalSection({
  config,
  onChange,
}: {
  config: SeasonalConfig;
  onChange: (config: SeasonalConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Monthly irradiance factors adjust solar generation throughout the year
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">High Demand Load Factor</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[config.highDemandLoadMultiplier * 100]}
              onValueChange={([v]) => onChange({ ...config, highDemandLoadMultiplier: v / 100 })}
              min={90}
              max={130}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-12 text-right">{(config.highDemandLoadMultiplier * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Low Demand Load Factor</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[config.lowDemandLoadMultiplier * 100]}
              onValueChange={([v]) => onChange({ ...config, lowDemandLoadMultiplier: v / 100 })}
              min={70}
              max={110}
              step={1}
              className="flex-1"
            />
            <span className="text-xs w-12 text-right">{(config.lowDemandLoadMultiplier * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
