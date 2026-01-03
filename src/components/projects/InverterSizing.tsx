import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Info, Plus, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Common inverter sizes in kW (AC output)
export const INVERTER_SIZES = [
  { kw: 5, label: "5 kW", typical: "Residential" },
  { kw: 10, label: "10 kW", typical: "Small Commercial" },
  { kw: 15, label: "15 kW", typical: "Small Commercial" },
  { kw: 20, label: "20 kW", typical: "Small Commercial" },
  { kw: 25, label: "25 kW", typical: "Commercial" },
  { kw: 30, label: "30 kW", typical: "Commercial" },
  { kw: 50, label: "50 kW", typical: "Commercial" },
  { kw: 60, label: "60 kW", typical: "Large Commercial" },
  { kw: 80, label: "80 kW", typical: "Large Commercial" },
  { kw: 100, label: "100 kW", typical: "Industrial" },
  { kw: 110, label: "110 kW", typical: "Industrial" },
  { kw: 120, label: "120 kW", typical: "Industrial" },
  { kw: 150, label: "150 kW", typical: "Industrial" },
  { kw: 185, label: "185 kW", typical: "Utility" },
  { kw: 200, label: "200 kW", typical: "Utility" },
  { kw: 250, label: "250 kW", typical: "Utility" },
];

export interface InverterConfig {
  inverterSize: number; // kW AC
  inverterCount: number;
  dcAcRatio: number; // Typical 1.1-1.5
}

export interface InverterSizingProps {
  config: InverterConfig;
  onChange: (config: InverterConfig) => void;
  currentSolarCapacity: number; // This is now AC capacity (kW)
  onSolarCapacityChange: (capacity: number) => void;
  maxSolarKva?: number | null;
}

export function getDefaultInverterConfig(): InverterConfig {
  return {
    inverterSize: 100,
    inverterCount: 1,
    dcAcRatio: 1.25,
  };
}

export function calculateValidSizes(
  inverterSize: number,
  dcAcRatio: number,
  maxInverters: number = 10
): { inverterCount: number; acCapacity: number; dcCapacity: number }[] {
  const sizes: { inverterCount: number; acCapacity: number; dcCapacity: number }[] = [];
  
  for (let count = 1; count <= maxInverters; count++) {
    const acCapacity = inverterSize * count; // System size = AC capacity
    const dcCapacity = Math.round(acCapacity * dcAcRatio); // Panel capacity for overpaneling
    sizes.push({ inverterCount: count, acCapacity, dcCapacity });
  }
  
  return sizes;
}

