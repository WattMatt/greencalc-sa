import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  GitCompare, 
  Save, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  Zap,
  CheckCircle2,
  X,
  Trophy,
  Pencil
} from "lucide-react";
import { 
  AdvancedSimulationConfig, 
  AdvancedFinancialResults,
} from "./AdvancedSimulationTypes";
import { runAdvancedSimulation } from "./AdvancedSimulationEngine";
import { EnergySimulationResults, TariffData, SystemCosts } from "./index";
import { TariffRate } from "@/lib/tariffCalculations";
import { TOUSettings } from "@/components/projects/load-profile/types";

type ScenarioKey = "A" | "B" | "C";

interface Scenario {
  name: string;
  config: AdvancedSimulationConfig;
  results: AdvancedFinancialResults | null;
}

interface AdvancedConfigComparisonProps {
  currentConfig: AdvancedSimulationConfig;
  energyResults: EnergySimulationResults;
  tariffData: TariffData;
  systemCosts: SystemCosts;
  solarCapacity: number;
  batteryCapacity: number;
  onApplyConfig: (config: AdvancedSimulationConfig) => void;
  tariffRates?: TariffRate[];
  touSettings?: TOUSettings;
}

const SCENARIO_COLORS: Record<ScenarioKey, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
  B: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/30" },
  C: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
};

const DEFAULT_NAMES: Record<ScenarioKey, string> = {
  A: "Conservative",
  B: "Base Case", 
  C: "Optimistic",
};

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

function getPaybackYear(results: AdvancedFinancialResults): number {
  return results.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25;
}

