import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, Info, Settings, Zap } from "lucide-react";
import { SOLAR_MODULE_PRESETS, calculateModuleMetrics } from "./SolarModulePresets";
import { InverterConfig, INVERTER_SIZES, calculateValidSizes } from "./InverterSizing";

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
  // System size (AC) is now the primary input — stored as currentSolarCapacity
  const desiredAcCapacity = currentSolarCapacity;
  const derivedInverterCount = Math.max(1, Math.ceil(desiredAcCapacity / config.inverterSize));

  // Keep config.inverterCount in sync as a derived value
  if (config.inverterCount !== derivedInverterCount) {
    onChange({ ...config, inverterCount: derivedInverterCount });
  }

  const selectedModule =
    config.selectedModuleId === "custom"
      ? config.customModule
      : SOLAR_MODULE_PRESETS.find((m) => m.id === config.selectedModuleId) ||
        SOLAR_MODULE_PRESETS[0];

  const validSizes = calculateValidSizes(config.inverterSize, config.dcAcRatio);
  const moduleMetrics = selectedModule
    ? calculateModuleMetrics(desiredAcCapacity, config.dcAcRatio, selectedModule)
    : null;

  const handleSystemSizeQuickSelect = (acKw: number) => {
    const newCount = Math.max(1, Math.ceil(acKw / config.inverterSize));
    onChange({ ...config, inverterCount: newCount });
    onSolarCapacityChange(acKw);
  };

  const handleCustomSystemSize = (value: string) => {
    const val = parseFloat(value);
    if (!isNaN(val) && val > 0) {
      const newCount = Math.max(1, Math.ceil(val / config.inverterSize));
      onChange({ ...config, inverterCount: newCount });
      onSolarCapacityChange(val);
    }
  };

  const handleDcAcRatioChange = (value: number[]) => {
    onChange({ ...config, dcAcRatio: value[0] });
  };

  const isExceedingLimit = maxSolarKva && desiredAcCapacity > maxSolarKva;

  const isCustomSize = !INVERTER_SIZES.some(
    (size) => size.kw === config.inverterSize
  );

  const handleInverterSizeChange = (value: string) => {
    if (value === "custom") return;
    const newSize = parseInt(value);
    const newCount = Math.max(1, Math.ceil(desiredAcCapacity / newSize));
    onChange({ ...config, inverterSize: newSize, inverterCount: newCount });
  };

  const handleCustomInverterSize = (value: string) => {
    const newSize = parseInt(value) || 0;
    if (newSize > 0) {
      const newCount = Math.max(1, Math.ceil(desiredAcCapacity / newSize));
      onChange({ ...config, inverterSize: newSize, inverterCount: newCount });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Quick Select System Size (AC) — PRIMARY INPUT */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4" />
          System Size (AC)
        </Label>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-2 flex-1">
            {validSizes.slice(0, 6).map((size) => (
              <Button
                key={size.acCapacity}
                variant={
                  desiredAcCapacity === size.acCapacity ? "default" : "outline"
                }
                size="sm"
                onClick={() => handleSystemSizeQuickSelect(size.acCapacity)}
                className="text-xs"
              >
                {size.acCapacity} kW
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-xs text-muted-foreground">Custom</Label>
            <Input
              type="number"
              value={desiredAcCapacity}
              onChange={(e) => handleCustomSystemSize(e.target.value)}
              className="w-24 h-8 text-right text-sm font-semibold"
              step="5"
              min="1"
            />
            <span className="text-xs text-muted-foreground">kW</span>
          </div>
        </div>
      </div>

      {/* 2. Inverter Size Dropdown */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Settings className="h-4 w-4" />
          Inverter Size (AC)
        </Label>
        <div className="flex gap-2">
          <Select
            value={isCustomSize ? "custom" : config.inverterSize.toString()}
            onValueChange={handleInverterSizeChange}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {INVERTER_SIZES.map((size) => (
                <SelectItem key={size.kw} value={size.kw.toString()}>
                  {size.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.inverterSize}
              onChange={(e) => handleCustomInverterSize(e.target.value)}
              className="w-24"
              min={1}
            />
            <span className="text-sm text-muted-foreground">kW</span>
          </div>
        </div>
      </div>

      {/* 3. Number of Inverters — READ-ONLY DERIVED */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium">
            Number of Inverters
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Auto-calculated: ⌈ System Size ÷ Inverter Size ⌉ = ⌈ {desiredAcCapacity} ÷ {config.inverterSize} ⌉ = {derivedInverterCount}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <span className="text-lg font-semibold">{derivedInverterCount}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {derivedInverterCount}× {config.inverterSize} kW = {derivedInverterCount * config.inverterSize} kW inverter capacity
        </p>
      </div>

      {/* 4. DC/AC Ratio Slider */}
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
                    The ratio of DC panel capacity to AC system size.
                    Higher ratios maximise energy harvest but increase clipping
                    losses.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            type="number"
            value={config.dcAcRatio}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 1.0 && val <= 1.5) {
                onChange({ ...config, dcAcRatio: val });
              }
            }}
            className="w-20 h-7 text-right text-sm font-semibold"
            step={0.001}
            min={1.0}
            max={1.5}
          />
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

      {/* 5. Calculated Metrics */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">System Size (AC)</span>
          <span className="font-medium">{desiredAcCapacity} kW</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">DC Panel Capacity</span>
          <span className="font-medium">
            {moduleMetrics?.actualDcCapacityKwp.toFixed(2) ||
              (desiredAcCapacity * config.dcAcRatio).toFixed(2)}{" "}
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

      {/* 6. Validation Status */}
      {!isExceedingLimit && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {derivedInverterCount}× {config.inverterSize} kW inverters for {desiredAcCapacity} kW system
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
    </div>
  );
}
