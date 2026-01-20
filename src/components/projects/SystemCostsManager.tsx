import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { DollarSign, Sun, Battery, Calculator, RotateCcw, TrendingUp, AlertCircle } from "lucide-react";
import { DEFAULT_SYSTEM_COSTS } from "./simulation/FinancialAnalysis";

export interface SystemCostsData {
  solarCostPerKwp: number;
  batteryCostPerKwh: number;
  solarMaintenancePercentage: number; // Percentage of solar cost (e.g., 3.5 = 3.5%)
  batteryMaintenancePercentage: number; // Percentage of battery cost (e.g., 1.5 = 1.5%)
  maintenancePerYear: number; // Calculated total Rand value
}

interface SystemCostsManagerProps {
  costs: SystemCostsData;
  onChange: (costs: SystemCostsData) => void;
  solarCapacity?: number;
  batteryCapacity?: number;
  includesBattery?: boolean; // Whether system includes battery storage
}

const COST_PRESETS = [
  {
    name: "Budget",
    description: "Entry-level components, basic installation",
    solarCostPerKwp: 8500,
    batteryCostPerKwh: 5500,
    solarMaintenancePercentage: 2.5,
    batteryMaintenancePercentage: 1.0,
  },
  {
    name: "Standard",
    description: "Quality Tier-1 panels, reputable brands",
    solarCostPerKwp: 11000,
    batteryCostPerKwh: 7500,
    solarMaintenancePercentage: 3.5,
    batteryMaintenancePercentage: 1.5,
  },
  {
    name: "Premium",
    description: "Top-tier equipment, extended warranties",
    solarCostPerKwp: 14000,
    batteryCostPerKwh: 9500,
    solarMaintenancePercentage: 4.0,
    batteryMaintenancePercentage: 2.0,
  },
  {
    name: "Commercial",
    description: "Large-scale C&I pricing",
    solarCostPerKwp: 9500,
    batteryCostPerKwh: 6500,
    solarMaintenancePercentage: 3.0,
    batteryMaintenancePercentage: 1.25,
  },
];

