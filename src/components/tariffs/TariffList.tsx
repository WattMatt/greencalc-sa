import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronDown, ChevronRight, MapPin, Building2, Zap, Filter } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TariffRate {
  id: string;
  season: string;
  time_of_use: string;
  block_start_kwh: number | null;
  block_end_kwh: number | null;
  rate_per_kwh: number;
  demand_charge_per_kva: number | null;
}

interface Tariff {
  id: string;
  name: string;
  tariff_type: string;
  is_prepaid: boolean | null;
  fixed_monthly_charge: number | null;
  demand_charge_per_kva: number | null;
  network_access_charge: number | null;
  phase_type: string | null;
  amperage_limit: string | null;
  has_seasonal_rates: boolean | null;
  municipality_id: string;
  municipality: { name: string; province_id: string } | null;
  category: { name: string } | null;
  rates: TariffRate[];
}

interface Province {
  id: string;
  name: string;
}

interface GroupedData {
  province: Province;
  municipalities: {
    name: string;
    tariffs: Tariff[];
  }[];
}

type DeleteTarget = 
  | { type: "all" }
  | { type: "province"; id: string; name: string }
  | { type: "municipality"; name: string; tariffIds: string[] };

export function TariffList() {
  const queryClient = useQueryClient();
  const [expandedTariffs, setExpandedTariffs] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string>("all");

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ["tariffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          municipality:municipalities(name, province_id),
          category:tariff_categories(name),
          rates:tariff_rates(*)
        `)
        .order("name");
      if (error) throw error;
      return data as unknown as Tariff[];
    },
  });

  const deleteTariff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tariffs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      toast.success("Tariff deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (target: DeleteTarget) => {
      if (target.type === "all") {
        // Delete all tariff rates first, then tariffs
        const { error: ratesError } = await supabase.from("tariff_rates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (ratesError) throw ratesError;
        const { error } = await supabase.from("tariffs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      } else if (target.type === "province") {
        // Get all municipality IDs for this province
        const { data: municipalities } = await supabase
          .from("municipalities")
          .select("id")
          .eq("province_id", target.id);
        
        if (municipalities && municipalities.length > 0) {
          const municipalityIds = municipalities.map((m) => m.id);
          // Get tariff IDs
          const { data: tariffData } = await supabase
            .from("tariffs")
            .select("id")
            .in("municipality_id", municipalityIds);
          
          if (tariffData && tariffData.length > 0) {
            const tariffIds = tariffData.map((t) => t.id);
            // Delete rates first
            const { error: ratesError } = await supabase.from("tariff_rates").delete().in("tariff_id", tariffIds);
            if (ratesError) throw ratesError;
            // Delete tariffs
            const { error } = await supabase.from("tariffs").delete().in("municipality_id", municipalityIds);
            if (error) throw error;
          }
        }
      } else if (target.type === "municipality") {
        // Delete rates first
        const { error: ratesError } = await supabase.from("tariff_rates").delete().in("tariff_id", target.tariffIds);
        if (ratesError) throw ratesError;
        // Delete tariffs
        const { error } = await supabase.from("tariffs").delete().in("id", target.tariffIds);
        if (error) throw error;
      }
    },
    onSuccess: (_, target) => {
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      const message = target.type === "all" 
        ? "All tariffs deleted" 
        : target.type === "province" 
          ? `Deleted all tariffs in ${target.name}`
          : `Deleted all tariffs in ${target.name}`;
      toast.success(message);
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
      setDeleteTarget(null);
    },
  });

  // Group tariffs by province → municipality
  const groupedData = useMemo(() => {
    if (!tariffs || !provinces) return [];

    const provinceMap = new Map<string, Province>();
    provinces.forEach((p) => provinceMap.set(p.id, p));

    const grouped: Record<string, Record<string, Tariff[]>> = {};

    tariffs.forEach((tariff) => {
      const provinceId = tariff.municipality?.province_id;
      const municipalityName = tariff.municipality?.name || "Unknown";

      if (!provinceId) return;

      if (!grouped[provinceId]) {
        grouped[provinceId] = {};
      }
      if (!grouped[provinceId][municipalityName]) {
        grouped[provinceId][municipalityName] = [];
      }
      grouped[provinceId][municipalityName].push(tariff);
    });

    const result: GroupedData[] = [];
    Object.entries(grouped).forEach(([provinceId, municipalities]) => {
      const province = provinceMap.get(provinceId);
      if (!province) return;

      const municipalityList = Object.entries(municipalities)
        .map(([name, tariffs]) => ({ name, tariffs }))
        .sort((a, b) => a.name.localeCompare(b.name));

      result.push({ province, municipalities: municipalityList });
    });

    return result.sort((a, b) => a.province.name.localeCompare(b.province.name));
  }, [tariffs, provinces]);

  // Filter grouped data by selected province
  const filteredData = useMemo(() => {
    if (selectedProvince === "all") return groupedData;
    return groupedData.filter((data) => data.province.id === selectedProvince);
  }, [groupedData, selectedProvince]);

  const filteredTariffCount = useMemo(() => {
    return filteredData.reduce((sum, p) => 
      sum + p.municipalities.reduce((mSum, m) => mSum + m.tariffs.length, 0), 0
    );
  }, [filteredData]);

  const toggleExpanded = (id: string) => {
    setExpandedTariffs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return `R ${value.toFixed(2)}`;
  };

  const formatRate = (value: number) => {
    return `${value.toFixed(4)} c/kWh`;
  };

  const getTariffCount = (data: GroupedData) => {
    return data.municipalities.reduce((sum, m) => sum + m.tariffs.length, 0);
  };

  const getDeleteDescription = () => {
    if (!deleteTarget) return "";
    if (deleteTarget.type === "all") return `This will permanently delete all ${tariffs?.length || 0} tariffs.`;
    if (deleteTarget.type === "province") return `This will delete all tariffs in ${deleteTarget.name}.`;
    if (deleteTarget.type === "municipality") return `This will delete all ${deleteTarget.tariffIds.length} tariffs in ${deleteTarget.name}.`;
    return "";
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">Loading tariffs...</p>
        </CardContent>
      </Card>
    );
  }

  if (!tariffs?.length) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">
            No tariffs configured yet. Use the import tools or Tariff Builder to add tariffs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>{getDeleteDescription()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && bulkDelete.mutate(deleteTarget)}
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Electricity Tariffs
              </CardTitle>
              <CardDescription>
                {selectedProvince === "all" 
                  ? `${tariffs.length} tariffs across ${groupedData.length} provinces`
                  : `${filteredTariffCount} tariffs in ${filteredData[0]?.province.name || "selected province"}`
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                <SelectTrigger className="w-[180px] bg-background">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by province" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">All Provinces</SelectItem>
                  {groupedData.map((data) => (
                    <SelectItem key={data.province.id} value={data.province.id}>
                      {data.province.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteTarget({ type: "all" })}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Province Level Accordion */}
      <Accordion type="multiple" className="space-y-3">
        {filteredData.map((provinceData) => (
          <AccordionItem
            key={provinceData.province.id}
            value={provinceData.province.id}
            className="border rounded-lg bg-card overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <div className="font-semibold text-foreground">{provinceData.province.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {provinceData.municipalities.length} municipalities • {getTariffCount(provinceData)} tariffs
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ type: "province", id: provinceData.province.id, name: provinceData.province.name });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {/* Municipality Level Accordion */}
              <Accordion type="multiple" className="space-y-2">
                {provinceData.municipalities.map((municipality) => (
                  <AccordionItem
                    key={municipality.name}
                    value={municipality.name}
                    className="border rounded-md bg-accent/20"
                  >
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-accent/40 text-sm">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{municipality.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {municipality.tariffs.length} tariffs
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              type: "municipality",
                              name: municipality.name,
                              tariffIds: municipality.tariffs.map((t) => t.id),
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      {/* Tariffs within Municipality */}
                      <div className="space-y-2 mt-2">
                        {municipality.tariffs.map((tariff) => (
                          <Collapsible key={tariff.id} open={expandedTariffs.has(tariff.id)}>
                            <div className="border rounded bg-background">
                              <div className="flex items-center justify-between p-3">
                                <CollapsibleTrigger
                                  className="flex items-center gap-2 hover:opacity-80 flex-1"
                                  onClick={() => toggleExpanded(tariff.id)}
                                >
                                  {expandedTariffs.has(tariff.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <div className="text-left">
                                    <div className="font-medium text-sm text-foreground">{tariff.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {tariff.category?.name}
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      tariff.tariff_type === "IBT"
                                        ? "default"
                                        : tariff.tariff_type === "TOU"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {tariff.tariff_type}
                                  </Badge>
                                  {tariff.is_prepaid && (
                                    <Badge variant="outline" className="text-xs">
                                      Prepaid
                                    </Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => deleteTariff.mutate(tariff.id)}
                                    disabled={deleteTariff.isPending}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              <CollapsibleContent>
                                <div className="px-3 pb-3 pt-1 border-t space-y-3">
                                  {/* Fixed Charges */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div className="bg-accent/30 rounded p-2">
                                      <div className="text-muted-foreground">Basic Charge</div>
                                      <div className="font-medium">{formatCurrency(tariff.fixed_monthly_charge)}</div>
                                    </div>
                                    <div className="bg-accent/30 rounded p-2">
                                      <div className="text-muted-foreground">Demand Charge</div>
                                      <div className="font-medium">
                                        {formatCurrency(tariff.demand_charge_per_kva)}/kVA
                                      </div>
                                    </div>
                                    <div className="bg-accent/30 rounded p-2">
                                      <div className="text-muted-foreground">Phase</div>
                                      <div className="font-medium">{tariff.phase_type || "-"}</div>
                                    </div>
                                    <div className="bg-accent/30 rounded p-2">
                                      <div className="text-muted-foreground">Amperage</div>
                                      <div className="font-medium">{tariff.amperage_limit || "-"}</div>
                                    </div>
                                  </div>

                                  {/* Rates Table */}
                                  {tariff.rates?.length > 0 && (
                                    <div>
                                      <div className="text-xs font-medium mb-2 text-foreground">Energy Rates</div>
                                      <div className="rounded border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/50">
                                              {tariff.has_seasonal_rates && (
                                                <TableHead className="text-xs py-2">Season</TableHead>
                                              )}
                                              {tariff.tariff_type === "TOU" && (
                                                <TableHead className="text-xs py-2">Time of Use</TableHead>
                                              )}
                                              {tariff.tariff_type === "IBT" && (
                                                <>
                                                  <TableHead className="text-xs py-2">From (kWh)</TableHead>
                                                  <TableHead className="text-xs py-2">To (kWh)</TableHead>
                                                </>
                                              )}
                                              <TableHead className="text-xs py-2">Rate</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {tariff.rates.map((rate) => (
                                              <TableRow key={rate.id}>
                                                {tariff.has_seasonal_rates && (
                                                  <TableCell className="text-xs py-1.5">{rate.season}</TableCell>
                                                )}
                                                {tariff.tariff_type === "TOU" && (
                                                  <TableCell className="text-xs py-1.5">{rate.time_of_use}</TableCell>
                                                )}
                                                {tariff.tariff_type === "IBT" && (
                                                  <>
                                                    <TableCell className="text-xs py-1.5">
                                                      {rate.block_start_kwh}
                                                    </TableCell>
                                                    <TableCell className="text-xs py-1.5">
                                                      {rate.block_end_kwh ?? "∞"}
                                                    </TableCell>
                                                  </>
                                                )}
                                                <TableCell className="text-xs py-1.5 font-medium">
                                                  {formatRate(rate.rate_per_kwh)}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
