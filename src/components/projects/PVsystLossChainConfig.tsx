import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronDown, 
  ChevronUp,
  Sun, 
  Thermometer, 
  Zap, 
  RotateCcw, 
  Info,
  CloudRain,
  Layers,
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
  step = 0.01,
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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toFixed(4));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    } else {
      setEditValue(value.toFixed(4));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(value.toFixed(4));
    }
  };

  const handleClick = () => {
    setEditValue(value.toFixed(4));
    setIsEditing(true);
  };

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
        {isEditing ? (
          <Input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-5 w-20 text-xs text-right px-1 py-0"
            step={0.0001}
            min={min}
            max={max}
          />
        ) : (
          <span
            className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary hover:underline"
            onClick={handleClick}
            title="Click to edit"
          >
            {value.toFixed(4)}{suffix}
          </span>
        )}
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
  const [isOpen, setIsOpen] = useState(false);
  const [showIrradiance, setShowIrradiance] = useState(false);
  const [showArray, setShowArray] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [showAfterInverter, setShowAfterInverter] = useState(false);
  const [showDegradation, setShowDegradation] = useState(false);

  // Calculate results in real-time
  const result = calculatePVsystLossChain(dailyGHI, capacityKwp, ambientTemp, config);

  // Calculate total inverter loss for display
  const totalInverterLoss = 
    config.system.inverter.operationEfficiency +
    config.system.inverter.overNominalPower +
    config.system.inverter.maxInputCurrent +
    config.system.inverter.overNominalVoltage +
    config.system.inverter.powerThreshold +
    config.system.inverter.voltageThreshold +
    config.system.inverter.nightConsumption;

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

  const updateInverter = (key: keyof ConfigType["system"]["inverter"], value: number) => {
    onChange({
      ...config,
      system: { 
        ...config.system, 
        inverter: { ...config.system.inverter, [key]: value } 
      },
    });
  };

  const updateAfterInverter = (key: keyof ConfigType["lossesAfterInverter"], value: number) => {
    onChange({
      ...config,
      lossesAfterInverter: { ...config.lossesAfterInverter, [key]: value },
    });
  };

  const resetToDefaults = () => {
    onChange(DEFAULT_PVSYST_CONFIG);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border-dashed ${className || ''}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">PVsyst Loss Chain</CardTitle>
                <Badge 
                  variant={result.performanceRatio >= 75 ? "default" : "secondary"}
                  className="text-xs"
                >
                  PR: {result.performanceRatio.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); resetToDefaults(); }} 
                  className="h-7 px-2"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
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
                -{(config.irradiance.nearShadingLoss + config.irradiance.iamLoss + config.irradiance.soilingLoss).toFixed(1)}%
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
              value={config.irradiance.nearShadingLoss}
              onChange={(v) => updateIrradiance("nearShadingLoss", v)}
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
                -{(result.cumulativeDegradation + config.array.irradianceLevelLoss + config.array.temperatureLoss + config.irradiance.spectralLoss + config.irradiance.electricalShadingLoss + config.array.moduleQualityLoss + config.array.lidLoss + config.array.mismatchLoss + config.array.ohmicLoss).toFixed(1)}%
              </Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${showArray ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3 px-2">
            {/* 1. Module Degradation Loss (for year #X) */}
            <LossSlider
              label={`Module Degradation Loss (for year #${config.operationYear})`}
              value={config.array.annualDegradation}
              onChange={(v) => updateArray("annualDegradation", v)}
              max={2}
              step={0.01}
              suffix="%/yr"
              description={`Annual degradation rate. Total cumulative: ${result.cumulativeDegradation.toFixed(2)}% (LID ${config.array.lidLoss}% + ${Math.max(0, config.operationYear - 1)} × ${config.array.annualDegradation}%/yr)`}
            />
            
            {/* 2. PV loss due to irradiance level */}
            <LossSlider
              label="PV loss due to irradiance level"
              value={config.array.irradianceLevelLoss}
              onChange={(v) => updateArray("irradianceLevelLoss", v)}
              max={3}
              step={0.1}
              description="Low-light efficiency losses (typically 0.5-1.5%)"
            />
            
            {/* 3. PV loss due to temperature */}
            <LossSlider
              label="PV loss due to temperature"
              value={config.array.temperatureLoss}
              onChange={(v) => updateArray("temperatureLoss", v)}
              max={20}
              step={0.01}
              description="Temperature-induced power loss (typically 5-15% depending on climate)"
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
              value={config.irradiance.electricalShadingLoss}
              onChange={(v) => updateIrradiance("electricalShadingLoss", v)}
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
              <Zap className="h-4 w-4 text-primary" />
              System Losses
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                -{totalInverterLoss.toFixed(1)}%
              </Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${showSystem ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3 px-2">
            <LossSlider
              label="Inverter Loss during operation (efficiency)"
              value={config.system.inverter.operationEfficiency}
              onChange={(v) => updateInverter("operationEfficiency", v)}
              max={5}
              description="Inverter conversion efficiency loss (typically 1-3%)"
            />
            <LossSlider
              label="Inverter Loss over nominal inv. power"
              value={config.system.inverter.overNominalPower}
              onChange={(v) => updateInverter("overNominalPower", v)}
              max={2}
              description="Losses when inverter operates above nominal power"
            />
            <LossSlider
              label="Inverter Loss due to max. input current"
              value={config.system.inverter.maxInputCurrent}
              onChange={(v) => updateInverter("maxInputCurrent", v)}
              max={2}
              description="Losses when input current exceeds inverter limits"
            />
            <LossSlider
              label="Inverter Loss over nominal inv. voltage"
              value={config.system.inverter.overNominalVoltage}
              onChange={(v) => updateInverter("overNominalVoltage", v)}
              max={2}
              description="Losses when voltage exceeds inverter nominal range"
            />
            <LossSlider
              label="Inverter Loss due to power threshold"
              value={config.system.inverter.powerThreshold}
              onChange={(v) => updateInverter("powerThreshold", v)}
              max={2}
              description="Losses at low power levels below operating threshold"
            />
            <LossSlider
              label="Inverter Loss due to voltage threshold"
              value={config.system.inverter.voltageThreshold}
              onChange={(v) => updateInverter("voltageThreshold", v)}
              max={2}
              description="Losses when voltage is below operating threshold"
            />
            <LossSlider
              label="Night consumption"
              value={config.system.inverter.nightConsumption}
              onChange={(v) => updateInverter("nightConsumption", v)}
              max={1}
              description="Standby power consumption during non-production hours"
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Losses after the inverter */}
        <Collapsible open={showAfterInverter} onOpenChange={setShowAfterInverter}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded-lg px-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Losses after the inverter
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                -{config.lossesAfterInverter.availabilityLoss.toFixed(1)}%
              </Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAfterInverter ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3 px-2">
            <LossSlider
              label="System unavailability"
              value={config.lossesAfterInverter.availabilityLoss}
              onChange={(v) => updateAfterInverter("availabilityLoss", v)}
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
