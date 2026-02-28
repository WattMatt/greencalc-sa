/**
 * FinancialConfigPane – extracted from SimulationPanel.
 * Renders the Financial carousel pane: tariff rate selector + financial return outputs.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, TrendingUp, Calculator, Clock } from "lucide-react";
import { FinancialMetricRow } from "./FinancialMetricRow";
import { formatPaybackPeriod } from "@/lib/utils";
import type { BlendedRateType } from "../TariffSelector";
import type { AdvancedFinancialResults } from "./AdvancedSimulationTypes";
import type { SystemCostsData } from "../SystemCostsManager";
import type { calculateAnnualBlendedRates } from "@/lib/tariffCalculations";

interface FinancialConfigPaneProps {
  hasFinancialData: boolean;
  annualBlendedRates: ReturnType<typeof calculateAnnualBlendedRates>;
  blendedRateType: BlendedRateType;
  onBlendedRateTypeChange?: (type: BlendedRateType) => void;
  useHourlyTouRates: boolean;
  onUseHourlyTouRatesChange?: (value: boolean) => void;
  financialResults: { annualSavings: number; systemCost: number; paybackYears: number; roi: number };
  advancedResults: AdvancedFinancialResults | null;
  basicFinancialMetrics: { npv: number; irr: number; mirr: number; lcoe: number; projectLifeYears: number; discountRate: number };
  unifiedPaybackPeriod: number | null;
  threeYearOM: number;
  solarCapacity: number;
  annualEnergyResults: { totalAnnualSolar: number };
  annualPVsystResult: any;
  reductionFactor: number;
  inverterConfig: { dcAcRatio: number; inverterSize: number; inverterCount: number };
  systemCosts: SystemCostsData;
  advancedConfig: { financial: { projectLifetimeYears?: number; tariffEscalationRate?: number; discountRate?: number; inflationRate?: number } };
  projectLocation?: string;
}

export function FinancialConfigPane({
  hasFinancialData,
  annualBlendedRates,
  blendedRateType,
  onBlendedRateTypeChange,
  useHourlyTouRates,
  onUseHourlyTouRatesChange,
  financialResults,
  advancedResults,
  basicFinancialMetrics,
  unifiedPaybackPeriod,
  threeYearOM,
  solarCapacity,
  annualEnergyResults,
  annualPVsystResult,
  reductionFactor,
  inverterConfig,
  systemCosts,
  advancedConfig,
  projectLocation,
}: FinancialConfigPaneProps) {
  if (!hasFinancialData) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Financial Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Select a tariff to enable cost analysis and ROI calculations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRateValue = (type: BlendedRateType) => {
    if (!annualBlendedRates) return 0;
    switch (type) {
      case 'solarHours': return annualBlendedRates.solarHours.annual;
      case 'solarHoursHigh': return annualBlendedRates.solarHours.high;
      case 'solarHoursLow': return annualBlendedRates.solarHours.low;
      case 'allHours': return annualBlendedRates.allHours.annual;
      case 'allHoursHigh': return annualBlendedRates.allHours.high;
      case 'allHoursLow': return annualBlendedRates.allHours.low;
      default: return annualBlendedRates.solarHours.annual;
    }
  };

  // Year 1 metrics
  const year1Projection = advancedResults?.yearlyProjections?.[0];
  const totalIncomeY1 = year1Projection?.totalIncomeR ?? financialResults.annualSavings;
  const omCostY1 = year1Projection?.maintenanceCost ?? (systemCosts.maintenancePerYear ?? 0);
  const insuranceY1 = year1Projection?.insuranceCostR ?? (financialResults.systemCost * (systemCosts.insuranceRatePercent ?? 1) / 100 * 12);
  const netCashflowY1 = totalIncomeY1 - omCostY1 - insuranceY1;
  const initialYield = (netCashflowY1 / financialResults.systemCost) * 100;

  return (
    <div className="flex flex-col gap-4">
      {annualBlendedRates && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Simulation Tariff Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <Select
                value={blendedRateType}
                onValueChange={(value: BlendedRateType) => onBlendedRateTypeChange?.(value)}
                disabled={useHourlyTouRates}
              >
                <SelectTrigger className={`w-56 ${useHourlyTouRates ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solarHours">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span>Solar Hours - Annual</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="solarHoursHigh">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-orange-500" />
                      <span>Solar Hours - High (Winter)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="solarHoursLow">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-yellow-500" />
                      <span>Solar Hours - Low (Summer)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="allHours">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>All Hours - Annual</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="allHoursHigh">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span>All Hours - High (Winter)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="allHoursLow">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span>All Hours - Low (Summer)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  id="hourly-rates-toggle"
                  checked={useHourlyTouRates}
                  onCheckedChange={(checked) => onUseHourlyTouRatesChange?.(checked)}
                />
                <Label htmlFor="hourly-rates-toggle" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                  Hourly Rates
                </Label>
              </div>
              <span className={`text-lg font-bold ml-auto ${useHourlyTouRates ? 'text-primary' : blendedRateType?.startsWith('solarHours') ? 'text-amber-600' : ''}`}>
                {useHourlyTouRates ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Hourly TOU
                  </span>
                ) : (
                  <>R{getRateValue(blendedRateType).toFixed(4)}/kWh</>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Financial Return Outputs
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {projectLocation || 'Site'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border text-sm">
            <FinancialMetricRow
              label="ZAR / kWh (Incl. 3-Yr O&M)"
              value={((financialResults.systemCost + threeYearOM) / ((annualPVsystResult?.eGrid ?? annualEnergyResults.totalAnnualSolar) * reductionFactor)).toFixed(2)}
              breakdown={{
                formula: "(System Cost + 3-Yr O&M) ÷ (Annual Production × Reduction)",
                inputs: [
                  { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                  { label: "3-Yr O&M Total", value: `R ${Math.round(threeYearOM).toLocaleString()}` },
                  { label: "Annual Production", value: `${Math.round(annualPVsystResult?.eGrid ?? annualEnergyResults.totalAnnualSolar).toLocaleString()} kWh` },
                  { label: "Reduction Factor", value: `${(reductionFactor * 100).toFixed(0)}%` },
                  { label: "Note", value: "Uses total production (LCOE basis). Revenue kWh shown in cashflow table." },
                ],
              }}
            />
            <FinancialMetricRow
              label="ZAR / Wp (DC)"
              value={((financialResults.systemCost + threeYearOM) / (solarCapacity * inverterConfig.dcAcRatio * 1000)).toFixed(2)}
              breakdown={{
                formula: "(System Cost + 3-Yr O&M) ÷ (DC Capacity in Wp)",
                inputs: [
                  { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                  { label: "3-Yr O&M Total", value: `R ${Math.round(threeYearOM).toLocaleString()}` },
                  { label: "AC Capacity", value: `${solarCapacity} kW` },
                  { label: "DC/AC Ratio", value: inverterConfig.dcAcRatio.toFixed(2) },
                  { label: "DC Capacity", value: `${(solarCapacity * inverterConfig.dcAcRatio).toFixed(1)} kWp` },
                ],
              }}
            />
            <FinancialMetricRow
              label="ZAR / Wp (AC)"
              value={((financialResults.systemCost + threeYearOM) / ((inverterConfig.inverterSize * inverterConfig.inverterCount || solarCapacity) * 1000)).toFixed(2)}
              breakdown={{
                formula: "(System Cost + 3-Yr O&M) ÷ (AC Capacity in Wp)",
                inputs: [
                  { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                  { label: "3-Yr O&M Total", value: `R ${Math.round(threeYearOM).toLocaleString()}` },
                  { label: "AC Capacity", value: `${inverterConfig.inverterSize * inverterConfig.inverterCount || solarCapacity} kW` },
                ],
              }}
            />
            <FinancialMetricRow
              label="LCOE (ZAR/kWh)"
              value={(advancedResults?.lcoe ?? basicFinancialMetrics.lcoe).toFixed(2)}
              breakdown={{
                formula: "Undiscounted Total Costs ÷ NPV of Energy Yield",
                inputs: [
                  { label: "Initial Capital", value: `R ${financialResults.systemCost.toLocaleString()}` },
                  { label: "20-Yr O&M (CPI escalated)", value: advancedResults?.columnTotals ? `R ${Math.round(advancedResults.columnTotals.totalOM).toLocaleString()}` : 'N/A' },
                  { label: "20-Yr Insurance (CPI escalated)", value: advancedResults?.columnTotals ? `R ${Math.round(advancedResults.columnTotals.totalInsurance).toLocaleString()}` : 'N/A' },
                  { label: "Replacements (Yr 10)", value: advancedResults?.columnTotals ? `R ${Math.round(advancedResults.columnTotals.totalReplacements).toLocaleString()}` : 'N/A' },
                  { label: "NPV of Energy Yield", value: advancedResults?.columnTotals ? `${Math.round(advancedResults.columnTotals.npvEnergyYield).toLocaleString()} kWh` : 'N/A' },
                  { label: "LCOE Discount Rate", value: `${systemCosts.lcoeDiscountRate ?? 10}%` },
                ],
              }}
            />
            <FinancialMetricRow
              label="Initial Yield"
              value={`${initialYield.toFixed(2)}%`}
              breakdown={{
                formula: "((Total Income Y1 - O&M Y1 - Insurance Y1) ÷ Total Project Cost) × 100",
                inputs: [
                  { label: "Total Income Y1", value: `R ${Math.round(totalIncomeY1).toLocaleString()}` },
                  { label: "O&M Cost Y1", value: `R ${Math.round(omCostY1).toLocaleString()}` },
                  { label: "Insurance Y1", value: `R ${Math.round(insuranceY1).toLocaleString()}` },
                  { label: "Net Cashflow Y1", value: `R ${Math.round(netCashflowY1).toLocaleString()}` },
                  { label: "Total Project Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                ],
              }}
            />
            <FinancialMetricRow
              label="IRR"
              value={`${(advancedResults?.irr ?? basicFinancialMetrics.irr).toFixed(2)}%`}
              breakdown={{
                formula: "Rate where NPV of cashflows = 0",
                inputs: [
                  { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                  { label: "Annual Savings (Yr 1)", value: `R ${Math.round(financialResults.annualSavings).toLocaleString()}` },
                  { label: "Project Lifetime", value: `${advancedConfig.financial.projectLifetimeYears ?? 20} years` },
                  { label: "Tariff Escalation", value: `${advancedConfig.financial.tariffEscalationRate ?? 10}%` },
                ],
              }}
            />
            <FinancialMetricRow
              label="MIRR"
              value={`${(advancedResults?.mirr ?? basicFinancialMetrics.mirr).toFixed(2)}%`}
              breakdown={{
                formula: "[(FV Positives / PV Negatives)^(1/n)] - 1",
                inputs: [
                  { label: "Finance Rate", value: `${systemCosts.mirrFinanceRate ?? 10}%` },
                  { label: "Reinvestment Rate", value: `${systemCosts.mirrReinvestmentRate ?? 12}%` },
                  { label: "Project Lifetime", value: `${advancedConfig.financial.projectLifetimeYears ?? 20} years` },
                ],
              }}
            />
            <FinancialMetricRow
              label="Payback Period"
              value={formatPaybackPeriod(unifiedPaybackPeriod ?? financialResults.paybackYears)}
              breakdown={{
                formula: "Year when cumulative cashflow ≥ 0",
                inputs: [
                  { label: "System Cost", value: `R ${financialResults.systemCost.toLocaleString()}` },
                  { label: "Year 1 Savings", value: `R ${Math.round(financialResults.annualSavings).toLocaleString()}` },
                  { label: "Tariff Escalation", value: `${advancedConfig.financial.tariffEscalationRate ?? 10}%` },
                ],
              }}
            />
            <FinancialMetricRow
              label="NPV"
              value={Math.round(advancedResults?.npv ?? basicFinancialMetrics.npv).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              valueClassName={(advancedResults?.npv ?? basicFinancialMetrics.npv) >= 0 ? 'text-green-600' : 'text-red-600'}
              breakdown={{
                formula: "Σ (Cashflow_t ÷ (1 + r)^t)",
                inputs: [
                  { label: "System Cost (Year 0)", value: `-R ${financialResults.systemCost.toLocaleString()}` },
                  { label: "Annual Savings (Yr 1)", value: `R ${Math.round(financialResults.annualSavings).toLocaleString()}` },
                  { label: "Discount Rate", value: `${advancedConfig.financial.discountRate ?? 10}%` },
                  { label: "Project Lifetime", value: `${advancedConfig.financial.projectLifetimeYears ?? 20} years` },
                ],
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
