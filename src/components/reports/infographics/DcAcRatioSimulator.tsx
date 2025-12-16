import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Sun, 
  Battery, 
  TrendingUp, 
  TrendingDown,
  Zap,
  AlertTriangle
} from "lucide-react";

interface DcAcRatioSimulatorProps {
  className?: string;
  acCapacityKw?: number;
  onRatioChange?: (ratio: number) => void;
}

// Power law model: clipping = 47.6 * (ratio - 1)^3.31
function calculateClipping(ratio: number): number {
  if (ratio <= 1.0) return 0;
  return 47.6 * Math.pow(ratio - 1, 3.31);
}

// Yield gain model based on research data
function calculateYieldGain(ratio: number): number {
  if (ratio <= 1.0) return 0;
  // Logarithmic growth that plateaus
  return Math.min(25, 15 * Math.log10(1 + (ratio - 1) * 5));
}

function calculateNetBenefit(ratio: number, hasBESS: boolean): number {
  const yieldGain = calculateYieldGain(ratio);
  const clipping = calculateClipping(ratio);
  // With BESS, 80% of clipped energy is stored
  const effectiveClipping = hasBESS ? clipping * 0.2 : clipping;
  return yieldGain - effectiveClipping;
}

export function DcAcRatioSimulator({ 
  className, 
  acCapacityKw = 100,
  onRatioChange 
}: DcAcRatioSimulatorProps) {
  const [ratio, setRatio] = useState(1.3);
  const [hasBESS, setHasBESS] = useState(false);
  const [region, setRegion] = useState<"high-sun" | "moderate" | "cloudy">("high-sun");

  const calculations = useMemo(() => {
    const dcCapacity = acCapacityKw * ratio;
    const clippingPercent = calculateClipping(ratio);
    const yieldGainPercent = calculateYieldGain(ratio);
    const netBenefit = calculateNetBenefit(ratio, hasBESS);
    
    // Annual yield estimates based on region
    const baseYield: Record<string, number> = {
      "high-sun": 1864,
      "moderate": 1600,
      "cloudy": 1100
    };
    
    const annualYieldKwh = dcCapacity * baseYield[region];
    const clippedEnergyKwh = annualYieldKwh * (clippingPercent / 100);
    const storedEnergyKwh = hasBESS ? clippedEnergyKwh * 0.8 : 0;
    const lostEnergyKwh = clippedEnergyKwh - storedEnergyKwh;
    const effectiveYieldKwh = annualYieldKwh - lostEnergyKwh;
    
    // ROI impact (simplified)
    const baselineYield = acCapacityKw * baseYield[region];
    const additionalYield = effectiveYieldKwh - baselineYield;
    const yieldImprovement = (additionalYield / baselineYield) * 100;

    return {
      dcCapacity,
      clippingPercent,
      yieldGainPercent,
      netBenefit,
      annualYieldKwh,
      clippedEnergyKwh,
      storedEnergyKwh,
      lostEnergyKwh,
      effectiveYieldKwh,
      yieldImprovement
    };
  }, [ratio, hasBESS, region, acCapacityKw]);

  const handleRatioChange = (value: number[]) => {
    const newRatio = value[0];
    setRatio(newRatio);
    onRatioChange?.(newRatio);
  };

  const getRecommendation = () => {
    const ranges: Record<string, [number, number]> = {
      "high-sun": [1.1, 1.35],
      "moderate": [1.2, 1.4],
      "cloudy": [1.3, 1.5]
    };
    const [min, max] = ranges[region];
    const bessMax = hasBESS ? 2.0 : max;
    
    if (ratio < min) return { status: "low", message: "Below optimal - underutilizing panels" };
    if (ratio > bessMax) return { status: "high", message: "Excessive - high clipping losses" };
    if (ratio >= min && ratio <= max) return { status: "optimal", message: "Within recommended range" };
    if (hasBESS && ratio > max && ratio <= 2.0) return { status: "bess-ok", message: "Justified with battery storage" };
    return { status: "caution", message: "Above typical range - monitor clipping" };
  };

  const recommendation = getRecommendation();

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <Sun className="h-5 w-5 text-amber-500" />
            DC/AC Ratio Simulator
          </div>
          <Badge 
            variant={recommendation.status === "optimal" || recommendation.status === "bess-ok" ? "default" : "secondary"}
            className={
              recommendation.status === "optimal" ? "bg-emerald-500" :
              recommendation.status === "bess-ok" ? "bg-blue-500" :
              recommendation.status === "high" ? "bg-red-500" :
              recommendation.status === "low" ? "bg-amber-500" : ""
            }
          >
            {recommendation.message}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">DC/AC Ratio</Label>
            <span className="text-2xl font-bold text-primary">{ratio.toFixed(2)}:1</span>
          </div>
          
          <div className="relative pt-2">
            {/* Optimal zone indicator */}
            <div 
              className="absolute h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full top-[18px]"
              style={{ 
                left: `${((region === "high-sun" ? 1.1 : region === "moderate" ? 1.2 : 1.3) - 1.0) / 1.0 * 100}%`,
                width: `${((region === "high-sun" ? 0.25 : region === "moderate" ? 0.2 : 0.2)) / 1.0 * 100}%`
              }}
            />
            <Slider
              value={[ratio]}
              onValueChange={handleRatioChange}
              min={1.0}
              max={2.0}
              step={0.05}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1.0:1</span>
              <span>1.25:1</span>
              <span>1.5:1</span>
              <span>1.75:1</span>
              <span>2.0:1</span>
            </div>
          </div>
        </div>

        {/* Configuration Toggles */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={hasBESS} onCheckedChange={setHasBESS} />
            <Label className="flex items-center gap-1 text-sm">
              <Battery className="h-4 w-4" />
              Battery Storage
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
              value={region}
              onChange={(e) => setRegion(e.target.value as typeof region)}
              className="text-sm border rounded-md px-2 py-1 bg-background"
            >
              <option value="high-sun">High-Sun (SA, 1864 kWh/kWp)</option>
              <option value="moderate">Moderate (1600 kWh/kWp)</option>
              <option value="cloudy">Cloudy (1100 kWh/kWp)</option>
            </select>
          </div>
        </div>

        {/* Real-time Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={<Zap className="h-4 w-4 text-amber-500" />}
            label="DC Capacity"
            value={`${calculations.dcCapacity.toFixed(0)} kW`}
            sublabel={`${acCapacityKw} kW AC`}
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            label="Yield Gain"
            value={`+${calculations.yieldGainPercent.toFixed(1)}%`}
            sublabel="vs 1.0:1 baseline"
            positive
          />
          <MetricCard
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            label="Clipping Loss"
            value={`${calculations.clippingPercent.toFixed(1)}%`}
            sublabel={`${(calculations.lostEnergyKwh / 1000).toFixed(1)} MWh/yr lost`}
            negative={calculations.clippingPercent > 5}
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            label="Net Benefit"
            value={`${calculations.netBenefit >= 0 ? "+" : ""}${calculations.netBenefit.toFixed(1)}%`}
            sublabel="Yield - Clipping"
            positive={calculations.netBenefit > 0}
            negative={calculations.netBenefit < 0}
          />
        </div>

        {/* Energy Flow Visualization */}
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Annual Energy Flow</p>
          <div className="space-y-2">
            <EnergyBar 
              label="Theoretical DC Output" 
              value={calculations.annualYieldKwh} 
              max={calculations.annualYieldKwh}
              color="bg-amber-500"
            />
            <EnergyBar 
              label="Effective AC Output" 
              value={calculations.effectiveYieldKwh} 
              max={calculations.annualYieldKwh}
              color="bg-emerald-500"
            />
            {hasBESS && calculations.storedEnergyKwh > 0 && (
              <EnergyBar 
                label="Stored in Battery" 
                value={calculations.storedEnergyKwh} 
                max={calculations.annualYieldKwh}
                color="bg-blue-500"
              />
            )}
            {calculations.lostEnergyKwh > 0 && (
              <EnergyBar 
                label="Clipping Losses" 
                value={calculations.lostEnergyKwh} 
                max={calculations.annualYieldKwh}
                color="bg-red-400"
              />
            )}
          </div>
        </div>

        {/* Daily Clipping Profile Visualization */}
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Typical Daily Profile (Peak Summer Day)</p>
          <DailyClippingChart ratio={ratio} acCapacity={acCapacityKw} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  sublabel, 
  positive, 
  negative 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  sublabel: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${positive ? "text-emerald-600" : negative ? "text-red-600" : ""}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{sublabel}</p>
    </div>
  );
}

