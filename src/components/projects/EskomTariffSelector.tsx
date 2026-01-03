import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  Gauge, 
  Check,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TariffRate {
  id: string;
  season: string;
  time_of_use: string;
  rate_per_kwh: number;
  demand_charge_per_kva?: number;
  network_charge_per_kwh?: number;
  ancillary_charge_per_kwh?: number;
  energy_charge_per_kwh?: number;
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
  tariff_rates?: TariffRate[];
}

interface EskomTariffSelectorProps {
  municipalityId: string;
  currentTariffId: string | null;
  onSelect: (tariffId: string) => void;
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
  onSelect 
}: EskomTariffSelectorProps) {
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [activeFamily, setActiveFamily] = useState<string>("");

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
                                          
                                        {/* Energy Rates by Season/TOU */}
                                        {tariff.tariff_rates && tariff.tariff_rates.length > 0 && (
                                          <div className="mt-2 pt-2 border-t border-dashed">
                                            <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                                              <Zap className="h-3 w-3" />
                                              Energy Rates (c/kWh)
                                            </div>
                                            <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
                                              {tariff.tariff_rates.map(rate => (
                                                <div 
                                                  key={rate.id}
                                                  className={cn(
                                                    "p-1.5 rounded text-xs text-center",
                                                    rate.time_of_use === "Peak" && "bg-red-500/10 text-red-700 dark:text-red-400",
                                                    rate.time_of_use === "Standard" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                                                    rate.time_of_use === "Off-Peak" && "bg-green-500/10 text-green-700 dark:text-green-400",
                                                    !["Peak", "Standard", "Off-Peak"].includes(rate.time_of_use) && "bg-muted"
                                                  )}
                                                >
                                                  <div className="font-semibold">{(rate.rate_per_kwh * 100).toFixed(1)}c</div>
                                                  <div className="text-[10px] opacity-80 truncate">
                                                    {rate.time_of_use} {rate.season?.includes("High") ? "H" : rate.season?.includes("Low") ? "L" : ""}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
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

            {/* Rate Matrix */}
            {selectedTariff.tariff_rates && selectedTariff.tariff_rates.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Energy Rates (c/kWh)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {selectedTariff.tariff_rates.map(rate => (
                    <div 
                      key={rate.id}
                      className={cn(
                        "p-2 rounded text-xs",
                        rate.time_of_use === "Peak" && "bg-red-500/10 border border-red-500/30",
                        rate.time_of_use === "Standard" && "bg-yellow-500/10 border border-yellow-500/30",
                        rate.time_of_use === "Off-Peak" && "bg-green-500/10 border border-green-500/30",
                        !["Peak", "Standard", "Off-Peak"].includes(rate.time_of_use) && "bg-muted"
                      )}
                    >
                      <div className="font-medium">{(rate.rate_per_kwh * 100).toFixed(2)}c</div>
                      <div className="text-muted-foreground">
                        {rate.time_of_use} • {rate.season?.replace("High/", "").replace("Low/", "")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
