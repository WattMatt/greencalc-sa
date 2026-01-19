import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { DollarSign, Sun, Battery, Wrench, Calculator, RotateCcw, TrendingUp, AlertCircle } from "lucide-react";
import { DEFAULT_SYSTEM_COSTS } from "./simulation/FinancialAnalysis";

export interface SystemCostsData {
  solarCostPerKwp: number;
  batteryCostPerKwh: number;
  installationCost: number;
  maintenancePerYear: number;
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
    installationCost: 15000,
    maintenancePerYear: 2000,
  },
  {
    name: "Standard",
    description: "Quality Tier-1 panels, reputable brands",
    solarCostPerKwp: 11000,
    batteryCostPerKwh: 7500,
    installationCost: 25000,
    maintenancePerYear: 5000,
  },
  {
    name: "Premium",
    description: "Top-tier equipment, extended warranties",
    solarCostPerKwp: 14000,
    batteryCostPerKwh: 9500,
    installationCost: 50000,
    maintenancePerYear: 8000,
  },
  {
    name: "Commercial",
    description: "Large-scale C&I pricing",
    solarCostPerKwp: 9500,
    batteryCostPerKwh: 6500,
    installationCost: 100000,
    maintenancePerYear: 15000,
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
  
  const totalSystemCost = 
    (solarCapacity * costs.solarCostPerKwp) + 
    (effectiveBatteryCapacity * costs.batteryCostPerKwh) + 
    costs.installationCost;

  const handleInputChange = (field: keyof SystemCostsData, value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange({ ...costs, [field]: numValue });
  };

  const applyPreset = (preset: typeof COST_PRESETS[0]) => {
    onChange({
      solarCostPerKwp: preset.solarCostPerKwp,
      batteryCostPerKwh: preset.batteryCostPerKwh,
      installationCost: preset.installationCost,
      maintenancePerYear: preset.maintenancePerYear,
    });
  };

  const resetToDefaults = () => {
    onChange({
      solarCostPerKwp: DEFAULT_SYSTEM_COSTS.solarCostPerKwp,
      batteryCostPerKwh: DEFAULT_SYSTEM_COSTS.batteryCostPerKwh,
      installationCost: DEFAULT_SYSTEM_COSTS.installationCost ?? 0,
      maintenancePerYear: DEFAULT_SYSTEM_COSTS.maintenancePerYear ?? 0,
    });
  };

  const isCustom = !COST_PRESETS.some(
    p => 
      p.solarCostPerKwp === costs.solarCostPerKwp &&
      p.batteryCostPerKwh === costs.batteryCostPerKwh &&
      p.installationCost === costs.installationCost &&
      p.maintenancePerYear === costs.maintenancePerYear
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
                preset.installationCost === costs.installationCost &&
                preset.maintenancePerYear === costs.maintenancePerYear;

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
                <span className="font-medium">R{(solarCapacity * costs.solarCostPerKwp).toLocaleString()}</span>
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
                  <span className="font-medium">R{(batteryCapacity * costs.batteryCostPerKwh).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Installation costs are included in R/kWp rate */}

        {/* Maintenance Costs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4 text-purple-500" />
              Annual Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Annual O&M Cost</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">R</span>
                <Input
                  type="number"
                  value={costs.maintenancePerYear}
                  onChange={(e) => handleInputChange("maintenancePerYear", e.target.value)}
                  className="h-9"
                  min={0}
                  step={1000}
                />
                <span className="text-muted-foreground text-sm">/year</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Cleaning, monitoring, inspections, inverter servicing
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
                <span>R{(solarCapacity * costs.solarCostPerKwp).toLocaleString()}</span>
              </div>
              {includesBattery && (
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Battery ({batteryCapacity} kWh)</span>
                  <span>R{(effectiveBatteryCapacity * costs.batteryCostPerKwh).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">Installation</span>
                <span>R{costs.installationCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-8 pt-1 border-t">
                <span className="text-muted-foreground">Annual O&M</span>
                <span>R{costs.maintenancePerYear.toLocaleString()}/yr</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
