import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Settings2, ChevronDown, Cloud, RefreshCw, Loader2 } from "lucide-react";
import { DisplayUnit } from "../types";
import { SolcastPVProfile } from "../hooks/useSolcastPVProfile";
import { SavePresetDialog, PresetConfig } from "./SavePresetDialog";

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
  // Solcast props
  solcastProfile?: SolcastPVProfile;
  useSolcast?: boolean;
  toggleSolcast?: (use: boolean) => void;
  solcastLoading?: boolean;
  refetchSolcast?: () => void;
  hasLocation?: boolean;
  // System losses
  systemLosses?: number;
  setSystemLosses?: (losses: number) => void;
  // Diversity factor
  diversityFactor?: number;
  setDiversityFactor?: (factor: number) => void;
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
  solcastProfile,
  useSolcast,
  toggleSolcast,
  solcastLoading,
  refetchSolcast,
  hasLocation,
  systemLosses = 0.14,
  setSystemLosses,
  diversityFactor = 1.0,
  setDiversityFactor,
}: ChartSettingsProps) {
  // Build current config for preset saving
  const currentConfig: PresetConfig = {
    dcAcRatio,
    batteryCapacity,
    batteryPower,
    systemLosses,
    powerFactor,
    showPVProfile,
    showBattery,
    show1to1Comparison,
    useSolcast: useSolcast || false,
    diversityFactor,
  };

  return (
    <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
      <div className="flex items-center gap-2 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">
            <Settings2 className="h-3 w-3" />
            Settings
            <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <SavePresetDialog config={currentConfig} />
      </div>
      <CollapsibleContent className="mb-4 p-3 rounded-lg bg-muted/50 space-y-3">
        {/* Check if any settings are available */}
        {!showPVProfile && !showBattery && displayUnit !== "kva" && !setDiversityFactor ? (
          <div className="text-sm text-muted-foreground py-2">
            <p className="font-medium mb-1">No settings available</p>
            <p className="text-xs">Enable PV Profile or Battery simulation, or switch to kVA display to access additional settings.</p>
          </div>
        ) : (
          <>
            {/* Row 1: Basic settings */}
            <div className="flex flex-wrap gap-6">
              {/* Diversity Factor - Always shown */}
              {setDiversityFactor && (
                <div className="w-44 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Diversity Factor</span>
                    <span className="font-medium">{(diversityFactor * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[diversityFactor * 100]}
                    onValueChange={([v]) => setDiversityFactor(v / 100)}
                    min={50}
                    max={100}
                    step={5}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Reduces combined peak by {((1 - diversityFactor) * 100).toFixed(0)}%
                  </p>
                </div>
              )}
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

            {/* Row 2: Solcast and system losses */}
            {showPVProfile && maxPvAcKva && (
              <div className="pt-2 border-t border-border/50 flex flex-wrap gap-6 items-center">
                {/* Solcast Toggle */}
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch
                      checked={useSolcast || false}
                      onCheckedChange={(checked) => toggleSolcast?.(checked)}
                      disabled={!hasLocation || solcastLoading}
                      className="scale-75"
                    />
                    <Cloud className="h-3 w-3 text-blue-500" />
                    Solcast Irradiance
                  </Label>
                  {solcastLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {useSolcast && refetchSolcast && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refetchSolcast} disabled={solcastLoading}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Solcast Status Badge */}
                {solcastProfile && (
                  <Badge
                    variant={solcastProfile.source === "solcast" ? "default" : "secondary"}
                    className="text-[10px] gap-1"
                  >
                    {solcastProfile.source === "solcast" ? (
                      <>
                        <Cloud className="h-2.5 w-2.5" />
                        PSH: {solcastProfile.peakSunHours.toFixed(1)} | Avg: {solcastProfile.avgTemp.toFixed(0)}°C
                      </>
                    ) : (
                      "Static Profile (5.5 PSH)"
                    )}
                  </Badge>
                )}

                {!hasLocation && (
                  <span className="text-[10px] text-muted-foreground">Set project location to enable Solcast</span>
                )}

                {/* System Losses */}
                {setSystemLosses && (
                  <div className="w-36 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">System Losses</span>
                      <span className="font-medium">{(systemLosses * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[systemLosses * 100]}
                      onValueChange={([v]) => setSystemLosses(v / 100)}
                      min={5}
                      max={25}
                      step={1}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