export function SystemCostsManager({ 
  costs, 
  onChange, 
  solarCapacity = 100, 
  batteryCapacity = 50,
  includesBattery = true
}: SystemCostsManagerProps) {
  const effectiveBatteryCapacity = includesBattery ? batteryCapacity : 0;
  
  // Calculate costs
  const solarCost = solarCapacity * costs.solarCostPerKwp;
  const batteryCost = effectiveBatteryCapacity * costs.batteryCostPerKwh;
  const totalSystemCost = solarCost + batteryCost;

  // Calculate maintenance from separate percentages
  const solarMaintenance = solarCost * (costs.solarMaintenancePercentage / 100);
  const batteryMaintenance = batteryCost * (costs.batteryMaintenancePercentage / 100);
  const totalMaintenancePerYear = solarMaintenance + batteryMaintenance;

  // Calculate effective O&M percentage (read-only)
  const effectiveOMPercentage = totalSystemCost > 0 
    ? (totalMaintenancePerYear / totalSystemCost) * 100 
    : 0;

  // Local state for percentage inputs
  const [solarPercentageInput, setSolarPercentageInput] = useState(costs.solarMaintenancePercentage.toString());
  const [batteryPercentageInput, setBatteryPercentageInput] = useState(costs.batteryMaintenancePercentage.toString());

  // Sync local inputs with props
  useEffect(() => {
    setSolarPercentageInput(costs.solarMaintenancePercentage.toString());
  }, [costs.solarMaintenancePercentage]);

  useEffect(() => {
    setBatteryPercentageInput(costs.batteryMaintenancePercentage.toString());
  }, [costs.batteryMaintenancePercentage]);

  // Auto-sync calculated maintenance to parent whenever inputs change
  useEffect(() => {
    if (Math.abs(costs.maintenancePerYear - totalMaintenancePerYear) > 0.01) {
      onChange({ ...costs, maintenancePerYear: totalMaintenancePerYear });
    }
  }, [totalMaintenancePerYear, costs, onChange]);

  const handleInputChange = (field: keyof SystemCostsData, value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange({ ...costs, [field]: numValue });
  };

  const handleSolarPercentageInputBlur = () => {
    const parsed = parseFloat(solarPercentageInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      onChange({ ...costs, solarMaintenancePercentage: parsed });
    } else {
      setSolarPercentageInput(costs.solarMaintenancePercentage.toString());
    }
  };

  const handleBatteryPercentageInputBlur = () => {
    const parsed = parseFloat(batteryPercentageInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      onChange({ ...costs, batteryMaintenancePercentage: parsed });
    } else {
      setBatteryPercentageInput(costs.batteryMaintenancePercentage.toString());
    }
  };

  const handleSolarPercentageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSolarPercentageInputBlur();
    } else if (e.key === "Escape") {
      setSolarPercentageInput(costs.solarMaintenancePercentage.toString());
    }
  };

  const handleBatteryPercentageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBatteryPercentageInputBlur();
    } else if (e.key === "Escape") {
      setBatteryPercentageInput(costs.batteryMaintenancePercentage.toString());
    }
  };

  const applyPreset = (preset: typeof COST_PRESETS[0]) => {
    onChange({
      solarCostPerKwp: preset.solarCostPerKwp,
      batteryCostPerKwh: preset.batteryCostPerKwh,
      solarMaintenancePercentage: preset.solarMaintenancePercentage,
      batteryMaintenancePercentage: preset.batteryMaintenancePercentage,
      maintenancePerYear: 0, // Will be recalculated
    });
  };

  const resetToDefaults = () => {
    onChange({
      solarCostPerKwp: DEFAULT_SYSTEM_COSTS.solarCostPerKwp,
      batteryCostPerKwh: DEFAULT_SYSTEM_COSTS.batteryCostPerKwh,
      solarMaintenancePercentage: DEFAULT_SYSTEM_COSTS.solarMaintenancePercentage ?? 3.5,
      batteryMaintenancePercentage: DEFAULT_SYSTEM_COSTS.batteryMaintenancePercentage ?? 1.5,
      maintenancePerYear: 0,
    });
  };

  const isCustom = !COST_PRESETS.some(
    p => 
      p.solarCostPerKwp === costs.solarCostPerKwp &&
      p.batteryCostPerKwh === costs.batteryCostPerKwh &&
      p.solarMaintenancePercentage === costs.solarMaintenancePercentage &&
      p.batteryMaintenancePercentage === costs.batteryMaintenancePercentage
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          System Cost Configuration
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure installation costs for accurate payback and ROI calculations
        </p>
      </div>

      {/* Cost Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Presets</CardTitle>
          <CardDescription className="text-xs">
            Select a pricing tier based on your project requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {COST_PRESETS.map((preset) => {
              const isActive = 
                preset.solarCostPerKwp === costs.solarCostPerKwp &&
                preset.batteryCostPerKwh === costs.batteryCostPerKwh &&
                preset.solarMaintenancePercentage === costs.solarMaintenancePercentage &&
                preset.batteryMaintenancePercentage === costs.batteryMaintenancePercentage;

              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    isActive 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{preset.name}</span>
                    {isActive && <Badge variant="default" className="text-xs">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{preset.description}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Solar</span>
                      <span>R{preset.solarCostPerKwp.toLocaleString()}/kWp</span>
                    </div>
                    {includesBattery && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Battery</span>
                        <span>R{preset.batteryCostPerKwh.toLocaleString()}/kWh</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {isCustom && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Custom values configured</span>
              <Button variant="ghost" size="sm" onClick={resetToDefaults} className="ml-auto">
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Cost Inputs */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Solar Costs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              Solar PV Costs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Cost per kWp Installed</Label>
                <span className="text-xs text-muted-foreground">
                  R{costs.solarCostPerKwp.toLocaleString()}
                </span>
              </div>
              <Slider
                value={[costs.solarCostPerKwp]}
                onValueChange={([v]) => onChange({ ...costs, solarCostPerKwp: v })}
                min={5000}
                max={20000}
                step={500}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>R5,000</span>
                <span>R20,000</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Or enter exact value</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">R</span>
                <Input
                  type="number"
                  value={costs.solarCostPerKwp}
                  onChange={(e) => handleInputChange("solarCostPerKwp", e.target.value)}
                  className="h-9"
                  min={0}
                  step={100}
                />
                <span className="text-muted-foreground text-sm">/kWp</span>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Solar total ({solarCapacity} kWp)</span>
                <span className="font-medium">R{solarCost.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Battery Costs - Only shown if system includes battery */}
        {includesBattery && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Battery className="h-4 w-4 text-green-500" />
                Battery Storage Costs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Cost per kWh Capacity</Label>
                  <span className="text-xs text-muted-foreground">
                    R{costs.batteryCostPerKwh.toLocaleString()}
                  </span>
                </div>
                <Slider
                  value={[costs.batteryCostPerKwh]}
                  onValueChange={([v]) => onChange({ ...costs, batteryCostPerKwh: v })}
                  min={3000}
                  max={15000}
                  step={500}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>R3,000</span>
                  <span>R15,000</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Or enter exact value</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">R</span>
                  <Input
                    type="number"
                    value={costs.batteryCostPerKwh}
                    onChange={(e) => handleInputChange("batteryCostPerKwh", e.target.value)}
                    className="h-9"
                    min={0}
                    step={100}
                  />
                  <span className="text-muted-foreground text-sm">/kWh</span>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Battery total ({batteryCapacity} kWh)</span>
                  <span className="font-medium">R{batteryCost.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Annual Maintenance - Split Solar & Battery O&M */}
        <Card className={includesBattery ? "md:col-span-2" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Annual Maintenance (O&M)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid gap-6 ${includesBattery ? "md:grid-cols-2" : ""}`}>
              {/* Solar PV O&M */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Solar PV O&M</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Percentage of Solar Cost</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={solarPercentageInput}
                        onChange={(e) => setSolarPercentageInput(e.target.value)}
                        onBlur={handleSolarPercentageInputBlur}
                        onKeyDown={handleSolarPercentageKeyDown}
                        className="h-6 w-14 text-xs text-right px-2"
                        min={0}
                        max={10}
                        step={0.1}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[costs.solarMaintenancePercentage]}
                    onValueChange={([v]) => onChange({ ...costs, solarMaintenancePercentage: v })}
                    min={0}
                    max={10}
                    step={0.1}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>5%</span>
                    <span>10%</span>
                  </div>
                </div>
                <div className="pt-2 px-3 py-2 bg-muted/30 rounded-md">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Annual Cost</span>
                    <span className="font-medium">R{solarMaintenance.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {costs.solarMaintenancePercentage}% of R{solarCost.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Battery O&M - Only shown if system includes battery */}
              {includesBattery && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Battery className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Battery O&M</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Percentage of Battery Cost</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={batteryPercentageInput}
                          onChange={(e) => setBatteryPercentageInput(e.target.value)}
                          onBlur={handleBatteryPercentageInputBlur}
                          onKeyDown={handleBatteryPercentageKeyDown}
                          className="h-6 w-14 text-xs text-right px-2"
                          min={0}
                          max={10}
                          step={0.1}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Slider
                      value={[costs.batteryMaintenancePercentage]}
                      onValueChange={([v]) => onChange({ ...costs, batteryMaintenancePercentage: v })}
                      min={0}
                      max={10}
                      step={0.1}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0%</span>
                      <span>5%</span>
                      <span>10%</span>
                    </div>
                  </div>
                  <div className="pt-2 px-3 py-2 bg-muted/30 rounded-md">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Annual Cost</span>
                      <span className="font-medium">R{batteryMaintenance.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {costs.batteryMaintenancePercentage}% of R{batteryCost.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Total O&M Summary */}
            <div className="pt-4 border-t bg-primary/5 -mx-6 px-6 -mb-6 pb-4 rounded-b-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Total Annual O&M</span>
                <span className="font-bold text-lg">
                  R{totalMaintenancePerYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Effective O&M Rate</span>
                <span className="text-sm font-medium text-primary">
                  {effectiveOMPercentage.toFixed(2)}% of total project
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Formula: (Solar × {costs.solarMaintenancePercentage}%){includesBattery ? ` + (Battery × ${costs.batteryMaintenancePercentage}%)` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total System Cost</p>
                <p className="text-2xl font-bold">R{totalSystemCost.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-right space-y-1 text-sm">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Solar ({solarCapacity} kWp)</span>
                <span>R{solarCost.toLocaleString()}</span>
              </div>
              {includesBattery && (
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Battery ({batteryCapacity} kWh)</span>
                  <span>R{batteryCost.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between gap-8 pt-1 border-t">
                <span className="text-muted-foreground">Annual O&M ({effectiveOMPercentage.toFixed(2)}%)</span>
                <span>R{totalMaintenancePerYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
