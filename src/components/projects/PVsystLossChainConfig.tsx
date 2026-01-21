import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronDown, 
  Sun, 
  Thermometer, 
  Zap, 
  RotateCcw, 
  Info,
  CloudRain,
  Layers,
  Cable,
  Activity
} from "lucide-react";
import { 
  type PVsystLossChainConfig as ConfigType, 
  DEFAULT_PVSYST_CONFIG,
  calculatePVsystLossChain 
} from "@/lib/pvsystLossChain";
import { LossWaterfallChart } from "./LossWaterfallChart";
import { DegradationProjection } from "./DegradationProjection";

interface PVsystLossChainConfigProps {
  config: ConfigType;
  onChange: (config: ConfigType) => void;
  dailyGHI: number;        // kWh/m²/day
  capacityKwp: number;
  ambientTemp?: number;    // Average ambient temperature °C
  className?: string;
}

// Helper for slider with info tooltip
function LossSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.1,
  suffix = "%",
  description,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1">
          {label}
          {description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Label>
        <span className="text-xs font-medium text-muted-foreground">
          {value.toFixed(1)}{suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="py-1"
      />
    </div>
  );
}

export function PVsystLossChainConfig({
  config,
  onChange,
  dailyGHI,
  capacityKwp,
  ambientTemp = 25,
  className,
}: PVsystLossChainConfigProps) {
  const [showIrradiance, setShowIrradiance] = useState(true);
  const [showArray, setShowArray] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [showDegradation, setShowDegradation] = useState(false);

  // Calculate results in real-time
  const result = calculatePVsystLossChain(dailyGHI, capacityKwp, ambientTemp, config);

  // Update helper functions
  const updateIrradiance = (key: keyof ConfigType["irradiance"], value: number) => {
    onChange({
      ...config,
      irradiance: { ...config.irradiance, [key]: value },
    });
  };

  const updateArray = (key: keyof ConfigType["array"], value: number) => {
    onChange({
      ...config,
      array: { ...config.array, [key]: value },
    });
  };

  const updateSystem = (key: keyof ConfigType["system"], value: number) => {
    onChange({
      ...config,
      system: { ...config.system, [key]: value },
    });
  };

  const resetToDefaults = () => {
    onChange(DEFAULT_PVSYST_CONFIG);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">PVsyst Loss Chain</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={result.performanceRatio >= 75 ? "default" : "secondary"}
              className="text-xs"
            >
              PR: {result.performanceRatio.toFixed(1)}%
            </Badge>
            <Button variant="ghost" size="sm" onClick={resetToDefaults} className="h-7 px-2">
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Configure detailed loss factors matching PVsyst methodology
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics Summary */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold text-primary">{result.performanceRatio.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">PR</div>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold">{result.eGrid.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">kWh/day</div>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold">{result.specificYield.toFixed(0)}</div>
            <div className="text-[10px] text-muted-foreground">kWh/kWp/yr</div>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold text-amber-600">-{result.totalLossPercent.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">Total Loss</div>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-3">
          <Label className="text-xs">Operation Year:</Label>
          <Select
            value={config.operationYear.toString()}
            onValueChange={(v) => onChange({ ...config, operationYear: parseInt(v) })}
          >
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 25 }, (_, i) => i + 1).map((year) => (
                <SelectItem key={year} value={year.toString()} className="text-xs">
                  Year {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Degradation: -{result.cumulativeDegradation.toFixed(1)}%
          </span>
        </div>

        {/* Irradiance Losses */}
        <Collapsible open={showIrradiance} onOpenChange={setShowIrradiance}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded-lg px-2">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              Irradiance Losses
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                -{(config.irradiance.shadingLoss + config.irradiance.iamLoss + config.irradiance.soilingLoss).toFixed(1)}%
              </Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${showIrradiance ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3 px-2">
            {/* 1. Global incident in coll. plane (Transposition Factor) */}
            <LossSlider
              label="Global incident in coll. plane"
              value={config.transpositionFactor}
              onChange={(v) => onChange({ ...config, transpositionFactor: v })}
              min={0.9}
              max={1.3}
              step={0.01}
              suffix="x"
              description="POA irradiance gain from tilted surface (typically 1.05-1.15 for SA)"
            />
            {/* 2. Near Shadings: irradiance loss */}
            <LossSlider
              label="Near Shadings: irradiance loss"
              value={config.irradiance.shadingLoss}
              onChange={(v) => updateIrradiance("shadingLoss", v)}
              max={15}
              description="Near shading from surrounding objects, horizon, and module self-shading"
            />
            {/* 3. IAM factor on global */}
            <LossSlider
              label="IAM factor on global"
              value={config.irradiance.iamLoss}
              onChange={(v) => updateIrradiance("iamLoss", v)}
              max={5}
              description="Incidence Angle Modifier - reflection losses at high angles"
            />
            {/* 4. Soiling loss factor */}
            <LossSlider
              label="Soiling loss factor"
              value={config.irradiance.soilingLoss}
              onChange={(v) => updateIrradiance("soilingLoss", v)}
              max={10}
              description="Dust, dirt, and debris accumulation on modules"
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Array Losses */}
        <Collapsible open={showArray} onOpenChange={setShowArray}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded-lg px-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" />
              Array Losses
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                -{(result.cumulativeDegradation + config.array.irradianceLevelLoss + result.temperatureLoss + config.irradiance.spectralLoss + config.irradiance.shadingLoss + config.array.moduleQualityLoss + config.array.lidLoss + config.array.mismatchLoss + config.array.ohmicLoss).toFixed(1)}%
              </Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${showArray ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3 px-2">
            {/* 1. Module Degradation Loss (for year #X) - DISPLAY ONLY */}
            <div className="p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span>Module Degradation Loss (for year #{config.operationYear})</span>
                <Badge variant="secondary">{result.cumulativeDegradation.toFixed(2)}%</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                LID ({config.array.lidLoss}%) + {Math.max(0, config.operationYear - 1)} × {config.array.annualDegradation}%/yr
              </div>
            </div>
            
            {/* 2. PV loss due to irradiance level */}
            <LossSlider
              label="PV loss due to irradiance level"
              value={config.array.irradianceLevelLoss}
              onChange={(v) => updateArray("irradianceLevelLoss", v)}
              max={3}
              step={0.1}
              description="Low-light efficiency losses (typically 0.5-1.5%)"
            />
            
            {/* 3. PV loss due to temperature - DISPLAY ONLY */}
            <div className="p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  PV loss due to temperature
                </span>
                <Badge variant={result.temperatureLoss > 8 ? "destructive" : "secondary"}>
                  {result.temperatureLoss.toFixed(2)}%
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Calculated from Tcell × {Math.abs(config.cellTempCoefficient)}%/°C (ambient: {ambientTemp}°C)
              </div>
            </div>
            <LossSlider
              label="Temp Coefficient"
              value={Math.abs(config.cellTempCoefficient)}
              onChange={(v) => onChange({ ...config, cellTempCoefficient: -v })}
              min={0.2}
              max={0.6}
              step={0.01}
              suffix="%/°C"
              description="Power temperature coefficient (typically -0.35 to -0.45 for mono-Si)"
            />
            <LossSlider
              label="NOCT"
              value={config.noct}
              onChange={(v) => onChange({ ...config, noct: v })}
              min={40}
              max={55}
              step={1}
              suffix="°C"
              description="Nominal Operating Cell Temperature (typically 44-47°C)"
            />
            
            {/* 4. Spectral correction */}
            <LossSlider
              label="Spectral correction"
              value={config.irradiance.spectralLoss}
              onChange={(v) => updateIrradiance("spectralLoss", v)}
              max={2}
              step={0.1}
              description="Spectral mismatch between actual and STC spectrum"
            />
            
            {/* 5. Shadings: Electrical Loss detailed module calc. */}
            <LossSlider
              label="Shadings: Electrical Loss detailed module calc."
              value={config.irradiance.shadingLoss}
              onChange={(v) => updateIrradiance("shadingLoss", v)}
              max={10}
              description="Electrical losses from partial shading on module strings"
            />
            
            {/* 6. Module quality loss */}
            <LossSlider
              label="Module quality loss"
              value={config.array.moduleQualityLoss}
              onChange={(v) => updateArray("moduleQualityLoss", v)}
              max={3}
              step={0.1}
              description="Manufacturer power tolerance and binning (typically 0-1%)"
            />
            
            {/* 7. LID - Light induced degradation */}
            <LossSlider
              label="LID - Light induced degradation"
              value={config.array.lidLoss}
              onChange={(v) => updateArray("lidLoss", v)}
              max={5}
              description="First-year light-induced degradation (typically 1-3%)"
            />
            
            {/* 8. Module array mismatch loss */}
            <LossSlider
              label="Module array mismatch loss"
              value={config.array.mismatchLoss}
              onChange={(v) => updateArray("mismatchLoss", v)}
              max={8}
              description="Including 1.7% for degradation dispersion"
            />
            
            {/* 9. Ohmic wiring loss */}
            <LossSlider
              label="Ohmic wiring loss"
              value={config.array.ohmicLoss}
              onChange={(v) => updateArray("ohmicLoss", v)}
              max={5}
              description="DC cable and connection losses"
            />
          </CollapsibleContent>
        </Collapsible>

        {/* System Losses */}
        <Collapsible open={showSystem} onOpenChange={setShowSystem}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded-lg px-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              System Losses
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                -{(config.system.inverterLoss + config.system.acWiringLoss + config.system.transformerLoss + config.system.availabilityLoss).toFixed(1)}%
              </Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${showSystem ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3 px-2">
            <LossSlider
              label="Inverter Loss"
              value={config.system.inverterLoss}
              onChange={(v) => updateSystem("inverterLoss", v)}
              max={5}
              description="Inverter conversion efficiency loss (typically 1-3%)"
            />
            <LossSlider
              label="AC Wiring Loss"
              value={config.system.acWiringLoss}
              onChange={(v) => updateSystem("acWiringLoss", v)}
              max={3}
              description="AC cable and connection losses"
            />
            <LossSlider
              label="Transformer Loss"
              value={config.system.transformerLoss}
              onChange={(v) => updateSystem("transformerLoss", v)}
              max={3}
              description="MV transformer losses (if applicable)"
            />
            <LossSlider
              label="Availability Loss"
              value={config.system.availabilityLoss}
              onChange={(v) => updateSystem("availabilityLoss", v)}
              max={5}
              description="Downtime for maintenance, faults, and grid outages"
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Loss Waterfall Chart */}
        <LossWaterfallChart
          breakdown={result.lossBreakdown}
          performanceRatio={result.performanceRatio}
        />

        {/* 25-Year Projection */}
        <Collapsible open={showDegradation} onOpenChange={setShowDegradation}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded-lg px-2">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-muted-foreground" />
              25-Year Projection
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${showDegradation ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <DegradationProjection
              dailyGHI={dailyGHI}
              capacityKwp={capacityKwp}
              ambientTemp={ambientTemp}
              config={config}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
