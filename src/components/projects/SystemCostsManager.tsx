import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { DollarSign, Sun, Battery, Calculator, RotateCcw, TrendingUp, AlertCircle, Percent } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_SYSTEM_COSTS } from "./simulation/FinancialAnalysis";

export interface SystemCostsData {
  solarCostPerKwp: number;
  batteryCostPerKwh: number;
  solarMaintenancePercentage: number; // Percentage of solar cost (e.g., 3.5 = 3.5%)
  batteryMaintenancePercentage: number; // Percentage of battery cost (e.g., 1.5 = 1.5%)
  maintenancePerYear: number; // Calculated total Rand value
  
  // Financial Return Parameters
  costOfCapital: number;           // % - General WACC
  cpi: number;                     // % - Inflation
  electricityInflation: number;    // % - Tariff escalation
  projectDurationYears: number;    // years
  lcoeDiscountRate: number;        // % - NPV discount rate (Cost of Capital for LCOE calc)
  mirrFinanceRate: number;         // % - Interest paid on money used in cash flows
  mirrReinvestmentRate: number;    // % - Interest received on cash flows as reinvested
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

  // State for inline editing of solar cost per kWp
  const [isEditingSolarCost, setIsEditingSolarCost] = useState(false);
  const [solarCostEditValue, setSolarCostEditValue] = useState("");
  const solarCostInputRef = useRef<HTMLInputElement>(null);

  // State for inline editing of battery cost per kWh
  const [isEditingBatteryCost, setIsEditingBatteryCost] = useState(false);
  const [batteryCostEditValue, setBatteryCostEditValue] = useState("");
  const batteryCostInputRef = useRef<HTMLInputElement>(null);

  // Sync local inputs with props
  useEffect(() => {
    setSolarPercentageInput(costs.solarMaintenancePercentage.toString());
  }, [costs.solarMaintenancePercentage]);

  useEffect(() => {
    setBatteryPercentageInput(costs.batteryMaintenancePercentage.toString());
  }, [costs.batteryMaintenancePercentage]);

  // Auto-focus for inline cost editing
  useEffect(() => {
    if (isEditingSolarCost && solarCostInputRef.current) {
      solarCostInputRef.current.focus();
      solarCostInputRef.current.select();
    }
  }, [isEditingSolarCost]);

  useEffect(() => {
    if (isEditingBatteryCost && batteryCostInputRef.current) {
      batteryCostInputRef.current.focus();
      batteryCostInputRef.current.select();
    }
  }, [isEditingBatteryCost]);

  // Auto-sync calculated maintenance to parent whenever inputs change
  useEffect(() => {
    if (Math.abs(costs.maintenancePerYear - totalMaintenancePerYear) > 0.01) {
      onChange({ ...costs, maintenancePerYear: totalMaintenancePerYear });
    }
  }, [totalMaintenancePerYear, costs, onChange]);

  // Handlers for inline solar cost editing
  const handleSolarCostClick = () => {
    setSolarCostEditValue(costs.solarCostPerKwp.toString());
    setIsEditingSolarCost(true);
  };

  const handleSolarCostBlur = () => {
    setIsEditingSolarCost(false);
    const parsed = parseFloat(solarCostEditValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange({ ...costs, solarCostPerKwp: parsed });
    }
  };

