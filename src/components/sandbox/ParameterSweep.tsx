import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";

export interface SweepConfig {
  enabled: boolean;
  solarMin: number;
  solarMax: number;
  solarStep: number;
  batteryMin: number;
  batteryMax: number;
  batteryStep: number;
  dcAcMin: number;
  dcAcMax: number;
  dcAcStep: number;
}

interface ParameterSweepProps {
  config: SweepConfig;
  onConfigChange: (config: SweepConfig) => void;
}

export function ParameterSweep({ config, onConfigChange }: ParameterSweepProps) {
  const totalCombinations = config.enabled
    ? Math.ceil((config.solarMax - config.solarMin) / config.solarStep + 1) *
      Math.ceil((config.batteryMax - config.batteryMin) / config.batteryStep + 1) *
      Math.ceil((config.dcAcMax - config.dcAcMin) / config.dcAcStep + 1)
    : 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Parameter Sweep</CardTitle>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(enabled) => onConfigChange({ ...config, enabled })}
          />
        </div>
        <CardDescription>
          Test ranges of values to find optimal configurations
        </CardDescription>
      </CardHeader>

      {config.enabled && (
        <CardContent className="space-y-4">
          {/* Solar Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Solar Capacity Range (kWp)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  value={config.solarMin}
                  onChange={(e) => onConfigChange({ ...config, solarMin: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  value={config.solarMax}
                  onChange={(e) => onConfigChange({ ...config, solarMax: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Step</Label>
                <Input
                  type="number"
                  value={config.solarStep}
                  onChange={(e) => onConfigChange({ ...config, solarStep: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Battery Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Battery Capacity Range (kWh)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  value={config.batteryMin}
                  onChange={(e) => onConfigChange({ ...config, batteryMin: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  value={config.batteryMax}
                  onChange={(e) => onConfigChange({ ...config, batteryMax: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Step</Label>
                <Input
                  type="number"
                  value={config.batteryStep}
                  onChange={(e) => onConfigChange({ ...config, batteryStep: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* DC/AC Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">DC/AC Ratio Range (%)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  value={config.dcAcMin}
                  onChange={(e) => onConfigChange({ ...config, dcAcMin: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  value={config.dcAcMax}
                  onChange={(e) => onConfigChange({ ...config, dcAcMax: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Step</Label>
                <Input
                  type="number"
                  value={config.dcAcStep}
                  onChange={(e) => onConfigChange({ ...config, dcAcStep: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Combinations indicator */}
          <div className="flex items-center justify-between pt-2 border-t border-dashed">
            <span className="text-sm text-muted-foreground">Total combinations:</span>
            <Badge variant={totalCombinations > 100 ? "destructive" : "secondary"}>
              {totalCombinations.toLocaleString()}
            </Badge>
          </div>
          {totalCombinations > 100 && (
            <p className="text-xs text-destructive">
              Consider reducing ranges or increasing steps for faster results.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
