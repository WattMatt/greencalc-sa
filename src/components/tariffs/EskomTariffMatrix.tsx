import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Zap, MapPin, Gauge, Info, TrendingUp, DollarSign, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TariffRate {
  id: string;
  season: string;
  time_of_use: string;
  rate_per_kwh: number;
  demand_charge_per_kva: number | null;
  network_charge_per_kwh: number | null;
  ancillary_charge_per_kwh: number | null;
  energy_charge_per_kwh: number | null;
}

interface Tariff {
  id: string;
  name: string;
  tariff_type: string;
  tariff_family: string | null;
  voltage_level: string | null;
  transmission_zone: string | null;
  customer_category: string | null;
  is_prepaid: boolean | null;
  fixed_monthly_charge: number | null;
  demand_charge_per_kva: number | null;
  service_charge_per_day: number | null;
  administration_charge_per_day: number | null;
  generation_capacity_charge: number | null;
  legacy_charge_per_kwh: number | null;
  reactive_energy_charge: number | null;
  network_access_charge: number | null;
  rates?: TariffRate[];
}

interface EskomTariffMatrixProps {
  tariffs: Tariff[];
  tariffRates: Record<string, TariffRate[]>;
  loadRatesForTariff: (tariffId: string) => void;
  loadingRates: Set<string>;
  onDeleteTariff: (id: string) => void;
}

// Transmission zone order
const ZONE_ORDER = ['Zone 0-300km', 'Zone 300-600km', 'Zone 600-900km', 'Zone >900km'];

// Voltage level order
const VOLTAGE_ORDER = ['< 500V', '≥ 500V & < 66kV', '≥ 66kV & ≤ 132kV', '> 132kV'];
const VOLTAGE_DISPLAY = {
  'LV': '< 500V',
  'MV': '≥ 500V & < 66kV',
  'HV': '≥ 66kV'
};

// Season and TOU order
const SEASON_ORDER = ['High/Winter', 'Low/Summer', 'All Year'];
const TOU_ORDER = ['Peak', 'Standard', 'Off-Peak'];

// Eskom tariff family categories
const ESKOM_FAMILIES = [
  { key: 'Megaflex', label: 'Megaflex', description: 'Large power users (> 1 MVA)' },
  { key: 'Miniflex', label: 'Miniflex', description: 'Urban customers (16 kVA - 5 MVA)' },
  { key: 'Nightsave', label: 'Nightsave', description: 'Off-peak incentive tariffs' },
  { key: 'Businessrate', label: 'Businessrate', description: 'Small business customers' },
  { key: 'Ruraflex', label: 'Ruraflex', description: 'Rural large power users' },
  { key: 'Landrate', label: 'Landrate', description: 'Agricultural customers' },
  { key: 'Homepower', label: 'Homepower', description: 'Residential TOU' },
  { key: 'Homelight', label: 'Homelight', description: 'Residential standard' },
];

