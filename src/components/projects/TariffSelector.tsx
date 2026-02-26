import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sun, Clock, Calculator, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  calculateAnnualBlendedRates,
  ANNUAL_HOURS_24H,
  ANNUAL_HOURS_SOLAR,
  isFlatRateTariff,
  getFlatRate,
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
function RateCard({ rate, tariff, isFlat = false }: { rate: any; tariff: any; isFlat?: boolean }) {
  const combinedRate = calculateCombinedRate(rate, tariff);
  
  const base = Number(rate.rate_per_kwh) || 0;
  const legacy = Number(tariff?.legacy_charge_per_kwh) || 0;
  const network = Number(rate.network_charge_per_kwh) || 0;
  const ancillary = Number(rate.ancillary_charge_per_kwh) || 0;
  const elecRural = Number(rate.electrification_rural_per_kwh) || 0;
  const affordability = Number(rate.affordability_subsidy_per_kwh) || 0;
  
  // Flat rate uses neutral styling
  const bgColor = isFlat
    ? 'bg-primary/10 border-primary/20'
    : rate.time_of_use === 'Peak' 
    ? 'bg-red-500/10 border-red-500/20' 
    : rate.time_of_use === 'Standard' 
    ? 'bg-yellow-500/10 border-yellow-500/20' 
    : 'bg-green-500/10 border-green-500/20';
  
  const textColor = isFlat
    ? 'text-primary'
    : rate.time_of_use === 'Peak'
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
        {isFlat ? 'Flat Rate' : rate.time_of_use}
      </div>
    </div>
  );
}

// Export the blended rate type for use in other components
// Extended to support all 6 rate options: category (allHours/solarHours) + period (annual/high/low)
export type BlendedRateType = 
  | 'allHours' | 'allHoursHigh' | 'allHoursLow'
  | 'solarHours' | 'solarHoursHigh' | 'solarHoursLow';

interface BlendedRatesCardProps {
  rates: any[];
  tariff?: { legacy_charge_per_kwh?: number };
  selectedType?: BlendedRateType;
  onTypeChange?: (type: BlendedRateType) => void;
}

function BlendedRatesCard({ rates, tariff, selectedType = 'solarHours', onTypeChange }: BlendedRatesCardProps) {
  const isFlat = isFlatRateTariff(rates);
  const flatRate = isFlat ? getFlatRate(rates, tariff) : 0;
  const blendedRates = useMemo(() => calculateAnnualBlendedRates(rates, tariff), [rates, tariff]);
  
  if (!blendedRates && !isFlat) return null;
  
  const isSelectable = !!onTypeChange;
  
  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {isFlat ? 'Fixed Tariff Rate' : 'Blended Tariff Rates'}
        </span>
        {isFlat && (
          <Badge variant="outline" className="text-[10px]">No TOU Variation</Badge>
        )}
        {!isFlat && isSelectable && (
          <Badge variant="outline" className="text-[10px] ml-auto">
            Click to select for simulation
          </Badge>
        )}
        {!isFlat && (
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
        )}
      </div>
      
      {isFlat ? (
        /* Flat Rate Display - Single unified rate */
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-primary/10 border-primary/20">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-primary">
                R{flatRate.toFixed(4)}
              </span>
              <span className="text-sm text-muted-foreground">/kWh</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Fixed rate applies to all hours, seasons, and time periods
            </p>
            {isSelectable && (
              <Badge variant="default" className="mt-3 text-[10px]">
                ✓ Used for simulation
              </Badge>
            )}
          </div>
          
          <div className="p-3 rounded bg-muted/50 text-xs text-muted-foreground">
            <p>
              This is a <strong>fixed/conventional tariff</strong> with no time-of-use or seasonal variation. 
              The same rate applies 24/7/365, making cost calculations straightforward.
            </p>
          </div>
        </div>
      ) : (
        /* TOU Rate Display - Two columns */
        <>
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
                    R{blendedRates?.allHours.annual.toFixed(4) ?? '0.0000'}
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
                    R{blendedRates?.allHours.high.toFixed(4) ?? '0.0000'}
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
                    R{blendedRates?.allHours.low.toFixed(4) ?? '0.0000'}
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
                    R{blendedRates?.solarHours.annual.toFixed(4) ?? '0.0000'}
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
                    R{blendedRates?.solarHours.high.toFixed(4) ?? '0.0000'}
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
                    R{blendedRates?.solarHours.low.toFixed(4) ?? '0.0000'}
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
        </>
      )}
    </div>
  );
}

