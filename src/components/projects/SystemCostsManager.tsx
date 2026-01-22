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
  
  // Additional Fixed Costs (Rand values)
  healthAndSafetyCost: number;        // Health and Safety Consultant
  waterPointsCost: number;            // Water Points
  cctvCost: number;                   // CCTV
  mvSwitchGearCost: number;           // MV Switch Gear
  
  // Percentage-based Fees (% of project subtotal)
  professionalFeesPercent: number;    // Professional Fees %
  projectManagementPercent: number;   // Project Management Fees %
  contingencyPercent: number;         // Project Contingency %
  
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

interface SystemCostsManagerProps {
  costs: SystemCostsData;
  onChange: (costs: SystemCostsData) => void;
  onBlur?: () => void;
  solarCapacity?: number;
  batteryCapacity?: number;
  includesBattery?: boolean;
}

export function SystemCostsManager({ 
  costs, 
  onChange, 
  onBlur,
  solarCapacity = 100, 
  batteryCapacity = 50,
  includesBattery = true
}: SystemCostsManagerProps) {
  const effectiveBatteryCapacity = includesBattery ? batteryCapacity : 0;
  
  // Calculate base costs
  const solarCost = solarCapacity * costs.solarCostPerKwp;
  const batteryCost = effectiveBatteryCapacity * costs.batteryCostPerKwh;
  const baseCost = solarCost + batteryCost;

  // Calculate additional fixed costs
  const additionalCosts = 
    (costs.healthAndSafetyCost ?? 0) +
    (costs.waterPointsCost ?? 0) +
    (costs.cctvCost ?? 0) +
    (costs.mvSwitchGearCost ?? 0);

  // Subtotal before fees
  const subtotalBeforeFees = baseCost + additionalCosts;

  // Percentage-based fees (applied to subtotal)
  const professionalFees = subtotalBeforeFees * ((costs.professionalFeesPercent ?? 0) / 100);
  const projectManagementFees = subtotalBeforeFees * ((costs.projectManagementPercent ?? 0) / 100);

  // Subtotal with fees
  const subtotalWithFees = subtotalBeforeFees + professionalFees + projectManagementFees;

  // Contingency (applied to subtotal + fees)
  const contingency = subtotalWithFees * ((costs.contingencyPercent ?? 0) / 100);

  // Total Capital Cost (Excl. O&M)
  const totalCapitalCost = subtotalWithFees + contingency;

  // Legacy totalSystemCost for backwards compatibility with some displays
  const totalSystemCost = totalCapitalCost;

  // Calculate maintenance from separate percentages
  const solarMaintenance = solarCost * (costs.solarMaintenancePercentage / 100);
  const batteryMaintenance = batteryCost * (costs.batteryMaintenancePercentage / 100);
  const totalMaintenancePerYear = solarMaintenance + batteryMaintenance;

  // Calculate 20-year O&M with CPI escalation
  const cpi = costs.cpi ?? 6.0;
  const projectYears = costs.projectDurationYears ?? 20;
  let lifetimeOM = 0;
  for (let year = 1; year <= projectYears; year++) {
    lifetimeOM += totalMaintenancePerYear * Math.pow(1 + cpi / 100, year - 1);
  }

  // Calculate first 3 years O&M with CPI escalation (for display)
  const threeYearSolarOM = solarMaintenance * (1 + Math.pow(1 + cpi / 100, 1) + Math.pow(1 + cpi / 100, 2));
  const threeYearBatteryOM = batteryMaintenance * (1 + Math.pow(1 + cpi / 100, 1) + Math.pow(1 + cpi / 100, 2));

  // Calculate effective O&M percentage (read-only)
  const effectiveOMPercentage = totalCapitalCost > 0 
    ? (totalMaintenancePerYear / totalCapitalCost) * 100 
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
      // Additional Fixed Costs
      healthAndSafetyCost: DEFAULT_SYSTEM_COSTS.healthAndSafetyCost ?? 0,
      waterPointsCost: DEFAULT_SYSTEM_COSTS.waterPointsCost ?? 0,
      cctvCost: DEFAULT_SYSTEM_COSTS.cctvCost ?? 0,
      mvSwitchGearCost: DEFAULT_SYSTEM_COSTS.mvSwitchGearCost ?? 0,
      // Percentage-based Fees
      professionalFeesPercent: DEFAULT_SYSTEM_COSTS.professionalFeesPercent ?? 0,
      projectManagementPercent: DEFAULT_SYSTEM_COSTS.projectManagementPercent ?? 0,
      contingencyPercent: DEFAULT_SYSTEM_COSTS.contingencyPercent ?? 0,
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

      {/* 2x2 Grid Layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Equipment Costs Card (Solar + Battery) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                Equipment Costs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Solar PV Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Solar PV</span>
                </div>
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
              </div>

              {/* Battery Storage Section (conditional) */}
              {includesBattery && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Battery className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Battery Storage</span>
                    </div>
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
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Additional Project Costs Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Additional Project Costs
              </CardTitle>
              <CardDescription className="text-xs">
                Fixed costs for project infrastructure and services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {/* Health & Safety Consultant */}
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <Label className="text-sm">Health & Safety Consultant</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input
                      type="number"
                      value={costs.healthAndSafetyCost ?? 0}
                      onChange={(e) => onChange({ ...costs, healthAndSafetyCost: parseFloat(e.target.value) || 0 })}
                      onBlur={onBlur}
                      className="h-8 w-28 text-sm text-right px-2"
                      min={0}
                      step={1000}
                    />
                  </div>
                </div>

                {/* Water Points */}
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <Label className="text-sm">Water Points</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input
                      type="number"
                      value={costs.waterPointsCost ?? 0}
                      onChange={(e) => onChange({ ...costs, waterPointsCost: parseFloat(e.target.value) || 0 })}
                      onBlur={onBlur}
                      className="h-8 w-28 text-sm text-right px-2"
                      min={0}
                      step={1000}
                    />
                  </div>
                </div>

                {/* CCTV */}
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <Label className="text-sm">CCTV</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input
                      type="number"
                      value={costs.cctvCost ?? 0}
                      onChange={(e) => onChange({ ...costs, cctvCost: parseFloat(e.target.value) || 0 })}
                      onBlur={onBlur}
                      className="h-8 w-28 text-sm text-right px-2"
                      min={0}
                      step={1000}
                    />
                  </div>
                </div>

                {/* MV Switch Gear */}
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <Label className="text-sm">MV Switch Gear</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input
                      type="number"
                      value={costs.mvSwitchGearCost ?? 0}
                      onChange={(e) => onChange({ ...costs, mvSwitchGearCost: parseFloat(e.target.value) || 0 })}
                      onBlur={onBlur}
                      className="h-8 w-28 text-sm text-right px-2"
                      min={0}
                      step={10000}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Costs Subtotal */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Additional Costs Subtotal</span>
                  <span className="font-bold">R{additionalCosts.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Annual Maintenance (O&M) Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Annual Maintenance (O&M)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">3-Year O&M Cost</span>
                    <span className="font-bold">R{threeYearSolarOM.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    @ {cpi}% CPI escalation (Year 1: R{solarMaintenance.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                  </p>
                </div>
              </div>

              {/* Battery O&M - Only shown if system includes battery */}
              {includesBattery && (
                <>
                  <Separator />
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
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">3-Year Battery O&M</span>
                        <span className="font-bold">R{threeYearBatteryOM.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        @ {cpi}% CPI escalation (Year 1: R{batteryMaintenance.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Fees & Contingency Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Fees & Contingency
              </CardTitle>
              <CardDescription className="text-xs">
                Percentage-based fees applied to the project subtotal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {/* Professional Fees */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Professional Fees</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={costs.professionalFeesPercent ?? 0}
                        onChange={(e) => onChange({ ...costs, professionalFeesPercent: parseFloat(e.target.value) || 0 })}
                        className="h-6 w-14 text-xs text-right px-2"
                        min={0}
                        max={15}
                        step={0.5}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[costs.professionalFeesPercent ?? 0]}
                    onValueChange={([v]) => onChange({ ...costs, professionalFeesPercent: v })}
                    min={0}
                    max={15}
                    step={0.5}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    R{professionalFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Project Management */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Project Management</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={costs.projectManagementPercent ?? 0}
                        onChange={(e) => onChange({ ...costs, projectManagementPercent: parseFloat(e.target.value) || 0 })}
                        className="h-6 w-14 text-xs text-right px-2"
                        min={0}
                        max={15}
                        step={0.5}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[costs.projectManagementPercent ?? 0]}
                    onValueChange={([v]) => onChange({ ...costs, projectManagementPercent: v })}
                    min={0}
                    max={15}
                    step={0.5}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    R{projectManagementFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Contingency */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Contingency</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={costs.contingencyPercent ?? 0}
                        onChange={(e) => onChange({ ...costs, contingencyPercent: parseFloat(e.target.value) || 0 })}
                        className="h-6 w-14 text-xs text-right px-2"
                        min={0}
                        max={15}
                        step={0.5}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[costs.contingencyPercent ?? 0]}
                    onValueChange={([v]) => onChange({ ...costs, contingencyPercent: v })}
                    min={0}
                    max={15}
                    step={0.5}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    R{contingency.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Fees Summary */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Fees & Contingency</span>
                  <span className="font-medium">
                    R{(professionalFees + projectManagementFees + contingency).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left side: Total Capital Cost + Total Annual O&M */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Capital Cost (Excl. O&M)</p>
                  <p className="text-2xl font-bold">R{totalCapitalCost.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Calculator className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Annual O&M</p>
                  <p className="text-2xl font-bold">R{totalMaintenancePerYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                </div>
              </div>
            </div>

            {/* Right side: Cost Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Solar ({solarCapacity} kWp)</span>
                <span>R{solarCost.toLocaleString()}</span>
              </div>
              {includesBattery && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Battery ({batteryCapacity} kWh)</span>
                  <span>R{batteryCost.toLocaleString()}</span>
                </div>
              )}
              {additionalCosts > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Additional Costs</span>
                  <span>R{additionalCosts.toLocaleString()}</span>
                </div>
              )}
              {(professionalFees + projectManagementFees) > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Fees</span>
                  <span>R{(professionalFees + projectManagementFees).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              {contingency > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Contingency</span>
                  <span>R{contingency.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 pt-2 border-t">
                <span className="text-muted-foreground">Effective O&M Rate</span>
                <span className="font-medium text-primary">{effectiveOMPercentage.toFixed(2)}% of project</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{projectYears}-Year O&M (@ {cpi}% CPI)</span>
                <span className="font-bold text-primary">R{lifetimeOM.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
