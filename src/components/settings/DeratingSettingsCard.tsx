import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Zap, Sun, ThermometerSun, Cable, CheckCircle2, TrendingDown } from "lucide-react";
import { useDeratingSettings } from "@/hooks/useDeratingSettings";
import { toast } from "sonner";

export function DeratingSettingsCard() {
  const { settings, updateSetting, resetToDefaults, getCombinedDeratingFactor } = useDeratingSettings();

  const handleReset = () => {
    resetToDefaults();
    toast.success("Derating settings reset to defaults");
  };

  const combinedFactor = getCombinedDeratingFactor();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Zap className="h-5 w-5" />
              PV System Derating
            </CardTitle>
            <CardDescription>
              Applied to solar simulations over the plant lifespan
            </CardDescription>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Auto-saved
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Combined Factor Display */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Combined Derating Factor
            </p>
            <span className="text-xl font-bold text-primary">{(combinedFactor * 100).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Effective solar output after all losses: {(combinedFactor * 100).toFixed(1)}% of rated capacity
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

        {/* Annual Degradation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Annual Degradation
            </Label>
            <span className="text-sm font-medium">{(settings.annualDegradation * 100).toFixed(1)}%/yr</span>
          </div>
          <Slider
            value={[settings.annualDegradation * 1000]}
            onValueChange={([v]) => updateSetting("annualDegradation", v / 1000)}
            min={3}
            max={10}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Panel efficiency loss per year (typically 0.4-0.7%)
          </p>
        </div>

        <Button variant="outline" onClick={handleReset} className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>

        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-xs text-primary font-medium">
            ✓ Settings are automatically saved and applied as defaults for all new project simulations
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