interface TariffSelectorProps {
  projectId: string;
  currentTariffId: string | null;
  onSelect: (tariffId: string) => void;
  selectedBlendedRateType?: BlendedRateType;
  onBlendedRateTypeChange?: (type: BlendedRateType) => void;
  latitude?: number | null;
  longitude?: number | null;
}

export function TariffSelector({ 
  projectId, 
  currentTariffId, 
  onSelect, 
  selectedBlendedRateType = 'solarHours',
  onBlendedRateTypeChange,
  latitude,
  longitude
}: TariffSelectorProps) {
  const [provinceId, setProvinceId] = useState<string>("");
  const [municipalityId, setMunicipalityId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

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

  // Auto-select province and municipality based on project coordinates (reverse geocoding)
  // Only runs when no province is selected yet and no existing tariff to prepopulate from
  useEffect(() => {
    if (!latitude || !longitude || provinceId || !provinces || hasAutoSelected || currentTariffId) {
      return;
    }

    const reverseGeocode = async () => {
      setIsReverseGeocoding(true);
      try {
        const response = await supabase.functions.invoke('geocode-location', {
          body: { latitude, longitude, reverse: true }
        });

        if (response.error) {
          console.error('Reverse geocoding error:', response.error);
          return;
        }

        const { province, municipality } = response.data;
        console.log('Reverse geocode result:', { province, municipality });

        if (province) {
          const matchedProvince = provinces.find(p => 
            p.name.toLowerCase() === province.toLowerCase() ||
            p.name.toLowerCase().includes(province.toLowerCase()) ||
            province.toLowerCase().includes(p.name.toLowerCase())
          );

          if (matchedProvince) {
            console.log('Matched province:', matchedProvince.name);
            setProvinceId(matchedProvince.id);
            setHasAutoSelected(true);

            if (municipality) {
              sessionStorage.setItem(`tariff-selector-municipality-${projectId}`, municipality);
            }
          }
        }
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
      } finally {
        setIsReverseGeocoding(false);
      }
    };

    reverseGeocode();
  }, [latitude, longitude, provinceId, provinces, hasAutoSelected, currentTariffId, projectId]);

  // Auto-select municipality after province is selected (from reverse geocoding or existing tariff)
  useEffect(() => {
    if (!municipalities || municipalities.length === 0 || !hasAutoSelected || municipalityId) {
      return;
    }

    // First check for exact municipality ID (from existing tariff)
    const targetMuniId = sessionStorage.getItem(`tariff-selector-muni-id-${projectId}`);
    if (targetMuniId) {
      const exactMatch = municipalities.find(m => m.id === targetMuniId);
      if (exactMatch) {
        console.log('Matched municipality by ID:', exactMatch.name);
        setMunicipalityId(exactMatch.id);
        sessionStorage.removeItem(`tariff-selector-muni-id-${projectId}`);
        return;
      }
      sessionStorage.removeItem(`tariff-selector-muni-id-${projectId}`);
    }

    // Then check for name-based match (from reverse geocoding)
    const targetMunicipality = sessionStorage.getItem(`tariff-selector-municipality-${projectId}`);
    if (!targetMunicipality) return;

    // Find matching municipality (case-insensitive, partial match)
    const matchedMunicipality = municipalities.find(m => {
      const mName = m.name.toLowerCase();
      const target = targetMunicipality.toLowerCase();
      return mName === target ||
        mName.includes(target) ||
        target.includes(mName) ||
        // Handle cases like "Mogalakwena" matching "Mogalakwena Local Municipality"
        mName.split(' ').some(word => word === target) ||
        target.split(' ').some(word => word === mName.split(' ')[0]);
    });

    if (matchedMunicipality) {
      console.log('Matched municipality:', matchedMunicipality.name);
      setMunicipalityId(matchedMunicipality.id);
    }

    // Clean up
    sessionStorage.removeItem(`tariff-selector-municipality-${projectId}`);
  }, [municipalities, hasAutoSelected, municipalityId, projectId]);

  const { data: tariffs } = useQuery({
    queryKey: ["tariff-plans", municipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_plans")
        .select("*, tariff_rates(*)")
        .eq("municipality_id", municipalityId!)
        .eq("is_redundant", false)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!municipalityId,
  });

  // Derive available periods from tariffs
  const availablePeriods = useMemo(() => {
    if (!tariffs || tariffs.length === 0) return [];
    
    const periodMap = new Map<string, { key: string; label: string; effectiveFrom: string | null }>();
    
    for (const t of tariffs) {
      const from = (t as any).effective_from;
      const to = (t as any).effective_to;
      
      if (!from && !to) {
        periodMap.set("no_period", { key: "no_period", label: "No Period Specified", effectiveFrom: null });
      } else {
        const key = `${from || ""}|${to || ""}`;
        if (!periodMap.has(key)) {
          const fromDate = from ? new Date(from) : null;
          const toDate = to ? new Date(to) : null;
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          
          let label = "";
          if (fromDate && toDate) {
            label = `${months[fromDate.getMonth()]} ${fromDate.getFullYear()} - ${months[toDate.getMonth()]} ${toDate.getFullYear()}`;
          } else if (fromDate) {
            label = `From ${months[fromDate.getMonth()]} ${fromDate.getFullYear()}`;
          } else if (toDate) {
            label = `Until ${months[toDate.getMonth()]} ${toDate.getFullYear()}`;
          }
          
          periodMap.set(key, { key, label, effectiveFrom: from });
        }
      }
    }
    
    // Sort descending by effective_from (most recent first), nulls last
    return Array.from(periodMap.values()).sort((a, b) => {
      if (!a.effectiveFrom && !b.effectiveFrom) return 0;
      if (!a.effectiveFrom) return 1;
      if (!b.effectiveFrom) return -1;
      return b.effectiveFrom.localeCompare(a.effectiveFrom);
    });
  }, [tariffs]);

  // Auto-select the period matching the current year, or fall back to most recent
  useEffect(() => {
    if (availablePeriods.length > 0 && !selectedPeriod) {
      const currentYear = new Date().getFullYear().toString();
      const currentYearPeriod = availablePeriods.find(p => 
        p.effectiveFrom?.includes(currentYear)
      );
      setSelectedPeriod(currentYearPeriod?.key || availablePeriods[0].key);
    }
  }, [availablePeriods, selectedPeriod]);

  // Filter tariffs by selected period
  const filteredTariffs = useMemo(() => {
    if (!tariffs) return [];
    if (!selectedPeriod || selectedPeriod === "all") return tariffs;
    
    if (selectedPeriod === "no_period") {
      return tariffs.filter(t => !(t as any).effective_from && !(t as any).effective_to);
    }
    
    const [from, to] = selectedPeriod.split("|");
    return tariffs.filter(t => {
      const tFrom = (t as any).effective_from || "";
      const tTo = (t as any).effective_to || "";
      return tFrom === from && tTo === to;
    });
  }, [tariffs, selectedPeriod]);

  const { data: selectedTariff } = useQuery({
    queryKey: ["selected-tariff-plan", currentTariffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_plans")
        .select("*, municipalities(id, name, province_id, provinces(id, name)), tariff_rates(*)")
        .eq("id", currentTariffId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTariffId,
  });

  // Prepopulate province and municipality from existing selected tariff
  useEffect(() => {
    if (!selectedTariff || provinceId) return;
    const muni = (selectedTariff as any).municipalities;
    if (muni?.provinces?.id) {
      setProvinceId(muni.provinces.id);
      setHasAutoSelected(true);
      // Store municipality ID to set once municipalities load
      sessionStorage.setItem(`tariff-selector-muni-id-${projectId}`, muni.id);
    }
  }, [selectedTariff, provinceId, projectId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Select Tariff</h2>
        <p className="text-sm text-muted-foreground">
          Choose the electricity tariff for cost calculations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Province</Label>
          <Select value={provinceId} onValueChange={(value) => {
            setProvinceId(value);
            setMunicipalityId("");
            setSelectedPeriod("");
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
            onValueChange={(value) => {
              setMunicipalityId(value);
              setSelectedPeriod("");
            }}
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

        <div className="space-y-2">
          <Label>Year</Label>
          <Select
            value={selectedPeriod}
            onValueChange={setSelectedPeriod}
            disabled={!municipalityId || availablePeriods.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select period..." />
            </SelectTrigger>
            <SelectContent>
              {availablePeriods.length > 1 && (
                <SelectItem value="all">All Periods</SelectItem>
              )}
              {availablePeriods.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
              {filteredTariffs?.map((t) => (
                <SelectItem key={(t as any).id} value={(t as any).id}>
                  {(t as any).name} ({(t as any).category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedTariff && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{(selectedTariff as any).name}</CardTitle>
                <CardDescription>
                  {(selectedTariff as any).municipalities?.name},{" "}
                  {(selectedTariff as any).municipalities?.provinces?.name}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{(selectedTariff as any).structure}</Badge>
                {(selectedTariff as any).voltage && (
                  <Badge variant="outline">{(selectedTariff as any).voltage}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category</span>
                <p className="font-medium">{(selectedTariff as any).category || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fixed Charge</span>
                <p className="font-medium">
                  R{Number(((selectedTariff as any).tariff_rates || []).find((r: any) => r.charge === 'basic')?.amount || 0).toFixed(2)}/month
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Demand Charge</span>
                <p className="font-medium">
                  R{Number(((selectedTariff as any).tariff_rates || []).find((r: any) => r.charge === 'demand')?.amount || 0).toFixed(2)}/kVA
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Voltage Level</span>
                <p className="font-medium">{(selectedTariff as any).voltage || "-"}</p>
              </div>
            </div>

            {(() => {
              const reactiveRate = ((selectedTariff as any).tariff_rates || []).find((r: any) => r.charge === 'reactive_energy');
              return reactiveRate && Number(reactiveRate.amount) > 0 ? (
                <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                  <span className="text-muted-foreground">Reactive Energy: </span>
                  <span className="font-medium">{Number(reactiveRate.amount).toFixed(4)} {reactiveRate.unit}</span>
                </div>
              ) : null;
            })()}

            {(selectedTariff as any).tariff_rates && (selectedTariff as any).tariff_rates.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Energy Rates</span>
                {(() => {
                  const energyRates = ((selectedTariff as any).tariff_rates || []).filter((r: any) => r.charge === 'energy');
                  const isFlat = energyRates.length <= 1 || energyRates.every((r: any) => r.season === 'all' && r.tou === 'all');
                  
                  if (isFlat && energyRates.length > 0) {
                    return (
                      <div className="mt-3">
                        <Badge variant="outline" className="text-xs mb-2">Fixed Rate</Badge>
                        <p className="font-medium">{Number(energyRates[0].amount).toFixed(2)} {energyRates[0].unit}</p>
                      </div>
                    );
                  }
                  
                  const highRates = energyRates.filter((r: any) => r.season === 'high');
                  const lowRates = energyRates.filter((r: any) => r.season === 'low');
                  
                  return (
                    <>
                      {highRates.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs text-muted-foreground mb-1 block">High Season (Winter)</span>
                          <div className="grid gap-2 md:grid-cols-3">
                            {highRates.map((rate: any, i: number) => (
                              <div key={i} className="p-2 rounded border bg-muted/30 text-sm">
                                <span className="font-medium">{rate.tou}: </span>
                                {Number(rate.amount).toFixed(2)} {rate.unit}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {lowRates.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs text-muted-foreground mb-1 block">Low Season (Summer)</span>
                          <div className="grid gap-2 md:grid-cols-3">
                            {lowRates.map((rate: any, i: number) => (
                              <div key={i} className="p-2 rounded border bg-muted/30 text-sm">
                                <span className="font-medium">{rate.tou}: </span>
                                {Number(rate.amount).toFixed(2)} {rate.unit}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
