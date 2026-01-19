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

// Sunshine hours for South Africa (approximate solar production hours)
// Summer: 06:00-19:00 (13 hours), Winter: 07:00-17:00 (10 hours)
const SUNSHINE_HOURS = {
  summer: { start: 6, end: 19 }, // Low/Summer season
  winter: { start: 7, end: 17 }, // High/Winter season
};

// TOU period definitions (SA standard)
const TOU_PERIODS = {
  peak: [7, 8, 9, 18, 19], // 07:00-10:00, 18:00-20:00
  standard: [6, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21], // 06:00-07:00, 10:00-18:00, 20:00-22:00
  offPeak: [0, 1, 2, 3, 4, 5, 22, 23], // 22:00-06:00
};

// Solar production curve (relative output per hour, peaks at noon)
const SOLAR_CURVE: Record<number, number> = {
  5: 0.05, 6: 0.15, 7: 0.35, 8: 0.55, 9: 0.75, 10: 0.88, 11: 0.95,
  12: 1.0, 13: 0.98, 14: 0.92, 15: 0.82, 16: 0.68, 17: 0.50, 18: 0.30, 19: 0.10,
};

interface BlendedRateCalculation {
  blendedRate: number;
  peakHours: number;
  standardHours: number;
  offPeakHours: number;
  peakEnergy: number;
  standardEnergy: number;
  offPeakEnergy: number;
  totalEnergy: number;
  breakdown: {
    period: string;
    hours: number;
    energyPercent: number;
    rate: number;
    contribution: number;
  }[];
}

function calculateBlendedSolarRate(rates: any[], season: 'summer' | 'winter'): BlendedRateCalculation {
  const sunHours = season === 'summer' ? SUNSHINE_HOURS.summer : SUNSHINE_HOURS.winter;
  const seasonFilter = season === 'summer' ? 'Low/Summer' : 'High/Winter';
  
  // Get rates for this season
  const peakRate = rates.find(r => r.time_of_use === 'Peak' && r.season === seasonFilter)?.rate_per_kwh || 0;
  const standardRate = rates.find(r => r.time_of_use === 'Standard' && r.season === seasonFilter)?.rate_per_kwh || 0;
  const offPeakRate = rates.find(r => r.time_of_use === 'Off-Peak' && r.season === seasonFilter)?.rate_per_kwh || 0;
  
  // Calculate energy-weighted hours during sunshine
  let peakEnergy = 0, standardEnergy = 0, offPeakEnergy = 0;
  let peakHours = 0, standardHours = 0, offPeakHours = 0;
  
  for (let hour = sunHours.start; hour < sunHours.end; hour++) {
    const solarOutput = SOLAR_CURVE[hour] || 0;
    
    if (TOU_PERIODS.peak.includes(hour)) {
      peakEnergy += solarOutput;
      peakHours++;
    } else if (TOU_PERIODS.standard.includes(hour)) {
      standardEnergy += solarOutput;
      standardHours++;
    } else {
      offPeakEnergy += solarOutput;
      offPeakHours++;
    }
  }
  
  const totalEnergy = peakEnergy + standardEnergy + offPeakEnergy;
  
  // Calculate blended rate weighted by solar production
  const blendedRate = totalEnergy > 0
    ? (peakEnergy * peakRate + standardEnergy * standardRate + offPeakEnergy * offPeakRate) / totalEnergy
    : 0;
  
  const breakdown = [
    {
      period: 'Peak',
      hours: peakHours,
      energyPercent: totalEnergy > 0 ? (peakEnergy / totalEnergy) * 100 : 0,
      rate: Number(peakRate),
      contribution: totalEnergy > 0 ? (peakEnergy * peakRate) / totalEnergy : 0,
    },
    {
      period: 'Standard',
      hours: standardHours,
      energyPercent: totalEnergy > 0 ? (standardEnergy / totalEnergy) * 100 : 0,
      rate: Number(standardRate),
      contribution: totalEnergy > 0 ? (standardEnergy * standardRate) / totalEnergy : 0,
    },
    {
      period: 'Off-Peak',
      hours: offPeakHours,
      energyPercent: totalEnergy > 0 ? (offPeakEnergy / totalEnergy) * 100 : 0,
      rate: Number(offPeakRate),
      contribution: totalEnergy > 0 ? (offPeakEnergy * offPeakRate) / totalEnergy : 0,
    },
  ];
  
  return {
    blendedRate,
    peakHours, standardHours, offPeakHours,
    peakEnergy, standardEnergy, offPeakEnergy,
    totalEnergy,
    breakdown,
  };
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
          <li>Sunshine hours: Summer 06:00-19:00, Winter 07:00-17:00</li>
          <li>Solar curve weighted by typical PV output (peaks at noon)</li>
          <li>TOU periods: Peak 07-10 & 18-20, Standard 06-07 & 10-18 & 20-22</li>
          <li>Energy contribution = hours × relative solar output</li>
          <li>Blended rate = Σ(energy contribution × rate) / total energy</li>
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
                <span className="text-sm text-muted-foreground">Energy Rates</span>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {selectedTariff.tariff_rates.map((rate: any) => (
                    <div
                      key={rate.id}
                      className="p-2 rounded bg-muted/50 text-sm"
                    >
                      <div className="font-medium">
                        R{Number(rate.rate_per_kwh).toFixed(4)}/kWh
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rate.time_of_use} • {rate.season}
                      </div>
                    </div>
                  ))}
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
