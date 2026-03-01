/**
 * DataComparisonTab – Extracted from SimulationChartTabs.
 * Renders the Solcast vs Generic side-by-side comparison.
 */

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, Sun } from "lucide-react";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Area, Line } from "recharts";
import { formatPaybackPeriod } from "@/lib/utils";
import type { AnnualEnergySimulationResults } from "./EnergySimulationEngine";
import type { FinancialResults } from "./FinancialAnalysis";

function DifferenceIndicator({ baseValue, compareValue, suffix = "", invert = false }: { baseValue: number; compareValue: number; suffix?: string; invert?: boolean }) {
  const diff = compareValue - baseValue;
  const pct = baseValue !== 0 ? (diff / baseValue) * 100 : 0;
  const isPositive = invert ? diff < 0 : diff > 0;
  if (Math.abs(pct) < 0.5) return null;
  return <span className={`text-xs ml-1 ${isPositive ? "text-green-600" : "text-amber-600"}`}>({pct > 0 ? "+" : ""}{pct.toFixed(1)}%{suffix})</span>;
}

interface DataComparisonTabProps {
  solarProfileSolcast: number[];
  solarProfileGeneric: number[];
  annualEnergyResultsGeneric: AnnualEnergySimulationResults;
  annualEnergyResultsSolcast: AnnualEnergySimulationResults;
  financialResultsGeneric: FinancialResults;
  financialResultsSolcast: FinancialResults | null;
  hasFinancialData: boolean;
  selectedLocationName: string;
}

export function DataComparisonTab({
  solarProfileSolcast, solarProfileGeneric,
  annualEnergyResultsGeneric, annualEnergyResultsSolcast,
  financialResultsGeneric, financialResultsSolcast,
  hasFinancialData, selectedLocationName,
}: DataComparisonTabProps) {
  const chartData = useMemo(() =>
    Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, "0")}:00`,
      generic: solarProfileGeneric[h],
      solcast: solarProfileSolcast[h],
      difference: solarProfileSolcast[h] - solarProfileGeneric[h],
    })),
    [solarProfileSolcast, solarProfileGeneric]
  );

  return (
    <div className="space-y-4">
      {/* Solar Profile Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5 text-primary" />Solar Generation Comparison</CardTitle>
          <CardDescription>Compare hourly solar output using Solcast real irradiance vs generic model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(v: number, name: string) => [`${v.toFixed(1)} kWh`, name === 'generic' ? 'Generic Model' : name === 'solcast' ? 'Solcast Forecast' : 'Difference']} />
                <Legend />
                <Area type="monotone" dataKey="generic" name="Generic Model" fill="hsl(var(--muted))" stroke="hsl(var(--muted-foreground))" fillOpacity={0.3} />
                <Line type="monotone" dataKey="solcast" name="Solcast Forecast" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Energy Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Generic Model */}
        <Card className="border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Sun className="h-4 w-4 text-muted-foreground" />Generic Model (PVWatts-style)</CardTitle>
            <CardDescription className="text-xs">Based on average historical GHI for {selectedLocationName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Daily Solar</p><p className="text-lg font-semibold">{(annualEnergyResultsGeneric.totalAnnualSolar / 365).toFixed(0)} kWh</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Grid Import</p><p className="text-lg font-semibold">{(annualEnergyResultsGeneric.totalAnnualGridImport / 365).toFixed(0)} kWh</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Self-Consumption</p><p className="text-lg font-semibold">{Math.round(annualEnergyResultsGeneric.selfConsumptionRate)}%</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Peak Reduction</p><p className="text-lg font-semibold">{Math.round(annualEnergyResultsGeneric.peakReduction)}%</p></div>
            </div>
            {hasFinancialData && (
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Annual Savings</span><span className="text-green-600">R{Math.round(financialResultsGeneric.annualSavings).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Payback</span><span>{formatPaybackPeriod(financialResultsGeneric.paybackYears)}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Solcast */}
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Cloud className="h-4 w-4 text-primary" />Solcast Forecast<Badge variant="outline" className="text-xs text-primary border-primary ml-auto">Real Data</Badge></CardTitle>
            <CardDescription className="text-xs">Based on 7-day weather forecast for actual location</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Daily Solar</p><p className="text-lg font-semibold">{(annualEnergyResultsSolcast.totalAnnualSolar / 365).toFixed(0)} kWh<DifferenceIndicator baseValue={annualEnergyResultsGeneric.totalAnnualSolar / 365} compareValue={annualEnergyResultsSolcast.totalAnnualSolar / 365} /></p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Grid Import</p><p className="text-lg font-semibold">{(annualEnergyResultsSolcast.totalAnnualGridImport / 365).toFixed(0)} kWh<DifferenceIndicator baseValue={annualEnergyResultsGeneric.totalAnnualGridImport / 365} compareValue={annualEnergyResultsSolcast.totalAnnualGridImport / 365} invert /></p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Self-Consumption</p><p className="text-lg font-semibold">{Math.round(annualEnergyResultsSolcast.selfConsumptionRate)}%</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Peak Reduction</p><p className="text-lg font-semibold">{Math.round(annualEnergyResultsSolcast.peakReduction)}%</p></div>
            </div>
            {hasFinancialData && financialResultsSolcast && (
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Annual Savings</span><span className="text-green-600">R{Math.round(financialResultsSolcast.annualSavings).toLocaleString()}<DifferenceIndicator baseValue={financialResultsGeneric.annualSavings} compareValue={financialResultsSolcast.annualSavings} /></span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Payback</span><span>{formatPaybackPeriod(financialResultsSolcast.paybackYears)}<DifferenceIndicator baseValue={financialResultsGeneric.paybackYears} compareValue={financialResultsSolcast.paybackYears} invert /></span></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Impact Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Accuracy Impact Summary</CardTitle>
          <CardDescription className="text-xs">How real weather data affects your simulation results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Solar Output</p>
              <p className={`text-lg font-semibold ${annualEnergyResultsSolcast.totalAnnualSolar >= annualEnergyResultsGeneric.totalAnnualSolar ? "text-green-600" : "text-amber-600"}`}>
                {((annualEnergyResultsSolcast.totalAnnualSolar - annualEnergyResultsGeneric.totalAnnualSolar) / annualEnergyResultsGeneric.totalAnnualSolar * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Grid Import</p>
              <p className={`text-lg font-semibold ${annualEnergyResultsSolcast.totalAnnualGridImport <= annualEnergyResultsGeneric.totalAnnualGridImport ? "text-green-600" : "text-amber-600"}`}>
                {((annualEnergyResultsSolcast.totalAnnualGridImport - annualEnergyResultsGeneric.totalAnnualGridImport) / annualEnergyResultsGeneric.totalAnnualGridImport * 100).toFixed(1)}%
              </p>
            </div>
            {hasFinancialData && financialResultsSolcast && (
              <>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Savings</p>
                  <p className={`text-lg font-semibold ${financialResultsSolcast.annualSavings >= financialResultsGeneric.annualSavings ? "text-green-600" : "text-amber-600"}`}>
                    {((financialResultsSolcast.annualSavings - financialResultsGeneric.annualSavings) / financialResultsGeneric.annualSavings * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Payback</p>
                  <p className={`text-lg font-semibold ${financialResultsSolcast.paybackYears <= financialResultsGeneric.paybackYears ? "text-green-600" : "text-amber-600"}`}>
                    {((financialResultsSolcast.paybackYears - financialResultsGeneric.paybackYears) / financialResultsGeneric.paybackYears * 100).toFixed(1)}%
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
