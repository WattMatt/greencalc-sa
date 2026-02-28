/**
 * SimulationKPICards - Energy Results Summary
 * 
 * Displays key performance indicators derived from the annual 8,760-hour simulation.
 * All values are tariff-independent energy metrics.
 */

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AnnualPVsystResult } from "@/lib/pvsystLossChain";

interface SimulationKPICardsProps {
  annualLoad: number;          // kWh/year
  annualSolar: number;         // kWh/year
  annualGridImport: number;    // kWh/year
  selfConsumptionRate: number; // %
  peakReduction: number;       // %
  includesSolar: boolean;
  annualPVsystResult: AnnualPVsystResult | null;
  reductionFactor: number;     // 1 - (productionReductionPercent / 100)
}

export function SimulationKPICards({
  annualLoad,
  annualSolar,
  annualGridImport,
  selfConsumptionRate,
  peakReduction,
  includesSolar,
  annualPVsystResult,
  reductionFactor,
}: SimulationKPICardsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Daily Load</CardDescription>
          <CardTitle className="text-2xl">{Math.round(annualLoad / 365)} kWh</CardTitle>
        </CardHeader>
      </Card>
      {includesSolar && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Solar Generated</CardDescription>
            <CardTitle className="text-2xl text-amber-500">
              {Math.round(annualSolar / 365)} kWh
            </CardTitle>
          </CardHeader>
        </Card>
      )}
      {includesSolar && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Annual Production</CardDescription>
            <CardTitle className="text-2xl text-chart-2">
              {annualPVsystResult
                ? Math.round(annualPVsystResult.eGrid * reductionFactor).toLocaleString()
                : Math.round(annualSolar).toLocaleString()} kWh
            </CardTitle>
            {annualPVsystResult && (
              <p className="text-xs text-muted-foreground">
                {Math.round(annualPVsystResult.specificYield * reductionFactor).toLocaleString()} kWh/kWp • PR: {annualPVsystResult.performanceRatio.toFixed(1)}%
              </p>
            )}
          </CardHeader>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Grid Import</CardDescription>
          <CardTitle className="text-2xl">{Math.round(annualGridImport / 365)} kWh</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Self-Consumption</CardDescription>
          <CardTitle className="text-2xl text-green-600">
            {Math.round(selfConsumptionRate)}%
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Peak Reduction</CardDescription>
          <CardTitle className="text-2xl">
            {Math.round(peakReduction)}%
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