export function InverterSizing({
  config,
  onChange,
  currentSolarCapacity,
  onSolarCapacityChange,
  maxSolarKva,
}: InverterSizingProps) {
  const validSizes = useMemo(
    () => calculateValidSizes(config.inverterSize, config.dcAcRatio, 10),
    [config.inverterSize, config.dcAcRatio]
  );

  const currentAcCapacity = config.inverterSize * config.inverterCount;
  const dcPanelCapacity = Math.round(currentAcCapacity * config.dcAcRatio);
  
  // Check if current solar capacity (AC) matches a valid inverter configuration
  const isValidConfig = validSizes.some(s => s.acCapacity === currentSolarCapacity);
  const nearestValid = validSizes.reduce((prev, curr) => 
    Math.abs(curr.acCapacity - currentSolarCapacity) < Math.abs(prev.acCapacity - currentSolarCapacity) 
      ? curr 
      : prev
  );

  // Check against connection limit (AC capacity vs kVA limit)
  const exceedsConnectionLimit = maxSolarKva && currentAcCapacity > maxSolarKva;

  const handleInverterSizeChange = (size: number) => {
    const newConfig = { ...config, inverterSize: size };
    onChange(newConfig);
    // Auto-update solar capacity (AC) to match
    const newAcCapacity = size * config.inverterCount;
    onSolarCapacityChange(newAcCapacity);
  };

  const handleInverterCountChange = (count: number) => {
    const newConfig = { ...config, inverterCount: count };
    onChange(newConfig);
    // Auto-update solar capacity (AC) to match
    const newAcCapacity = config.inverterSize * count;
    onSolarCapacityChange(newAcCapacity);
  };

  const handleDcAcRatioChange = (ratio: number) => {
    const newConfig = { ...config, dcAcRatio: ratio };
    onChange(newConfig);
    // DC/AC ratio doesn't change the system size, only the panel capacity
  };

  const snapToNearest = () => {
    handleInverterCountChange(nearestValid.inverterCount);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Inverter-Based Sizing
        </CardTitle>
        <CardDescription className="text-xs">
          Size system based on inverter capacity and grouping
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
          {/* Inverter Size Selection */}
          <div className="space-y-2">
            <Label className="text-xs">Inverter Size (AC)</Label>
            <Select
              value={config.inverterSize.toString()}
              onValueChange={(v) => handleInverterSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVERTER_SIZES.map((inv) => (
                  <SelectItem key={inv.kw} value={inv.kw.toString()} className="text-xs">
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span className="font-medium">{inv.label}</span>
                      <span className="text-muted-foreground">{inv.typical}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inverter Count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Number of Inverters</Label>
              <span className="text-xs font-medium">{config.inverterCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleInverterCountChange(Math.max(1, config.inverterCount - 1))}
                disabled={config.inverterCount <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Slider
                value={[config.inverterCount]}
                onValueChange={([v]) => handleInverterCountChange(v)}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleInverterCountChange(Math.min(10, config.inverterCount + 1))}
                disabled={config.inverterCount >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* DC/AC Ratio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                DC/AC Ratio
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Ratio of DC panel capacity to AC inverter capacity. Higher ratios 
                        (1.2-1.4) maximize energy harvest but may cause clipping during peak hours.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <span className="text-xs font-medium">{config.dcAcRatio.toFixed(2)}</span>
            </div>
            <Slider
              value={[config.dcAcRatio]}
              onValueChange={([v]) => handleDcAcRatioChange(v)}
              min={1.0}
              max={1.5}
              step={0.05}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1.0 (Conservative)</span>
              <span className="text-primary">1.25 (Optimal)</span>
              <span>1.5 (Aggressive)</span>
            </div>
          </div>

          {/* Calculated System Size */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">System Size (AC)</span>
              <span className="font-semibold text-primary">{currentAcCapacity} kW</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">DC Panel Capacity</span>
              <span className="font-medium">{dcPanelCapacity} kWp</span>
            </div>
            {maxSolarKva && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Connection Limit (70%)</span>
                <span className={exceedsConnectionLimit ? "text-destructive font-medium" : ""}>
                  {maxSolarKva.toFixed(0)} kVA
                </span>
              </div>
            )}
          </div>

          {/* Valid Configurations Quick Select */}
          <div className="space-y-2">
            <Label className="text-xs">Quick Select System Size (AC)</Label>
            <div className="flex flex-wrap gap-1">
              {validSizes
                .filter(s => !maxSolarKva || s.acCapacity <= maxSolarKva * 1.2)
                .slice(0, 6)
                .map((size) => {
                  const isSelected = currentSolarCapacity === size.acCapacity;
                  const exceedsLimit = maxSolarKva && size.acCapacity > maxSolarKva;
                  
                  return (
                    <Button
                      key={size.inverterCount}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-7 text-xs",
                        exceedsLimit && !isSelected && "border-amber-500/50 text-amber-600"
                      )}
                      onClick={() => {
                        handleInverterCountChange(size.inverterCount);
                      }}
                    >
                      {size.acCapacity} kW
                      <span className="ml-1 text-[10px] opacity-70">
                        ({size.inverterCount}×{config.inverterSize})
                      </span>
                    </Button>
                  );
                })}
            </div>
          </div>

          {/* Validation Status */}
          {!isValidConfig && (
            <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 text-xs">
                <span className="text-amber-600 dark:text-amber-400">
                  Current capacity ({currentSolarCapacity} kW) doesn't match inverter grouping.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={snapToNearest}
              >
                Snap to {nearestValid.acCapacity} kW
              </Button>
            </div>
          )}

          {isValidConfig && (
            <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-xs text-green-600 dark:text-green-400">
                Valid configuration: {config.inverterCount}× {config.inverterSize}kW inverter{config.inverterCount > 1 ? "s" : ""} = {currentAcCapacity}kW AC
              </span>
            </div>
          )}

          {exceedsConnectionLimit && (
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-xs text-destructive">
                Exceeds 70% connection limit ({maxSolarKva?.toFixed(0)} kVA)
              </span>
            </div>
          )}
        </CardContent>
    </Card>
  );
}
