import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, Info, Settings } from "lucide-react";
import { SOLAR_MODULE_PRESETS, calculateModuleMetrics } from "./SolarModulePresets";
import { InverterConfig, calculateValidSizes } from "./InverterSizing";

interface InverterSliderPanelProps {
  config: InverterConfig;
  onChange: (config: InverterConfig) => void;
  currentSolarCapacity: number;
  onSolarCapacityChange: (capacity: number) => void;
  maxSolarKva?: number | null;
}

export function InverterSliderPanel({
  config,
  onChange,
  currentSolarCapacity,
  onSolarCapacityChange,
  maxSolarKva,
}: InverterSliderPanelProps) {
  const selectedModule =
    config.selectedModuleId === "custom"
      ? config.customModule
      : SOLAR_MODULE_PRESETS.find((m) => m.id === config.selectedModuleId) ||
        SOLAR_MODULE_PRESETS[0];

  const validSizes = calculateValidSizes(config.inverterSize, config.dcAcRatio);
  const acCapacity = config.inverterSize * config.inverterCount;
  const nearestValid = validSizes.find((s) => s.acCapacity === acCapacity);
  const moduleMetrics = selectedModule
    ? calculateModuleMetrics(acCapacity, config.dcAcRatio, selectedModule)
    : null;

  const handleInverterCountChange = (value: number[]) => {
    const newCount = value[0];
    onChange({ ...config, inverterCount: newCount });
    onSolarCapacityChange(config.inverterSize * newCount);
  };

  const handleDcAcRatioChange = (value: number[]) => {
    onChange({ ...config, dcAcRatio: value[0] });
  };

  const handleQuickSelect = (inverterCount: number) => {
    onChange({ ...config, inverterCount });
    onSolarCapacityChange(config.inverterSize * inverterCount);
  };

  const isExceedingLimit = maxSolarKva && acCapacity > maxSolarKva;

  return (
    <div className="space-y-4">
      {/* Number of Inverters Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Settings className="h-4 w-4" />
            Number of Inverters
          </Label>
          <span className="text-lg font-semibold">{config.inverterCount}</span>
        </div>
        <Slider
          value={[config.inverterCount]}
          onValueChange={handleInverterCountChange}
          min={1}
          max={10}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>

      {/* DC/AC Ratio Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium">
            DC/AC Ratio
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    The ratio of DC panel capacity to AC inverter capacity.
                    Higher ratios maximize energy harvest but increase clipping
                    losses.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <span className="text-lg font-semibold">
            {config.dcAcRatio.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[config.dcAcRatio]}
          onValueChange={handleDcAcRatioChange}
          min={1.0}
          max={1.5}
          step={0.01}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1.0 (Conservative)</span>
          <span>1.25 (Optimal)</span>
          <span>1.5 (Aggressive)</span>
        </div>
      </div>

      {/* Calculated Metrics */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">System Size (AC)</span>
          <span className="font-medium">{acCapacity} kW</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">DC Panel Capacity</span>
          <span className="font-medium">
            {moduleMetrics?.actualDcCapacityKwp.toFixed(2) ||
              (acCapacity * config.dcAcRatio).toFixed(2)}{" "}
            kWp
          </span>
        </div>
        {moduleMetrics && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Module Count</span>
              <span className="font-medium">
                {moduleMetrics.moduleCount} modules
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Collector Area</span>
              <span className="font-medium">
                {moduleMetrics.collectorAreaM2.toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{" "}
                m²
              </span>
            </div>
          </>
        )}
        {maxSolarKva && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Connection Limit (70%)</span>
            <span className="font-medium">{maxSolarKva.toFixed(0)} kVA</span>
          </div>
        )}
      </div>

      {/* Quick Select Buttons */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Quick Select System Size (AC)
        </Label>
        <div className="flex flex-wrap gap-2">
          {validSizes.slice(0, 6).map((size) => (
            <Button
              key={size.inverterCount}
              variant={
                config.inverterCount === size.inverterCount
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handleQuickSelect(size.inverterCount)}
              className="text-xs"
            >
              {size.acCapacity} kW
            </Button>
          ))}
        </div>
      </div>

      {/* Validation Status */}
      {nearestValid && !isExceedingLimit && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Valid: {config.inverterCount}× {config.inverterSize}kW inverters ={" "}
            {acCapacity}kW AC
          </span>
        </div>
      )}

      {isExceedingLimit && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>
            Exceeds grid connection limit ({maxSolarKva?.toFixed(0)} kVA)
          </span>
        </div>
      )}

      {!nearestValid && !isExceedingLimit && (
        <div className="flex items-center gap-2 text-sm text-warning">
          <AlertCircle className="h-4 w-4" />
          <span>
            Current capacity ({acCapacity} kW) is not a standard configuration
          </span>
        </div>
      )}
    </div>
  );
}
