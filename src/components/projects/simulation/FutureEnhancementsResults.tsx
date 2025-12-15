import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cloud, Zap, Building2, Leaf, CreditCard, Cpu, TrendingUp, TrendingDown, TreeDeciduous, Car, DollarSign } from "lucide-react";
import {
  FutureEnhancementsConfig,
  HistoricalWeatherResults,
  FeedInTariffResults,
  PortfolioResults,
  CarbonResults,
  FinancingResults,
  EquipmentResults,
  SAMPLE_PANELS,
  SAMPLE_INVERTERS,
  SAMPLE_BATTERIES,
} from "./FutureEnhancementsTypes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface FutureEnhancementsResultsProps {
  config: FutureEnhancementsConfig;
  solarCapacity: number;
  batteryCapacity: number;
  annualGeneration: number;
  annualSavings: number;
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

export function FutureEnhancementsResults({
  config,
  solarCapacity,
  batteryCapacity,
  annualGeneration,
  annualSavings,
}: FutureEnhancementsResultsProps) {
  // Calculate results for each enabled module
  const carbonResults = config.carbon.enabled ? calculateCarbonResults(config, annualGeneration) : null;
  const financingResults = config.financing.enabled ? calculateFinancingResults(config, solarCapacity, batteryCapacity, annualSavings) : null;
  const equipmentResults = config.equipment.enabled ? calculateEquipmentResults(config, solarCapacity) : null;
  const feedInResults = config.feedInTariff.enabled ? calculateFeedInResults(config, annualGeneration) : null;

  const hasAnyResults = carbonResults || financingResults || equipmentResults || feedInResults;

  if (!hasAnyResults) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/50 text-primary text-xs">Phase 8</Badge>
          <CardTitle className="text-sm font-medium">Future Enhancements Results</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={carbonResults ? "carbon" : feedInResults ? "feedin" : financingResults ? "financing" : "equipment"}>
          <TabsList className="grid w-full grid-cols-4 h-auto">
            {carbonResults && (
              <TabsTrigger value="carbon" className="text-xs py-1.5">
                <Leaf className="h-3 w-3 mr-1" />
                Carbon
              </TabsTrigger>
            )}
            {feedInResults && (
              <TabsTrigger value="feedin" className="text-xs py-1.5">
                <Zap className="h-3 w-3 mr-1" />
                Feed-in
              </TabsTrigger>
            )}
            {financingResults && (
              <TabsTrigger value="financing" className="text-xs py-1.5">
                <CreditCard className="h-3 w-3 mr-1" />
                Finance
              </TabsTrigger>
            )}
            {equipmentResults && (
              <TabsTrigger value="equipment" className="text-xs py-1.5">
                <Cpu className="h-3 w-3 mr-1" />
                Equipment
              </TabsTrigger>
            )}
          </TabsList>

          {carbonResults && (
            <TabsContent value="carbon" className="mt-4">
              <CarbonResultsDisplay results={carbonResults} />
            </TabsContent>
          )}

          {feedInResults && (
            <TabsContent value="feedin" className="mt-4">
              <FeedInResultsDisplay results={feedInResults} config={config.feedInTariff} />
            </TabsContent>
          )}

          {financingResults && (
            <TabsContent value="financing" className="mt-4">
              <FinancingResultsDisplay results={financingResults} config={config.financing} />
            </TabsContent>
          )}

          {equipmentResults && (
            <TabsContent value="equipment" className="mt-4">
              <EquipmentResultsDisplay results={equipmentResults} config={config.equipment} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============= Carbon Results Display =============
function CarbonResultsDisplay({ results }: { results: CarbonResults }) {
  const impactData = [
    { name: "CO₂ Avoided", value: results.annualCo2Avoided, unit: "kg/yr" },
    { name: "Lifetime CO₂", value: results.lifetimeCo2Avoided, unit: "kg" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={<Leaf className="h-4 w-4" />}
          label="Annual CO₂ Avoided"
          value={`${formatNumber(results.annualCo2Avoided / 1000)} tons`}
          variant="positive"
        />
        <MetricCard
          icon={<TreeDeciduous className="h-4 w-4" />}
          label="Equivalent Trees"
          value={formatNumber(results.equivalentTreesPlanted, 0)}
          variant="positive"
        />
        <MetricCard
          icon={<Car className="h-4 w-4" />}
          label="Cars Off Road"
          value={formatNumber(results.equivalentCarsOffRoad, 1)}
          variant="positive"
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Carbon Tax Savings"
          value={formatCurrency(results.carbonTaxSavings)}
          variant="neutral"
        />
      </div>

      {results.recValue > 0 && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center justify-between">
            <span className="text-sm">Renewable Energy Certificate Value</span>
            <span className="font-medium text-green-600">{formatCurrency(results.recValue)}/year</span>
          </div>
        </div>
      )}

      <div className="p-3 rounded-lg bg-muted/50">
        <div className="text-xs text-muted-foreground mb-2">Lifetime Environmental Impact</div>
        <div className="text-2xl font-bold text-green-600">
          {formatNumber(results.lifetimeCo2Avoided / 1000)} tons CO₂
        </div>
        <div className="text-xs text-muted-foreground">avoided over project lifetime</div>
      </div>
    </div>
  );
}

// ============= Feed-in Results Display =============
function FeedInResultsDisplay({ results, config }: { results: FeedInTariffResults; config: any }) {
  const periodData = [
    { name: "Peak", value: results.peakExportRevenue, fill: "hsl(var(--chart-1))" },
    { name: "Off-Peak", value: results.offPeakExportRevenue, fill: "hsl(var(--chart-2))" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          icon={<Zap className="h-4 w-4" />}
          label="Annual Export Revenue"
          value={formatCurrency(results.annualExportRevenue)}
          variant="positive"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Average Export Rate"
          value={`R${formatNumber(results.averageExportRate, 2)}/kWh`}
          variant="neutral"
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Net Metering Credits"
          value={formatCurrency(results.netMeteringCredits)}
          variant="neutral"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Peak Export Revenue</div>
          <div className="text-lg font-semibold">{formatCurrency(results.peakExportRevenue)}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Off-Peak Export Revenue</div>
          <div className="text-lg font-semibold">{formatCurrency(results.offPeakExportRevenue)}</div>
        </div>
      </div>

      <div className="p-3 rounded-lg border">
        <div className="text-xs font-medium mb-2">Metering Type: {config.meteringType === 'net' ? 'Net Metering' : 'Gross Metering'}</div>
        <div className="text-xs text-muted-foreground">
          {config.meteringType === 'net' 
            ? 'Credits offset import costs first, excess exported at feed-in rate'
            : 'All generation exported at feed-in rate, import billed separately'}
        </div>
      </div>
    </div>
  );
}

// ============= Financing Results Display =============
function FinancingResultsDisplay({ results, config }: { results: FinancingResults; config: any }) {
  const optionLabels: Record<string, string> = {
    cash: 'Cash Purchase',
    ppa: 'Power Purchase Agreement',
    lease: 'Equipment Lease',
    loan: 'Bank Loan',
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
        <div className="text-sm font-medium">{optionLabels[results.selectedOption]}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Cost"
          value={formatCurrency(results.totalCost)}
          variant="neutral"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Effective Rate"
          value={`R${formatNumber(results.effectiveRate, 2)}/kWh`}
          variant="neutral"
        />
        <MetricCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Savings vs Cash"
          value={formatCurrency(results.savingsVsCash)}
          variant={results.savingsVsCash > 0 ? "positive" : "negative"}
        />
        <MetricCard
          icon={<Zap className="h-4 w-4" />}
          label="Break-even Year"
          value={`Year ${results.breakEvenYear}`}
          variant="neutral"
        />
      </div>

      {results.yearlyPayments.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={results.yearlyPayments.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} tickFormatter={(v) => `Y${v}`} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="principal" name="Principal" fill="hsl(var(--primary))" stackId="a" />
              <Bar dataKey="interest" name="Interest" fill="hsl(var(--muted-foreground))" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============= Equipment Results Display =============
function EquipmentResultsDisplay({ results, config }: { results: EquipmentResults; config: any }) {
  const panel = SAMPLE_PANELS.find(p => p.id === config.selectedPanelId);
  const inverter = SAMPLE_INVERTERS.find(i => i.id === config.selectedInverterId);
  const battery = SAMPLE_BATTERIES.find(b => b.id === config.selectedBatteryId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={<Cpu className="h-4 w-4" />}
          label="Panel Count"
          value={formatNumber(results.panelCount, 0)}
          variant="neutral"
        />
        <MetricCard
          icon={<Zap className="h-4 w-4" />}
          label="DC/AC Ratio"
          value={formatNumber(results.dcAcRatio, 2)}
          variant="neutral"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="System Efficiency"
          value={`${formatNumber(results.systemEfficiency)}%`}
          variant={results.systemEfficiency > 85 ? "positive" : "neutral"}
        />
        <MetricCard
          icon={<Building2 className="h-4 w-4" />}
          label="Compatibility"
          value={`${formatNumber(results.compatibilityScore, 0)}%`}
          variant={results.compatibilityScore > 90 ? "positive" : results.compatibilityScore > 70 ? "neutral" : "negative"}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {panel && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs font-medium mb-1">Solar Panel</div>
            <div className="text-sm">{panel.manufacturer}</div>
            <div className="text-xs text-muted-foreground">{panel.model}</div>
            <div className="text-xs text-primary mt-1">{panel.wattage}W • {panel.efficiency}% eff</div>
          </div>
        )}
        {inverter && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs font-medium mb-1">Inverter</div>
            <div className="text-sm">{inverter.manufacturer}</div>
            <div className="text-xs text-muted-foreground">{inverter.model}</div>
            <div className="text-xs text-primary mt-1">{inverter.ratedPower}kW • {inverter.maxEfficiency}% eff</div>
          </div>
        )}
        {battery && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-xs font-medium mb-1">Battery</div>
            <div className="text-sm">{battery.manufacturer}</div>
            <div className="text-xs text-muted-foreground">{battery.model}</div>
            <div className="text-xs text-primary mt-1">{battery.capacity}kWh • {battery.chemistry.toUpperCase()}</div>
          </div>
        )}
      </div>

      {results.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="text-xs font-medium text-amber-700 mb-1">Compatibility Warnings</div>
          {results.warnings.map((warning, i) => (
            <div key={i} className="text-xs text-amber-600">• {warning}</div>
          ))}
        </div>
      )}

      <div className="p-3 rounded-lg border">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Strings:</span> {results.stringsCount}
          </div>
          <div>
            <span className="text-muted-foreground">Panels/String:</span> {results.panelsPerString}
          </div>
          <div>
            <span className="text-muted-foreground">Inverters:</span> {results.inverterCount}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= Helper Components =============
function MetricCard({
  icon,
  label,
  value,
  variant = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: "positive" | "negative" | "neutral";
}) {
  const variantStyles = {
    positive: "border-green-500/30 bg-green-500/5",
    negative: "border-destructive/30 bg-destructive/5",
    neutral: "border-border bg-card",
  };

  return (
    <Card className={variantStyles[variant]}>
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

// ============= Calculation Functions =============
function calculateCarbonResults(config: FutureEnhancementsConfig, annualGeneration: number): CarbonResults {
  const { carbon } = config;
  const effectiveGeneration = carbon.includeTransmissionLosses
    ? annualGeneration * (1 + carbon.transmissionLossPercent / 100)
    : annualGeneration;

  const annualCo2Avoided = effectiveGeneration * carbon.gridEmissionFactor; // kg
  const lifetimeCo2Avoided = annualCo2Avoided * 25; // 25-year lifetime

  // Equivalent calculations
  const equivalentTreesPlanted = annualCo2Avoided / 21; // ~21kg CO2 per tree per year
  const equivalentCarsOffRoad = annualCo2Avoided / 4600; // ~4.6 tons per car per year

  // Financial
  const recValue = carbon.recTrackingEnabled ? (annualGeneration / 1000) * carbon.recPricePerMwh : 0;
  const carbonTaxSavings = (annualCo2Avoided / 1000) * carbon.carbonTaxRate; // tons * R/ton

  return {
    annualCo2Avoided,
    lifetimeCo2Avoided,
    equivalentTreesPlanted,
    equivalentCarsOffRoad,
    recValue,
    carbonTaxSavings,
    esgScore: Math.min(100, 50 + (annualCo2Avoided / 1000) * 2), // Simplified ESG score
  };
}

function calculateFeedInResults(config: FutureEnhancementsConfig, annualGeneration: number): FeedInTariffResults {
  const { feedInTariff } = config;
  
  // Simplified: assume 30% of generation is exported
  const annualExport = annualGeneration * 0.3;
  
  // Calculate weighted average rate from periods
  const totalHours = feedInTariff.feedInPeriods.reduce((sum, p) => {
    const hours = p.endHour > p.startHour ? p.endHour - p.startHour : 24 - p.startHour + p.endHour;
    return sum + hours * p.daysApplicable.length;
  }, 0);
  
  const weightedRate = feedInTariff.feedInPeriods.reduce((sum, p) => {
    const hours = p.endHour > p.startHour ? p.endHour - p.startHour : 24 - p.startHour + p.endHour;
    return sum + p.ratePerKwh * hours * p.daysApplicable.length;
  }, 0) / Math.max(totalHours, 1);
  
  const averageExportRate = Math.max(feedInTariff.minimumExportPrice, Math.min(feedInTariff.maximumExportPrice, weightedRate));
  
  // Simplified peak/off-peak split (40/60)
  const peakExportRevenue = annualExport * 0.4 * (averageExportRate * 1.5);
  const offPeakExportRevenue = annualExport * 0.6 * (averageExportRate * 0.7);
  
  const totalExportRevenue = peakExportRevenue + offPeakExportRevenue;
  const annualExportRevenue = totalExportRevenue - feedInTariff.gridConnectionFee * 12;
  
  return {
    totalExportRevenue,
    averageExportRate,
    peakExportRevenue,
    offPeakExportRevenue,
    netMeteringCredits: feedInTariff.meteringType === 'net' ? annualGeneration * 0.7 * averageExportRate : 0,
    annualExportRevenue: Math.max(0, annualExportRevenue),
  };
}

function calculateFinancingResults(
  config: FutureEnhancementsConfig,
  solarCapacity: number,
  batteryCapacity: number,
  annualSavings: number
): FinancingResults {
  const { financing } = config;
  const systemCost = solarCapacity * 12000 + batteryCapacity * 8000;
  
  let totalCost = systemCost;
  let effectiveRate = systemCost / (annualSavings * 25); // R per kWh effective
  let breakEvenYear = Math.ceil(systemCost / annualSavings);
  const yearlyPayments: { year: number; payment: number; principal: number; interest: number }[] = [];
  
  if (financing.selectedOption === 'loan') {
    const { loan } = financing;
    const downPaymentAmount = systemCost * (loan.downPayment / 100);
    const loanAmount = systemCost - downPaymentAmount;
    const monthlyRate = loan.interestRate / 100 / 12;
    const numPayments = loan.loanTerm * 12;
    
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    
    totalCost = downPaymentAmount + monthlyPayment * numPayments;
    
    let balance = loanAmount;
    for (let year = 1; year <= loan.loanTerm; year++) {
      let yearlyPrincipal = 0;
      let yearlyInterest = 0;
      
      for (let month = 0; month < 12; month++) {
        const interest = balance * monthlyRate;
        const principal = monthlyPayment - interest;
        yearlyPrincipal += principal;
        yearlyInterest += interest;
        balance -= principal;
      }
      
      yearlyPayments.push({
        year,
        payment: monthlyPayment * 12,
        principal: yearlyPrincipal,
        interest: yearlyInterest,
      });
    }
  } else if (financing.selectedOption === 'lease') {
    const { lease } = financing;
    totalCost = lease.monthlyPayment * lease.leaseTerm;
    
    for (let year = 1; year <= Math.ceil(lease.leaseTerm / 12); year++) {
      yearlyPayments.push({
        year,
        payment: lease.monthlyPayment * 12,
        principal: lease.monthlyPayment * 12 * 0.8,
        interest: lease.monthlyPayment * 12 * 0.2,
      });
    }
  } else if (financing.selectedOption === 'ppa') {
    const { ppa } = financing;
    let cumulativeCost = 0;
    
    for (let year = 1; year <= ppa.contractTerm; year++) {
      const escalatedRate = ppa.ppaRate * Math.pow(1 + ppa.ppaEscalationRate / 100, year - 1);
      const yearlyCost = annualSavings / 2 * escalatedRate; // Simplified
      cumulativeCost += yearlyCost;
      
      yearlyPayments.push({
        year,
        payment: yearlyCost,
        principal: yearlyCost,
        interest: 0,
      });
    }
    
    totalCost = cumulativeCost;
  }
  
  const savingsVsCash = systemCost - totalCost;
  effectiveRate = totalCost / (annualSavings * 25);
  
  // Find break-even year
  let cumulative = -totalCost;
  for (let year = 1; year <= 25; year++) {
    cumulative += annualSavings;
    if (cumulative >= 0) {
      breakEvenYear = year;
      break;
    }
  }

  return {
    selectedOption: financing.selectedOption,
    totalCost,
    monthlyCashFlow: [],
    effectiveRate,
    savingsVsCash,
    breakEvenYear,
    yearlyPayments,
  };
}

function calculateEquipmentResults(config: FutureEnhancementsConfig, solarCapacity: number): EquipmentResults {
  const { equipment } = config;
  
  const panel = SAMPLE_PANELS.find(p => p.id === equipment.selectedPanelId);
  const inverter = SAMPLE_INVERTERS.find(i => i.id === equipment.selectedInverterId);
  
  const panelWattage = panel?.wattage || 550;
  const panelCount = Math.ceil((solarCapacity * 1000) / panelWattage);
  
  const inverterPower = inverter?.ratedPower || 100;
  const inverterCount = Math.ceil(solarCapacity / inverterPower);
  
  const dcAcRatio = solarCapacity / (inverterCount * inverterPower);
  const panelsPerString = Math.min(20, Math.ceil(panelCount / Math.max(1, inverter?.mpptCount || 1)));
  const stringsCount = Math.ceil(panelCount / panelsPerString);
  
  const panelEfficiency = panel?.efficiency || 21;
  const inverterEfficiency = inverter?.maxEfficiency || 98;
  const systemEfficiency = (panelEfficiency / 100) * (inverterEfficiency / 100) * 0.95 * 100;
  
  const warnings: string[] = [];
  
  if (dcAcRatio > 1.5) {
    warnings.push(`DC/AC ratio ${dcAcRatio.toFixed(2)} exceeds recommended 1.5`);
  }
  if (dcAcRatio < 1.0) {
    warnings.push(`DC/AC ratio ${dcAcRatio.toFixed(2)} is below optimal 1.0`);
  }
  if (!panel) {
    warnings.push('No panel selected - using default specifications');
  }
  if (!inverter) {
    warnings.push('No inverter selected - using default specifications');
  }
  
  const compatibilityScore = 100 - warnings.length * 15;

  return {
    panelCount,
    stringsCount,
    panelsPerString,
    inverterCount,
    dcAcRatio,
    systemEfficiency,
    compatibilityScore: Math.max(0, compatibilityScore),
    warnings,
  };
}

export default FutureEnhancementsResults;
