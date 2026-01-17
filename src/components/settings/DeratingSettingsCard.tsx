import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Zap, Sun, ThermometerSun, Cable } from "lucide-react";
import { useDeratingSettings } from "@/hooks/useDeratingSettings";
import { toast } from "sonner";

const DIVERSITY_PRESETS = [
  { label: "Shopping Centre", value: 0.80 },
  { label: "Office Park", value: 0.85 },
  { label: "Industrial", value: 0.90 },
  { label: "Mixed Use", value: 0.75 },
];

export function DeratingSettingsCard() {
  const { settings, updateSetting, resetToDefaults } = useDeratingSettings();

  const handleReset = () => {
    resetToDefaults();
    toast.success("Derating settings reset to defaults");
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Zap className="h-5 w-5" />
          Derating Settings
        </CardTitle>
        <CardDescription>
          Default derating factors applied to all new projects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Diversity Factor with Presets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Diversity Factor
            </Label>
            <span className="text-sm font-medium">{(settings.diversityFactor * 100).toFixed(0)}%</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {DIVERSITY_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={settings.diversityFactor === preset.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => updateSetting("diversityFactor", preset.value)}
              >
                {preset.label} ({(preset.value * 100).toFixed(0)}%)
              </Button>
            ))}
          </div>
          <Slider
            value={[settings.diversityFactor * 100]}
            onValueChange={([v]) => updateSetting("diversityFactor", v / 100)}
            min={50}
            max={100}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Reduces combined peak demand by {((1 - settings.diversityFactor) * 100).toFixed(0)}%
          </p>
        </div>

        {/* DC/AC Ratio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              DC/AC Ratio
            </Label>
            <span className="text-sm font-medium">{settings.dcAcRatio.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.dcAcRatio * 100]}
            onValueChange={([v]) => updateSetting("dcAcRatio", v / 100)}
            min={100}
            max={150}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Panel capacity relative to inverter capacity
          </p>
        </div>

        {/* System Losses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>System Losses</Label>
            <span className="text-sm font-medium">{(settings.systemLosses * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[settings.systemLosses * 100]}
            onValueChange={([v]) => updateSetting("systemLosses", v / 100)}
            min={5}
            max={25}
            step={1}
          />
        </div>

        {/* Power Factor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Power Factor</Label>
            <span className="text-sm font-medium">{settings.powerFactor.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.powerFactor * 100]}
            onValueChange={([v]) => updateSetting("powerFactor", v / 100)}
            min={80}
            max={100}
            step={1}
          />
        </div>

        {/* Temperature Derating */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <ThermometerSun className="h-4 w-4 text-muted-foreground" />
              Temperature Derating
            </Label>
            <span className="text-sm font-medium">{(settings.temperatureDerating * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[settings.temperatureDerating * 100]}
            onValueChange={([v]) => updateSetting("temperatureDerating", v / 100)}
            min={0}
            max={15}
            step={1}
          />
        </div>

        {/* Soiling Losses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Soiling Losses</Label>
            <span className="text-sm font-medium">{(settings.soilingLosses * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[settings.soilingLosses * 100]}
            onValueChange={([v]) => updateSetting("soilingLosses", v / 100)}
            min={0}
            max={10}
            step={1}
          />
        </div>

        {/* Cable Losses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Cable className="h-4 w-4 text-muted-foreground" />
              Cable Losses
            </Label>
            <span className="text-sm font-medium">{(settings.cableLosses * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[settings.cableLosses * 100]}
            onValueChange={([v]) => updateSetting("cableLosses", v / 100)}
            min={0}
            max={5}
            step={0.5}
          />
        </div>

        <Button variant="outline" onClick={handleReset} className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </CardContent>
    </Card>
  );
}
