import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sun, 
  TrendingDown, 
  DollarSign, 
  Wrench, 
  Leaf, 
  ChevronDown, 
  RotateCcw,
  Calculator,
  Zap
} from "lucide-react";
import { 
  useCalculationDefaults, 
  DEFAULT_SOLAR_SYSTEM,
  DEFAULT_PVSYST_LOSS,
  DEFAULT_DEGRADATION,
  DEFAULT_FINANCIAL,
  DEFAULT_COST_BREAKDOWN,
  DEFAULT_CARBON,
} from "@/hooks/useCalculationDefaults";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
}

function SettingRow({ label, description, value, onChange, unit, min, max, step = 0.01, defaultValue }: SettingRowProps) {
  const isModified = value !== defaultValue;
  
  return (
    <div className="grid grid-cols-[1fr,auto] gap-4 items-start py-2 border-b border-border/50 last:border-0">
      <div className="space-y-0.5">
        <Label className={cn("text-sm font-medium", isModified && "text-primary")}>
          {label}
          {isModified && <span className="ml-1 text-xs text-primary">•</span>}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="w-24 h-8 text-right text-sm"
        />
        {unit && <span className="text-xs text-muted-foreground w-12">{unit}</span>}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onReset: () => void;
  defaultOpen?: boolean;
}

function Section({ title, description, icon, children, onReset, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-card/50 border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {icon}
                </div>
                <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="text-xs">{description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function CalculationsSettingsCard() {
  const { 
    defaults, 
    updateValue, 
    resetSection, 
    resetAll 
  } = useCalculationDefaults();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Calculation Defaults</h2>
            <p className="text-sm text-muted-foreground">
              Configure first-principles variables for all solar and financial calculations
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset All
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {/* Solar System Defaults */}
        <Section
          title="Solar System Defaults"
          description="Installation costs and system parameters"
          icon={<Sun className="h-4 w-4" />}
          onReset={() => resetSection("solarSystem")}
          defaultOpen={true}
        >
          <div className="space-y-1">
            <SettingRow
              label="Solar Cost per kWp"
              description="Default installed cost for PV systems"
              value={defaults.solarSystem.solarCostPerKwp}
              onChange={(v) => updateValue("solarSystem", "solarCostPerKwp", v)}
              unit="R/kWp"
              min={0}
              step={100}
              defaultValue={DEFAULT_SOLAR_SYSTEM.solarCostPerKwp}
            />
            <SettingRow
              label="Battery Cost per kWh"
              description="Default installed cost for battery storage"
              value={defaults.solarSystem.batteryCostPerKwh}
              onChange={(v) => updateValue("solarSystem", "batteryCostPerKwh", v)}
              unit="R/kWh"
              min={0}
              step={100}
              defaultValue={DEFAULT_SOLAR_SYSTEM.batteryCostPerKwh}
            />
            <SettingRow
              label="Default DC/AC Ratio"
              description="Panel oversizing relative to inverter capacity"
              value={defaults.solarSystem.defaultDcAcRatio}
              onChange={(v) => updateValue("solarSystem", "defaultDcAcRatio", v)}
              unit="ratio"
              min={1}
              max={2}
              step={0.05}
              defaultValue={DEFAULT_SOLAR_SYSTEM.defaultDcAcRatio}
            />
            <SettingRow
              label="Default Peak Sun Hours"
              description="Average daily PSH for quick estimates"
              value={defaults.solarSystem.defaultPeakSunHours}
              onChange={(v) => updateValue("solarSystem", "defaultPeakSunHours", v)}
              unit="hours"
              min={3}
              max={8}
              step={0.1}
              defaultValue={DEFAULT_SOLAR_SYSTEM.defaultPeakSunHours}
            />
            <SettingRow
              label="Default System Losses"
              description="Combined BOS losses for simple estimates"
              value={defaults.solarSystem.defaultSystemLosses}
              onChange={(v) => updateValue("solarSystem", "defaultSystemLosses", v)}
              unit="%"
              min={0}
              max={30}
              step={0.5}
              defaultValue={DEFAULT_SOLAR_SYSTEM.defaultSystemLosses}
            />
          </div>
        </Section>

        {/* PVsyst Loss Chain */}
        <Section
          title="PVsyst Loss Chain"
          description="Detailed loss factors for accurate yield modeling"
          icon={<Zap className="h-4 w-4" />}
          onReset={() => resetSection("pvsystLoss")}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 pb-2 border-b">Irradiance Losses</p>
            <SettingRow
              label="Near Shading Loss"
              description="Shading from nearby objects"
              value={defaults.pvsystLoss.nearShadingLoss}
              onChange={(v) => updateValue("pvsystLoss", "nearShadingLoss", v)}
              unit="%"
              min={0}
              max={10}
              defaultValue={DEFAULT_PVSYST_LOSS.nearShadingLoss}
            />
            <SettingRow
              label="IAM Loss"
              description="Incidence Angle Modifier loss"
              value={defaults.pvsystLoss.iamLoss}
              onChange={(v) => updateValue("pvsystLoss", "iamLoss", v)}
              unit="%"
              min={0}
              max={10}
              defaultValue={DEFAULT_PVSYST_LOSS.iamLoss}
            />
            <SettingRow
              label="Soiling Loss"
              description="Dust and dirt accumulation"
              value={defaults.pvsystLoss.soilingLoss}
              onChange={(v) => updateValue("pvsystLoss", "soilingLoss", v)}
              unit="%"
              min={0}
              max={10}
              defaultValue={DEFAULT_PVSYST_LOSS.soilingLoss}
            />
            <SettingRow
              label="Spectral Loss"
              description="Spectral mismatch correction"
              value={defaults.pvsystLoss.spectralLoss}
              onChange={(v) => updateValue("pvsystLoss", "spectralLoss", v)}
              unit="%"
              min={0}
              max={5}
              defaultValue={DEFAULT_PVSYST_LOSS.spectralLoss}
            />
            <SettingRow
              label="Electrical Shading Loss"
              description="Electrical effects of partial shading"
              value={defaults.pvsystLoss.electricalShadingLoss}
              onChange={(v) => updateValue("pvsystLoss", "electricalShadingLoss", v)}
              unit="%"
              min={0}
              max={5}
              defaultValue={DEFAULT_PVSYST_LOSS.electricalShadingLoss}
            />
            
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-2 pb-2 border-b">Array Losses</p>
            <SettingRow
              label="Irradiance Level Loss"
              description="Loss at low irradiance levels"
              value={defaults.pvsystLoss.irradianceLevelLoss}
              onChange={(v) => updateValue("pvsystLoss", "irradianceLevelLoss", v)}
              unit="%"
              min={0}
              max={5}
              defaultValue={DEFAULT_PVSYST_LOSS.irradianceLevelLoss}
            />
            <SettingRow
              label="Temperature Loss"
              description="Output reduction due to heat"
              value={defaults.pvsystLoss.temperatureLoss}
              onChange={(v) => updateValue("pvsystLoss", "temperatureLoss", v)}
              unit="%"
              min={0}
              max={15}
              defaultValue={DEFAULT_PVSYST_LOSS.temperatureLoss}
            />
            <SettingRow
              label="Module Quality"
              description="Manufacturing tolerance (negative = gain)"
              value={defaults.pvsystLoss.moduleQualityLoss}
              onChange={(v) => updateValue("pvsystLoss", "moduleQualityLoss", v)}
              unit="%"
              min={-5}
              max={5}
              defaultValue={DEFAULT_PVSYST_LOSS.moduleQualityLoss}
            />
            <SettingRow
              label="LID Loss"
              description="Light-Induced Degradation (first year)"
              value={defaults.pvsystLoss.lidLoss}
              onChange={(v) => updateValue("pvsystLoss", "lidLoss", v)}
              unit="%"
              min={0}
              max={5}
              defaultValue={DEFAULT_PVSYST_LOSS.lidLoss}
            />
            <SettingRow
              label="Mismatch Loss"
              description="Module array mismatch including degradation dispersion"
              value={defaults.pvsystLoss.mismatchLoss}
              onChange={(v) => updateValue("pvsystLoss", "mismatchLoss", v)}
              unit="%"
              min={0}
              max={10}
              defaultValue={DEFAULT_PVSYST_LOSS.mismatchLoss}
            />
            <SettingRow
              label="Ohmic Wiring Loss"
              description="DC cable losses"
              value={defaults.pvsystLoss.ohmicLoss}
              onChange={(v) => updateValue("pvsystLoss", "ohmicLoss", v)}
              unit="%"
              min={0}
              max={5}
              defaultValue={DEFAULT_PVSYST_LOSS.ohmicLoss}
            />
            
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-2 pb-2 border-b">Inverter & System</p>
            <SettingRow
              label="Inverter Efficiency Loss"
              description="DC to AC conversion loss"
              value={defaults.pvsystLoss.inverterEfficiencyLoss}
              onChange={(v) => updateValue("pvsystLoss", "inverterEfficiencyLoss", v)}
              unit="%"
              min={0}
              max={5}
              defaultValue={DEFAULT_PVSYST_LOSS.inverterEfficiencyLoss}
            />
            <SettingRow
              label="Inverter Clipping Loss"
              description="Loss due to oversizing beyond inverter capacity"
              value={defaults.pvsystLoss.inverterClippingLoss}
              onChange={(v) => updateValue("pvsystLoss", "inverterClippingLoss", v)}
              unit="%"
              min={0}
              max={10}
              defaultValue={DEFAULT_PVSYST_LOSS.inverterClippingLoss}
            />
            <SettingRow
              label="Availability Loss"
              description="System downtime and unavailability"
              value={defaults.pvsystLoss.availabilityLoss}
              onChange={(v) => updateValue("pvsystLoss", "availabilityLoss", v)}
              unit="%"
              min={0}
              max={10}
              defaultValue={DEFAULT_PVSYST_LOSS.availabilityLoss}
            />
          </div>
        </Section>

        {/* Degradation & Lifetime */}
        <Section
          title="Degradation & Lifetime"
          description="Equipment aging and project duration"
          icon={<TrendingDown className="h-4 w-4" />}
          onReset={() => resetSection("degradation")}
        >
          <div className="space-y-1">
            <SettingRow
              label="Annual Panel Degradation"
              description="Yearly efficiency loss after first year"
              value={defaults.degradation.annualPanelDegradation}
              onChange={(v) => updateValue("degradation", "annualPanelDegradation", v)}
              unit="%/yr"
              min={0}
              max={2}
              defaultValue={DEFAULT_DEGRADATION.annualPanelDegradation}
            />
            <SettingRow
              label="First Year Degradation"
              description="Initial LID and settling loss"
              value={defaults.degradation.firstYearDegradation}
              onChange={(v) => updateValue("degradation", "firstYearDegradation", v)}
              unit="%"
              min={0}
              max={5}
              defaultValue={DEFAULT_DEGRADATION.firstYearDegradation}
            />
            <SettingRow
              label="Annual Battery Degradation"
              description="Battery capacity loss per year"
              value={defaults.degradation.annualBatteryDegradation}
              onChange={(v) => updateValue("degradation", "annualBatteryDegradation", v)}
              unit="%/yr"
              min={0}
              max={10}
              defaultValue={DEFAULT_DEGRADATION.annualBatteryDegradation}
            />
            <SettingRow
              label="Battery EOL Capacity"
              description="End-of-life replacement threshold"
              value={defaults.degradation.batteryEolCapacity}
              onChange={(v) => updateValue("degradation", "batteryEolCapacity", v)}
              unit="%"
              min={50}
              max={90}
              step={5}
              defaultValue={DEFAULT_DEGRADATION.batteryEolCapacity}
            />
            <SettingRow
              label="Project Lifetime"
              description="Duration for financial calculations"
              value={defaults.degradation.projectLifetimeYears}
              onChange={(v) => updateValue("degradation", "projectLifetimeYears", v)}
              unit="years"
              min={10}
              max={30}
              step={1}
              defaultValue={DEFAULT_DEGRADATION.projectLifetimeYears}
            />
          </div>
        </Section>

        {/* Financial Assumptions */}
        <Section
          title="Financial Assumptions"
          description="Rates for NPV, IRR, and escalation modeling"
          icon={<DollarSign className="h-4 w-4" />}
          onReset={() => resetSection("financial")}
        >
          <div className="space-y-1">
            <SettingRow
              label="Discount Rate"
              description="Cost of capital for NPV calculations"
              value={defaults.financial.discountRate}
              onChange={(v) => updateValue("financial", "discountRate", v)}
              unit="%"
              min={0}
              max={25}
              step={0.5}
              defaultValue={DEFAULT_FINANCIAL.discountRate}
            />
            <SettingRow
              label="Tariff Escalation"
              description="Annual electricity price increase"
              value={defaults.financial.tariffEscalation}
              onChange={(v) => updateValue("financial", "tariffEscalation", v)}
              unit="%/yr"
              min={0}
              max={20}
              step={0.5}
              defaultValue={DEFAULT_FINANCIAL.tariffEscalation}
            />
            <SettingRow
              label="CPI Inflation"
              description="Consumer price inflation for O&M escalation"
              value={defaults.financial.cpiInflation}
              onChange={(v) => updateValue("financial", "cpiInflation", v)}
              unit="%/yr"
              min={0}
              max={15}
              step={0.5}
              defaultValue={DEFAULT_FINANCIAL.cpiInflation}
            />
            <SettingRow
              label="VAT Rate"
              description="Value Added Tax percentage"
              value={defaults.financial.vatRate}
              onChange={(v) => updateValue("financial", "vatRate", v)}
              unit="%"
              min={0}
              max={25}
              step={0.5}
              defaultValue={DEFAULT_FINANCIAL.vatRate}
            />
            <SettingRow
              label="Insurance Rate"
              description="Annual insurance as % of capital"
              value={defaults.financial.insuranceRatePercent}
              onChange={(v) => updateValue("financial", "insuranceRatePercent", v)}
              unit="%"
              min={0}
              max={5}
              step={0.1}
              defaultValue={DEFAULT_FINANCIAL.insuranceRatePercent}
            />
            <SettingRow
              label="Finance Rate (MIRR)"
              description="Rate for negative cash flows in MIRR"
              value={defaults.financial.financeRate}
              onChange={(v) => updateValue("financial", "financeRate", v)}
              unit="%"
              min={0}
              max={20}
              step={0.5}
              defaultValue={DEFAULT_FINANCIAL.financeRate}
            />
            <SettingRow
              label="Reinvestment Rate (MIRR)"
              description="Rate for positive cash flows in MIRR"
              value={defaults.financial.reinvestmentRate}
              onChange={(v) => updateValue("financial", "reinvestmentRate", v)}
              unit="%"
              min={0}
              max={20}
              step={0.5}
              defaultValue={DEFAULT_FINANCIAL.reinvestmentRate}
            />
          </div>
        </Section>

        {/* Cost Breakdown */}
        <Section
          title="Cost Breakdown & Replacements"
          description="Equipment splits and replacement assumptions"
          icon={<Wrench className="h-4 w-4" />}
          onReset={() => resetSection("costBreakdown")}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 pb-2 border-b">Equipment Cost Splits</p>
            <SettingRow
              label="Equipment Cost %"
              description="Equipment portion of total solar PV cost"
              value={defaults.costBreakdown.equipmentCostPercent}
              onChange={(v) => updateValue("costBreakdown", "equipmentCostPercent", v)}
              unit="%"
              min={0}
              max={100}
              step={1}
              defaultValue={DEFAULT_COST_BREAKDOWN.equipmentCostPercent}
            />
            <SettingRow
              label="Module Share %"
              description="Modules as % of equipment cost"
              value={defaults.costBreakdown.moduleSharePercent}
              onChange={(v) => updateValue("costBreakdown", "moduleSharePercent", v)}
              unit="%"
              min={0}
              max={100}
              step={1}
              defaultValue={DEFAULT_COST_BREAKDOWN.moduleSharePercent}
            />
            <SettingRow
              label="Inverter Share %"
              description="Inverters as % of equipment cost"
              value={defaults.costBreakdown.inverterSharePercent}
              onChange={(v) => updateValue("costBreakdown", "inverterSharePercent", v)}
              unit="%"
              min={0}
              max={100}
              step={1}
              defaultValue={DEFAULT_COST_BREAKDOWN.inverterSharePercent}
            />
            
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-2 pb-2 border-b">Replacement Assumptions</p>
            <SettingRow
              label="Replacement Year"
              description="Year for major equipment replacements"
              value={defaults.costBreakdown.replacementYear}
              onChange={(v) => updateValue("costBreakdown", "replacementYear", v)}
              unit="year"
              min={5}
              max={20}
              step={1}
              defaultValue={DEFAULT_COST_BREAKDOWN.replacementYear}
            />
            <SettingRow
              label="Module Replacement %"
              description="% of modules to replace"
              value={defaults.costBreakdown.moduleReplacementPercent}
              onChange={(v) => updateValue("costBreakdown", "moduleReplacementPercent", v)}
              unit="%"
              min={0}
              max={100}
              step={1}
              defaultValue={DEFAULT_COST_BREAKDOWN.moduleReplacementPercent}
            />
            <SettingRow
              label="Inverter Replacement %"
              description="% of inverters to replace"
              value={defaults.costBreakdown.inverterReplacementPercent}
              onChange={(v) => updateValue("costBreakdown", "inverterReplacementPercent", v)}
              unit="%"
              min={0}
              max={100}
              step={1}
              defaultValue={DEFAULT_COST_BREAKDOWN.inverterReplacementPercent}
            />
            <SettingRow
              label="Battery Replacement %"
              description="% of batteries to replace"
              value={defaults.costBreakdown.batteryReplacementPercent}
              onChange={(v) => updateValue("costBreakdown", "batteryReplacementPercent", v)}
              unit="%"
              min={0}
              max={100}
              step={1}
              defaultValue={DEFAULT_COST_BREAKDOWN.batteryReplacementPercent}
            />
            
            <p className="text-xs font-medium text-muted-foreground mt-4 mb-2 pb-2 border-b">Project Fees</p>
            <SettingRow
              label="Professional Fees %"
              description="Engineering and design fees"
              value={defaults.costBreakdown.professionalFeesPercent}
              onChange={(v) => updateValue("costBreakdown", "professionalFeesPercent", v)}
              unit="%"
              min={0}
              max={20}
              step={0.5}
              defaultValue={DEFAULT_COST_BREAKDOWN.professionalFeesPercent}
            />
            <SettingRow
              label="Project Management %"
              description="PM and oversight costs"
              value={defaults.costBreakdown.projectManagementPercent}
              onChange={(v) => updateValue("costBreakdown", "projectManagementPercent", v)}
              unit="%"
              min={0}
              max={20}
              step={0.5}
              defaultValue={DEFAULT_COST_BREAKDOWN.projectManagementPercent}
            />
            <SettingRow
              label="Contingency %"
              description="Budget contingency allowance"
              value={defaults.costBreakdown.contingencyPercent}
              onChange={(v) => updateValue("costBreakdown", "contingencyPercent", v)}
              unit="%"
              min={0}
              max={20}
              step={0.5}
              defaultValue={DEFAULT_COST_BREAKDOWN.contingencyPercent}
            />
          </div>
        </Section>

        {/* Carbon & Environmental */}
        <Section
          title="Carbon & Environmental"
          description="Emission factors and environmental calculations"
          icon={<Leaf className="h-4 w-4" />}
          onReset={() => resetSection("carbon")}
        >
          <div className="space-y-1">
            <SettingRow
              label="Grid Emission Factor"
              description="SA grid carbon intensity"
              value={defaults.carbon.gridEmissionFactor}
              onChange={(v) => updateValue("carbon", "gridEmissionFactor", v)}
              unit="kg/kWh"
              min={0}
              max={2}
              defaultValue={DEFAULT_CARBON.gridEmissionFactor}
            />
            <SettingRow
              label="Transmission Loss %"
              description="Grid transmission and distribution losses"
              value={defaults.carbon.transmissionLossPercent}
              onChange={(v) => updateValue("carbon", "transmissionLossPercent", v)}
              unit="%"
              min={0}
              max={20}
              step={0.5}
              defaultValue={DEFAULT_CARBON.transmissionLossPercent}
            />
            <SettingRow
              label="REC Price"
              description="Renewable Energy Certificate value"
              value={defaults.carbon.recPricePerMwh}
              onChange={(v) => updateValue("carbon", "recPricePerMwh", v)}
              unit="R/MWh"
              min={0}
              max={500}
              step={10}
              defaultValue={DEFAULT_CARBON.recPricePerMwh}
            />
            <SettingRow
              label="Carbon Tax Rate"
              description="SA carbon tax per ton CO2"
              value={defaults.carbon.carbonTaxRate}
              onChange={(v) => updateValue("carbon", "carbonTaxRate", v)}
              unit="R/ton"
              min={0}
              max={500}
              step={10}
              defaultValue={DEFAULT_CARBON.carbonTaxRate}
            />
            <SettingRow
              label="CO2 per Tree per Year"
              description="Average CO2 absorption per tree"
              value={defaults.carbon.kgCo2PerTreePerYear}
              onChange={(v) => updateValue("carbon", "kgCo2PerTreePerYear", v)}
              unit="kg"
              min={10}
              max={50}
              step={1}
              defaultValue={DEFAULT_CARBON.kgCo2PerTreePerYear}
            />
            <SettingRow
              label="CO2 per Car per Year"
              description="Average car annual emissions"
              value={defaults.carbon.kgCo2PerCarPerYear}
              onChange={(v) => updateValue("carbon", "kgCo2PerCarPerYear", v)}
              unit="kg"
              min={2000}
              max={8000}
              step={100}
              defaultValue={DEFAULT_CARBON.kgCo2PerCarPerYear}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
