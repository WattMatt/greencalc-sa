import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Award } from "lucide-react";
import { ScenarioConfig, ScenarioResults } from "./ScenarioCard";

interface ScenarioData {
  id: "A" | "B" | "C";
  config: ScenarioConfig;
  results?: ScenarioResults;
}

interface ScenarioComparisonProps {
  scenarios: ScenarioData[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ScenarioComparison({ scenarios }: ScenarioComparisonProps) {
  const scenariosWithResults = scenarios.filter((s) => s.results);

  if (scenariosWithResults.length < 2) {
    return null;
  }

  // Find best performers
  const bestSavings = scenariosWithResults.reduce((best, s) =>
    (s.results?.annualSavings || 0) > (best.results?.annualSavings || 0) ? s : best
  );
  const bestPayback = scenariosWithResults.reduce((best, s) =>
    (s.results?.paybackYears || Infinity) < (best.results?.paybackYears || Infinity) ? s : best
  );
  const lowestCost = scenariosWithResults.reduce((best, s) =>
    (s.results?.systemCost || Infinity) < (best.results?.systemCost || Infinity) ? s : best
  );

  const metrics = [
    {
      label: "Best Annual Savings",
      winner: bestSavings.id,
      value: formatCurrency(bestSavings.results?.annualSavings || 0),
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      label: "Fastest Payback",
      winner: bestPayback.id,
      value: `${bestPayback.results?.paybackYears.toFixed(1)} years`,
      icon: Award,
      color: "text-blue-600",
    },
    {
      label: "Lowest Cost",
      winner: lowestCost.id,
      value: formatCurrency(lowestCost.results?.systemCost || 0),
      icon: TrendingDown,
      color: "text-amber-600",
    },
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comparison Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
            >
              <metric.icon className={`h-5 w-5 ${metric.color}`} />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Scenario {metric.winner}
                  </Badge>
                  <span className="font-semibold">{metric.value}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed comparison table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Metric</th>
                {scenariosWithResults.map((s) => (
                  <th key={s.id} className="text-right py-2 font-medium">
                    Scenario {s.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 text-muted-foreground">Solar Capacity</td>
                {scenariosWithResults.map((s) => (
                  <td key={s.id} className="text-right py-2">{s.config.solarCapacity} kWp</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 text-muted-foreground">Battery Storage</td>
                {scenariosWithResults.map((s) => (
                  <td key={s.id} className="text-right py-2">{s.config.batteryCapacity} kWh</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 text-muted-foreground">DC/AC Ratio</td>
                {scenariosWithResults.map((s) => (
                  <td key={s.id} className="text-right py-2">{(s.config.dcAcRatio * 100).toFixed(0)}%</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 text-muted-foreground">Annual Generation</td>
                {scenariosWithResults.map((s) => (
                  <td key={s.id} className="text-right py-2">{formatNumber(s.results?.annualGeneration || 0)} kWh</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 text-muted-foreground">System Cost</td>
                {scenariosWithResults.map((s) => (
                  <td key={s.id} className="text-right py-2">{formatCurrency(s.results?.systemCost || 0)}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 text-muted-foreground">Annual Savings</td>
                {scenariosWithResults.map((s) => (
                  <td key={s.id} className="text-right py-2 text-green-600 font-medium">
                    {formatCurrency(s.results?.annualSavings || 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Payback Period</td>
                {scenariosWithResults.map((s) => (
                  <td key={s.id} className="text-right py-2 font-medium">
                    {s.results?.paybackYears.toFixed(1)} years
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
