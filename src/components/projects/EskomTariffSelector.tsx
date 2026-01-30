import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  Gauge, 
  Check,
  Zap,
  Calculator,
  Sun,
  Clock,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateAnnualBlendedRates,
  ANNUAL_HOURS_24H,
  ANNUAL_HOURS_SOLAR,
} from "@/lib/tariffCalculations";

// Extended to support all 6 rate options: category (allHours/solarHours) + period (annual/high/low)
export type BlendedRateType = 
  | 'allHours' | 'allHoursHigh' | 'allHoursLow'
  | 'solarHours' | 'solarHoursHigh' | 'solarHoursLow';

interface TariffRate {
  id: string;
  season: string;
  time_of_use: string;
  rate_per_kwh: number;
  demand_charge_per_kva?: number;
  network_charge_per_kwh?: number;
  ancillary_charge_per_kwh?: number;
  energy_charge_per_kwh?: number;
  electrification_rural_per_kwh?: number;
  affordability_subsidy_per_kwh?: number;
  // VAT-inclusive variants
  rate_per_kwh_incl_vat?: number;
  network_charge_per_kwh_incl_vat?: number;
  ancillary_charge_per_kwh_incl_vat?: number;
  energy_charge_per_kwh_incl_vat?: number;
  electrification_rural_per_kwh_incl_vat?: number;
  affordability_subsidy_per_kwh_incl_vat?: number;
}

interface Tariff {
  id: string;
  name: string;
  tariff_type: string;
  tariff_family: string | null;
  transmission_zone: string | null;
  voltage_level: string | null;
  fixed_monthly_charge: number | null;
  demand_charge_per_kva: number | null;
  generation_capacity_charge: number | null;
  network_access_charge: number | null;
  reactive_energy_charge: number | null;
  administration_charge_per_day: number | null;
  service_charge_per_day: number | null;
  legacy_charge_per_kwh: number | null;
  // VAT-inclusive tariff-level fields
  fixed_monthly_charge_incl_vat?: number | null;
  demand_charge_per_kva_incl_vat?: number | null;
  legacy_charge_per_kwh_incl_vat?: number | null;
  tariff_rates?: TariffRate[];
}

interface EskomTariffSelectorProps {
  municipalityId: string;
  currentTariffId: string | null;
  onSelect: (tariffId: string) => void;
  selectedBlendedRateType?: BlendedRateType;
  onBlendedRateTypeChange?: (type: BlendedRateType) => void;
}

const TRANSMISSION_ZONES = [
  "Zone 0-300km",
  "Zone 300-600km",
  "Zone 600-900km",
  "Zone >900km",
];

const VOLTAGE_LEVELS = ["LV", "MV", "HV"];

