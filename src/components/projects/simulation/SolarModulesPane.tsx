import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Sun, RefreshCw } from "lucide-react";
import { InverterSizeModuleConfig } from "../InverterSizeModuleConfig";
import type { InverterConfig } from "../InverterSizing";

interface SolarModulesPaneProps {
  inverterConfig: InverterConfig;
  onInverterConfigChange: (config: InverterConfig) => void;
  onSolarCapacityChange: (v: number) => void;
  maxSolarKva: number | null;
  solarExceedsLimit: boolean;
  dailyOutputOverride: number | null;
  onDailyOutputOverrideChange: (v: number | null) => void;
  specificYieldOverride: number | null;
  onSpecificYieldOverrideChange: (v: number | null) => void;
  productionReductionPercent: number;
  onProductionReductionPercentChange: (v: number) => void;
  calculatedDailyOutput: number;
  calculatedSpecificYield: number;
  solarCapacity: number;
}

export function SolarModulesPane({
  inverterConfig, onInverterConfigChange,
  onSolarCapacityChange, maxSolarKva, solarExceedsLimit,
  dailyOutputOverride, onDailyOutputOverrideChange,
  specificYieldOverride, onSpecificYieldOverrideChange,
  productionReductionPercent, onProductionReductionPercentChange,
  calculatedDailyOutput, calculatedSpecificYield, solarCapacity,
}: SolarModulesPaneProps) {
  return (
    <Card className={solarExceedsLimit ? "border-destructive/50" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sun className="h-4 w-4" />
          Solar PV System
          {maxSolarKva && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              Max: {maxSolarKva.toFixed(0)} kVA
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <InverterSizeModuleConfig
            config={inverterConfig}
            onChange={onInverterConfigChange}
            onSolarCapacityChange={onSolarCapacityChange}
          />
        </div>
        <div className="pt-2 border-t space-y-2 text-[10px]">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-muted-foreground text-[10px]">Expected daily output</Label>
            <div className="flex items-center gap-1">
              <NumericInput
                integer
                value={dailyOutputOverride ?? calculatedDailyOutput}
                onChange={(v) => onDailyOutputOverrideChange(v)}
                className="h-6 w-20 text-right text-xs"
              />
              <span className="text-xs text-muted-foreground">kWh</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onDailyOutputOverrideChange(null)} title="Reset to calculated value">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-muted-foreground text-[10px]">Specific yield</Label>
            <div className="flex items-center gap-1">
              <NumericInput
                integer
                value={specificYieldOverride ?? calculatedSpecificYield}
                onChange={(v) => onSpecificYieldOverrideChange(v)}
                className="h-6 w-20 text-right text-xs"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">kWh/kWp/yr</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onSpecificYieldOverrideChange(null)} title="Reset to calculated value">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-muted-foreground text-[10px]">Production reduction</Label>
            <div className="flex items-center gap-1">
              <NumericInput
                integer
                value={productionReductionPercent}
                onChange={(v) => onProductionReductionPercentChange(v)}
                className="h-6 w-16 text-right text-xs"
                min={0}
                max={100}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onProductionReductionPercentChange(15)} title="Reset to default (15%)">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {productionReductionPercent > 0 && (
            <p className="text-[9px] text-muted-foreground mt-1">
              Output reduced by {productionReductionPercent}% for conservative estimate
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
