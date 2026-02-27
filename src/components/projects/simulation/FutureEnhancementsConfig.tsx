import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Cloud, Zap, Building2, Leaf, CreditCard, Cpu, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FutureEnhancementsConfig as FEConfig,
  DEFAULT_FUTURE_ENHANCEMENTS_CONFIG,
  HistoricalWeatherConfig,
  FeedInTariffConfig,
  PortfolioConfig,
  CarbonConfig,
  FinancingConfig,
  EquipmentConfig,
  SAMPLE_PANELS,
  SAMPLE_INVERTERS,
  SAMPLE_BATTERIES,
} from "./FutureEnhancementsTypes";

interface FutureEnhancementsConfigProps {
  config: FEConfig;
  onChange: (config: FEConfig) => void;
}

export function FutureEnhancementsConfigPanel({ config, onChange }: FutureEnhancementsConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const enabledCount = [
    config.historicalWeather.enabled,
    config.feedInTariff.enabled,
    config.portfolio.enabled,
    config.carbon.enabled,
    config.financing.enabled,
    config.equipment.enabled,
  ].filter(Boolean).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Future Enhancements (Phase 8)</CardTitle>
                {enabledCount > 0 && (
                  <Badge variant="default" className="text-xs">
                    {enabledCount} active
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                  Preview
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <p className="text-xs text-muted-foreground">
              Extended capabilities for enterprise-scale deployments and advanced integrations.
            </p>
            
            <Tabs defaultValue="weather" className="w-full">
              <TabsList className="grid w-full grid-cols-6 h-auto">
                <TabsTrigger value="weather" className="text-xs py-1.5 flex flex-col gap-0.5">
                  <Cloud className="h-3 w-3" />
                  <span className="hidden sm:inline">Weather</span>
                </TabsTrigger>
                <TabsTrigger value="feedin" className="text-xs py-1.5 flex flex-col gap-0.5">
                  <Zap className="h-3 w-3" />
                  <span className="hidden sm:inline">Feed-in</span>
                </TabsTrigger>
                <TabsTrigger value="portfolio" className="text-xs py-1.5 flex flex-col gap-0.5">
                  <Building2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Portfolio</span>
                </TabsTrigger>
                <TabsTrigger value="carbon" className="text-xs py-1.5 flex flex-col gap-0.5">
                  <Leaf className="h-3 w-3" />
                  <span className="hidden sm:inline">Carbon</span>
                </TabsTrigger>
                <TabsTrigger value="financing" className="text-xs py-1.5 flex flex-col gap-0.5">
                  <CreditCard className="h-3 w-3" />
                  <span className="hidden sm:inline">Finance</span>
                </TabsTrigger>
                <TabsTrigger value="equipment" className="text-xs py-1.5 flex flex-col gap-0.5">
                  <Cpu className="h-3 w-3" />
                  <span className="hidden sm:inline">Equipment</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="weather" className="mt-4">
                <HistoricalWeatherSection
                  config={config.historicalWeather}
                  onChange={(historicalWeather) => onChange({ ...config, historicalWeather })}
                />
              </TabsContent>
              
              <TabsContent value="feedin" className="mt-4">
                <FeedInTariffSection
                  config={config.feedInTariff}
                  onChange={(feedInTariff) => onChange({ ...config, feedInTariff })}
                />
              </TabsContent>
              
              <TabsContent value="portfolio" className="mt-4">
                <PortfolioSection
                  config={config.portfolio}
                  onChange={(portfolio) => onChange({ ...config, portfolio })}
                />
              </TabsContent>
              
              <TabsContent value="carbon" className="mt-4">
                <CarbonSection
                  config={config.carbon}
                  onChange={(carbon) => onChange({ ...config, carbon })}
                />
              </TabsContent>
              
              <TabsContent value="financing" className="mt-4">
                <FinancingSection
                  config={config.financing}
                  onChange={(financing) => onChange({ ...config, financing })}
                />
              </TabsContent>
              
              <TabsContent value="equipment" className="mt-4">
                <EquipmentSection
                  config={config.equipment}
                  onChange={(equipment) => onChange({ ...config, equipment })}
                />
              </TabsContent>
            </Tabs>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => onChange(DEFAULT_FUTURE_ENHANCEMENTS_CONFIG)}
            >
              Reset All Enhancements
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============= 1. Historical Weather Section =============
function HistoricalWeatherSection({
  config,
  onChange,
}: {
  config: HistoricalWeatherConfig;
  onChange: (config: HistoricalWeatherConfig) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-blue-500" />
          <Label className="text-sm font-medium">Historical Weather Integration</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
          <div className="text-xs text-muted-foreground">
            Compare forecast vs actual generation using historical weather data
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Weather API Provider</Label>
              <Select
                value={config.weatherApiProvider}
                onValueChange={(v: 'solcast' | 'openmeteo' | 'nasa_power') => 
                  onChange({ ...config, weatherApiProvider: v })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solcast">Solcast</SelectItem>
                  <SelectItem value="openmeteo">Open-Meteo</SelectItem>
                  <SelectItem value="nasa_power">NASA POWER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 pt-4">
              <Switch
                checked={config.compareToForecast}
                onCheckedChange={(compareToForecast) => onChange({ ...config, compareToForecast })}
              />
              <Label className="text-xs">Compare to Forecast</Label>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date Range Start</Label>
              <Input
                type="date"
                value={config.dateRangeStart}
                onChange={(e) => onChange({ ...config, dateRangeStart: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date Range End</Label>
              <Input
                type="date"
                value={config.dateRangeEnd}
                onChange={(e) => onChange({ ...config, dateRangeEnd: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={config.weatherAdjustmentEnabled}
              onCheckedChange={(weatherAdjustmentEnabled) => onChange({ ...config, weatherAdjustmentEnabled })}
            />
            <Label className="text-xs">Enable Weather-Adjusted Reporting</Label>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= 2. Feed-in Tariff Section =============
function FeedInTariffSection({
  config,
  onChange,
}: {
  config: FeedInTariffConfig;
  onChange: (config: FeedInTariffConfig) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <Label className="text-sm font-medium">Grid Feed-in Tariff</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Metering Type</Label>
              <Select
                value={config.meteringType}
                onValueChange={(v: 'net' | 'gross') => onChange({ ...config, meteringType: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="net">Net Metering</SelectItem>
                  <SelectItem value="gross">Gross Metering</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Escalation Rate (%/yr)</Label>
              <NumericInput
                value={config.escalationRate}
                onChange={(v) => onChange({ ...config, escalationRate: v })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Min Export (R/kWh)</Label>
              <NumericInput
                step={0.01}
                value={config.minimumExportPrice}
                onChange={(v) => onChange({ ...config, minimumExportPrice: v })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Export (R/kWh)</Label>
              <NumericInput
                step={0.01}
                value={config.maximumExportPrice}
                onChange={(v) => onChange({ ...config, maximumExportPrice: v })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Connection Fee (R/mo)</Label>
              <NumericInput
                value={config.gridConnectionFee}
                onChange={(v) => onChange({ ...config, gridConnectionFee: v })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          
          <div className="p-2 rounded bg-muted/50 text-xs">
            <div className="font-medium mb-1">Export Periods:</div>
            {config.feedInPeriods.map((period) => (
              <div key={period.id} className="flex justify-between">
                <span>{period.name} ({period.startHour}:00-{period.endHour}:00)</span>
                <span className="font-medium">R{period.ratePerKwh.toFixed(2)}/kWh</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============= 3. Portfolio Section =============
function PortfolioSection({
  config,
  onChange,
}: {
  config: PortfolioConfig;
  onChange: (config: PortfolioConfig) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-purple-500" />
          <Label className="text-sm font-medium">Multi-site Portfolio Analysis</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
          <div className="text-xs text-muted-foreground">
            Aggregate multiple projects for portfolio-level metrics and comparisons
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Portfolio Name</Label>
              <Input
                value={config.portfolioName}
                onChange={(e) => onChange({ ...config, portfolioName: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aggregation Method</Label>
              <Select
                value={config.aggregationMethod}
                onValueChange={(v: 'sum' | 'weighted_average') => onChange({ ...config, aggregationMethod: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum Total</SelectItem>
                  <SelectItem value="weighted_average">Weighted Average</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Benchmark IRR (%)</Label>
              <NumericInput
                value={config.benchmarkIrr}
                onChange={(v) => onChange({ ...config, benchmarkIrr: v })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target Payback (years)</Label>
              <NumericInput
                value={config.targetPayback}
                onChange={(v) => onChange({ ...config, targetPayback: v })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          
          <div className="p-2 rounded bg-muted/50 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Info className="h-3 w-3" />
              Select projects to include from the Projects page
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= 4. Carbon Section =============
function CarbonSection({
  config,
  onChange,
}: {
  config: CarbonConfig;
  onChange: (config: CarbonConfig) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-green-500" />
          <Label className="text-sm font-medium">Carbon & Sustainability</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Grid Emission Factor (kg CO₂/kWh)</Label>
              <NumericInput
                step={0.01}
                value={config.gridEmissionFactor}
                onChange={(v) => onChange({ ...config, gridEmissionFactor: v })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Carbon Tax (R/ton CO₂)</Label>
              <NumericInput
                value={config.carbonTaxRate}
                onChange={(v) => onChange({ ...config, carbonTaxRate: v })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.includeTransmissionLosses}
                onCheckedChange={(includeTransmissionLosses) => onChange({ ...config, includeTransmissionLosses })}
              />
              <Label className="text-xs">Include Transmission Losses</Label>
            </div>
            {config.includeTransmissionLosses && (
              <div className="space-y-1">
                <Label className="text-xs">Loss %</Label>
                <NumericInput
                  value={config.transmissionLossPercent}
                  onChange={(v) => onChange({ ...config, transmissionLossPercent: v })}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.recTrackingEnabled}
                onCheckedChange={(recTrackingEnabled) => onChange({ ...config, recTrackingEnabled })}
              />
              <Label className="text-xs">REC Tracking</Label>
            </div>
            {config.recTrackingEnabled && (
              <div className="space-y-1">
                <Label className="text-xs">REC Price (R/MWh)</Label>
                <NumericInput
                  value={config.recPricePerMwh}
                  onChange={(v) => onChange({ ...config, recPricePerMwh: v })}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={config.esgReportingEnabled}
              onCheckedChange={(esgReportingEnabled) => onChange({ ...config, esgReportingEnabled })}
            />
            <Label className="text-xs">Enable ESG Reporting Exports</Label>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= 5. Financing Section =============
function FinancingSection({
  config,
  onChange,
}: {
  config: FinancingConfig;
  onChange: (config: FinancingConfig) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-500" />
          <Label className="text-sm font-medium">Financing Options</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Financing Type</Label>
            <Select
              value={config.selectedOption}
              onValueChange={(v: 'cash' | 'ppa' | 'lease' | 'loan') => onChange({ ...config, selectedOption: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash Purchase</SelectItem>
                <SelectItem value="ppa">PPA (Power Purchase Agreement)</SelectItem>
                <SelectItem value="lease">Equipment Lease</SelectItem>
                <SelectItem value="loan">Bank Loan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {config.selectedOption === 'ppa' && (
            <div className="space-y-2 p-2 rounded bg-muted/50">
              <div className="text-xs font-medium">PPA Configuration</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">PPA Rate (R/kWh)</Label>
                  <NumericInput
                    step={0.01}
                    value={config.ppa.ppaRate}
                    onChange={(v) => onChange({ ...config, ppa: { ...config.ppa, ppaRate: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Escalation (%/yr)</Label>
                  <NumericInput
                    value={config.ppa.ppaEscalationRate}
                    onChange={(v) => onChange({ ...config, ppa: { ...config.ppa, ppaEscalationRate: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contract Term (years)</Label>
                  <NumericInput
                    integer
                    value={config.ppa.contractTerm}
                    onChange={(v) => onChange({ ...config, ppa: { ...config.ppa, contractTerm: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Performance Guarantee (%)</Label>
                  <NumericInput
                    value={config.ppa.performanceGuarantee}
                    onChange={(v) => onChange({ ...config, ppa: { ...config.ppa, performanceGuarantee: v } })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
          
          {config.selectedOption === 'lease' && (
            <div className="space-y-2 p-2 rounded bg-muted/50">
              <div className="text-xs font-medium">Lease Configuration</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Payment (R)</Label>
                  <NumericInput
                    value={config.lease.monthlyPayment}
                    onChange={(v) => onChange({ ...config, lease: { ...config.lease, monthlyPayment: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lease Term (months)</Label>
                  <NumericInput
                    integer
                    value={config.lease.leaseTerm}
                    onChange={(v) => onChange({ ...config, lease: { ...config.lease, leaseTerm: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Residual Value (%)</Label>
                  <NumericInput
                    value={config.lease.residualValue}
                    onChange={(v) => onChange({ ...config, lease: { ...config.lease, residualValue: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <Switch
                    checked={config.lease.buyoutOption}
                    onCheckedChange={(buyoutOption) => onChange({ ...config, lease: { ...config.lease, buyoutOption } })}
                  />
                  <Label className="text-xs">Buyout Option</Label>
                </div>
              </div>
            </div>
          )}
          
          {config.selectedOption === 'loan' && (
            <div className="space-y-2 p-2 rounded bg-muted/50">
              <div className="text-xs font-medium">Loan Configuration</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Interest Rate (%)</Label>
                  <NumericInput
                    step={0.1}
                    value={config.loan.interestRate}
                    onChange={(v) => onChange({ ...config, loan: { ...config.loan, interestRate: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Loan Term (years)</Label>
                  <NumericInput
                    integer
                    value={config.loan.loanTerm}
                    onChange={(v) => onChange({ ...config, loan: { ...config.loan, loanTerm: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Down Payment (%)</Label>
                  <NumericInput
                    value={config.loan.downPayment}
                    onChange={(v) => onChange({ ...config, loan: { ...config.loan, downPayment: v } })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Frequency</Label>
                  <Select
                    value={config.loan.paymentFrequency}
                    onValueChange={(v: 'monthly' | 'quarterly' | 'annually') => 
                      onChange({ ...config, loan: { ...config.loan, paymentFrequency: v } })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============= 6. Equipment Section =============
function EquipmentSection({
  config,
  onChange,
}: {
  config: EquipmentConfig;
  onChange: (config: EquipmentConfig) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-orange-500" />
          <Label className="text-sm font-medium">Equipment Database</Label>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 mb-3">
            <Switch
              checked={config.autoMatch}
              onCheckedChange={(autoMatch) => onChange({ ...config, autoMatch })}
            />
            <Label className="text-xs">Auto-match Compatible Equipment</Label>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Solar Panel</Label>
            <Select
              value={config.selectedPanelId || ""}
              onValueChange={(v) => onChange({ ...config, selectedPanelId: v || null })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select panel..." />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_PANELS.map((panel) => (
                  <SelectItem key={panel.id} value={panel.id}>
                    {panel.manufacturer} {panel.model} ({panel.wattage}W)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Inverter</Label>
            <Select
              value={config.selectedInverterId || ""}
              onValueChange={(v) => onChange({ ...config, selectedInverterId: v || null })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select inverter..." />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_INVERTERS.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.manufacturer} {inv.model} ({inv.ratedPower}kW)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Battery</Label>
            <Select
              value={config.selectedBatteryId || ""}
              onValueChange={(v) => onChange({ ...config, selectedBatteryId: v || null })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select battery..." />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_BATTERIES.map((bat) => (
                  <SelectItem key={bat.id} value={bat.id}>
                    {bat.manufacturer} {bat.model} ({bat.capacity}kWh)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {config.selectedPanelId && (
            <div className="p-2 rounded bg-muted/50 text-xs">
              <div className="font-medium mb-1">Selected Panel Specs:</div>
              {(() => {
                const panel = SAMPLE_PANELS.find(p => p.id === config.selectedPanelId);
                if (!panel) return null;
                return (
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    <span>Efficiency: {panel.efficiency}%</span>
                    <span>Voc: {panel.voc}V</span>
                    <span>Temp Coeff: {panel.tempCoeffPmax}%/°C</span>
                    <span>Warranty: {panel.warranty} years</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FutureEnhancementsConfigPanel;
