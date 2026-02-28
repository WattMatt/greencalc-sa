import { Card, CardContent } from "@/components/ui/card";
import { InverterSliderPanel } from "../InverterSliderPanel";
import type { InverterConfig } from "../InverterSizing";

interface InverterPaneProps {
  inverterConfig: InverterConfig;
  onInverterConfigChange: (config: InverterConfig) => void;
  currentSolarCapacity: number;
  onSolarCapacityChange: (v: number) => void;
  maxSolarKva: number | null;
  solarExceedsLimit: boolean;
}

export function InverterPane({
  inverterConfig, onInverterConfigChange,
  currentSolarCapacity, onSolarCapacityChange,
  maxSolarKva, solarExceedsLimit,
}: InverterPaneProps) {
  return (
    <Card className={solarExceedsLimit ? "border-destructive/50" : ""}>
      <CardContent className="pt-4">
        <InverterSliderPanel
          config={inverterConfig}
          onChange={onInverterConfigChange}
          currentSolarCapacity={currentSolarCapacity}
          onSolarCapacityChange={onSolarCapacityChange}
          maxSolarKva={maxSolarKva}
        />
      </CardContent>
    </Card>
  );
}
