import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { X, Sun, Battery, Percent } from "lucide-react";

export interface ScenarioConfig {
  solarCapacity: number;
  batteryCapacity: number;
  dcAcRatio: number;
}

export interface ScenarioResults {
  annualGeneration: number;
  selfConsumption: number;
  gridImport: number;
  gridExport: number;
  annualSavings: number;
  paybackYears: number;
  systemCost: number;
}

interface ScenarioCardProps {
  id: "A" | "B" | "C";
  config: ScenarioConfig;
  results?: ScenarioResults;
  onConfigChange: (config: ScenarioConfig) => void;
  onRemove?: () => void;
  isActive?: boolean;
}

const SCENARIO_COLORS = {
  A: "bg-blue-500/10 border-blue-500/30",
  B: "bg-amber-500/10 border-amber-500/30",
  C: "bg-green-500/10 border-green-500/30",
};

const SCENARIO_BADGES = {
  A: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  B: "bg-amber-500/20 text-amber-700 border-amber-500/30",
  C: "bg-green-500/20 text-green-700 border-green-500/30",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ScenarioCard({
  id,
  config,
  results,
  onConfigChange,
  onRemove,
  isActive = true,
}: ScenarioCardProps) {
  return (
    <Card className={`relative border-2 border-dashed ${SCENARIO_COLORS[id]} transition-all`}>
      {/* Draft Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
        <span className="text-6xl font-bold rotate-[-20deg]">DRAFT</span>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={SCENARIO_BADGES[id]}>
              Scenario {id}
            </Badge>
          </div>
          {onRemove && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Solar Capacity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <Label className="text-sm">Solar Capacity</Label>
            </div>
            <span className="text-sm font-medium">{config.solarCapacity} kWp</span>
          </div>
          <Slider
            value={[config.solarCapacity]}
            onValueChange={([value]) => onConfigChange({ ...config, solarCapacity: value })}
            min={10}
            max={2000}
            step={10}
          />
        </div>

        {/* Battery Capacity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Battery className="h-4 w-4 text-green-500" />
              <Label className="text-sm">Battery Storage</Label>
            </div>
            <span className="text-sm font-medium">{config.batteryCapacity} kWh</span>
          </div>
          <Slider
            value={[config.batteryCapacity]}
            onValueChange={([value]) => onConfigChange({ ...config, batteryCapacity: value })}
            min={0}
            max={1000}
            step={10}
          />
        </div>

        {/* DC/AC Ratio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-blue-500" />
              <Label className="text-sm">DC/AC Ratio</Label>
            </div>
            <span className="text-sm font-medium">{(config.dcAcRatio * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[config.dcAcRatio * 100]}
            onValueChange={([value]) => onConfigChange({ ...config, dcAcRatio: value / 100 })}
            min={100}
            max={150}
            step={5}
          />
        </div>

        {/* Results (if calculated) */}
        {results && (
          <div className="pt-3 border-t border-dashed space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Annual Gen.</p>
                <p className="font-semibold">{formatNumber(results.annualGeneration)} kWh</p>
              </div>
              <div>
                <p className="text-muted-foreground">Self-Consumed</p>
                <p className="font-semibold">{formatNumber(results.selfConsumption)} kWh</p>
              </div>
              <div>
                <p className="text-muted-foreground">Annual Savings</p>
                <p className="font-semibold text-green-600">{formatCurrency(results.annualSavings)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payback</p>
                <p className="font-semibold">{results.paybackYears.toFixed(1)} years</p>
              </div>
            </div>
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">System Cost</p>
              <p className="text-lg font-bold">{formatCurrency(results.systemCost)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
