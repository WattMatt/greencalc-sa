import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SimulationData, YearlyProjection, formatCurrency, formatNumber } from "../types";
import { ProposalTemplate } from "../templates/types";
import { cn } from "@/lib/utils";

interface CashflowTableSectionProps {
  simulation: SimulationData;
  template: ProposalTemplate;
  forPDF?: boolean;
  showAllYears?: boolean;
}

// Local formatting helpers for table
function formatTableCurrency(value: number): string {
  if (value === 0) return "—";
  const formatted = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return value < 0 ? `(R ${formatted})` : `R ${formatted}`;
}

function formatTableNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function CashflowTableSection({ simulation, template, forPDF, showAllYears = true }: CashflowTableSectionProps) {
  const primaryColor = template.colors.accentColor;
  
  // Use simulation's yearlyProjections if available, otherwise generate basic projection
  const projections: YearlyProjection[] = simulation.yearlyProjections || generateBasicProjection(simulation);
  
  // Find payback year (first year where cumulative >= 0)
  const paybackYearIndex = projections.findIndex(p => p.cumulativeCashflow >= 0);
  const paybackYear = paybackYearIndex >= 0 ? projections[paybackYearIndex].year : null;
  
  // Calculate initial investment (Year 0 cumulative)
  const initialInvestment = simulation.systemCost;
  
  // Check if demand columns should be shown
  const hasDemandSavings = simulation.demandSavingKva && simulation.demandSavingKva > 0;
  
  // Display years based on prop
  const displayedProjections = showAllYears ? projections : projections.slice(0, 10);

  const cellClasses = forPDF ? "text-[10px] py-1 px-2" : "text-xs py-2";
  const headerClasses = forPDF ? "text-[9px] py-1 px-2 font-semibold" : "text-[10px] py-2 font-semibold";

  return (
    <div className={forPDF ? "break-inside-avoid" : "p-6"}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">20-Year Cashflow Projection</h2>
        {paybackYear && (
          <Badge 
            variant="outline" 
            className="text-xs border-primary/30 bg-primary/5"
            style={{ borderColor: `${primaryColor}50`, backgroundColor: `${primaryColor}10` }}
          >
            Payback: Year {paybackYear}
          </Badge>
        )}
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className={cn(headerClasses, "w-14 text-center sticky left-0 bg-muted/50")}>Year</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>Energy Yield</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>Index</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>Rate (R/kWh)</TableHead>
                <TableHead className={cn(headerClasses, "text-right bg-green-500/5")}>Energy Income</TableHead>
                {hasDemandSavings && (
                  <>
                    <TableHead className={cn(headerClasses, "text-right")}>Demand kVA</TableHead>
                    <TableHead className={cn(headerClasses, "text-right")}>Rate (R/kVA)</TableHead>
                    <TableHead className={cn(headerClasses, "text-right bg-green-500/5")}>Demand Income</TableHead>
                  </>
                )}
                <TableHead className={cn(headerClasses, "text-right font-bold bg-green-500/10")}>Total Income</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>Insurance</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>O&M</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>Replacements</TableHead>
                <TableHead className={cn(headerClasses, "text-right font-bold bg-amber-500/10")}>Total Cost</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>Net Cashflow</TableHead>
                <TableHead className={cn(headerClasses, "text-right")}>Cumulative</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Year 0 - Initial Investment */}
              <TableRow className="bg-destructive/5 border-b-2 border-destructive/20">
                <TableCell className={cn(cellClasses, "text-center font-bold sticky left-0 bg-destructive/5")}>0</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground bg-green-500/5")}>—</TableCell>
                {hasDemandSavings && (
                  <>
                    <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                    <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                    <TableCell className={cn(cellClasses, "text-right text-muted-foreground bg-green-500/5")}>—</TableCell>
                  </>
                )}
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground bg-green-500/10")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right text-muted-foreground bg-amber-500/10")}>—</TableCell>
                <TableCell className={cn(cellClasses, "text-right font-bold text-destructive")}>
                  (R {formatTableNumber(initialInvestment)})
                </TableCell>
                <TableCell className={cn(cellClasses, "text-right font-bold text-destructive")}>
                  (R {formatTableNumber(initialInvestment)})
                </TableCell>
              </TableRow>
              
              {displayedProjections.map((row, index) => {
                const isPaybackYear = paybackYear !== null && row.year === paybackYear;
                const previousWasNegative = index === 0 || projections[index - 1]?.cumulativeCashflow < 0;
                const isPaybackTransition = isPaybackYear && previousWasNegative;
                const isPositive = row.cumulativeCashflow >= 0;
                const totalCost = (row.oAndM || 0) + (row.insurance || 0) + (row.replacementCost || 0);
                
                return (
                  <TableRow 
                    key={row.year}
                    className={cn(
                      isPaybackTransition && "bg-primary/10 border-l-4",
                      !isPaybackTransition && index % 2 === 1 && "bg-muted/30"
                    )}
                    style={isPaybackTransition ? { borderLeftColor: primaryColor } : undefined}
                  >
                    <TableCell className={cn(
                      cellClasses, 
                      "text-center font-bold sticky left-0",
                      isPaybackTransition ? "bg-primary/10" : index % 2 === 1 ? "bg-muted/30" : "bg-background"
                    )}>
                      <div className="flex items-center justify-center gap-1">
                        {row.year}
                        {isPaybackTransition && (
                          <Badge 
                            variant="default" 
                            className="text-[8px] px-1 py-0 h-4"
                            style={{ backgroundColor: primaryColor }}
                          >
                            ★
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right")}>
                      {formatTableNumber(row.energyYield)}
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right text-muted-foreground")}>
                      {formatTableNumber(row.energyIndex, 3)}
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right")} style={{ color: primaryColor }}>
                      {formatTableNumber(row.energyRate, 4)}
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right text-green-600 bg-green-500/5")}>
                      {formatTableCurrency(row.energyIncome)}
                    </TableCell>
                    {hasDemandSavings && (
                      <>
                        <TableCell className={cn(cellClasses, "text-right")}>
                          {row.demandSavingKva > 0 ? formatTableNumber(row.demandSavingKva, 1) : "—"}
                        </TableCell>
                        <TableCell className={cn(cellClasses, "text-right")} style={{ color: primaryColor }}>
                          {row.demandRate > 0 ? formatTableNumber(row.demandRate, 2) : "—"}
                        </TableCell>
                        <TableCell className={cn(cellClasses, "text-right text-green-600 bg-green-500/5")}>
                          {row.demandIncome > 0 ? formatTableCurrency(row.demandIncome) : "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className={cn(cellClasses, "text-right font-semibold text-green-600 bg-green-500/10")}>
                      {formatTableCurrency(row.totalIncome)}
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right text-amber-600")}>
                      {row.insurance > 0 ? `(${formatTableNumber(row.insurance)})` : "—"}
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right text-amber-600")}>
                      {row.oAndM > 0 ? `(${formatTableNumber(row.oAndM)})` : "—"}
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right text-amber-600")}>
                      {row.replacementCost > 0 ? `(${formatTableNumber(row.replacementCost)})` : "—"}
                    </TableCell>
                    <TableCell className={cn(cellClasses, "text-right font-semibold text-amber-600 bg-amber-500/10")}>
                      {totalCost > 0 ? `(${formatTableNumber(totalCost)})` : "—"}
                    </TableCell>
                    <TableCell className={cn(
                      cellClasses, 
                      "text-right font-semibold",
                      row.netCashflow >= 0 ? "text-green-600" : "text-destructive"
                    )}>
                      {row.netCashflow >= 0 
                        ? formatTableCurrency(row.netCashflow) 
                        : `(R ${formatTableNumber(Math.abs(row.netCashflow))})`}
                    </TableCell>
                    <TableCell className={cn(
                      cellClasses, 
                      "text-right font-bold",
                      isPositive ? "text-green-600" : "text-destructive"
                    )}>
                      {isPositive 
                        ? formatTableCurrency(row.cumulativeCashflow) 
                        : `(R ${formatTableNumber(Math.abs(row.cumulativeCashflow))})`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border-l-4" 
              style={{ borderLeftColor: primaryColor, backgroundColor: `${primaryColor}15` }} 
            />
            <span className="text-muted-foreground">Payback Year</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/10 border border-green-500/30" />
            <span className="text-muted-foreground">Income</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500/10 border border-amber-500/30" />
            <span className="text-muted-foreground">Costs</span>
          </div>
        </div>
        {!showAllYears && projections.length > 10 && (
          <span className="text-muted-foreground">
            Showing years 1-10 of {projections.length}
          </span>
        )}
      </div>
    </div>
  );
}

// Generate basic projection if yearlyProjections not available
function generateBasicProjection(simulation: SimulationData): YearlyProjection[] {
  const projections: YearlyProjection[] = [];
  let cumulativeCashflow = -simulation.systemCost;
  
  const annualDegradation = 0.005;
  const tariffEscalation = 0.08;
  const inflationRate = 0.06;
  const baseRate = simulation.annualSavings / simulation.annualSolarGeneration;
  const baseOM = simulation.systemCost * 0.01; // 1% O&M
  const baseInsurance = simulation.systemCost * 0.01; // 1% Insurance

  for (let year = 1; year <= 20; year++) {
    const degradationFactor = Math.pow(1 - annualDegradation, year - 1);
    const escalationFactor = Math.pow(1 + tariffEscalation, year - 1);
    const inflationFactor = Math.pow(1 + inflationRate, year - 1);
    
    const energyYield = simulation.annualSolarGeneration * degradationFactor;
    const energyRate = baseRate * escalationFactor;
    const energyIncome = energyYield * energyRate;
    const oAndM = baseOM * inflationFactor;
    const insurance = baseInsurance * inflationFactor;
    const replacementCost = year === 10 ? simulation.systemCost * 0.12 : 0; // 12% battery replacement at Y10
    
    const totalIncome = energyIncome;
    const netCashflow = totalIncome - oAndM - insurance - replacementCost;
    cumulativeCashflow += netCashflow;

    projections.push({
      year,
      energyYield: Math.round(energyYield),
      energyIndex: degradationFactor,
      energyRate,
      energyIncome: Math.round(energyIncome),
      demandSavingKva: 0,
      demandIndex: 1,
      demandRate: 0,
      demandIncome: 0,
      totalIncome: Math.round(totalIncome),
      insurance: Math.round(insurance),
      oAndM: Math.round(oAndM),
      totalCost: Math.round(oAndM + insurance),
      replacementCost: Math.round(replacementCost),
      netCashflow: Math.round(netCashflow),
      cumulativeCashflow: Math.round(cumulativeCashflow),
    });
  }

  return projections;
}