export function EskomTariffMatrix({
  tariffs,
  tariffRates,
  loadRatesForTariff,
  loadingRates,
  onDeleteTariff
}: EskomTariffMatrixProps) {
  const [expandedTariffs, setExpandedTariffs] = useState<Set<string>>(new Set());
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  // Group tariffs by family
  const groupedByFamily = useMemo(() => {
    const groups: Record<string, Tariff[]> = {};
    
    tariffs.forEach(t => {
      // Determine family from tariff_family or name prefix
      let family = t.tariff_family;
      if (!family) {
        const name = t.name.toLowerCase();
        const matchedFamily = ESKOM_FAMILIES.find(f => name.startsWith(f.key.toLowerCase()));
        family = matchedFamily?.key || 'Other';
      }
      
      if (!groups[family]) groups[family] = [];
      groups[family].push(t);
    });
    
    // Sort families by ESKOM_FAMILIES order
    const sortedGroups: { family: string; tariffs: Tariff[]; info: typeof ESKOM_FAMILIES[0] | null }[] = [];
    ESKOM_FAMILIES.forEach(f => {
      if (groups[f.key]) {
        sortedGroups.push({ family: f.key, tariffs: groups[f.key], info: f });
        delete groups[f.key];
      }
    });
    // Add remaining groups
    Object.entries(groups).forEach(([family, tariffs]) => {
      sortedGroups.push({ family, tariffs, info: null });
    });
    
    return sortedGroups;
  }, [tariffs]);

  // For TOU tariffs, create matrix view
  const createTariffMatrix = (familyTariffs: Tariff[]) => {
    // Group by transmission zone, then voltage
    const matrix: Record<string, Record<string, Tariff>> = {};
    
    familyTariffs.forEach(t => {
      const zone = t.transmission_zone || 'N/A';
      const voltage = t.voltage_level || 'N/A';
      
      if (!matrix[zone]) matrix[zone] = {};
      matrix[zone][voltage] = t;
    });
    
    return matrix;
  };

  const toggleExpanded = (id: string) => {
    setExpandedTariffs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        loadRatesForTariff(id);
      }
      return next;
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return `R${value.toFixed(2)}`;
  };

  const formatRate = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return `${(value * 100).toFixed(2)}c`;
  };

  const formatRatePerKwh = (value: number) => {
    return `${value.toFixed(4)} c/kWh`;
  };

  const renderRatesMatrix = (tariff: Tariff, rates: TariffRate[]) => {
    // Group rates by season
    const ratesBySeasonTOU: Record<string, Record<string, TariffRate>> = {};
    
    rates.forEach(r => {
      const season = r.season || 'All Year';
      const tou = r.time_of_use || 'Any';
      if (!ratesBySeasonTOU[season]) ratesBySeasonTOU[season] = {};
      ratesBySeasonTOU[season][tou] = r;
    });

    const seasons = Object.keys(ratesBySeasonTOU).sort((a, b) => 
      SEASON_ORDER.indexOf(a) - SEASON_ORDER.indexOf(b)
    );

    return (
      <div className="space-y-4">
        {/* Active Energy Charges by Season/TOU */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Active Energy Charges (c/kWh)
          </h4>
          <div className="rounded border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs py-2 font-medium">Season</TableHead>
                  {TOU_ORDER.map(tou => (
                    <TableHead key={tou} className="text-xs py-2 font-medium text-center">{tou}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map(season => (
                  <TableRow key={season}>
                    <TableCell className="text-xs py-2 font-medium bg-muted/30">
                      {season}
                    </TableCell>
                    {TOU_ORDER.map(tou => {
                      const rate = ratesBySeasonTOU[season]?.[tou];
                      return (
                        <TableCell key={tou} className="text-xs py-2 text-center">
                          {rate ? formatRatePerKwh(rate.rate_per_kwh) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Fixed/Demand Charges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-accent/30 rounded p-3">
            <div className="text-xs text-muted-foreground">Service Charge</div>
            <div className="font-medium text-sm">{formatCurrency(tariff.service_charge_per_day)}/day</div>
          </div>
          <div className="bg-accent/30 rounded p-3">
            <div className="text-xs text-muted-foreground">Admin Charge</div>
            <div className="font-medium text-sm">{formatCurrency(tariff.administration_charge_per_day)}/day</div>
          </div>
          <div className="bg-accent/30 rounded p-3">
            <div className="text-xs text-muted-foreground">GCC</div>
            <div className="font-medium text-sm">{formatCurrency(tariff.generation_capacity_charge)}/kVA/m</div>
          </div>
          <div className="bg-accent/30 rounded p-3">
            <div className="text-xs text-muted-foreground">Legacy Charge</div>
            <div className="font-medium text-sm">{formatRate(tariff.legacy_charge_per_kwh)}/kWh</div>
          </div>
        </div>

        {/* Unbundled Charges if available */}
        {rates.some(r => r.network_charge_per_kwh || r.ancillary_charge_per_kwh) && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Unbundled Network Charges
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-500/10 rounded p-3">
                <div className="text-xs text-muted-foreground">Network Charge</div>
                <div className="font-medium text-sm">
                  {formatRate(rates[0]?.network_charge_per_kwh)}
                </div>
              </div>
              <div className="bg-blue-500/10 rounded p-3">
                <div className="text-xs text-muted-foreground">Ancillary Service</div>
                <div className="font-medium text-sm">
                  {formatRate(rates[0]?.ancillary_charge_per_kwh)}
                </div>
              </div>
              <div className="bg-blue-500/10 rounded p-3">
                <div className="text-xs text-muted-foreground">Reactive Energy</div>
                <div className="font-medium text-sm">
                  {formatCurrency(tariff.reactive_energy_charge)}/kVArh
                </div>
              </div>
              <div className="bg-blue-500/10 rounded p-3">
                <div className="text-xs text-muted-foreground">Network Access</div>
                <div className="font-medium text-sm">
                  {formatCurrency(tariff.network_access_charge)}/kVA/m
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTariffCard = (tariff: Tariff) => {
    const rates = tariffRates[tariff.id] || [];
    const isExpanded = expandedTariffs.has(tariff.id);
    const isLoading = loadingRates.has(tariff.id);

    return (
      <Collapsible key={tariff.id} open={isExpanded} onOpenChange={() => toggleExpanded(tariff.id)}>
        <div className="border rounded bg-background">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
              <div className="flex items-center gap-2 flex-1">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <div className="text-left">
                  <span className="text-sm font-medium">{tariff.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    {tariff.transmission_zone && (
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {tariff.transmission_zone.replace('Zone ', '')}
                      </Badge>
                    )}
                    {tariff.voltage_level && (
                      <Badge variant="outline" className="text-xs">
                        <Gauge className="h-3 w-3 mr-1" />
                        {tariff.voltage_level}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Badge variant={tariff.tariff_type === "TOU" ? "secondary" : "outline"} className="text-xs">
                  {tariff.tariff_type}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7" 
                  onClick={() => onDeleteTariff(tariff.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 border-t space-y-4">
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Loading rates...
                </div>
              ) : rates.length > 0 ? (
                renderRatesMatrix(tariff, rates)
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No rate data available
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  if (tariffs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No Eskom tariffs found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Family Tabs */}
      <Tabs defaultValue={groupedByFamily[0]?.family || 'all'} className="w-full">
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-auto h-auto p-1 bg-muted">
            {groupedByFamily.map(({ family, tariffs: familyTariffs, info }) => (
              <TabsTrigger 
                key={family} 
                value={family}
                className="text-xs px-3 py-2 whitespace-nowrap"
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <span>{family}</span>
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                          {familyTariffs.length}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    {info && (
                      <TooltipContent>
                        <p>{info.description}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {groupedByFamily.map(({ family, tariffs: familyTariffs, info }) => {
          const matrix = createTariffMatrix(familyTariffs);
          const hasMatrix = Object.keys(matrix).length > 1 || 
            (Object.keys(matrix).length === 1 && Object.keys(matrix[Object.keys(matrix)[0]]).length > 1);

          return (
            <TabsContent key={family} value={family} className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        {family}
                      </CardTitle>
                      {info && (
                        <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                      )}
                    </div>
                    <Badge variant="outline">{familyTariffs.length} tariffs</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {hasMatrix ? (
                    // Matrix view for tariffs with zone/voltage variants
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span>Tariffs organized by Transmission Zone and Voltage Level</span>
                      </div>
                      <Accordion type="multiple" className="space-y-2">
                        {ZONE_ORDER.filter(zone => matrix[zone]).map(zone => (
                          <AccordionItem key={zone} value={zone} className="border rounded">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <span className="font-medium">{zone}</span>
                                <Badge variant="outline" className="text-xs">
                                  {Object.keys(matrix[zone]).length} voltage levels
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="space-y-3">
                                {['LV', 'MV', 'HV'].filter(v => matrix[zone][v]).map(voltage => {
                                  const tariff = matrix[zone][voltage];
                                  return renderTariffCard(tariff);
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                        {/* Handle zones not in standard order */}
                        {Object.keys(matrix).filter(z => !ZONE_ORDER.includes(z)).map(zone => (
                          <AccordionItem key={zone} value={zone} className="border rounded">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <span className="font-medium">{zone}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="space-y-3">
                                {Object.entries(matrix[zone]).map(([voltage, tariff]) => 
                                  renderTariffCard(tariff)
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  ) : (
                    // Simple list for tariffs without variants
                    <div className="space-y-3">
                      {familyTariffs.map(tariff => renderTariffCard(tariff))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
