import { TrendingUp, DollarSign, Percent, Clock, BarChart3, Zap } from "lucide-react";
import { SimulationData, formatCurrency, formatNumber, formatPercent } from "../types";
import { ProposalTemplate } from "../templates/types";

interface FinancialSummarySectionProps {
  simulation: SimulationData;
  template: ProposalTemplate;
  forPDF?: boolean;
}

export function FinancialSummarySection({ simulation, template, forPDF }: FinancialSummarySectionProps) {
  const primaryColor = template.colors.accentColor;

  const metrics = [
    { 
      icon: DollarSign, 
      label: "Net Present Value", 
      value: simulation.npv ? formatCurrency(simulation.npv) : "—",
      description: "Total value of future cashflows in today's money",
      highlight: (simulation.npv || 0) > 0
    },
    { 
      icon: Percent, 
      label: "Internal Rate of Return", 
      value: simulation.irr ? formatPercent(simulation.irr) : "—",
      description: "Annualized return on investment",
      highlight: (simulation.irr || 0) > 15
    },
    { 
      icon: Zap, 
      label: "LCOE", 
      value: simulation.lcoe ? `R ${simulation.lcoe.toFixed(2)}/kWh` : "—",
      description: "Levelized Cost of Energy",
      highlight: (simulation.lcoe || 0) < 1.50
    },
    { 
      icon: Clock, 
      label: "Payback Period", 
      value: `${simulation.paybackYears.toFixed(1)} years`,
      description: "Time to recover initial investment",
      highlight: simulation.paybackYears < 6
    },
    { 
      icon: BarChart3, 
      label: "20-Year ROI", 
      value: formatPercent(simulation.roiPercentage),
      description: "Total return over project lifetime",
      highlight: simulation.roiPercentage > 200
    },
    { 
      icon: TrendingUp, 
      label: "Annual Savings", 
      value: formatCurrency(simulation.annualSavings),
      description: "First year energy cost reduction",
      highlight: true
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <DollarSign className="h-5 w-5" style={{ color: primaryColor }} />
        Financial Summary
      </h2>

      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div 
              key={index}
              className={`p-4 rounded-lg border ${metric.highlight ? 'border-primary/30 bg-primary/5' : 'bg-muted/30'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
              </div>
              <div className="text-xl font-bold" style={{ color: metric.highlight ? primaryColor : undefined }}>
                {metric.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
            </div>
          );
        })}
      </div>

      {/* Investment Summary */}
      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <h3 className="text-sm font-semibold mb-3">Investment Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total System Cost</span>
            <span className="font-medium">{formatCurrency(simulation.systemCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Annual Generation</span>
            <span className="font-medium">{formatNumber(simulation.annualSolarGeneration)} kWh</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grid Export (Annual)</span>
            <span className="font-medium">{formatNumber(simulation.annualGridExport)} kWh</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grid Import (Annual)</span>
            <span className="font-medium">{formatNumber(simulation.annualGridImport)} kWh</span>
          </div>
          {simulation.demandSavingKva && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Demand Saving</span>
              <span className="font-medium">{formatNumber(simulation.demandSavingKva, 1)} kVA</span>
            </div>
          )}
          {simulation.selfConsumptionRate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Self-Consumption Rate</span>
              <span className="font-medium">{formatPercent(simulation.selfConsumptionRate)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
