import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sun, Battery, TrendingUp, Calendar, Banknote, AlertTriangle, Info } from "lucide-react";

export interface QuickEstimateOutput {
  // Energy
  annualGeneration: number;
  dailyGeneration: number;
  selfConsumption: number;
  gridExport: number;
  solarCoverage: number;
  
  // Financial
  annualSavings: number;
  systemCost: number;
  paybackYears: number;
  roi20Years: number;
  lcoe: number;
  
  // Assumptions used
  assumptions: {
    peakSunHours: number;
    systemLosses: number;
    tariffRate: number;
    tariffEscalation: number;
    solarCostPerKw: number;
    batteryCostPerKwh: number;
  };
}

interface QuickEstimateResultsProps {
  results: QuickEstimateOutput | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function QuickEstimateResults({ results }: QuickEstimateResultsProps) {
  if (!results) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Sun className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Enter system parameters and click Calculate to see results</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estimate Disclaimer */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>ESTIMATE ONLY</strong> — These figures are indicative with ±20% accuracy. 
          For detailed analysis, use Profile Builder with actual load data.
        </AlertDescription>
      </Alert>

      {/* Energy Production */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            Energy Production
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-primary">
              {formatNumber(results.annualGeneration)} kWh
            </p>
            <p className="text-xs text-muted-foreground">Annual Generation</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {formatNumber(results.dailyGeneration)} kWh
            </p>
            <p className="text-xs text-muted-foreground">Daily Average</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-green-600">
              {results.solarCoverage.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Solar Coverage</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {formatNumber(results.selfConsumption)} kWh
            </p>
            <p className="text-xs text-muted-foreground">Self-Consumed</p>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4 text-green-600" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(results.annualSavings)}
              </p>
              <p className="text-xs text-muted-foreground">Annual Savings (Year 1)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatCurrency(results.systemCost)}
              </p>
              <p className="text-xs text-muted-foreground">Estimated System Cost</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-xl font-bold">{results.paybackYears.toFixed(1)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Payback (years)</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xl font-bold">{results.roi20Years.toFixed(0)}%</p>
              </div>
              <p className="text-xs text-muted-foreground">20-Year ROI</p>
            </div>
            <div>
              <p className="text-xl font-bold">R{results.lcoe.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">LCOE (R/kWh)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assumptions Used */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Assumptions Used
          </CardTitle>
          <CardDescription>
            Default values applied to this estimate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peak Sun Hours:</span>
              <span>{results.assumptions.peakSunHours} hrs/day</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">System Losses:</span>
              <span>{results.assumptions.systemLosses}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tariff Rate:</span>
              <span>R{results.assumptions.tariffRate.toFixed(2)}/kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tariff Escalation:</span>
              <span>{results.assumptions.tariffEscalation}%/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Solar Cost:</span>
              <span>R{formatNumber(results.assumptions.solarCostPerKw)}/kWp</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Battery Cost:</span>
              <span>R{formatNumber(results.assumptions.batteryCostPerKwh)}/kWh</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
