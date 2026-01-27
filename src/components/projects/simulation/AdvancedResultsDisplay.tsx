import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, DollarSign, Zap, Calendar, TableIcon } from "lucide-react";
import { AdvancedFinancialResults, YearlyProjection } from "./AdvancedSimulationTypes";
import { useMemo } from "react";
import { formatPaybackPeriod } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  ReferenceLine,
} from "recharts";

interface AdvancedResultsDisplayProps {
  results: AdvancedFinancialResults;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Generate monthly data points from yearly projections for more granular chart
function generateMonthlyCashflowData(yearlyProjections: YearlyProjection[]): { 
  monthlyData: Array<{ month: number; year: number; label: string; cumulativeCashFlow: number }>;
  breakEvenMonth: { year: number; month: number } | null;
} {
  const monthlyData: Array<{ month: number; year: number; label: string; cumulativeCashFlow: number }> = [];
  let breakEvenMonth: { year: number; month: number } | null = null;
  
  // Add Year 0 (initial investment) as month 0
  if (yearlyProjections.length > 0) {
    const firstYear = yearlyProjections[0];
    // The first projection is Year 1, but we need Year 0's cumulative (initial investment)
    // Year 0 cumulative = Year 1 cumulative - Year 1 net cashflow
    const year0Cumulative = firstYear.cumulativeCashFlow - firstYear.netCashFlow;
    monthlyData.push({ month: 0, year: 0, label: "Y0", cumulativeCashFlow: year0Cumulative });
  }
  
  for (let i = 0; i < yearlyProjections.length; i++) {
    const currentYear = yearlyProjections[i];
    const previousCumulative = i === 0 
      ? (currentYear.cumulativeCashFlow - currentYear.netCashFlow)
      : yearlyProjections[i - 1].cumulativeCashFlow;
    
    const annualNetCashflow = currentYear.netCashFlow;
    const monthlyNetCashflow = annualNetCashflow / 12;
    
    // Generate 12 monthly data points for this year
    for (let m = 1; m <= 12; m++) {
      const monthNumber = (currentYear.year - 1) * 12 + m;
      const cumulativeCashFlow = previousCumulative + (monthlyNetCashflow * m);
      
      // Label format: Y1-M1, Y1-M2, etc. but only show year labels at month 1
      const label = m === 1 ? `Y${currentYear.year}` : "";
      
      monthlyData.push({
        month: monthNumber,
        year: currentYear.year,
        label,
        cumulativeCashFlow
      });
      
      // Check for breakeven crossing
      if (breakEvenMonth === null && cumulativeCashFlow >= 0) {
        breakEvenMonth = { year: currentYear.year, month: m };
      }
    }
  }
  
  return { monthlyData, breakEvenMonth };
}

export function AdvancedResultsDisplay({ results }: AdvancedResultsDisplayProps) {
  // Generate monthly data for the cashflow chart
  const { monthlyData } = generateMonthlyCashflowData(results.yearlyProjections);
  
  // Calculate interpolated payback from yearly projections (same logic as AdvancedSimulationEngine)
  // This serves as a fallback when sensitivityResults is not available
  const paybackPeriod = useMemo(() => {
    // Use sensitivityResults if available (preferred source)
    if (results.sensitivityResults?.expected.payback) {
      return results.sensitivityResults.expected.payback;
    }
    
    // Fallback: calculate interpolated payback from yearlyProjections
    const projections = results.yearlyProjections;
    const breakeven = projections.find(p => p.cumulativeCashFlow >= 0);
    if (!breakeven) return null; // No payback within projection period
    
    // Interpolate for more accurate payback
    const prevYear = projections[breakeven.year - 2];
    if (!prevYear) return breakeven.year;
    
    const remaining = Math.abs(prevYear.cumulativeCashFlow);
    const fraction = remaining / breakeven.netCashFlow;
    
    return breakeven.year - 1 + fraction;
  }, [results.yearlyProjections, results.sensitivityResults]);
  
  // Calculate column totals for the cashflow table
  const totals = useMemo(() => {
    const projections = results.yearlyProjections;
    return {
      energyYield: projections.reduce((sum, p) => sum + (p.energyYield ?? p.solarGeneration ?? 0), 0),
      discountedEnergyYield: projections.reduce((sum, p) => sum + (p.discountedEnergyYield ?? 0), 0),
      totalIncome: projections.reduce((sum, p) => sum + (p.totalIncomeR ?? p.energySavings ?? 0), 0),
      insurance: projections.reduce((sum, p) => sum + (p.insuranceCostR ?? 0), 0),
      oAndM: projections.reduce((sum, p) => sum + (p.maintenanceCost ?? 0), 0),
      replacements: projections.reduce((sum, p) => sum + (p.replacementCost ?? 0), 0),
      totalCost: projections.reduce((sum, p) => sum + (p.totalCostR ?? p.maintenanceCost ?? 0) + (p.replacementCost ?? 0), 0),
      netCashflow: projections.reduce((sum, p) => sum + (p.netCashFlow ?? 0), 0),
      presentValue: projections.reduce((sum, p) => sum + (p.presentValue ?? 0), 0),
    };
  }, [results.yearlyProjections]);
  
  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="NPV"
          value={formatCurrency(results.npv)}
          icon={<DollarSign className="h-4 w-4" />}
          variant={results.npv > 0 ? "positive" : "negative"}
          tooltip="Net Present Value of all cash flows"
        />
        <MetricCard
          label="IRR"
          value={`${formatNumber(results.irr)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          variant={results.irr > 10 ? "positive" : results.irr > 0 ? "neutral" : "negative"}
          tooltip="Internal Rate of Return"
        />
        <MetricCard
          label="LCOE"
          value={`R${formatNumber(results.lcoe, 2)}/kWh`}
          icon={<Zap className="h-4 w-4" />}
          variant="neutral"
          tooltip="Levelized Cost of Energy"
        />
        <MetricCard
          label="Payback"
          value={paybackPeriod 
            ? formatPaybackPeriod(paybackPeriod)
            : ">25 years"}
          icon={<Calendar className="h-4 w-4" />}
          variant={paybackPeriod && paybackPeriod < 7 
            ? "positive" 
            : paybackPeriod && paybackPeriod < 12 
              ? "neutral" 
              : "negative"}
          tooltip="Years to break even"
        />
      </div>

      {/* Sensitivity Analysis */}
      {results.sensitivityResults && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sensitivity Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <SensitivityCard
                label="Best Case"
                npv={results.sensitivityResults.best.npv}
                irr={results.sensitivityResults.best.irr}
                payback={results.sensitivityResults.best.payback}
                assumptions={results.sensitivityResults.best.assumptions}
                variant="positive"
              />
              <SensitivityCard
                label="Expected"
                npv={results.sensitivityResults.expected.npv}
                irr={results.sensitivityResults.expected.irr}
                payback={results.sensitivityResults.expected.payback}
                variant="neutral"
              />
              <SensitivityCard
                label="Worst Case"
                npv={results.sensitivityResults.worst.npv}
                irr={results.sensitivityResults.worst.irr}
                payback={results.sensitivityResults.worst.payback}
                assumptions={results.sensitivityResults.worst.assumptions}
                variant="negative"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <Tabs defaultValue="cashflow" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Table</TabsTrigger>
          <TabsTrigger value="generation">Generation</TabsTrigger>
          <TabsTrigger value="degradation">Degradation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="cashflow" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Cumulative Cash Flow</span>
              {paybackPeriod && paybackPeriod < 25 && (
                <Badge variant="outline" className="text-xs">
                  Break-even: {formatPaybackPeriod(paybackPeriod)}
                </Badge>
              )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => {
                        // Show year labels at year boundaries (month 1, 13, 25, etc.)
                        if (v === 0) return "Y0";
                        const year = Math.ceil(v / 12);
                        const month = v % 12 || 12;
                        // Only show year labels at January of each year
                        return month === 1 ? `Y${year}` : "";
                      }}
                      interval={11} // Show tick every 12 months (at year start)
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(monthNum) => {
                        if (monthNum === 0) return "Initial Investment";
                        const year = Math.ceil(monthNum / 12);
                        const month = monthNum % 12 || 12;
                        return `Year ${year}, Month ${month}`;
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="cumulativeCashFlow"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                      name="Cumulative Cash Flow"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TableIcon className="h-4 w-4" />
                20-Year Cashflow Breakdown (Income Model)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center sticky left-0 bg-background">Year</TableHead>
                      <TableHead className="text-right">Energy Yield (kWh)</TableHead>
                      <TableHead className="text-right">Energy Index</TableHead>
                      <TableHead className="text-right">Energy Rate (R/kWh)</TableHead>
                      <TableHead className="text-right">Energy Income</TableHead>
                      <TableHead className="text-right">Demand kVA</TableHead>
                      <TableHead className="text-right">Demand Index</TableHead>
                      <TableHead className="text-right">Demand Rate (R/kVA)</TableHead>
                      <TableHead className="text-right">Demand Income</TableHead>
                      <TableHead className="text-right bg-green-500/5">Total Income</TableHead>
                      <TableHead className="text-right">Insurance</TableHead>
                      <TableHead className="text-right">O&M</TableHead>
                      <TableHead className="text-right">Replacements</TableHead>
                      <TableHead className="text-right bg-amber-500/5">Total Cost</TableHead>
                      <TableHead className="text-right">Net Cashflow</TableHead>
                      <TableHead className="text-right text-muted-foreground">PV Reduction Factor</TableHead>
                      <TableHead className="text-right">Present Value</TableHead>
                      <TableHead className="text-right">Cumulative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Year 0 - Initial Investment */}
                    <TableRow className="bg-destructive/5">
                      <TableCell className="text-center font-medium sticky left-0 bg-destructive/5">0</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground bg-green-500/5">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground bg-amber-500/5">-</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        -{formatCurrency(Math.abs(results.yearlyProjections[0]?.cumulativeCashFlow - results.yearlyProjections[0]?.netCashFlow || 0))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">1.0000</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        -{formatCurrency(Math.abs(results.yearlyProjections[0]?.cumulativeCashFlow - results.yearlyProjections[0]?.netCashFlow || 0))}
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        -{formatCurrency(Math.abs(results.yearlyProjections[0]?.cumulativeCashFlow - results.yearlyProjections[0]?.netCashFlow || 0))}
                      </TableCell>
                    </TableRow>
                    {results.yearlyProjections.map((proj, idx) => {
                      const isPaybackYear = proj.cumulativeCashFlow >= 0 && (idx === 0 || results.yearlyProjections[idx - 1]?.cumulativeCashFlow < 0);
                      return (
                        <TableRow 
                          key={proj.year} 
                          className={isPaybackYear ? "bg-green-500/10 font-medium" : ""}
                        >
                          <TableCell className={`text-center font-medium sticky left-0 ${isPaybackYear ? "bg-green-500/10" : "bg-background"}`}>
                            {proj.year}
                            {isPaybackYear && <Badge variant="outline" className="ml-1 text-[10px] px-1">Payback</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(proj.energyYield ?? proj.solarGeneration, 0)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatNumber(proj.energyRateIndex ?? 1, 2)}
                          </TableCell>
                          <TableCell className="text-right text-primary">
                            R{formatNumber(proj.energyRateR ?? proj.tariffRate ?? 0, 4)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(proj.energyIncomeR ?? proj.energySavings)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(proj.demandSavingKva ?? 0, 1)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatNumber(proj.demandRateIndex ?? 1, 2)}
                          </TableCell>
                          <TableCell className="text-right text-primary">
                            {(proj.demandRateR ?? 0) > 0 
                              ? `R${formatNumber(proj.demandRateR, 2)}`
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(proj.demandIncomeR ?? 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600 bg-green-500/5">
                            {formatCurrency(proj.totalIncomeR ?? proj.energySavings)}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {proj.insuranceCostR > 0 ? `-${formatCurrency(proj.insuranceCostR)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            -{formatCurrency(proj.maintenanceCost)}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {(proj.replacementCost ?? 0) > 0 ? `-${formatCurrency(proj.replacementCost)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-amber-600 bg-amber-500/5">
                            -{formatCurrency((proj.totalCostR ?? proj.maintenanceCost) + (proj.replacementCost ?? 0))}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${proj.netCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {proj.netCashFlow >= 0 ? formatCurrency(proj.netCashFlow) : `-${formatCurrency(Math.abs(proj.netCashFlow))}`}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatNumber(proj.pvReductionFactor ?? 0, 4)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${(proj.presentValue ?? 0) >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {(proj.presentValue ?? 0) >= 0 ? formatCurrency(proj.presentValue ?? 0) : `-${formatCurrency(Math.abs(proj.presentValue ?? 0))}`}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${proj.cumulativeCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {proj.cumulativeCashFlow >= 0 ? formatCurrency(proj.cumulativeCashFlow) : `-${formatCurrency(Math.abs(proj.cumulativeCashFlow))}`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell className="text-center sticky left-0 bg-muted/50 font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-bold">{formatNumber(totals.energyYield, 0)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right font-bold text-green-600 bg-green-500/10">{formatCurrency(totals.totalIncome)}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600">-{formatCurrency(totals.insurance)}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600">-{formatCurrency(totals.oAndM)}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600">-{formatCurrency(totals.replacements)}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600 bg-amber-500/10">-{formatCurrency(totals.totalCost)}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{formatCurrency(totals.netCashflow)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{formatCurrency(totals.presentValue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="generation" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Annual Energy Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.yearlyProjections}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="year" 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `Y${v}`}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${formatNumber(value, 0)} kWh`}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="solarGeneration"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={false}
                      name="Solar Generation"
                    />
                    <Line
                      type="monotone"
                      dataKey="loadConsumption"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                      name="Load"
                    />
                    <Line
                      type="monotone"
                      dataKey="gridImport"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      dot={false}
                      name="Grid Import"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="degradation" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Degradation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.yearlyProjections}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="year" 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `Y${v}`}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      domain={[60, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${formatNumber(value)}%`}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="panelEfficiency"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={false}
                      name="Panel Efficiency"
                    />
                    <Line
                      type="monotone"
                      dataKey="batteryCapacityRemaining"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      dot={false}
                      name="Battery Capacity"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Lifetime Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Generation</div>
              <div className="font-medium">{formatNumber(results.lifetimeGeneration / 1000, 0)} MWh</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Savings</div>
              <div className="font-medium">{formatCurrency(results.lifetimeSavings)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Final Year Generation</div>
              <div className="font-medium">
                {formatNumber(results.yearlyProjections[results.yearlyProjections.length - 1]?.solarGeneration / 1000, 0)} MWh
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Final Year Savings</div>
              <div className="font-medium">
                {formatCurrency(results.yearlyProjections[results.yearlyProjections.length - 1]?.energySavings)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= Helper Components =============

function MetricCard({ 
  label, 
  value, 
  icon, 
  variant = "neutral",
  tooltip 
}: { 
  label: string; 
  value: string; 
  icon: React.ReactNode;
  variant?: "positive" | "negative" | "neutral";
  tooltip?: string;
}) {
  const variantStyles = {
    positive: "border-green-500/30 bg-green-500/5",
    negative: "border-destructive/30 bg-destructive/5",
    neutral: "border-border bg-card",
  };
  
  return (
    <Card className={`${variantStyles[variant]}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className="text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SensitivityCard({
  label,
  npv,
  irr,
  payback,
  assumptions,
  variant,
}: {
  label: string;
  npv: number;
  irr: number;
  payback: number;
  assumptions?: string;
  variant: "positive" | "negative" | "neutral";
}) {
  const variantStyles = {
    positive: "border-green-500/30 bg-green-500/5",
    negative: "border-destructive/30 bg-destructive/5",
    neutral: "border-border bg-card",
  };
  
  return (
    <div className={`p-3 rounded-lg border ${variantStyles[variant]}`}>
      <div className="text-xs font-medium mb-2">{label}</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">NPV:</span>
          <span className="font-medium">{formatCurrency(npv)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IRR:</span>
          <span className="font-medium">{formatNumber(irr)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Payback:</span>
          <span className="font-medium">{formatPaybackPeriod(payback)}</span>
        </div>
      </div>
      {assumptions && (
        <div className="mt-2 text-[10px] text-muted-foreground">{assumptions}</div>
      )}
    </div>
  );
}

export default AdvancedResultsDisplay;
