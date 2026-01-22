import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sun, Clock, Calculator, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EskomTariffSelector } from "./EskomTariffSelector";
import {
  calculateAnnualBlendedRates,
  ANNUAL_HOURS_24H,
  ANNUAL_HOURS_SOLAR,
  type BlendedRatesBreakdown,
} from "@/lib/tariffCalculations";

// Helper function to organize energy rates by season and TOU period
const organizeEnergyRates = (rates: any[]) => {
  const touOrder: Record<string, number> = { 'Peak': 0, 'Standard': 1, 'Off-Peak': 2 };
  
  return [...rates].sort((a, b) => {
    const seasonA = a.season?.includes('High') || a.season?.includes('Winter') ? 0 : 1;
    const seasonB = b.season?.includes('High') || b.season?.includes('Winter') ? 0 : 1;
    const seasonCompare = seasonA - seasonB;
    if (seasonCompare !== 0) return seasonCompare;
    return (touOrder[a.time_of_use] || 0) - (touOrder[b.time_of_use] || 0);
  });
};

// Helper function to calculate combined rate including all unbundled charges
const calculateCombinedRate = (rate: any, tariff: any) => {
  const base = Number(rate.rate_per_kwh) || 0;
  const legacy = Number(tariff?.legacy_charge_per_kwh) || 0;
  const network = Number(rate.network_charge_per_kwh) || 0;
  const ancillary = Number(rate.ancillary_charge_per_kwh) || 0;
  const elecRural = Number(rate.electrification_rural_per_kwh) || 0;
  const affordability = Number(rate.affordability_subsidy_per_kwh) || 0;
  
  return base + legacy + network + ancillary + elecRural + affordability;
};