export function AdvancedConfigComparison({
  currentConfig,
  energyResults,
  tariffData,
  systemCosts,
  solarCapacity,
  batteryCapacity,
  onApplyConfig,
  tariffRates,
  touSettings,
}: AdvancedConfigComparisonProps) {
  const [scenarios, setScenarios] = useState<Record<ScenarioKey, Scenario>>({
    A: { name: DEFAULT_NAMES.A, config: currentConfig, results: null },
    B: { name: DEFAULT_NAMES.B, config: currentConfig, results: null },
    C: { name: DEFAULT_NAMES.C, config: currentConfig, results: null },
  });
  
  const [isComparing, setIsComparing] = useState(false);
  const [editingName, setEditingName] = useState<ScenarioKey | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const captureScenario = (key: ScenarioKey) => {
    const results = runAdvancedSimulation(
      energyResults,
      tariffData,
      systemCosts,
      solarCapacity,
      batteryCapacity,
      currentConfig,
      tariffRates,
      touSettings
    );
    setScenarios(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        config: { ...currentConfig },
        results,
      },
    }));
  };

  const clearScenario = (key: ScenarioKey) => {
    setScenarios(prev => ({
      ...prev,
      [key]: { name: prev[key].name, config: currentConfig, results: null },
    }));
  };

  const updateScenarioName = (key: ScenarioKey, name: string) => {
    setScenarios(prev => ({
      ...prev,
      [key]: { ...prev[key], name: name || DEFAULT_NAMES[key] },
    }));
    setEditingName(null);
  };

  const startEditing = (key: ScenarioKey) => {
    setEditingName(key);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const activeScenarios = (Object.keys(scenarios) as ScenarioKey[]).filter(
    key => scenarios[key].results !== null
  );

  const startComparison = () => {
    if (activeScenarios.length >= 2) {
      setIsComparing(true);
    }
  };

  // Find best value for each metric across all scenarios
  const findBest = (
    getValue: (results: AdvancedFinancialResults) => number,
    higherIsBetter: boolean
  ): ScenarioKey | null => {
    const activeWithResults = activeScenarios.filter(k => scenarios[k].results);
    if (activeWithResults.length === 0) return null;
    
    let bestKey = activeWithResults[0];
    let bestValue = getValue(scenarios[bestKey].results!);
    
    for (const key of activeWithResults.slice(1)) {
      const value = getValue(scenarios[key].results!);
      if (higherIsBetter ? value > bestValue : value < bestValue) {
        bestKey = key;
        bestValue = value;
      }
    }
    return bestKey;
  };

  // Capture UI
  if (!isComparing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Scenario Comparison (A/B/C)
          </CardTitle>
          <CardDescription className="text-xs">
            Capture up to 3 scenarios for side-by-side comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(["A", "B", "C"] as ScenarioKey[]).map(key => (
              <div key={key} className="flex items-center gap-2">
                {/* Scenario name (editable) */}
                <div className={`flex items-center gap-1.5 min-w-[120px] px-2 py-1 rounded ${SCENARIO_COLORS[key].bg} ${SCENARIO_COLORS[key].border} border`}>
                  <span className={`text-xs font-medium ${SCENARIO_COLORS[key].text}`}>{key}:</span>
                  {editingName === key ? (
                    <Input
                      ref={inputRef}
                      className="h-5 text-xs px-1 py-0 w-20"
                      defaultValue={scenarios[key].name}
                      onBlur={(e) => updateScenarioName(key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateScenarioName(key, e.currentTarget.value);
                        if (e.key === "Escape") setEditingName(null);
                      }}
                    />
                  ) : (
                    <button 
                      onClick={() => startEditing(key)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate max-w-[80px]"
                      title={scenarios[key].name}
                    >
                      {scenarios[key].name}
                      <Pencil className="h-2.5 w-2.5 opacity-50" />
                    </button>
                  )}
                </div>
                
                <Button 
                  variant={scenarios[key].results ? "secondary" : "outline"}
                  size="sm" 
                  onClick={() => captureScenario(key)}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {scenarios[key].results ? "Update" : "Capture"}
                </Button>
                {scenarios[key].results && (
                  <>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${SCENARIO_COLORS[key].bg} ${SCENARIO_COLORS[key].text} ${SCENARIO_COLORS[key].border}`}
                    >
                      NPV: {formatCurrency(scenarios[key].results!.npv)}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => clearScenario(key)}
                      className="h-7 w-7 p-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            
            <div className="pt-2 border-t mt-4">
              <Button 
                variant="default"
                size="sm" 
                onClick={startComparison}
                disabled={activeScenarios.length < 2}
                className="w-full"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare {activeScenarios.length} Scenarios
              </Button>
              {activeScenarios.length < 2 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Capture at least 2 scenarios to compare
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full comparison view
  const bestNpv = findBest(r => r.npv, true);
  const bestIrr = findBest(r => r.irr, true);
  const bestLcoe = findBest(r => r.lcoe, false);
  const bestPayback = findBest(r => getPaybackYear(r), false);
  const bestLifetime = findBest(r => r.lifetimeSavings, true);

  // Count wins per scenario
  const winCounts: Record<ScenarioKey, number> = { A: 0, B: 0, C: 0 };
  [bestNpv, bestIrr, bestLcoe, bestPayback, bestLifetime].forEach(winner => {
    if (winner) winCounts[winner]++;
  });

  const overallWinner = (Object.keys(winCounts) as ScenarioKey[])
    .filter(k => scenarios[k].results)
    .reduce((a, b) => winCounts[a] > winCounts[b] ? a : b);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              Scenario Comparison
            </CardTitle>
            <CardDescription className="text-xs">
              Comparing {activeScenarios.length} scenarios
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsComparing(false)}>
              Edit Scenarios
            </Button>
            {activeScenarios.map(key => (
              <Button 
                key={key}
                variant="outline" 
                size="sm" 
                onClick={() => onApplyConfig(scenarios[key].config)}
                className={`${SCENARIO_COLORS[key].text}`}
                title={`Apply ${scenarios[key].name}`}
              >
                Apply {scenarios[key].name}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Winner */}
        <div className={`p-3 rounded-lg ${SCENARIO_COLORS[overallWinner].bg} ${SCENARIO_COLORS[overallWinner].border} border flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Trophy className={`h-5 w-5 ${SCENARIO_COLORS[overallWinner].text}`} />
            <span className="text-sm font-medium">Overall Winner: {scenarios[overallWinner].name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Wins {winCounts[overallWinner]} of 5 metrics
          </span>
        </div>

        {/* Metrics Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Metric</th>
                {activeScenarios.map(key => (
                  <th key={key} className="text-right py-2">
                    <Badge 
                      variant="outline" 
                      className={`${SCENARIO_COLORS[key].bg} ${SCENARIO_COLORS[key].text} ${SCENARIO_COLORS[key].border}`}
                      title={scenarios[key].name}
                    >
                      {scenarios[key].name.length > 12 ? scenarios[key].name.slice(0, 10) + "…" : scenarios[key].name}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MetricTableRow
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="NPV"
                scenarios={activeScenarios}
                getValue={r => r.npv}
                formatValue={v => formatCurrency(v)}
                bestKey={bestNpv}
                scenarioData={scenarios}
              />
              <MetricTableRow
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="IRR"
                scenarios={activeScenarios}
                getValue={r => r.irr}
                formatValue={v => `${formatNumber(v)}%`}
                bestKey={bestIrr}
                scenarioData={scenarios}
              />
              <MetricTableRow
                icon={<Zap className="h-3.5 w-3.5" />}
                label="LCOE"
                scenarios={activeScenarios}
                getValue={r => r.lcoe}
                formatValue={v => `R${formatNumber(v, 2)}/kWh`}
                bestKey={bestLcoe}
                scenarioData={scenarios}
              />
              <MetricTableRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Payback"
                scenarios={activeScenarios}
                getValue={r => getPaybackYear(r)}
                formatValue={v => `${formatNumber(v)} yrs`}
                bestKey={bestPayback}
                scenarioData={scenarios}
              />
              <MetricTableRow
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Lifetime Savings"
                scenarios={activeScenarios}
                getValue={r => r.lifetimeSavings}
                formatValue={v => formatCurrency(v)}
                bestKey={bestLifetime}
                scenarioData={scenarios}
              />
              <MetricTableRow
                icon={<Zap className="h-3.5 w-3.5" />}
                label="Lifetime Gen."
                scenarios={activeScenarios}
                getValue={r => r.lifetimeGeneration / 1000}
                formatValue={v => `${formatNumber(v, 0)} MWh`}
                bestKey={findBest(r => r.lifetimeGeneration, true)}
                scenarioData={scenarios}
              />
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
            {activeScenarios.map(key => (
              <div key={key} className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`${SCENARIO_COLORS[key].bg} ${SCENARIO_COLORS[key].text} ${SCENARIO_COLORS[key].border}`}
                >
                  {scenarios[key].name}
                </Badge>
                <span className="text-muted-foreground">wins</span>
                <span className="font-medium">{winCounts[key]} metrics</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Config Differences */}
        <div className="pt-3 border-t">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">Key Configuration Differences</h4>
          <div className="grid gap-2 md:grid-cols-3">
            {activeScenarios.map(key => {
              const config = scenarios[key].config;
              return (
                <div key={key} className={`p-2 rounded-lg ${SCENARIO_COLORS[key].bg} ${SCENARIO_COLORS[key].border} border`}>
                  <div className={`text-xs font-medium ${SCENARIO_COLORS[key].text} mb-1`}>{scenarios[key].name}</div>
                  <div className="text-[10px] space-y-0.5 text-muted-foreground">
                    <div>Tariff Esc: {config.financial.tariffEscalationRate}%</div>
                    <div>Discount: {config.financial.discountRate}%</div>
                    <div>Lifetime: {config.financial.projectLifetimeYears} yrs</div>
                    <div>Panel Deg: {config.degradation.panelDegradationRate}%/yr</div>
                    <div>Load Growth: {config.loadGrowth.annualGrowthRate}%/yr</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTableRow({
  icon,
  label,
  scenarios,
  getValue,
  formatValue,
  bestKey,
  scenarioData,
}: {
  icon: React.ReactNode;
  label: string;
  scenarios: ScenarioKey[];
  getValue: (results: AdvancedFinancialResults) => number;
  formatValue: (value: number) => string;
  bestKey: ScenarioKey | null;
  scenarioData: Record<ScenarioKey, Scenario>;
}) {
  const baseValue = scenarioData[scenarios[0]].results 
    ? getValue(scenarioData[scenarios[0]].results!) 
    : 0;

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2.5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
      </td>
      {scenarios.map((key, idx) => {
        const results = scenarioData[key].results;
        if (!results) return <td key={key} className="text-right py-2.5">-</td>;
        
        const value = getValue(results);
        const isBest = bestKey === key;
        const diff = idx > 0 && baseValue !== 0 
          ? ((value - baseValue) / Math.abs(baseValue)) * 100 
          : null;

        return (
          <td key={key} className="text-right py-2.5">
            <div className={`flex flex-col items-end ${isBest ? "font-medium" : ""}`}>
              <span className={`flex items-center gap-1 ${isBest ? `${SCENARIO_COLORS[key].text}` : ""}`}>
                {formatValue(value)}
                {isBest && <CheckCircle2 className="h-3 w-3" />}
              </span>
              {diff !== null && (
                <span className={`text-[10px] flex items-center gap-0.5 ${
                  diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : diff < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                  {diff > 0 ? "+" : ""}{diff.toFixed(1)}% vs A
                </span>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

export default AdvancedConfigComparison;
