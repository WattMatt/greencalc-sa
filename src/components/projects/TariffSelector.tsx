import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sun, Calculator, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EskomTariffSelector } from "./EskomTariffSelector";
import {
  calculateBlendedSolarRate,
  calculateAnnualBlendedRate,
  SUNSHINE_HOURS,
  type BlendedRateCalculation,
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`p-2 rounded border text-sm cursor-help ${bgColor}`}>
            <div className={`font-semibold ${textColor}`}>
              R{combinedRate.toFixed(4)}/kWh
            </div>
            <div className="text-xs text-muted-foreground">
              {rate.time_of_use}
            </div>
          </div>
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
  );
}

function BlendedSolarRateCard({ rates }: { rates: any[] }) {
  const summerCalc = useMemo(() => calculateBlendedSolarRate(rates, 'summer'), [rates]);
  const winterCalc = useMemo(() => calculateBlendedSolarRate(rates, 'winter'), [rates]);
  
  // Annual weighted average (9 months summer, 3 months winter)
  const annualBlended = (summerCalc.blendedRate * 9 + winterCalc.blendedRate * 3) / 12;
  
  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center gap-2 mb-3">
        <Sun className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">Blended Solar Rate</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Effective tariff rate during sunshine hours, weighted by solar production curve. 
                This represents the value of each kWh your solar system generates.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Tabs defaultValue="annual" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="annual" className="text-xs">Annual</TabsTrigger>
          <TabsTrigger value="summer" className="text-xs">Summer</TabsTrigger>
          <TabsTrigger value="winter" className="text-xs">Winter</TabsTrigger>
        </TabsList>
        
        <TabsContent value="annual" className="mt-3">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">
                R{annualBlended.toFixed(4)}
              </span>
              <span className="text-sm text-muted-foreground">/kWh</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Weighted average (9 months summer + 3 months winter)
            </p>
          </div>
        </TabsContent>
        
        <TabsContent value="summer" className="mt-3 space-y-3">
          <SeasonBreakdown calc={summerCalc} season="Low/Summer" sunHours={SUNSHINE_HOURS.summer} />
        </TabsContent>
        
        <TabsContent value="winter" className="mt-3 space-y-3">
          <SeasonBreakdown calc={winterCalc} season="High/Winter" sunHours={SUNSHINE_HOURS.winter} />
        </TabsContent>
      </Tabs>
      
      <div className="mt-4 p-3 rounded bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground flex items-center gap-1">
          <Calculator className="h-3 w-3" /> Calculation Methodology
        </p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>Core sunshine hours: Summer 06:00-19:00, Winter 07:00-17:00</li>
          <li>Solar curve weighted by typical PV output (peaks at noon)</li>
          <li><strong>Peak TOU excluded</strong> (07-10 & 18-20 have low solar output)</li>
          <li>Blended rate uses Standard (10:00-18:00) + Off-Peak only</li>
          <li>Blended = Σ(Standard + Off-Peak energy × rate) / total energy</li>
        </ul>
      </div>
    </div>
  );
}

function SeasonBreakdown({ calc, season, sunHours }: { 
  calc: BlendedRateCalculation; 
  season: string;
  sunHours: { start: number; end: number };
}) {
  return (
    <>
      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-amber-600">
            R{calc.blendedRate.toFixed(4)}
          </span>
          <span className="text-sm text-muted-foreground">/kWh</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {season} • {sunHours.end - sunHours.start} sunshine hours ({sunHours.start}:00-{sunHours.end}:00)
        </p>
      </div>
      
      <div className="space-y-2">
        <p className="text-xs font-medium">Energy-Weighted Breakdown</p>
        {calc.breakdown.map((item) => (
          <div key={item.period} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={
                item.period === 'Peak' ? 'border-red-500 text-red-600' :
                item.period === 'Standard' ? 'border-amber-500 text-amber-600' :
                'border-green-500 text-green-600'
              }>
                {item.period}
              </Badge>
              <span className="text-muted-foreground">
                {item.hours}h → {item.energyPercent.toFixed(0)}% energy
              </span>
            </div>
            <div className="text-right">
              <span className="font-medium">R{item.rate.toFixed(4)}</span>
              <span className="text-muted-foreground ml-2">
                (+R{item.contribution.toFixed(4)})
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface TariffSelectorProps {
  projectId: string;
  currentTariffId: string | null;
  onSelect: (tariffId: string) => void;
}

export function TariffSelector({ projectId, currentTariffId, onSelect }: TariffSelectorProps) {
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

            {/* Blended Solar Rate Calculation */}
            {selectedTariff.tariff_rates && selectedTariff.tariff_rates.length > 0 && (
              <BlendedSolarRateCard rates={selectedTariff.tariff_rates} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
