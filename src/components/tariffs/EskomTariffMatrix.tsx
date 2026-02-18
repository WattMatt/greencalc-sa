import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Zap, MapPin, Gauge, Info, TrendingUp, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// NERSA-compliant interfaces
interface TariffRate {
  id: string;
  tariff_plan_id?: string;
  charge: string;
  season: string;
  tou: string;
  amount: number;
  unit: string | null;
  block_number: number | null;
  block_min_kwh: number | null;
  block_max_kwh: number | null;
  consumption_threshold_kwh: number | null;
  is_above_threshold: boolean | null;
  notes: string | null;
}

interface Tariff {
  id: string;
  name: string;
  municipality_id: string;
  category: string;
  structure: string;
  voltage: string | null;
  phase: string | null;
  scale_code: string | null;
  min_amps: number | null;
  max_amps: number | null;
  min_kva: number | null;
  max_kva: number | null;
  is_redundant: boolean | null;
  is_recommended: boolean | null;
  metering: string | null;
  description: string | null;
  tariff_rates?: TariffRate[];
}

interface EskomTariffMatrixProps {
  tariffs: Tariff[];
  tariffRates: Record<string, TariffRate[]>;
  loadRatesForTariff: (tariffId: string) => void;
  loadingRates: Set<string>;
  onDeleteTariff: (id: string) => void;
}

// Season and TOU display
const SEASON_DISPLAY: Record<string, string> = { 'high': 'High/Winter', 'low': 'Low/Summer', 'all': 'All Year' };
const TOU_DISPLAY: Record<string, string> = { 'peak': 'Peak', 'standard': 'Standard', 'off_peak': 'Off-Peak', 'all': 'Any' };
const TOU_ORDER = ['peak', 'standard', 'off_peak'];
const SEASON_ORDER = ['high', 'low', 'all'];

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

  // Group tariffs by family using scale_code or name prefix
  const groupedByFamily = useMemo(() => {
    const groups: Record<string, Tariff[]> = {};
    
    tariffs.forEach(t => {
      let family = t.scale_code;
      if (!family) {
        const name = t.name.toLowerCase();
        const matchedFamily = ESKOM_FAMILIES.find(f => name.startsWith(f.key.toLowerCase()));
        family = matchedFamily?.key || 'Other';
      }
      
      if (!groups[family]) groups[family] = [];
      groups[family].push(t);
    });
    
    const sortedGroups: { family: string; tariffs: Tariff[]; info: typeof ESKOM_FAMILIES[0] | null }[] = [];
    ESKOM_FAMILIES.forEach(f => {
      if (groups[f.key]) {
        sortedGroups.push({ family: f.key, tariffs: groups[f.key], info: f });
        delete groups[f.key];
      }
    });
    Object.entries(groups).forEach(([family, familyTariffs]) => {
      sortedGroups.push({ family, tariffs: familyTariffs, info: null });
    });
    
    return sortedGroups;
  }, [tariffs]);

  // For TOU tariffs, create matrix view by voltage
  const createTariffMatrix = (familyTariffs: Tariff[]) => {
    const matrix: Record<string, Tariff> = {};
    familyTariffs.forEach(t => {
      const voltage = t.voltage || 'N/A';
      matrix[voltage] = t;
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

  const formatAmount = (value: number | null | undefined, unit?: string | null) => {
    if (value === null || value === undefined) return "-";
    return `${value.toFixed(2)} ${unit || ''}`.trim();
  };

  const renderRatesMatrix = (tariff: Tariff, rates: TariffRate[]) => {
    const energyRates = rates.filter(r => r.charge === 'energy');
    const basicCharge = rates.find(r => r.charge === 'basic');
    const demandCharge = rates.find(r => r.charge === 'demand');
    const serviceCharge = rates.find(r => r.charge === 'service');
    const adminCharge = rates.find(r => r.charge === 'admin');

    // Group energy rates by season/tou
    const ratesBySeasonTOU: Record<string, Record<string, TariffRate>> = {};
    energyRates.forEach(r => {
      const season = r.season || 'all';
      const tou = r.tou || 'all';
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
            Active Energy Charges
          </h4>
          <div className="rounded border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs py-2 font-medium">Season</TableHead>
                  {TOU_ORDER.map(tou => (
                    <TableHead key={tou} className="text-xs py-2 font-medium text-center">{TOU_DISPLAY[tou]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map(season => (
                  <TableRow key={season}>
                    <TableCell className="text-xs py-2 font-medium bg-muted/30">
                      {SEASON_DISPLAY[season] || season}
                    </TableCell>
                    {TOU_ORDER.map(tou => {
                      const rate = ratesBySeasonTOU[season]?.[tou];
                      return (
                        <TableCell key={tou} className="text-xs py-2 text-center">
                          {rate ? `${rate.amount.toFixed(2)} ${rate.unit || 'c/kWh'}` : '-'}
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
            <div className="text-xs text-muted-foreground">Basic Charge</div>
            <div className="font-medium text-sm">{basicCharge ? formatAmount(basicCharge.amount, basicCharge.unit || 'R/month') : '-'}</div>
          </div>
          <div className="bg-accent/30 rounded p-3">
            <div className="text-xs text-muted-foreground">Service Charge</div>
            <div className="font-medium text-sm">{serviceCharge ? formatAmount(serviceCharge.amount, serviceCharge.unit || 'R/day') : '-'}</div>
          </div>
          <div className="bg-accent/30 rounded p-3">
            <div className="text-xs text-muted-foreground">Admin Charge</div>
            <div className="font-medium text-sm">{adminCharge ? formatAmount(adminCharge.amount, adminCharge.unit || 'R/day') : '-'}</div>
          </div>
          <div className="bg-accent/30 rounded p-3">
            <div className="text-xs text-muted-foreground">Demand Charge</div>
            <div className="font-medium text-sm">{demandCharge ? formatAmount(demandCharge.amount, demandCharge.unit || 'R/kVA') : '-'}</div>
          </div>
        </div>
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
                    {tariff.voltage && (
                      <Badge variant="outline" className="text-xs">
                        <Gauge className="h-3 w-3 mr-1" />
                        {tariff.voltage}
                      </Badge>
                    )}
                    {tariff.scale_code && (
                      <Badge variant="outline" className="text-xs">
                        {tariff.scale_code}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Badge variant={tariff.structure === "time_of_use" ? "secondary" : "outline"} className="text-xs">
                  {tariff.structure === 'time_of_use' ? 'TOU' : tariff.structure === 'inclining_block' ? 'IBT' : 'Flat'}
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

        {groupedByFamily.map(({ family, tariffs: familyTariffs, info }) => (
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
                <div className="space-y-3">
                  {familyTariffs.map(tariff => renderTariffCard(tariff))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