export function EskomTariffSelector({ 
  municipalityId, 
  currentTariffId, 
  onSelect,
  selectedBlendedRateType = 'solarHours',
  onBlendedRateTypeChange
}: EskomTariffSelectorProps) {
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [activeFamily, setActiveFamily] = useState<string>("");
  const [showVatInclusive, setShowVatInclusive] = useState<boolean>(false);

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ["eskom-tariffs", municipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          tariff_rates(*)
        `)
        .eq("municipality_id", municipalityId)
        .order("name");
      if (error) throw error;
      return data as Tariff[];
    },
    enabled: !!municipalityId,
  });

  // Group tariffs by family
  const tariffsByFamily = useMemo(() => {
    if (!tariffs) return {};
    
    const grouped: Record<string, Tariff[]> = {};
    tariffs.forEach(tariff => {
      const family = tariff.tariff_family || "Other";
      if (!grouped[family]) grouped[family] = [];
      grouped[family].push(tariff);
    });
    
    return grouped;
  }, [tariffs]);

  const families = Object.keys(tariffsByFamily).sort();

  // Set default active family
  useMemo(() => {
    if (families.length > 0 && !activeFamily) {
      setActiveFamily(families[0]);
    }
  }, [families, activeFamily]);

  // Group tariffs by transmission zone within the active family
  const tariffsByZone = useMemo(() => {
    const familyTariffs = tariffsByFamily[activeFamily] || [];
    const grouped: Record<string, Tariff[]> = {};
    
    familyTariffs.forEach(tariff => {
      const zone = tariff.transmission_zone || "No Zone";
      if (!grouped[zone]) grouped[zone] = [];
      grouped[zone].push(tariff);
    });
    
    return grouped;
  }, [tariffsByFamily, activeFamily]);

  const toggleZone = (zone: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(zone)) {
        next.delete(zone);
      } else {
        next.add(zone);
      }
      return next;
    });
  };

  const handleSelectTariff = (tariffId: string) => {
    onSelect(tariffId);
  };

  // Find selected tariff details
  const selectedTariff = tariffs?.find(t => t.id === currentTariffId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tariffs || tariffs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No Eskom tariffs found. Import tariffs from the Tariff Management page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* VAT Toggle */}
      <div className="flex items-center justify-end space-x-2 pb-2 border-b">
        <Label htmlFor="vat-toggle" className="text-sm text-muted-foreground">
          Show VAT-inclusive rates
        </Label>
        <Switch
          id="vat-toggle"
          checked={showVatInclusive}
          onCheckedChange={setShowVatInclusive}
        />
      </div>

      {/* Tariff Family Tabs */}
      <Tabs value={activeFamily} onValueChange={setActiveFamily}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {families.map(family => (
            <TabsTrigger
              key={family}
              value={family}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {family}
              <Badge variant="secondary" className="ml-2 text-xs">
                {tariffsByFamily[family]?.length || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {families.map(family => (
          <TabsContent key={family} value={family} className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {/* Group by Transmission Zone */}
                {TRANSMISSION_ZONES.map(zone => {
                  const zoneTariffs = tariffsByZone[zone];
                  if (!zoneTariffs || zoneTariffs.length === 0) return null;

                  const isExpanded = expandedZones.has(zone);

                  // Group by voltage level within zone
                  const byVoltage: Record<string, Tariff[]> = {};
                  zoneTariffs.forEach(t => {
                    const vl = t.voltage_level || "Unknown";
                    if (!byVoltage[vl]) byVoltage[vl] = [];
                    byVoltage[vl].push(t);
                  });

                  return (
                    <Collapsible
                      key={zone}
                      open={isExpanded}
                      onOpenChange={() => toggleZone(zone)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{zone.replace("Zone ", "")}</span>
                          </div>
                          <Badge variant="outline">
                            {zoneTariffs.length} tariff{zoneTariffs.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="pl-6 pt-2 space-y-3">
                          {/* Group by Voltage Level */}
                          {VOLTAGE_LEVELS.map(voltage => {
                            const voltageTariffs = byVoltage[voltage];
                            if (!voltageTariffs || voltageTariffs.length === 0) return null;

                            return (
                              <div key={voltage} className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Gauge className="h-3 w-3" />
                                  <span>{voltage} Voltage</span>
                                </div>
                                <div className="grid gap-2">
                                  {voltageTariffs.map(tariff => {
                                    const isSelected = tariff.id === currentTariffId;
                                    
                                    // Calculate totals for display
                                    const hasServiceCharge = tariff.fixed_monthly_charge && Number(tariff.fixed_monthly_charge) > 0;
                                    const hasNetworkAccess = tariff.network_access_charge && Number(tariff.network_access_charge) > 0;
                                    const hasGCC = tariff.generation_capacity_charge && Number(tariff.generation_capacity_charge) > 0;
                                    const hasReactive = tariff.reactive_energy_charge && Number(tariff.reactive_energy_charge) > 0;
                                    const hasAdminCharge = tariff.administration_charge_per_day && Number(tariff.administration_charge_per_day) > 0;
                                    
                                    return (
                                      <button
                                        key={tariff.id}
                                        onClick={() => handleSelectTariff(tariff.id)}
                                        className={cn(
                                          "p-3 rounded-lg border text-left transition-all",
                                          "hover:border-primary hover:bg-primary/5",
                                          isSelected && "border-primary bg-primary/10 ring-1 ring-primary"
                                        )}
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{tariff.name}</span>
                                            {isSelected && (
                                              <Check className="h-4 w-4 text-primary" />
                                            )}
                                          </div>
                                          <Badge 
                                            variant={tariff.tariff_type === "TOU" ? "default" : "outline"}
                                            className="shrink-0"
                                          >
                                            {tariff.tariff_type}
                                          </Badge>
                                        </div>

                                        {/* Unbundled Charges Grid */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                                          {hasServiceCharge && (
                                            <div className="p-1.5 rounded bg-muted/50">
                                              <div className="text-muted-foreground">Service</div>
                                              <div className="font-medium">R{Number(tariff.fixed_monthly_charge).toFixed(2)}/mo</div>
                                            </div>
                                          )}
                                          {hasNetworkAccess && (
                                            <div className="p-1.5 rounded bg-blue-500/10">
                                              <div className="text-muted-foreground">Network</div>
                                              <div className="font-medium">R{Number(tariff.network_access_charge).toFixed(2)}/kVA</div>
                                            </div>
                                          )}
                                          {hasGCC && (
                                            <div className="p-1.5 rounded bg-orange-500/10">
                                              <div className="text-muted-foreground">GCC</div>
                                              <div className="font-medium">R{Number(tariff.generation_capacity_charge).toFixed(2)}/kVA</div>
                                            </div>
                                          )}
                                          {hasReactive && (
                                            <div className="p-1.5 rounded bg-purple-500/10">
                                              <div className="text-muted-foreground">Reactive</div>
                                              <div className="font-medium">R{Number(tariff.reactive_energy_charge).toFixed(4)}/kVArh</div>
                                            </div>
                                          )}
                                          {hasAdminCharge && (
                                            <div className="p-1.5 rounded bg-muted/50">
                                              <div className="text-muted-foreground">Admin</div>
                                              <div className="font-medium">R{Number(tariff.administration_charge_per_day).toFixed(2)}/day</div>
                                            </div>
                                          )}
                                        </div>
                                          
                                        {/* Energy Rates using new grid layout */}
                                        {tariff.tariff_rates && tariff.tariff_rates.length > 0 && (
                                          <UnbundledBreakdown 
                                            rates={tariff.tariff_rates} 
                                            tariff={tariff}
                                            showVatInclusive={showVatInclusive} 
                                          />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}

                {/* Tariffs without zones */}
                {tariffsByZone["No Zone"]?.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <div className="text-sm text-muted-foreground px-3">Other Tariffs</div>
                    {tariffsByZone["No Zone"].map(tariff => {
                      const isSelected = tariff.id === currentTariffId;
                      
                      return (
                        <button
                          key={tariff.id}
                          onClick={() => handleSelectTariff(tariff.id)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border w-full text-left transition-all",
                            "hover:border-primary hover:bg-primary/5",
                            isSelected && "border-primary bg-primary/10 ring-1 ring-primary"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{tariff.name}</span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <Badge variant={tariff.tariff_type === "TOU" ? "default" : "outline"}>
                            {tariff.tariff_type}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      {/* Selected Tariff Summary */}
      {selectedTariff && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  {selectedTariff.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  {selectedTariff.transmission_zone && (
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {selectedTariff.transmission_zone.replace("Zone ", "")}
                    </Badge>
                  )}
                  {selectedTariff.voltage_level && (
                    <Badge variant="outline" className="text-xs">
                      <Gauge className="h-3 w-3 mr-1" />
                      {selectedTariff.voltage_level}
                    </Badge>
                  )}
                </CardDescription>
              </div>
              <Badge>{selectedTariff.tariff_type}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {selectedTariff.fixed_monthly_charge && Number(selectedTariff.fixed_monthly_charge) > 0 && (
                <div className="p-2 rounded bg-background">
                  <div className="text-xs text-muted-foreground">Service Charge</div>
                  <div className="font-medium">R{Number(selectedTariff.fixed_monthly_charge).toFixed(2)}/mo</div>
                </div>
              )}
              {selectedTariff.network_access_charge && Number(selectedTariff.network_access_charge) > 0 && (
                <div className="p-2 rounded bg-background">
                  <div className="text-xs text-muted-foreground">Network Access</div>
                  <div className="font-medium">R{Number(selectedTariff.network_access_charge).toFixed(2)}/kVA</div>
                </div>
              )}
              {selectedTariff.generation_capacity_charge && Number(selectedTariff.generation_capacity_charge) > 0 && (
                <div className="p-2 rounded bg-background">
                  <div className="text-xs text-muted-foreground">GCC</div>
                  <div className="font-medium">R{Number(selectedTariff.generation_capacity_charge).toFixed(2)}/kVA</div>
                </div>
              )}
              {selectedTariff.reactive_energy_charge && Number(selectedTariff.reactive_energy_charge) > 0 && (
                <div className="p-2 rounded bg-background">
                  <div className="text-xs text-muted-foreground">Reactive</div>
                  <div className="font-medium">R{Number(selectedTariff.reactive_energy_charge).toFixed(4)}/kVArh</div>
                </div>
              )}
            </div>

            {/* Full Rate Matrix using new grid layout */}
            {selectedTariff.tariff_rates && selectedTariff.tariff_rates.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <UnbundledBreakdown 
                  rates={selectedTariff.tariff_rates} 
                  tariff={selectedTariff}
                  showVatInclusive={showVatInclusive} 
                />
              </div>
            )}

            {/* Blended Rates Selection */}
            {selectedTariff.tariff_rates && selectedTariff.tariff_rates.length > 0 && (
              <EskomBlendedRatesCard 
                rates={selectedTariff.tariff_rates} 
                tariff={selectedTariff}
                selectedType={selectedBlendedRateType}
                onTypeChange={onBlendedRateTypeChange}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper to organize rates by season and TOU period
function organizeRatesBySeason(rates: TariffRate[]) {
  const findRate = (season: string, tou: string) =>
    rates.find(r =>
      r.season?.toLowerCase().includes(season.toLowerCase()) &&
      r.time_of_use === tou
    );

  return {
    highSeason: {
      peak: findRate("high", "Peak"),
      standard: findRate("high", "Standard"),
      offPeak: findRate("high", "Off-Peak")
    },
    lowSeason: {
      peak: findRate("low", "Peak"),
      standard: findRate("low", "Standard"),
      offPeak: findRate("low", "Off-Peak")
    }
  };
}

// Rate block component for consistent styling
function RateBlock({ 
  value, 
  label, 
  variant 
}: { 
  value: number | null | undefined; 
  label: string; 
  variant: 'peak' | 'standard' | 'offpeak' | 'neutral' | 'blue' | 'subsidy' | 'empty';
}) {
  if (variant === 'empty') {
    return <div className="p-1.5 rounded bg-transparent" />;
  }

  const variantStyles = {
    peak: 'bg-red-500/10 text-red-700 dark:text-red-400',
    standard: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    offpeak: 'bg-green-500/10 text-green-700 dark:text-green-400',
    neutral: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    subsidy: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  };

  const displayValue = value != null ? (value * 100).toFixed(2) : '—';

  return (
    <div className={`p-1.5 rounded text-center ${variantStyles[variant]}`}>
      <div className="font-semibold text-xs">{displayValue}c</div>
      <div className="text-[10px] text-muted-foreground truncate">{label}</div>
    </div>
  );
}

// Unbundled breakdown component using grid layout
function UnbundledBreakdown({ 
  rates, 
  tariff, 
  showVatInclusive 
}: { 
  rates: TariffRate[]; 
  tariff: Tariff;
  showVatInclusive: boolean; 
}) {
  const organized = organizeRatesBySeason(rates);
  
  // Get a sample rate for unbundled charges (they're the same across all periods)
  const sampleRate = rates[0];
  if (!sampleRate) return null;

  // Get rate values based on VAT preference
  const getRate = (rate: TariffRate | undefined, field: keyof TariffRate, fieldIncl: keyof TariffRate) => {
    if (!rate) return null;
    return showVatInclusive ? (rate[fieldIncl] as number | null) : (rate[field] as number | null);
  };

  const getLegacyCharge = () => {
    return showVatInclusive ? tariff.legacy_charge_per_kwh_incl_vat : tariff.legacy_charge_per_kwh;
  };

  // Get network demand from Peak rate (only applies to Peak/Standard)
  const networkDemand = getRate(organized.highSeason.peak, 'network_charge_per_kwh', 'network_charge_per_kwh_incl_vat');

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-dashed">
      <div className="text-[10px] text-muted-foreground font-medium">
        Rates (c/kWh) {showVatInclusive ? "(Incl VAT)" : "(Excl VAT)"}
      </div>
      
      {/* Row 1: High Season Energy Rates */}
      <div>
        <div className="text-[10px] text-muted-foreground mb-1">High Season (Winter)</div>
        <div className="grid grid-cols-3 gap-1">
          <RateBlock 
            value={getRate(organized.highSeason.peak, 'energy_charge_per_kwh', 'energy_charge_per_kwh_incl_vat')} 
            label="Peak" 
            variant="peak" 
          />
          <RateBlock 
            value={getRate(organized.highSeason.standard, 'energy_charge_per_kwh', 'energy_charge_per_kwh_incl_vat')} 
            label="Standard" 
            variant="standard" 
          />
          <RateBlock 
            value={getRate(organized.highSeason.offPeak, 'energy_charge_per_kwh', 'energy_charge_per_kwh_incl_vat')} 
            label="Off-Peak" 
            variant="offpeak" 
          />
        </div>
      </div>

      {/* Row 2: Low Season Energy Rates */}
      <div>
        <div className="text-[10px] text-muted-foreground mb-1">Low Season (Summer)</div>
        <div className="grid grid-cols-3 gap-1">
          <RateBlock 
            value={getRate(organized.lowSeason.peak, 'energy_charge_per_kwh', 'energy_charge_per_kwh_incl_vat')} 
            label="Peak" 
            variant="peak" 
          />
          <RateBlock 
            value={getRate(organized.lowSeason.standard, 'energy_charge_per_kwh', 'energy_charge_per_kwh_incl_vat')} 
            label="Standard" 
            variant="standard" 
          />
          <RateBlock 
            value={getRate(organized.lowSeason.offPeak, 'energy_charge_per_kwh', 'energy_charge_per_kwh_incl_vat')} 
            label="Off-Peak" 
            variant="offpeak" 
          />
        </div>
      </div>

      {/* Row 3: Fixed Per-kWh Charges */}
      <div>
        <div className="text-[10px] text-muted-foreground mb-1">Unbundled Charges</div>
        <div className="grid grid-cols-3 gap-1">
          <RateBlock 
            value={getLegacyCharge()} 
            label="Legacy" 
            variant="neutral" 
          />
          <RateBlock 
            value={getRate(sampleRate, 'ancillary_charge_per_kwh', 'ancillary_charge_per_kwh_incl_vat')} 
            label="Ancillary" 
            variant="neutral" 
          />
          <RateBlock 
            value={networkDemand} 
            label="Network Demand" 
            variant="blue" 
          />
        </div>
      </div>

      {/* Row 4: Subsidy Charges */}
      <div>
        <div className="grid grid-cols-3 gap-1">
          <RateBlock 
            value={getRate(sampleRate, 'electrification_rural_per_kwh', 'electrification_rural_per_kwh_incl_vat')} 
            label="Elec & Rural" 
            variant="subsidy" 
          />
          <RateBlock 
            value={getRate(sampleRate, 'affordability_subsidy_per_kwh', 'affordability_subsidy_per_kwh_incl_vat')} 
            label="Affordability" 
            variant="subsidy" 
          />
          <RateBlock value={null} label="" variant="empty" />
        </div>
      </div>
    </div>
  );
}

// Blended Rates Card for Eskom Tariffs with selection capability
function EskomBlendedRatesCard({ 
  rates, 
  tariff,
  selectedType = 'solarHours',
  onTypeChange
}: { 
  rates: TariffRate[]; 
  tariff: Tariff;
  selectedType?: BlendedRateType;
  onTypeChange?: (type: BlendedRateType) => void;
}) {
  const blendedRates = useMemo(() => calculateAnnualBlendedRates(rates, { 
    legacy_charge_per_kwh: tariff.legacy_charge_per_kwh ?? undefined 
  }), [rates, tariff.legacy_charge_per_kwh]);
  
  if (!blendedRates) return null;
  
  const isSelectable = !!onTypeChange;
  
  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Blended Tariff Rates</span>
        {isSelectable && (
          <Badge variant="outline" className="text-[10px] ml-auto">
            Click to select for simulation
          </Badge>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm p-3">
              <p className="text-xs font-medium mb-2">Two blended rate methodologies:</p>
              <ul className="text-xs space-y-1">
                <li><strong>All Hours:</strong> 24/7/365 weighted average (8,760h/year)</li>
                <li><strong>Solar Sun Hours:</strong> 6-hour core generation window (2,190h/year) with <strong>zero Peak TOU exposure</strong></li>
              </ul>
              <p className="text-xs mt-2 text-muted-foreground">
                Rates weighted by exact annual hour counts from Eskom tariff schedule.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* All Hours Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">All Hours (24/7/365)</span>
          </div>
          
          <div 
            className={`p-3 rounded-lg border transition-all ${isSelectable ? 'cursor-pointer' : ''} ${
              selectedType === 'allHours' 
                ? 'bg-primary/10 border-primary ring-2 ring-primary/30' 
                : 'bg-muted/50 hover:bg-muted/80'
            }`}
            onClick={() => onTypeChange?.('allHours')}
          >
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${selectedType === 'allHours' ? 'text-primary' : ''}`}>
                R{blendedRates.allHours.annual.toFixed(4)}
              </span>
              <span className="text-xs text-muted-foreground">/kWh</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Annual Blended • {ANNUAL_HOURS_24H.annual.total.toLocaleString()}h
            </p>
            {selectedType === 'allHours' && isSelectable && (
              <Badge variant="default" className="mt-2 text-[10px]">
                ✓ Selected for simulation
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div 
              className={`p-2 rounded text-center transition-all ${isSelectable ? 'cursor-pointer' : ''} ${
                selectedType === 'allHoursHigh'
                  ? 'bg-primary/20 ring-2 ring-primary/30'
                  : 'bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => onTypeChange?.('allHoursHigh')}
            >
              <div className={`text-sm font-semibold ${selectedType === 'allHoursHigh' ? 'text-primary' : ''}`}>
                R{blendedRates.allHours.high.toFixed(4)}
              </div>
              <div className="text-[10px] text-muted-foreground">High (Winter)</div>
              {selectedType === 'allHoursHigh' && isSelectable && (
                <Badge variant="default" className="mt-1 text-[8px] px-1 py-0">✓ Selected</Badge>
              )}
            </div>
            <div 
              className={`p-2 rounded text-center transition-all ${isSelectable ? 'cursor-pointer' : ''} ${
                selectedType === 'allHoursLow'
                  ? 'bg-primary/20 ring-2 ring-primary/30'
                  : 'bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => onTypeChange?.('allHoursLow')}
            >
              <div className={`text-sm font-semibold ${selectedType === 'allHoursLow' ? 'text-primary' : ''}`}>
                R{blendedRates.allHours.low.toFixed(4)}
              </div>
              <div className="text-[10px] text-muted-foreground">Low (Summer)</div>
              {selectedType === 'allHoursLow' && isSelectable && (
                <Badge variant="default" className="mt-1 text-[8px] px-1 py-0">✓ Selected</Badge>
              )}
            </div>
          </div>
          
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Peak: {ANNUAL_HOURS_24H.annual.peak.toLocaleString()}h</span>
              <span>({((ANNUAL_HOURS_24H.annual.peak / ANNUAL_HOURS_24H.annual.total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span>Standard: {ANNUAL_HOURS_24H.annual.standard.toLocaleString()}h</span>
              <span>({((ANNUAL_HOURS_24H.annual.standard / ANNUAL_HOURS_24H.annual.total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span>Off-Peak: {ANNUAL_HOURS_24H.annual.offPeak.toLocaleString()}h</span>
              <span>({((ANNUAL_HOURS_24H.annual.offPeak / ANNUAL_HOURS_24H.annual.total) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        </div>
        
        {/* Solar Sun Hours Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600">Solar Sun Hours (6h)</span>
          </div>
          
          <div 
            className={`p-3 rounded-lg border transition-all ${isSelectable ? 'cursor-pointer' : ''} ${
              selectedType === 'solarHours' 
                ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30' 
                : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'
            }`}
            onClick={() => onTypeChange?.('solarHours')}
          >
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-amber-600">
                R{blendedRates.solarHours.annual.toFixed(4)}
              </span>
              <span className="text-xs text-muted-foreground">/kWh</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Annual Blended • {ANNUAL_HOURS_SOLAR.annual.total.toLocaleString()}h
            </p>
            {selectedType === 'solarHours' && isSelectable && (
              <Badge className="mt-2 text-[10px] bg-amber-500 hover:bg-amber-600">
                ✓ Selected for simulation
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div 
              className={`p-2 rounded text-center transition-all ${isSelectable ? 'cursor-pointer' : ''} ${
                selectedType === 'solarHoursHigh'
                  ? 'bg-amber-500/30 ring-2 ring-amber-500/50'
                  : 'bg-amber-500/10 hover:bg-amber-500/20'
              }`}
              onClick={() => onTypeChange?.('solarHoursHigh')}
            >
              <div className={`text-sm font-semibold ${selectedType === 'solarHoursHigh' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-700 dark:text-amber-400'}`}>
                R{blendedRates.solarHours.high.toFixed(4)}
              </div>
              <div className="text-[10px] text-muted-foreground">High (Winter)</div>
              {selectedType === 'solarHoursHigh' && isSelectable && (
                <Badge className="mt-1 text-[8px] px-1 py-0 bg-amber-500">✓ Selected</Badge>
              )}
            </div>
            <div 
              className={`p-2 rounded text-center transition-all ${isSelectable ? 'cursor-pointer' : ''} ${
                selectedType === 'solarHoursLow'
                  ? 'bg-amber-500/30 ring-2 ring-amber-500/50'
                  : 'bg-amber-500/10 hover:bg-amber-500/20'
              }`}
              onClick={() => onTypeChange?.('solarHoursLow')}
            >
              <div className={`text-sm font-semibold ${selectedType === 'solarHoursLow' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-700 dark:text-amber-400'}`}>
                R{blendedRates.solarHours.low.toFixed(4)}
              </div>
              <div className="text-[10px] text-muted-foreground">Low (Summer)</div>
              {selectedType === 'solarHoursLow' && isSelectable && (
                <Badge className="mt-1 text-[8px] px-1 py-0 bg-amber-500">✓ Selected</Badge>
              )}
            </div>
          </div>
          
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Peak: {ANNUAL_HOURS_SOLAR.annual.peak}h</span>
              <span className="text-green-600 font-medium">(0% exposure)</span>
            </div>
            <div className="flex justify-between">
              <span>Standard: {ANNUAL_HOURS_SOLAR.annual.standard.toLocaleString()}h</span>
              <span>({((ANNUAL_HOURS_SOLAR.annual.standard / ANNUAL_HOURS_SOLAR.annual.total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span>Off-Peak: {ANNUAL_HOURS_SOLAR.annual.offPeak}h</span>
              <span>({((ANNUAL_HOURS_SOLAR.annual.offPeak / ANNUAL_HOURS_SOLAR.annual.total) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 rounded bg-muted/50 text-xs text-muted-foreground">
        <p className="font-medium text-foreground flex items-center gap-1 mb-1">
          <Calculator className="h-3 w-3" /> Calculation Methodology
        </p>
        <p>
          Rates weighted by exact annual hour counts from Eskom 2025/26 tariff schedule. 
          Solar Sun Hours uses the 6-hour core generation window with <strong>zero Peak TOU exposure</strong> — 
          92.9% Standard, 7.1% Off-Peak.
        </p>
      </div>
    </div>
  );
}
