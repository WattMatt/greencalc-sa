import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GitCompare, 
  Save, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  Zap,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { 
  AdvancedSimulationConfig, 
  AdvancedFinancialResults,
  DEFAULT_ADVANCED_CONFIG 
} from "./AdvancedSimulationTypes";
import { runAdvancedSimulation } from "./AdvancedSimulationEngine";
import { EnergySimulationResults, TariffData, SystemCosts } from "./index";

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

function DifferenceIndicator({ 
  valueA, 
  valueB, 
  invert = false,
  showAbsolute = false 
}: { 
  valueA: number; 
  valueB: number; 
  invert?: boolean;
  showAbsolute?: boolean;
}) {
  const diff = valueB - valueA;
  const pct = valueA !== 0 ? (diff / valueA) * 100 : 0;
  const isBetter = invert ? diff < 0 : diff > 0;
  
  if (Math.abs(pct) < 0.1) {
    return <span className="text-xs text-muted-foreground">Same</span>;
  }
  
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${
      isBetter ? "text-green-600" : "text-destructive"
    }`}>
      {isBetter ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
      {showAbsolute && (
        <span className="text-muted-foreground ml-1">
          ({diff > 0 ? "+" : ""}{formatCurrency(diff)})
        </span>
      )}
    </span>
  );
}

function ConfigDiffBadge({ 
  labelA, 
  labelB, 
  isDifferent 
}: { 
  labelA: string; 
  labelB: string; 
  isDifferent: boolean;
}) {
  if (!isDifferent) return null;
  
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{labelA}</Badge>
      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{labelB}</Badge>
    </div>
  );
}

export function AdvancedConfigComparison({
  currentConfig,
  energyResults,
  tariffData,
  systemCosts,
  solarCapacity,
  batteryCapacity,
  onApplyConfig,
}: AdvancedConfigComparisonProps) {
  const [scenarioA, setScenarioA] = useState<Scenario>({
    name: "Scenario A",
    config: currentConfig,
    results: null,
  });
  
  const [scenarioB, setScenarioB] = useState<Scenario>({
    name: "Scenario B", 
    config: currentConfig,
    results: null,
  });
  
  const [isComparing, setIsComparing] = useState(false);

  // Capture current config as Scenario A
  const captureAsScenarioA = () => {
    const results = runAdvancedSimulation(
      energyResults,
      tariffData,
      systemCosts,
      solarCapacity,
      batteryCapacity,
      currentConfig
    );
    setScenarioA({
      name: "Scenario A",
      config: { ...currentConfig },
      results,
    });
  };

  // Capture current config as Scenario B
  const captureAsScenarioB = () => {
    const results = runAdvancedSimulation(
      energyResults,
      tariffData,
      systemCosts,
      solarCapacity,
      batteryCapacity,
      currentConfig
    );
    setScenarioB({
      name: "Scenario B",
      config: { ...currentConfig },
      results,
    });
    setIsComparing(true);
  };

  // Get configuration differences
  const configDiffs = useMemo(() => {
    const diffs: { category: string; field: string; a: string; b: string }[] = [];
    
    // Seasonal
    if (scenarioA.config.seasonal.enabled !== scenarioB.config.seasonal.enabled) {
      diffs.push({ 
        category: "Seasonal", 
        field: "Enabled", 
        a: scenarioA.config.seasonal.enabled ? "Yes" : "No",
        b: scenarioB.config.seasonal.enabled ? "Yes" : "No"
      });
    }
    
    // Degradation
    if (scenarioA.config.degradation.enabled !== scenarioB.config.degradation.enabled) {
      diffs.push({
        category: "Degradation",
        field: "Enabled",
        a: scenarioA.config.degradation.enabled ? "Yes" : "No",
        b: scenarioB.config.degradation.enabled ? "Yes" : "No"
      });
    }
    if (scenarioA.config.degradation.panelDegradationRate !== scenarioB.config.degradation.panelDegradationRate) {
      diffs.push({
        category: "Degradation",
        field: "Panel Rate",
        a: `${scenarioA.config.degradation.panelDegradationRate}%/yr`,
        b: `${scenarioB.config.degradation.panelDegradationRate}%/yr`
      });
    }
    
    // Financial
    if (scenarioA.config.financial.enabled !== scenarioB.config.financial.enabled) {
      diffs.push({
        category: "Financial",
        field: "Enabled",
        a: scenarioA.config.financial.enabled ? "Yes" : "No",
        b: scenarioB.config.financial.enabled ? "Yes" : "No"
      });
    }
    if (scenarioA.config.financial.tariffEscalationRate !== scenarioB.config.financial.tariffEscalationRate) {
      diffs.push({
        category: "Financial",
        field: "Tariff Escalation",
        a: `${scenarioA.config.financial.tariffEscalationRate}%`,
        b: `${scenarioB.config.financial.tariffEscalationRate}%`
      });
    }
    if (scenarioA.config.financial.discountRate !== scenarioB.config.financial.discountRate) {
      diffs.push({
        category: "Financial",
        field: "Discount Rate",
        a: `${scenarioA.config.financial.discountRate}%`,
        b: `${scenarioB.config.financial.discountRate}%`
      });
    }
    if (scenarioA.config.financial.projectLifetimeYears !== scenarioB.config.financial.projectLifetimeYears) {
      diffs.push({
        category: "Financial",
        field: "Lifetime",
        a: `${scenarioA.config.financial.projectLifetimeYears} yrs`,
        b: `${scenarioB.config.financial.projectLifetimeYears} yrs`
      });
    }
    
    // Grid Constraints
    if (scenarioA.config.gridConstraints.enabled !== scenarioB.config.gridConstraints.enabled) {
      diffs.push({
        category: "Grid",
        field: "Enabled",
        a: scenarioA.config.gridConstraints.enabled ? "Yes" : "No",
        b: scenarioB.config.gridConstraints.enabled ? "Yes" : "No"
      });
    }
    
    // Load Growth
    if (scenarioA.config.loadGrowth.enabled !== scenarioB.config.loadGrowth.enabled) {
      diffs.push({
        category: "Load Growth",
        field: "Enabled",
        a: scenarioA.config.loadGrowth.enabled ? "Yes" : "No",
        b: scenarioB.config.loadGrowth.enabled ? "Yes" : "No"
      });
    }
    if (scenarioA.config.loadGrowth.annualGrowthRate !== scenarioB.config.loadGrowth.annualGrowthRate) {
      diffs.push({
        category: "Load Growth",
        field: "Growth Rate",
        a: `${scenarioA.config.loadGrowth.annualGrowthRate}%/yr`,
        b: `${scenarioB.config.loadGrowth.annualGrowthRate}%/yr`
      });
    }
    
    return diffs;
  }, [scenarioA.config, scenarioB.config]);

  // Determine winner for each metric
  const getWinner = (valueA: number, valueB: number, higherIsBetter: boolean) => {
    if (Math.abs(valueA - valueB) < 0.01) return "tie";
    if (higherIsBetter) return valueA > valueB ? "A" : "B";
    return valueA < valueB ? "A" : "B";
  };

  if (!isComparing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Scenario Comparison
          </CardTitle>
          <CardDescription className="text-xs">
            Compare two different configuration scenarios side-by-side
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Button 
                variant={scenarioA.results ? "secondary" : "outline"}
                size="sm" 
                onClick={captureAsScenarioA}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {scenarioA.results ? "Update Scenario A" : "Capture as Scenario A"}
              </Button>
              {scenarioA.results && (
                <Badge variant="outline" className="text-xs">
                  NPV: {formatCurrency(scenarioA.results.npv)}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                size="sm" 
                onClick={captureAsScenarioB}
                disabled={!scenarioA.results}
                className="flex-1"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Capture & Compare as Scenario B
              </Button>
            </div>
            
            {!scenarioA.results && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                First capture a scenario, then modify settings and capture another to compare.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full comparison view
  const resultsA = scenarioA.results!;
  const resultsB = scenarioB.results!;

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
              {configDiffs.length} configuration differences
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsComparing(false)}>
              Close
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onApplyConfig(scenarioA.config)}
            >
              Apply A
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onApplyConfig(scenarioB.config)}
            >
              Apply B
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Differences */}
        {configDiffs.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Configuration Differences</h4>
            <div className="grid grid-cols-2 gap-2">
              {configDiffs.map((diff, i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <span className="text-muted-foreground">{diff.category} - {diff.field}:</span>
                  <ConfigDiffBadge labelA={diff.a} labelB={diff.b} isDifferent={true} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Comparison */}
        <div className="grid grid-cols-2 gap-4">
          {/* Scenario A */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                Scenario A
              </Badge>
            </div>
            
            <div className="grid gap-2">
              <MetricRow
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="NPV"
                value={formatCurrency(resultsA.npv)}
                isWinner={getWinner(resultsA.npv, resultsB.npv, true) === "A"}
              />
              <MetricRow
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="IRR"
                value={`${formatNumber(resultsA.irr)}%`}
                isWinner={getWinner(resultsA.irr, resultsB.irr, true) === "A"}
              />
              <MetricRow
                icon={<Zap className="h-3.5 w-3.5" />}
                label="LCOE"
                value={`R${formatNumber(resultsA.lcoe, 2)}/kWh`}
                isWinner={getWinner(resultsA.lcoe, resultsB.lcoe, false) === "A"}
              />
              <MetricRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Payback"
                value={`${formatNumber(resultsA.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25)} yrs`}
                isWinner={getWinner(
                  resultsA.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                  resultsB.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                  false
                ) === "A"}
              />
              <MetricRow
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Lifetime Savings"
                value={formatCurrency(resultsA.lifetimeSavings)}
                isWinner={getWinner(resultsA.lifetimeSavings, resultsB.lifetimeSavings, true) === "A"}
              />
            </div>
          </div>

          {/* Scenario B */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                Scenario B
              </Badge>
            </div>
            
            <div className="grid gap-2">
              <MetricRow
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="NPV"
                value={formatCurrency(resultsB.npv)}
                isWinner={getWinner(resultsA.npv, resultsB.npv, true) === "B"}
                difference={<DifferenceIndicator valueA={resultsA.npv} valueB={resultsB.npv} showAbsolute />}
              />
              <MetricRow
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="IRR"
                value={`${formatNumber(resultsB.irr)}%`}
                isWinner={getWinner(resultsA.irr, resultsB.irr, true) === "B"}
                difference={<DifferenceIndicator valueA={resultsA.irr} valueB={resultsB.irr} />}
              />
              <MetricRow
                icon={<Zap className="h-3.5 w-3.5" />}
                label="LCOE"
                value={`R${formatNumber(resultsB.lcoe, 2)}/kWh`}
                isWinner={getWinner(resultsA.lcoe, resultsB.lcoe, false) === "B"}
                difference={<DifferenceIndicator valueA={resultsA.lcoe} valueB={resultsB.lcoe} invert />}
              />
              <MetricRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Payback"
                value={`${formatNumber(resultsB.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25)} yrs`}
                isWinner={getWinner(
                  resultsA.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                  resultsB.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                  false
                ) === "B"}
                difference={
                  <DifferenceIndicator 
                    valueA={resultsA.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25} 
                    valueB={resultsB.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25} 
                    invert 
                  />
                }
              />
              <MetricRow
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Lifetime Savings"
                value={formatCurrency(resultsB.lifetimeSavings)}
                isWinner={getWinner(resultsA.lifetimeSavings, resultsB.lifetimeSavings, true) === "B"}
                difference={<DifferenceIndicator valueA={resultsA.lifetimeSavings} valueB={resultsB.lifetimeSavings} showAbsolute />}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">A</Badge>
              <span className="text-muted-foreground">wins</span>
              <span className="font-medium">
                {[
                  getWinner(resultsA.npv, resultsB.npv, true),
                  getWinner(resultsA.irr, resultsB.irr, true),
                  getWinner(resultsA.lcoe, resultsB.lcoe, false),
                  getWinner(
                    resultsA.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                    resultsB.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                    false
                  ),
                  getWinner(resultsA.lifetimeSavings, resultsB.lifetimeSavings, true),
                ].filter(w => w === "A").length} metrics
              </span>
            </div>
            <span className="text-muted-foreground">vs</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">B</Badge>
              <span className="text-muted-foreground">wins</span>
              <span className="font-medium">
                {[
                  getWinner(resultsA.npv, resultsB.npv, true),
                  getWinner(resultsA.irr, resultsB.irr, true),
                  getWinner(resultsA.lcoe, resultsB.lcoe, false),
                  getWinner(
                    resultsA.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                    resultsB.yearlyProjections.find(p => p.cumulativeCashFlow >= 0)?.year || 25,
                    false
                  ),
                  getWinner(resultsA.lifetimeSavings, resultsB.lifetimeSavings, true),
                ].filter(w => w === "B").length} metrics
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ 
  icon, 
  label, 
  value, 
  isWinner,
  difference 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  isWinner: boolean;
  difference?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${
      isWinner ? "bg-green-500/10 border border-green-500/30" : "bg-muted/30"
    }`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium ${isWinner ? "text-green-600" : ""}`}>
          {value}
          {isWinner && <CheckCircle2 className="h-3 w-3 inline ml-1" />}
        </div>
        {difference && <div className="mt-0.5">{difference}</div>}
      </div>
    </div>
  );
}

export default AdvancedConfigComparison;