// Rate card component with TOU-based styling and breakdown tooltip
function RateCard({ rate, tariff }: { rate: any; tariff: any }) {
  const combinedRate = calculateCombinedRate(rate, tariff);
  
  const base = Number(rate.rate_per_kwh) || 0;
  const legacy = Number(tariff?.legacy_charge_per_kwh) || 0;
  const network = Number(rate.network_charge_per_kwh) || 0;
  const ancillary = Number(rate.ancillary_charge_per_kwh) || 0;
  const elecRural = Number(rate.electrification_rural_per_kwh) || 0;
  const affordability = Number(rate.affordability_subsidy_per_kwh) || 0;
  
  const bgColor = rate.time_of_use === 'Peak' 
    ? 'bg-red-500/10 border-red-500/20' 
    : rate.time_of_use === 'Standard' 
    ? 'bg-yellow-500/10 border-yellow-500/20' 
    : 'bg-green-500/10 border-green-500/20';
  
  const textColor = rate.time_of_use === 'Peak'
    ? 'text-red-700 dark:text-red-400'
    : rate.time_of_use === 'Standard'
    ? 'text-yellow-700 dark:text-yellow-400'
    : 'text-green-700 dark:text-green-400';

  return (
    <div className={`p-2 rounded border text-sm relative ${bgColor}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="absolute top-1 right-1 text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="w-56 p-3" side="top">
            <p className="font-medium text-xs mb-2">Rate Breakdown</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Energy</span>
                <span>R{base.toFixed(4)}</span>
              </div>
              {legacy > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Legacy Charge</span>
                  <span>R{legacy.toFixed(4)}</span>
                </div>
              )}
              {network > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network Demand</span>
                  <span>R{network.toFixed(4)}</span>
                </div>
              )}
              {ancillary > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ancillary Service</span>
                  <span>R{ancillary.toFixed(4)}</span>
                </div>
              )}
              {elecRural > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elec & Rural Subsidy</span>
                  <span>R{elecRural.toFixed(4)}</span>
                </div>
              )}
              {affordability > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Affordability Subsidy</span>
                  <span>R{affordability.toFixed(4)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t font-medium">
                <span>Total</span>
                <span>R{combinedRate.toFixed(4)}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className={`font-semibold ${textColor}`}>
        R{combinedRate.toFixed(4)}/kWh
      </div>
      <div className="text-xs text-muted-foreground">
        {rate.time_of_use}
      </div>
    </div>
  );
}

// Export the blended rate type for use in other components
export type BlendedRateType = 'allHours' | 'solarHours';

interface BlendedRatesCardProps {
  rates: any[];
  tariff?: { legacy_charge_per_kwh?: number };
  selectedType?: BlendedRateType;
  onTypeChange?: (type: BlendedRateType) => void;
}

function BlendedRatesCard({ rates, tariff, selectedType = 'solarHours', onTypeChange }: BlendedRatesCardProps) {
  const blendedRates = useMemo(() => calculateAnnualBlendedRates(rates, tariff), [rates, tariff]);
  
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
        <div 
          className={`space-y-3 ${isSelectable ? 'cursor-pointer' : ''}`}
          onClick={() => onTypeChange?.('allHours')}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">All Hours (24/7/365)</span>
          </div>
          
          <div className={`p-3 rounded-lg border transition-all ${
            selectedType === 'allHours' 
              ? 'bg-primary/10 border-primary ring-2 ring-primary/30' 
              : 'bg-muted/50 hover:bg-muted/80'
          }`}>
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
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-sm font-semibold">R{blendedRates.allHours.high.toFixed(4)}</div>
              <div className="text-[10px] text-muted-foreground">High (Winter)</div>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
              <div className="text-sm font-semibold">R{blendedRates.allHours.low.toFixed(4)}</div>
              <div className="text-[10px] text-muted-foreground">Low (Summer)</div>
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
        <div 
          className={`space-y-3 ${isSelectable ? 'cursor-pointer' : ''}`}
          onClick={() => onTypeChange?.('solarHours')}
        >
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600">Solar Sun Hours (6h)</span>
          </div>
          
          <div className={`p-3 rounded-lg border transition-all ${
            selectedType === 'solarHours' 
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30' 
              : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'
          }`}>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${selectedType === 'solarHours' ? 'text-amber-600' : 'text-amber-600'}`}>
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
            <div className="p-2 rounded bg-amber-500/10 text-center">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">R{blendedRates.solarHours.high.toFixed(4)}</div>
              <div className="text-[10px] text-muted-foreground">High (Winter)</div>
            </div>
            <div className="p-2 rounded bg-amber-500/10 text-center">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">R{blendedRates.solarHours.low.toFixed(4)}</div>
              <div className="text-[10px] text-muted-foreground">Low (Summer)</div>
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

interface TariffSelectorProps {
  projectId: string;
  currentTariffId: string | null;
  onSelect: (tariffId: string) => void;
  selectedBlendedRateType?: BlendedRateType;
  onBlendedRateTypeChange?: (type: BlendedRateType) => void;
}

export function TariffSelector({ 
  projectId, 
  currentTariffId, 
  onSelect, 
  selectedBlendedRateType = 'solarHours',
  onBlendedRateTypeChange 
}: TariffSelectorProps) {
  const [provinceId, setProvinceId] = useState<string>("");
  const [municipalityId, setMunicipalityId] = useState<string>("");

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Find Eskom province to check if selected
  const eskomProvince = provinces?.find(p => p.name === "Eskom");
  const isEskomSelected = provinceId === eskomProvince?.id;

  const { data: municipalities } = useQuery({
    queryKey: ["municipalities", provinceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("*")
        .eq("province_id", provinceId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!provinceId,
  });

  // Auto-select Eskom Direct when Eskom province is selected
  useEffect(() => {
    if (isEskomSelected && municipalities && municipalities.length > 0) {
      const eskomDirect = municipalities.find(m => m.name === "Eskom Direct");
      if (eskomDirect && municipalityId !== eskomDirect.id) {
        setMunicipalityId(eskomDirect.id);
      }
    }
  }, [isEskomSelected, municipalities, municipalityId]);

  const { data: tariffs } = useQuery({
    queryKey: ["tariffs", municipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          tariff_categories(name),
          tariff_rates(*)
        `)
        .eq("municipality_id", municipalityId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!municipalityId && !isEskomSelected,
  });

  const { data: selectedTariff } = useQuery({
    queryKey: ["selected-tariff", currentTariffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          municipalities(name, provinces(name)),
          tariff_categories(name),
          tariff_rates(*)
        `)
        .eq("id", currentTariffId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTariffId && !isEskomSelected,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Select Tariff</h2>
        <p className="text-sm text-muted-foreground">
          Choose the electricity tariff for cost calculations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Province</Label>
          <Select value={provinceId} onValueChange={(value) => {
            setProvinceId(value);
            setMunicipalityId("");
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select province..." />
            </SelectTrigger>
            <SelectContent>
              {provinces?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Municipality</Label>
          <Select
            value={municipalityId}
            onValueChange={setMunicipalityId}
            disabled={!provinceId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select municipality..." />
            </SelectTrigger>
            <SelectContent>
              {municipalities?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Only show regular tariff dropdown for non-Eskom */}
        {!isEskomSelected && (
          <div className="space-y-2">
            <Label>Tariff</Label>
            <Select
              value={currentTariffId || ""}
              onValueChange={onSelect}
              disabled={!municipalityId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tariff..." />
              </SelectTrigger>
              <SelectContent>
                {tariffs?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.tariff_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Eskom Matrix Selector */}
      {isEskomSelected && municipalityId && (
        <EskomTariffSelector
          municipalityId={municipalityId}
          currentTariffId={currentTariffId}
          onSelect={onSelect}
        />
      )}

      {/* Regular tariff display for non-Eskom */}
      {!isEskomSelected && selectedTariff && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{selectedTariff.name}</CardTitle>
                <CardDescription>
                  {(selectedTariff as any).municipalities?.name},{" "}
                  {(selectedTariff as any).municipalities?.provinces?.name}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{selectedTariff.tariff_type}</Badge>
                {selectedTariff.voltage_level && (
                  <Badge variant="outline">{selectedTariff.voltage_level}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category</span>
                <p className="font-medium">
                  {(selectedTariff as any).tariff_categories?.name || "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Fixed Charge</span>
                <p className="font-medium">
                  R{Number(selectedTariff.fixed_monthly_charge || 0).toFixed(2)}/month
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Demand Charge</span>
                <p className="font-medium">
                  R{Number(selectedTariff.demand_charge_per_kva || 0).toFixed(2)}/kVA
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Voltage Level</span>
                <p className="font-medium">{selectedTariff.voltage_level || "-"}</p>
              </div>
            </div>

            {selectedTariff.reactive_energy_charge && Number(selectedTariff.reactive_energy_charge) > 0 && (
              <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                <span className="text-muted-foreground">Reactive Energy: </span>
                <span className="font-medium">R{Number(selectedTariff.reactive_energy_charge).toFixed(4)}/kVArh</span>
              </div>
            )}

            {selectedTariff.tariff_rates && selectedTariff.tariff_rates.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Energy Rates (incl. unbundled charges)</span>
                
                {/* High Season Row */}
                <div className="mt-3">
                  <span className="text-xs text-muted-foreground mb-1 block">High Season (Winter)</span>
                  <div className="grid gap-2 md:grid-cols-3">
                    {organizeEnergyRates(selectedTariff.tariff_rates)
                      .filter((r: any) => r.season?.includes('High') || r.season?.includes('Winter'))
                      .map((rate: any) => (
                        <RateCard key={rate.id} rate={rate} tariff={selectedTariff} />
                      ))}
                  </div>
                </div>
                
                {/* Low Season Row */}
                <div className="mt-3">
                  <span className="text-xs text-muted-foreground mb-1 block">Low Season (Summer)</span>
                  <div className="grid gap-2 md:grid-cols-3">
                    {organizeEnergyRates(selectedTariff.tariff_rates)
                      .filter((r: any) => r.season?.includes('Low') || r.season?.includes('Summer'))
                      .map((rate: any) => (
                        <RateCard key={rate.id} rate={rate} tariff={selectedTariff} />
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Blended Rates Calculation */}
            {selectedTariff.tariff_rates && selectedTariff.tariff_rates.length > 0 && (
              <BlendedRatesCard 
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
