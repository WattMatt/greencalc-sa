import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DegradationConfig } from "../AdvancedSimulationTypes";

export function DegradationSection({
  config,
  onChange,
  projectLifetime = 20,
  includesBattery = false,
}: {
  config: DegradationConfig;
  onChange: (config: DegradationConfig) => void;
  projectLifetime?: number;
  includesBattery?: boolean;
}) {
  const [panelApplyRate, setPanelApplyRate] = useState(config.panelSimpleRate ?? 0.5);
  const [batteryApplyRate, setBatteryApplyRate] = useState(config.batterySimpleRate ?? 3.0);

  const ensureArrayLength = (arr: number[], length: number, defaultValue: number): number[] => {
    const newArr = [...arr];
    while (newArr.length < length) newArr.push(defaultValue);
    return newArr.slice(0, length);
  };

  const panelRates = ensureArrayLength(config.panelYearlyRates || [], projectLifetime, config.panelSimpleRate || 0.5);
  const batteryRates = ensureArrayLength(config.batteryYearlyRates || [], projectLifetime, config.batterySimpleRate || 3.0);

  const handlePanelYearChange = (index: number, value: number) => {
    const newRates = [...panelRates];
    newRates[index] = value;
    onChange({ ...config, panelYearlyRates: newRates });
  };

  const handleBatteryYearChange = (index: number, value: number) => {
    const newRates = [...batteryRates];
    newRates[index] = value;
    onChange({ ...config, batteryYearlyRates: newRates });
  };

  return (
    <div className="space-y-4">
      <div className={includesBattery ? "grid grid-cols-2 gap-4" : ""}>
        {/* Panel Degradation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Panel Degradation</Label>
            <RadioGroup
              value={config.panelDegradationMode || 'simple'}
              onValueChange={(mode: 'simple' | 'yearly') => onChange({ ...config, panelDegradationMode: mode })}
              className="flex items-center gap-2"
            >
              <div className="flex items-center gap-1">
                <RadioGroupItem value="simple" id="panel-simple" className="h-3 w-3" />
                <Label htmlFor="panel-simple" className="text-[10px] cursor-pointer">Simple</Label>
              </div>
              <div className="flex items-center gap-1">
                <RadioGroupItem value="yearly" id="panel-yearly" className="h-3 w-3" />
                <Label htmlFor="panel-yearly" className="text-[10px] cursor-pointer">Yearly</Label>
              </div>
            </RadioGroup>
          </div>

          {(config.panelDegradationMode || 'simple') === 'simple' ? (
            <div className="flex items-center gap-2">
              <Slider
                value={[(config.panelSimpleRate ?? 0.5) * 10]}
                onValueChange={([v]) => onChange({ ...config, panelSimpleRate: v / 10 })}
                min={2} max={15} step={1} className="flex-1"
              />
              <NumericInput
                value={config.panelSimpleRate ?? 0.5}
                onChange={(v) => onChange({ ...config, panelSimpleRate: v })}
                fallback={0.5} className="w-14 h-7 text-xs text-right" step={0.1} min={0} max={5}
              />
              <span className="text-[10px] text-muted-foreground">%/yr</span>
            </div>
          ) : (
            <div className="space-y-2">
              <ScrollArea className="h-48 rounded border bg-muted/20 p-2">
                <div className="grid grid-cols-4 gap-1">
                  {panelRates.map((rate, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground w-5">Y{idx + 1}</span>
                      <NumericInput value={rate} onChange={(v) => handlePanelYearChange(idx, v)} className="h-6 text-[10px] text-center p-1" step={0.1} min={0} max={10} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Set rate:</Label>
                <NumericInput value={panelApplyRate} onChange={setPanelApplyRate} fallback={0.5} className="w-20 h-6 text-[10px] text-center" step={0.1} min={0} max={10} />
                <span className="text-[10px] text-muted-foreground">%</span>
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onChange({ ...config, panelYearlyRates: Array(projectLifetime).fill(panelApplyRate) })}>
                  Apply to all
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Battery Degradation */}
        {includesBattery && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Battery Degradation</Label>
              <RadioGroup
                value={config.batteryDegradationMode || 'simple'}
                onValueChange={(mode: 'simple' | 'yearly') => onChange({ ...config, batteryDegradationMode: mode })}
                className="flex items-center gap-2"
              >
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="simple" id="battery-simple" className="h-3 w-3" />
                  <Label htmlFor="battery-simple" className="text-[10px] cursor-pointer">Simple</Label>
                </div>
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="yearly" id="battery-yearly" className="h-3 w-3" />
                  <Label htmlFor="battery-yearly" className="text-[10px] cursor-pointer">Yearly</Label>
                </div>
              </RadioGroup>
            </div>

            {(config.batteryDegradationMode || 'simple') === 'simple' ? (
              <div className="flex items-center gap-2">
                <Slider
                  value={[(config.batterySimpleRate ?? 3.0) * 10]}
                  onValueChange={([v]) => onChange({ ...config, batterySimpleRate: v / 10 })}
                  min={10} max={60} step={5} className="flex-1"
                />
                <NumericInput
                  value={config.batterySimpleRate ?? 3.0}
                  onChange={(v) => onChange({ ...config, batterySimpleRate: v })}
                  fallback={3.0} className="w-14 h-7 text-xs text-right" step={0.5} min={0} max={10}
                />
                <span className="text-[10px] text-muted-foreground">%/yr</span>
              </div>
            ) : (
              <div className="space-y-2">
                <ScrollArea className="h-48 rounded border bg-muted/20 p-2">
                  <div className="grid grid-cols-4 gap-1">
                    {batteryRates.map((rate, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground w-5">Y{idx + 1}</span>
                        <NumericInput value={rate} onChange={(v) => handleBatteryYearChange(idx, v)} className="h-6 text-[10px] text-center p-1" step={0.5} min={0} max={15} />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex items-center gap-1">
                  <NumericInput value={batteryApplyRate} onChange={setBatteryApplyRate} fallback={3.0} className="w-14 h-6 text-[10px] text-center" step={0.5} min={0} max={15} />
                  <span className="text-[10px] text-muted-foreground">%</span>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => onChange({ ...config, batteryYearlyRates: Array(projectLifetime).fill(batteryApplyRate) })}>
                    Apply to all years
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {includesBattery && (
        <div className="flex items-center gap-2">
          <Label className="text-xs flex-1">Battery End-of-Life Capacity</Label>
          <NumericInput
            value={config.batteryEolCapacity}
            onChange={(v) => onChange({ ...config, batteryEolCapacity: v })}
            fallback={70} integer className="w-16 h-7 text-xs text-right" min={50} max={90}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      )}
    </div>
  );
}