  const handleSolarCostKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSolarCostBlur();
    } else if (e.key === "Escape") {
      setIsEditingSolarCost(false);
    }
  };

  // Handlers for inline battery cost editing
  const handleBatteryCostClick = () => {
    setBatteryCostEditValue(costs.batteryCostPerKwh.toString());
    setIsEditingBatteryCost(true);
  };

  const handleBatteryCostBlur = () => {
    setIsEditingBatteryCost(false);
    const parsed = parseFloat(batteryCostEditValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange({ ...costs, batteryCostPerKwh: parsed });
    }
  };

  const handleBatteryCostKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBatteryCostBlur();
    } else if (e.key === "Escape") {
      setIsEditingBatteryCost(false);
    }
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
      ...costs, // Preserve financial parameters
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
      // Financial Return Parameters
      costOfCapital: DEFAULT_SYSTEM_COSTS.costOfCapital ?? 9.0,
      cpi: DEFAULT_SYSTEM_COSTS.cpi ?? 6.0,
      electricityInflation: DEFAULT_SYSTEM_COSTS.electricityInflation ?? 10.0,
      projectDurationYears: DEFAULT_SYSTEM_COSTS.projectDurationYears ?? 20,
      lcoeDiscountRate: DEFAULT_SYSTEM_COSTS.lcoeDiscountRate ?? 9.0,
      mirrFinanceRate: DEFAULT_SYSTEM_COSTS.mirrFinanceRate ?? 9.0,
      mirrReinvestmentRate: DEFAULT_SYSTEM_COSTS.mirrReinvestmentRate ?? 10.0,
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
              <div className="flex justify-between items-center">
                <Label className="text-xs">Cost per kWp Installed</Label>
                {isEditingSolarCost ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input
                      ref={solarCostInputRef}
                      type="number"
                      value={solarCostEditValue}
                      onChange={(e) => setSolarCostEditValue(e.target.value)}
                      onBlur={handleSolarCostBlur}
                      onKeyDown={handleSolarCostKeyDown}
                      className="h-6 w-20 text-xs text-right px-2"
                      min={0}
                      step={100}
                    />
                  </div>
                ) : (
                  <span 
                    className="text-xs text-muted-foreground cursor-pointer hover:underline hover:text-foreground"
                    onClick={handleSolarCostClick}
                    title="Click to edit"
                  >
                    R{costs.solarCostPerKwp.toLocaleString()}
                  </span>
                )}
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
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Cost per kWh Capacity</Label>
                  {isEditingBatteryCost ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">R</span>
                      <Input
                        ref={batteryCostInputRef}
                        type="number"
                        value={batteryCostEditValue}
                        onChange={(e) => setBatteryCostEditValue(e.target.value)}
                        onBlur={handleBatteryCostBlur}
                        onKeyDown={handleBatteryCostKeyDown}
                        className="h-6 w-20 text-xs text-right px-2"
                        min={0}
                        step={100}
                      />
                    </div>
                  ) : (
                    <span 
                      className="text-xs text-muted-foreground cursor-pointer hover:underline hover:text-foreground"
                      onClick={handleBatteryCostClick}
                      title="Click to edit"
                    >
                      R{costs.batteryCostPerKwh.toLocaleString()}
                    </span>
                  )}
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

      {/* Financial Return Inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Financial Return Inputs
          </CardTitle>
          <CardDescription className="text-xs">
            Parameters for NPV, IRR, MIRR, and LCOE calculations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Financial Parameters - 2x2 Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Cost of Capital */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Cost of Capital (WACC)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={costs.costOfCapital}
                    onChange={(e) => onChange({ ...costs, costOfCapital: parseFloat(e.target.value) || 0 })}
                    className="h-6 w-16 text-xs text-right px-2"
                    min={0}
                    max={30}
                    step={0.5}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[costs.costOfCapital]}
                onValueChange={([v]) => onChange({ ...costs, costOfCapital: v })}
                min={0}
                max={30}
                step={0.5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>15%</span>
                <span>30%</span>
              </div>
            </div>

            {/* CPI (Inflation) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">CPI (Inflation)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={costs.cpi}
                    onChange={(e) => onChange({ ...costs, cpi: parseFloat(e.target.value) || 0 })}
                    className="h-6 w-16 text-xs text-right px-2"
                    min={0}
                    max={20}
                    step={0.5}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[costs.cpi]}
                onValueChange={([v]) => onChange({ ...costs, cpi: v })}
                min={0}
                max={20}
                step={0.5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>10%</span>
                <span>20%</span>
              </div>
            </div>

            {/* Electricity Inflation */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Electricity Inflation</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={costs.electricityInflation}
                    onChange={(e) => onChange({ ...costs, electricityInflation: parseFloat(e.target.value) || 0 })}
                    className="h-6 w-16 text-xs text-right px-2"
                    min={0}
                    max={25}
                    step={0.5}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[costs.electricityInflation]}
                onValueChange={([v]) => onChange({ ...costs, electricityInflation: v })}
                min={0}
                max={25}
                step={0.5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>12.5%</span>
                <span>25%</span>
              </div>
            </div>

            {/* Project Duration */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Project Duration</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={costs.projectDurationYears}
                    onChange={(e) => onChange({ ...costs, projectDurationYears: parseInt(e.target.value) || 20 })}
                    className="h-6 w-16 text-xs text-right px-2"
                    min={5}
                    max={35}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">yrs</span>
                </div>
              </div>
              <Slider
                value={[costs.projectDurationYears]}
                onValueChange={([v]) => onChange({ ...costs, projectDurationYears: v })}
                min={5}
                max={35}
                step={1}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5 yrs</span>
                <span>20 yrs</span>
                <span>35 yrs</span>
              </div>
            </div>
          </div>

          {/* Cost of Capital for LCOE calc */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-xs">Cost of Capital (LCOE calc)</Label>
                <p className="text-[10px] text-muted-foreground">Used as NPV discount rate</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={costs.lcoeDiscountRate}
                  onChange={(e) => onChange({ ...costs, lcoeDiscountRate: parseFloat(e.target.value) || 0 })}
                  className="h-6 w-16 text-xs text-right px-2"
                  min={0}
                  max={25}
                  step={0.5}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[costs.lcoeDiscountRate]}
              onValueChange={([v]) => onChange({ ...costs, lcoeDiscountRate: v })}
              min={0}
              max={25}
              step={0.5}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>12.5%</span>
              <span>25%</span>
            </div>
          </div>

          <Separator />

          {/* Calculated Value: Adjusted Discount Rate */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm font-medium">Adjusted Discount Rate</span>
                <p className="text-[10px] text-muted-foreground">Cost of Capital + CPI</p>
              </div>
              <span className="text-lg font-bold text-primary">
                {(costs.costOfCapital + costs.cpi).toFixed(2)}%
              </span>
            </div>
          </div>

          <Separator />

          {/* MIRR Parameters */}
          <div>
            <h4 className="text-xs font-medium mb-3 text-muted-foreground uppercase tracking-wide">MIRR Parameters</h4>
            <div className="grid gap-6 md:grid-cols-2">
              {/* MIRR Finance Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-xs">Finance Rate</Label>
                    <p className="text-[10px] text-muted-foreground">Interest paid on cash flows</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={costs.mirrFinanceRate}
                      onChange={(e) => onChange({ ...costs, mirrFinanceRate: parseFloat(e.target.value) || 0 })}
                      className="h-6 w-16 text-xs text-right px-2"
                      min={0}
                      max={25}
                      step={0.5}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <Slider
                  value={[costs.mirrFinanceRate]}
                  onValueChange={([v]) => onChange({ ...costs, mirrFinanceRate: v })}
                  min={0}
                  max={25}
                  step={0.5}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>25%</span>
                </div>
              </div>

              {/* MIRR Re-investment Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-xs">Re-investment Rate</Label>
                    <p className="text-[10px] text-muted-foreground">Interest received on reinvestment</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={costs.mirrReinvestmentRate}
                      onChange={(e) => onChange({ ...costs, mirrReinvestmentRate: parseFloat(e.target.value) || 0 })}
                      className="h-6 w-16 text-xs text-right px-2"
                      min={0}
                      max={25}
                      step={0.5}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <Slider
                  value={[costs.mirrReinvestmentRate]}
                  onValueChange={([v]) => onChange({ ...costs, mirrReinvestmentRate: v })}
                  min={0}
                  max={25}
                  step={0.5}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>25%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
