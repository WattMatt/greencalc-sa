import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimulationData, YearlyProjection, formatCurrency, formatNumber, formatPercent } from "../types";
import { ProposalTemplate } from "../templates/types";
import { cn } from "@/lib/utils";

interface CashflowTableSectionProps {
  simulation: SimulationData;
  template: ProposalTemplate;
  forPDF?: boolean;
  showAllYears?: boolean;
}

export function CashflowTableSection({ simulation, template, forPDF, showAllYears = false }: CashflowTableSectionProps) {
  const primaryColor = template.colors.accentColor;
  
  // Use simulation's yearlyProjections if available, otherwise generate basic projection
  const projections: YearlyProjection[] = simulation.yearlyProjections || generateBasicProjection(simulation);
  
  // Find payback year
  const paybackYear = projections.findIndex(p => p.cumulativeCashflow >= 0) + 1;
  
  // Display either first 10 years or all 20
  const displayedProjections = showAllYears ? projections : projections.slice(0, 10);

  return (
    <div className={forPDF ? "" : "p-6"}>
      <h2 className="text-lg font-semibold mb-4">20-Year Cashflow Projection</h2>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-xs font-semibold">Year</TableHead>
                <TableHead className="text-xs font-semibold text-right">Energy Yield</TableHead>
                <TableHead className="text-xs font-semibold text-right">Energy Rate</TableHead>
                <TableHead className="text-xs font-semibold text-right">Energy Income</TableHead>
                {simulation.demandSavingKva && (
                  <>
                    <TableHead className="text-xs font-semibold text-right">Demand Income</TableHead>
                  </>
                )}
                <TableHead className="text-xs font-semibold text-right">Total Income</TableHead>
                <TableHead className="text-xs font-semibold text-right">O&M + Insurance</TableHead>
                <TableHead className="text-xs font-semibold text-right">Replacements</TableHead>
                <TableHead className="text-xs font-semibold text-right">Net Cashflow</TableHead>
                <TableHead className="text-xs font-semibold text-right">Cumulative</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Year 0 - Initial Investment */}
              <TableRow className="bg-destructive/5">
                <TableCell className="font-medium">0</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                {simulation.demandSavingKva && (
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                )}
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  ({formatCurrency(simulation.systemCost)})
                </TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  ({formatCurrency(simulation.systemCost)})
                </TableCell>
              </TableRow>
              
              {displayedProjections.map((row, index) => {
                const isPaybackYear = row.year === paybackYear;
                const isPositive = row.cumulativeCashflow >= 0;
                
                return (
                  <TableRow 
                    key={row.year}
                    className={cn(
                      isPaybackYear && "bg-primary/10 border-l-2",
                      index % 2 === 0 && !isPaybackYear && "bg-muted/20"
                    )}
                    style={isPaybackYear ? { borderLeftColor: primaryColor } : undefined}
                  >
                    <TableCell className="font-medium">
                      {row.year}
                      {isPaybackYear && (
                        <span className="ml-1 text-xs text-primary">★</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(row.energyYield)} kWh
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      R {row.energyRate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(row.energyIncome)}
                    </TableCell>
                    {simulation.demandSavingKva && (
                      <TableCell className="text-right text-sm">
                        {row.demandIncome > 0 ? formatCurrency(row.demandIncome) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(row.totalIncome)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      ({formatCurrency(row.oAndM + row.insurance)})
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {row.replacementCost > 0 ? `(${formatCurrency(row.replacementCost)})` : "—"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right text-sm font-medium",
                      row.netCashflow >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {formatCurrency(row.netCashflow)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right text-sm font-semibold",
                      isPositive ? "text-primary" : "text-destructive"
                    )}>
                      {isPositive ? formatCurrency(row.cumulativeCashflow) : `(${formatCurrency(Math.abs(row.cumulativeCashflow))})`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: `${primaryColor}20`, borderLeft: `2px solid ${primaryColor}` }} />
            <span className="text-muted-foreground">Payback Year</span>
          </div>
        </div>
        {!showAllYears && projections.length > 10 && (
          <span className="text-xs text-muted-foreground">
            Showing years 1-10 of 20
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
  const baseInsurance = simulation.systemCost * 0.0015; // 0.15% Insurance

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