function EnergyBar({ 
  label, 
  value, 
  max, 
  color 
}: { 
  label: string; 
  value: number; 
  max: number; 
  color: string;
}) {
  const percentage = (value / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-medium">{(value / 1000).toFixed(1)} MWh</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function DailyClippingChart({ ratio, acCapacity }: { ratio: number; acCapacity: number }) {
  const dcCapacity = acCapacity * ratio;
  
  // Simulated daily solar curve (bell curve peaking at noon)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const solarCurve = hours.map(h => {
    if (h < 5 || h > 19) return 0;
    // Bell curve centered at 12
    const x = (h - 12) / 4;
    return Math.exp(-x * x) * dcCapacity;
  });

  const maxValue = Math.max(...solarCurve, acCapacity);
  const barWidth = 100 / 24;

  return (
    <div className="relative h-32">
      {/* AC limit line */}
      <div 
        className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 z-10"
        style={{ bottom: `${(acCapacity / maxValue) * 100}%` }}
      >
        <span className="absolute right-0 -top-4 text-[10px] text-red-500 font-medium">
          AC Limit ({acCapacity} kW)
        </span>
      </div>
      
      {/* Bars */}
      <div className="absolute inset-0 flex items-end">
        {solarCurve.map((value, i) => {
          const isClipped = value > acCapacity;
          const displayHeight = Math.min(value, maxValue);
          const clippedHeight = isClipped ? value - acCapacity : 0;
          
          return (
            <div 
              key={i} 
              className="flex flex-col justify-end"
              style={{ width: `${barWidth}%`, height: "100%" }}
            >
              {isClipped && (
                <div 
                  className="bg-red-400/60 w-full"
                  style={{ height: `${(clippedHeight / maxValue) * 100}%` }}
                />
              )}
              <div 
                className="bg-amber-500 w-full"
                style={{ height: `${(Math.min(value, acCapacity) / maxValue) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      
      {/* Hour labels */}
      <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-[10px] text-muted-foreground">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}
