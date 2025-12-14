import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings2, ChevronDown } from "lucide-react";
import { DisplayUnit } from "../types";

interface ChartSettingsProps {
  showAdvancedSettings: boolean;
  setShowAdvancedSettings: (show: boolean) => void;
  displayUnit: DisplayUnit;
  powerFactor: number;
  setPowerFactor: (pf: number) => void;
  showPVProfile: boolean;
  maxPvAcKva: number | null;
  dcAcRatio: number;
  setDcAcRatio: (ratio: number) => void;
  dcCapacityKwp: number | null;
  show1to1Comparison: boolean;
  setShow1to1Comparison: (show: boolean) => void;
  showBattery: boolean;
  batteryCapacity: number;
  setBatteryCapacity: (cap: number) => void;
  batteryPower: number;
  setBatteryPower: (power: number) => void;
}

export function ChartSettings({
  showAdvancedSettings,
  setShowAdvancedSettings,
  displayUnit,
  powerFactor,
  setPowerFactor,
  showPVProfile,
  maxPvAcKva,
  dcAcRatio,
  setDcAcRatio,
  dcCapacityKwp,
  show1to1Comparison,
  setShow1to1Comparison,
  showBattery,
  batteryCapacity,
  setBatteryCapacity,
  batteryPower,
  setBatteryPower,
}: ChartSettingsProps) {
  return (
    <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="mb-2 h-7 text-xs text-muted-foreground gap-1">
          <Settings2 className="h-3 w-3" />
          Settings
          <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mb-4 p-3 rounded-lg bg-muted/50">
        <div className="flex flex-wrap gap-6">
          {displayUnit === "kva" && (
            <div className="w-40 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Power Factor</span>
                <span className="font-medium">{powerFactor.toFixed(2)}</span>
              </div>
              <Slider value={[powerFactor]} onValueChange={([v]) => setPowerFactor(v)} min={0.7} max={1.0} step={0.01} />
            </div>
          )}
          {showPVProfile && maxPvAcKva && (
            <>
              <div className="w-40 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">DC/AC Ratio</span>
                  <span className="font-medium">{(dcAcRatio * 100).toFixed(0)}%</span>
                </div>
                <Slider value={[dcAcRatio]} onValueChange={([v]) => setDcAcRatio(v)} min={1.0} max={1.5} step={0.05} />
                <p className="text-[10px] text-muted-foreground">
                  DC: {dcCapacityKwp?.toFixed(0)} kWp → AC: {maxPvAcKva.toFixed(0)} kVA
                </p>
              </div>
              {dcAcRatio > 1 && (
                <Label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={show1to1Comparison} onCheckedChange={setShow1to1Comparison} className="scale-75" />
                  Show 1:1 Baseline
                </Label>
              )}
            </>
          )}
          {showBattery && (
            <>
              <div className="w-40 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-medium">{batteryCapacity} kWh</span>
                </div>
                <Slider value={[batteryCapacity]} onValueChange={([v]) => setBatteryCapacity(v)} min={100} max={2000} step={50} />
              </div>
              <div className="w-40 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Power</span>
                  <span className="font-medium">{batteryPower} kW</span>
                </div>
                <Slider value={[batteryPower]} onValueChange={([v]) => setBatteryPower(v)} min={50} max={1000} step={25} />
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
