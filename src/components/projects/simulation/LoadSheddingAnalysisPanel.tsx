import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Battery, Sun, AlertTriangle, TrendingUp, Shield } from "lucide-react";
import {
  runLoadSheddingAnalysis,
  LOAD_SHEDDING_STAGES,
  type LoadSheddingAnalysisResult,
  type EnergySimulationConfig,
} from "./index";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface LoadSheddingAnalysisPanelProps {
  loadProfile: number[];
  solarProfile: number[];
  config: EnergySimulationConfig;
  tariffRate?: number;
  className?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number, decimals = 1) =>
  value.toLocaleString("en-ZA", { maximumFractionDigits: decimals });

export function LoadSheddingAnalysisPanel({
  loadProfile,
  solarProfile,
  config,
  tariffRate = 2.5,
  className,
}: LoadSheddingAnalysisPanelProps) {
  const [selectedStage, setSelectedStage] = useState<string>("4");
  const [activeTab, setActiveTab] = useState("overview");

  const analysis = useMemo(() => {
    if (!loadProfile.length || !solarProfile.length) return null;
    return runLoadSheddingAnalysis(loadProfile, solarProfile, config, tariffRate);
  }, [loadProfile, solarProfile, config, tariffRate]);

  if (!analysis) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          Configure load and solar profiles to run load shedding analysis
        </CardContent>
      </Card>
    );
  }

  const selectedScenario = analysis.scenarios.find(
    (s) => s.stage === parseInt(selectedStage)
  );

  const chartData = analysis.scenarios.map((s) => ({
    stage: `Stage ${s.stage}`,
    annualSavings: s.annualSavings,
    backupValue: s.additionalSavingsFromBackup,
    totalValue: s.annualSavings + s.additionalSavingsFromBackup,
    gridImport: s.annualGridImport,
    selfConsumption: s.selfConsumptionRate,
    protection: s.outageProtectionRate,
  }));

  const comparisonData = analysis.scenarios.map((s) => ({
    stage: s.stage,
    name: s.stageName,
    hours: s.hoursPerDay,
    protection: s.outageProtectionRate,
    savings: s.annualSavings,
    totalValue: s.annualSavings + s.additionalSavingsFromBackup,
  }));

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Load Shedding Scenario Analysis
          </CardTitle>
          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {LOAD_SHEDDING_STAGES.map((stage) => (
                <SelectItem key={stage.stage} value={stage.stage.toString()}>
                  {stage.name} ({stage.hoursPerDay}h/day)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="table">Data Table</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {selectedScenario && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Outage Hours
                      </div>
                      <div className="text-xl font-bold">
                        {selectedScenario.hoursPerDay}h/day
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(selectedScenario.annualLoadShedHours, 0)} hours/year
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Shield className="h-3 w-3" />
                        Protection Rate
                      </div>
                      <div className="text-xl font-bold">
                        {formatNumber(selectedScenario.outageProtectionRate, 0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Load served during outages
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <TrendingUp className="h-3 w-3" />
                        Annual Savings
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        {formatCurrency(selectedScenario.annualSavings)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        +{formatCurrency(selectedScenario.additionalSavingsFromBackup)} backup value
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Sun className="h-3 w-3" />
                        Self-Consumption
                      </div>
                      <div className="text-xl font-bold">
                        {formatNumber(selectedScenario.selfConsumptionRate, 0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(selectedScenario.solarCoverageRate, 0)}% solar coverage
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Daily Energy Flow</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Daily Load</span>
                        <span>{formatNumber(selectedScenario.dailyLoad)} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Daily Solar</span>
                        <span>{formatNumber(selectedScenario.dailySolar)} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grid Import</span>
                        <span>{formatNumber(selectedScenario.dailyGridImport)} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grid Export</span>
                        <span>{formatNumber(selectedScenario.dailyGridExport)} kWh</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">Unmet Load (outages)</span>
                        <span className="text-destructive">
                          {formatNumber(selectedScenario.unmetLoadDuringOutage)} kWh
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Annual Projections</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Annual Solar</span>
                        <span>{formatNumber(selectedScenario.annualSolar, 0)} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Annual Grid Import</span>
                        <span>{formatNumber(selectedScenario.annualGridImport, 0)} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Specific Yield</span>
                        <span>{formatNumber(selectedScenario.specificYield, 0)} kWh/kWp</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">Grid-Only Cost</span>
                        <span>{formatCurrency(selectedScenario.gridOnlyCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">With Solar Cost</span>
                        <span>{formatCurrency(selectedScenario.solarSystemCost)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {analysis.recommendations.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {analysis.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="comparison">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "protection") return [`${value.toFixed(0)}%`, "Protection Rate"];
                      if (name === "hours") return [`${value}h/day`, "Outage Hours"];
                      return [formatCurrency(value), "Total Value"];
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalValue"
                    stroke="hsl(var(--primary))"
                    name="Total Value (R/year)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="protection"
                    stroke="hsl(var(--chart-2))"
                    name="Protection Rate (%)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Total value increases with load shedding severity due to backup power value
            </div>
          </TabsContent>

          <TabsContent value="financial">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="stage" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "annualSavings" ? "Energy Savings" : "Backup Value",
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="annualSavings"
                    stackId="a"
                    fill="hsl(var(--primary))"
                    name="Energy Savings"
                  />
                  <Bar
                    dataKey="backupValue"
                    stackId="a"
                    fill="hsl(var(--chart-4))"
                    name="Backup Value"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Stage 0 (No LS)</div>
                <div className="text-lg font-bold">
                  {formatCurrency(analysis.baselineComparison.stage0Savings)}
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Stage 4</div>
                <div className="text-lg font-bold">
                  {formatCurrency(analysis.baselineComparison.stage4Savings)}
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Stage 8</div>
                <div className="text-lg font-bold">
                  {formatCurrency(analysis.baselineComparison.stage8Savings)}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="table">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Hours/Day</TableHead>
                    <TableHead className="text-right">Protection</TableHead>
                    <TableHead className="text-right">Grid Import</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.scenarios.map((s) => (
                    <TableRow
                      key={s.stage}
                      className={selectedStage === s.stage.toString() ? "bg-muted/50" : ""}
                    >
                      <TableCell className="font-medium">
                        <Badge variant={s.stage === 0 ? "secondary" : s.stage >= 6 ? "destructive" : "outline"}>
                          {s.stageName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{s.hoursPerDay}h</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(s.outageProtectionRate, 0)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(s.annualGridImport, 0)} kWh
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.annualSavings)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(s.annualSavings + s.additionalSavingsFromBackup)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
