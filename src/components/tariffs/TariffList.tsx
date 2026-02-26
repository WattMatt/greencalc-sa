import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronDown, ChevronRight, MapPin, Building2, Zap, Filter, Eye, Pencil, Save, X, Loader2, FileSpreadsheet, BarChart3, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EskomTariffMatrix } from "./EskomTariffMatrix";
import { TariffEditDialog } from "./TariffEditDialog";
import { TariffPeriodComparisonDialog } from "./TariffPeriodComparisonDialog";
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

// NERSA-compliant interfaces
interface TariffRate {
  id: string;
  tariff_plan_id: string;
  charge: string; // 'energy' | 'basic' | 'demand' | 'reactive' | 'network' | 'ancillary' | 'service' | 'admin' | 'capacity'
  season: string; // 'high' | 'low' | 'all'
  tou: string; // 'peak' | 'standard' | 'off_peak' | 'all'
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
  min_kw: number | null;
  max_kw: number | null;
  is_redundant: boolean | null;
  is_recommended: boolean | null;
  metering: string | null;
  description: string | null;
  effective_from: string | null;
  effective_to: string | null;
  municipality?: { name: string; province_id: string } | null;
  tariff_rates?: TariffRate[];
}

interface Province {
  id: string;
  name: string;
}

interface GroupedData {
  province: Province;
  municipalities: {
    name: string;
    id: string;
    tariffs: Tariff[];
  }[];
}

type DeleteTarget = 
  | { type: "all" }
  | { type: "province"; id: string; name: string }
  | { type: "municipality"; name: string; tariffIds: string[] };

interface TariffListProps {
  filterMunicipalityId?: string | null;
  filterMunicipalityName?: string | null;
  onClearFilter?: () => void;
}

// Helper: format display labels for NERSA enums
const structureLabel = (s: string) => {
  switch (s) {
    case 'time_of_use': return 'TOU';
    case 'inclining_block': return 'IBT';
    case 'flat': return 'Flat';
    default: return s;
  }
};

const seasonLabel = (s: string) => {
  switch (s) {
    case 'high': return 'High/Winter';
    case 'low': return 'Low/Summer';
    case 'all': return 'All Year';
    default: return s;
  }
};

const touLabel = (t: string) => {
  switch (t) {
    case 'peak': return 'Peak';
    case 'standard': return 'Standard';
    case 'off_peak': return 'Off-Peak';
    case 'all': return 'Any';
    default: return t;
  }
};

// Derive fixed charges from rates
const getChargeAmount = (rates: TariffRate[], chargeType: string): number | null => {
  const rate = rates.find(r => r.charge === chargeType);
  return rate ? rate.amount : null;
};

export function TariffList({ filterMunicipalityId, filterMunicipalityName, onClearFilter }: TariffListProps) {
  const queryClient = useQueryClient();
  const [expandedTariffs, setExpandedTariffs] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [previewMunicipality, setPreviewMunicipality] = useState<{ name: string; tariffs: Tariff[] } | null>(null);
  const [highlightedTariffName, setHighlightedTariffName] = useState<string | null>(null);
  
  // Full edit dialog state
  const [editDialogTariff, setEditDialogTariff] = useState<Tariff | null>(null);
  const [editDialogRates, setEditDialogRates] = useState<TariffRate[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Period comparison dialog state
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonTariffName, setComparisonTariffName] = useState("");
  const [comparisonMunicipalityId, setComparisonMunicipalityId] = useState("");

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch municipalities
  const { data: municipalities } = useQuery({
    queryKey: ["municipalities-with-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("id, name, nersa_increase_pct, province_id");
      if (error) throw error;
      return data;
    },
  });

  // Fetch tariff counts per municipality
  const { data: tariffCountsData } = useQuery({
    queryKey: ["tariff-counts-per-municipality"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_plans")
        .select("municipality_id");
      if (error) throw error;
      // Count per municipality
      const counts = new Map<string, number>();
      (data || []).forEach((t) => {
        counts.set(t.municipality_id, (counts.get(t.municipality_id) || 0) + 1);
      });
      return counts;
    },
  });

  // Pre-compute province-level counts
  const provinceCounts = useMemo(() => {
    if (!municipalities || !tariffCountsData) return new Map<string, { municipalities: number; tariffs: number }>();
    const counts = new Map<string, { municipalities: number; tariffs: number }>();
    municipalities.forEach((m) => {
      if (!m.province_id) return;
      const current = counts.get(m.province_id) || { municipalities: 0, tariffs: 0 };
      const muniTariffs = tariffCountsData.get(m.id) || 0;
      counts.set(m.province_id, {
        municipalities: current.municipalities + 1,
        tariffs: current.tariffs + muniTariffs,
      });
    });
    return counts;
  }, [municipalities, tariffCountsData]);

  // Pre-compute municipality-level tariff counts
  const municipalityCounts = useMemo(() => {
    if (!municipalities || !tariffCountsData) return new Map<string, number>();
    const counts = new Map<string, number>();
    municipalities.forEach((m) => {
      counts.set(m.name, tariffCountsData.get(m.id) || 0);
    });
    return counts;
  }, [municipalities, tariffCountsData]);

  // State for lazily loaded rates
  const [tariffRates, setTariffRates] = useState<Record<string, TariffRate[]>>({});
  const [loadingRates, setLoadingRates] = useState<Set<string>>(new Set());

  // State for lazily loaded municipality tariffs
  const [municipalityTariffs, setMunicipalityTariffs] = useState<Record<string, Tariff[]>>({});
  const [loadingMunicipalities, setLoadingMunicipalities] = useState<Set<string>>(new Set());
  const [isLoading] = useState(false);

  // Load tariffs for a specific municipality on demand
  const loadTariffsForMunicipality = async (municipalityName: string) => {
    if (municipalityTariffs[municipalityName] || loadingMunicipalities.has(municipalityName)) return;
    
    const muni = municipalities?.find(m => m.name === municipalityName);
    if (!muni) return;
    
    setLoadingMunicipalities(prev => new Set(prev).add(municipalityName));
    try {
      const { data, error } = await supabase
        .from("tariff_plans")
        .select(`
          *,
          municipality:municipalities(name, province_id),
          tariff_rates(*)
        `)
        .eq("municipality_id", muni.id)
        .order("name");
      
      if (!error && data) {
        setMunicipalityTariffs(prev => ({ ...prev, [municipalityName]: data as unknown as Tariff[] }));
      }
    } finally {
      setLoadingMunicipalities(prev => {
        const next = new Set(prev);
        next.delete(municipalityName);
        return next;
      });
    }
  };

  // Lazy load rates when tariff is expanded
  const loadRatesForTariff = async (tariffId: string) => {
    if (tariffRates[tariffId] || loadingRates.has(tariffId)) return;
    
    setLoadingRates(prev => new Set(prev).add(tariffId));
    try {
      const { data, error } = await supabase
        .from("tariff_rates")
        .select("*")
        .eq("tariff_plan_id", tariffId);
      
      if (!error && data) {
        setTariffRates(prev => ({ ...prev, [tariffId]: data as unknown as TariffRate[] }));
      }
    } finally {
      setLoadingRates(prev => {
        const next = new Set(prev);
        next.delete(tariffId);
        return next;
      });
    }
  };

  // Function to open preview
  const handleOpenPreview = (municipalityName: string, muniTariffs: Tariff[]) => {
    setPreviewMunicipality({ name: municipalityName, tariffs: muniTariffs });
  };

  const deleteTariff = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("tariff_rates").delete().eq("tariff_plan_id", id);
      const { error } = await supabase.from("tariff_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariff-counts-per-municipality"] });
      toast.success("Tariff deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (target: DeleteTarget) => {
      if (target.type === "all") {
        const { error: ratesError } = await supabase
          .from("tariff_rates")
          .delete()
          .gte("id", "00000000-0000-0000-0000-000000000000");
        if (ratesError) throw ratesError;
        const { error } = await supabase
          .from("tariff_plans")
          .delete()
          .gte("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      } else if (target.type === "province") {
        const { data: munis } = await supabase
          .from("municipalities")
          .select("id")
          .eq("province_id", target.id);
        
        if (munis && munis.length > 0) {
          const municipalityIds = munis.map((m) => m.id);
          const { data: tariffData } = await supabase
            .from("tariff_plans")
            .select("id")
            .in("municipality_id", municipalityIds);
          
          if (tariffData && tariffData.length > 0) {
            const tariffIds = tariffData.map((t) => t.id);
            const { error: ratesError } = await supabase.from("tariff_rates").delete().in("tariff_plan_id", tariffIds);
            if (ratesError) throw ratesError;
            const { error } = await supabase.from("tariff_plans").delete().in("municipality_id", municipalityIds);
            if (error) throw error;
          }
        }
      } else if (target.type === "municipality") {
        const { error: ratesError } = await supabase.from("tariff_rates").delete().in("tariff_plan_id", target.tariffIds);
        if (ratesError) throw ratesError;
        const { error } = await supabase.from("tariff_plans").delete().in("id", target.tariffIds);
        if (error) throw error;
      }
    },
    onSuccess: (_, target) => {
      queryClient.invalidateQueries({ queryKey: ["tariff-counts-per-municipality"] });
      queryClient.invalidateQueries({ queryKey: ["municipalities-with-counts"] });
      if (target.type === "municipality") {
        setMunicipalityTariffs(prev => {
          const next = { ...prev };
          delete next[target.name];
          return next;
        });
      } else {
        setMunicipalityTariffs({});
      }
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

  // Group municipalities by province
  const groupedData = useMemo(() => {
    if (!municipalities || !provinces || !tariffCountsData) return [];

    const provinceMap = new Map<string, Province>();
    provinces.forEach((p) => provinceMap.set(p.id, p));

    const grouped: Record<string, { name: string; id: string; tariffCount: number }[]> = {};

    municipalities.forEach((muni) => {
      if (!muni.province_id) return;
      
      if (!grouped[muni.province_id]) {
        grouped[muni.province_id] = [];
      }
      grouped[muni.province_id].push({
        name: muni.name,
        id: muni.id,
        tariffCount: tariffCountsData.get(muni.id) || 0
      });
    });

    const result: GroupedData[] = [];
    Object.entries(grouped).forEach(([provinceId, muniList]) => {
      const province = provinceMap.get(provinceId);
      if (!province) return;

      const municipalityList = muniList
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(m => ({ 
          name: m.name,
          id: m.id,
          tariffs: municipalityTariffs[m.name] || [] 
        }));

      result.push({ province, municipalities: municipalityList });
    });

    return result.sort((a, b) => a.province.name.localeCompare(b.province.name));
  }, [municipalities, provinces, municipalityTariffs, tariffCountsData]);

  // Filter grouped data
  const filteredData = useMemo(() => {
    let data = groupedData;
    if (selectedProvince !== "all") {
      data = data.filter((d) => d.province.id === selectedProvince);
    }
    if (filterMunicipalityId) {
      data = data.map((provinceGroup) => ({
        ...provinceGroup,
        municipalities: provinceGroup.municipalities.filter((m) => m.id === filterMunicipalityId),
      })).filter((d) => d.municipalities.length > 0);
    }
    return data;
  }, [groupedData, selectedProvince, filterMunicipalityId]);

  const filteredTariffCount = useMemo(() => {
    return filteredData.reduce((sum, p) => 
      sum + p.municipalities.reduce((mSum, m) => mSum + (municipalityCounts.get(m.name) || m.tariffs.length), 0), 0
    );
  }, [filteredData, municipalityCounts]);

  const toggleExpanded = (id: string) => {
    setExpandedTariffs((prev) => {
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

  const formatAmount = (value: number | null, unit?: string | null) => {
    if (value === null || value === undefined) return "-";
    if (unit) return `${value.toFixed(2)} ${unit}`;
    return `R ${value.toFixed(2)}`;
  };

  const getTariffCount = (data: GroupedData) => {
    return data.municipalities.reduce((sum, m) => sum + (municipalityCounts.get(m.name) || m.tariffs.length), 0);
  };

  const getDeleteDescription = () => {
    if (!deleteTarget) return "";
    const totalTariffs = Array.from(provinceCounts.values()).reduce((sum, p) => sum + p.tariffs, 0);
    if (deleteTarget.type === "all") return `This will permanently delete all ${totalTariffs} tariffs.`;
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

  const totalTariffCount = Array.from(provinceCounts.values()).reduce((sum, p) => sum + p.tariffs, 0);
  

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
                {filterMunicipalityName 
                  ? `Showing tariffs for ${filterMunicipalityName}`
                  : selectedProvince === "all" 
                    ? `${totalTariffCount} tariffs across ${provinceCounts.size || groupedData.length} provinces`
                    : `${provinceCounts.get(selectedProvince)?.tariffs || filteredTariffCount} tariffs in ${filteredData[0]?.province.name || "selected province"}`
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {filterMunicipalityName && onClearFilter && (
                <Badge 
                  variant="secondary" 
                  className="flex items-center gap-1 pr-1 bg-primary/10 text-primary border-primary/20"
                >
                  <MapPin className="h-3 w-3" />
                  {filterMunicipalityName}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-4 w-4 p-0 ml-1 hover:bg-primary/20 rounded-full"
                    onClick={onClearFilter}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
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
                      {provinceCounts.get(provinceData.province.id)?.municipalities || provinceData.municipalities.length} municipalities • {provinceCounts.get(provinceData.province.id)?.tariffs || getTariffCount(provinceData)} tariffs
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
              <Accordion type="multiple" className="space-y-2" onValueChange={(values) => {
                values.forEach((municipalityName) => {
                  loadTariffsForMunicipality(municipalityName);
                });
              }}>
                {provinceData.municipalities.map((municipality) => (
                  <AccordionItem
                    key={municipality.name}
                    value={municipality.name}
                    className="border rounded-md bg-accent/20"
                  >
                    <div className="flex items-center justify-between px-3 py-2 hover:bg-accent/40">
                      <AccordionTrigger className="hover:no-underline text-sm flex-1 py-0 [&>svg]:ml-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{municipality.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {municipalityCounts.get(municipality.name) || municipality.tariffs.length} tariffs
                          </Badge>
                          {loadingMunicipalities.has(municipality.name) && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadTariffsForMunicipality(municipality.name);
                            handleOpenPreview(municipality.name, municipalityTariffs[municipality.name] || []);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            const tariffs = municipalityTariffs[municipality.name] || [];
                            setDeleteTarget({
                              type: "municipality",
                              name: municipality.name,
                              tariffIds: tariffs.map((t) => t.id),
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <AccordionContent className="px-3 pb-3">
                      {/* Tariffs within Municipality */}
                      <div className="space-y-2 mt-2">
                        {loadingMunicipalities.has(municipality.name) ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                            <span className="text-sm text-muted-foreground">Loading tariffs...</span>
                          </div>
                        ) : municipality.tariffs.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No tariffs uploaded yet
                          </p>
                        ) : (
                        (() => {
                          
                          // Group tariffs by period
                          const periodGroups = new Map<string, { label: string; tariffs: Tariff[] }>();
                          municipality.tariffs.forEach((tariff) => {
                            const key = (tariff.effective_from && tariff.effective_to)
                              ? `${tariff.effective_from}|${tariff.effective_to}`
                              : 'unspecified';
                            if (!periodGroups.has(key)) {
                              let label = 'No Period Specified';
                              if (tariff.effective_from && tariff.effective_to) {
                                try {
                                  label = `${format(parseISO(tariff.effective_from), 'd MMM yyyy')} – ${format(parseISO(tariff.effective_to), 'd MMM yyyy')}`;
                                } catch { label = `${tariff.effective_from} – ${tariff.effective_to}`; }
                              }
                              periodGroups.set(key, { label, tariffs: [] });
                            }
                            periodGroups.get(key)!.tariffs.push(tariff);
                          });

                          const sortedPeriods = Array.from(periodGroups.entries()).sort(([a], [b]) => {
                            if (a === 'unspecified') return 1;
                            if (b === 'unspecified') return -1;
                            return a.localeCompare(b);
                          });

                          return sortedPeriods.map(([periodKey, group]) => (
                            <Collapsible key={periodKey} defaultOpen={sortedPeriods.length === 1}>
                              <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-sm font-medium text-foreground">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span>{group.label}</span>
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {group.tariffs.length} {group.tariffs.length === 1 ? 'tariff' : 'tariffs'}
                                </Badge>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-1 space-y-2 pl-2 border-l-2 border-primary/20 ml-2">
                                {[...group.tariffs].sort((a, b) => {
                                  // Sort by scale_code first, then by transmission zone, then voltage
                                  const scaleOrder = (a.scale_code || '').localeCompare(b.scale_code || '');
                                  if (scaleOrder !== 0) return scaleOrder;
                                  
                                  // Transmission zone order from tariff name
                                  const zoneOrder = ['<= 300km', '> 300km', '> 600km', '> 900km'];
                                  const getZoneIndex = (name: string) => {
                                    for (let i = zoneOrder.length - 1; i >= 0; i--) {
                                      if (name.includes(zoneOrder[i])) return i;
                                    }
                                    return -1;
                                  };
                                  const zoneA = getZoneIndex(a.name);
                                  const zoneB = getZoneIndex(b.name);
                                  if (zoneA !== zoneB) return zoneA - zoneB;
                                  
                                  // Voltage order from tariff name
                                  const voltageOrder = ['< 500V', '>= 500V', '>= 66kV', '> 132kV'];
                                  const getVoltageIndex = (name: string) => {
                                    for (let i = voltageOrder.length - 1; i >= 0; i--) {
                                      if (name.includes(voltageOrder[i])) return i;
                                    }
                                    return -1;
                                  };
                                  const voltA = getVoltageIndex(a.name);
                                  const voltB = getVoltageIndex(b.name);
                                  if (voltA !== voltB) return voltA - voltB;
                                  
                                  return a.name.localeCompare(b.name);
                                }).map((tariff) => (
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
                                      {tariff.category}
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      tariff.structure === "inclining_block"
                                        ? "default"
                                        : tariff.structure === "time_of_use"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {structureLabel(tariff.structure)}
                                  </Badge>
                                  {tariff.is_recommended && (
                                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
                                      Recommended
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
                                  {/* Fixed Charges derived from rates - dynamically show ALL non-energy charges */}
                                  {(() => {
                                    const rates = tariffRates[tariff.id] || [];
                                    const nonEnergyRates = rates.filter(r => r.charge !== 'energy');
                                    
                                    // Build display items from non-energy rates
                                    const chargeItems: { label: string; value: string }[] = [];
                                    
                                    for (const rate of nonEnergyRates) {
                                      let label = '';
                                      if (rate.notes) {
                                        label = rate.notes;
                                      } else if (rate.charge === 'basic') {
                                        label = 'Basic Charge';
                                      } else if (rate.charge === 'demand') {
                                        label = 'Demand Charge';
                                      } else if (rate.charge === 'network_demand') {
                                        label = 'Network Demand';
                                      } else if (rate.charge === 'ancillary') {
                                        label = 'Ancillary';
                                      } else {
                                        label = rate.charge.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                      }
                                      
                                      const unit = rate.unit || '';
                                      const isSmallAmount = rate.amount < 0.01;
                                      const displayAmount = isSmallAmount 
                                        ? `${(rate.amount * 100).toFixed(2)} c/kWh`
                                        : `${formatAmount(rate.amount)}${unit.includes('kVA') ? '/kVA' : unit.includes('month') ? '/month' : '/' + unit.replace('R/', '')}`;
                                      
                                      chargeItems.push({ label, value: displayAmount });
                                    }
                                    
                                    // Always show phase and voltage
                                    chargeItems.push({ label: 'Phase', value: tariff.phase || '-' });
                                    chargeItems.push({ label: 'Voltage', value: tariff.voltage || '-' });
                                    
                                    return (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        {chargeItems.map((item, idx) => (
                                          <div key={idx} className="bg-accent/30 rounded p-2">
                                            <div className="text-muted-foreground">{item.label}</div>
                                            <div className="font-medium">{item.value}</div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}

                                  {/* Rates Table - lazy loaded */}
                                  {loadingRates.has(tariff.id) ? (
                                    <div className="text-xs text-muted-foreground py-2">Loading rates...</div>
                                  ) : tariffRates[tariff.id]?.filter(r => r.charge === 'energy').length > 0 ? (
                                    <div>
                                      <div className="text-xs font-medium mb-2 text-foreground">Energy Rates</div>
                                      <div className="rounded border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/50">
                                              {tariffRates[tariff.id].some(r => r.season !== 'all') && (
                                                <TableHead className="text-xs py-2">Season</TableHead>
                                              )}
                                              {tariff.structure === "time_of_use" && (
                                                <TableHead className="text-xs py-2">Time of Use</TableHead>
                                              )}
                                              {tariff.structure === "inclining_block" && (
                                                <>
                                                  <TableHead className="text-xs py-2">From (kWh)</TableHead>
                                                  <TableHead className="text-xs py-2">To (kWh)</TableHead>
                                                </>
                                              )}
                                              <TableHead className="text-xs py-2">Rate</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {tariffRates[tariff.id]
                                              .filter(r => r.charge === 'energy')
                                              .map((rate) => (
                                              <TableRow key={rate.id}>
                                                {tariffRates[tariff.id].some(r => r.season !== 'all') && (
                                                  <TableCell className="text-xs py-1.5">{seasonLabel(rate.season)}</TableCell>
                                                )}
                                                {tariff.structure === "time_of_use" && (
                                                  <TableCell className="text-xs py-1.5">{touLabel(rate.tou)}</TableCell>
                                                )}
                                                {tariff.structure === "inclining_block" && (
                                                  <>
                                                    <TableCell className="text-xs py-1.5">
                                                      {rate.block_min_kwh}
                                                    </TableCell>
                                                    <TableCell className="text-xs py-1.5">
                                                      {rate.block_max_kwh ?? "∞"}
                                                    </TableCell>
                                                  </>
                                                )}
                                                <TableCell className="text-xs py-1.5 font-medium">
                                                  {rate.amount.toFixed(2)} {rate.unit || 'c/kWh'}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          ))
                        })()

                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Preview Dialog */}
      <Dialog open={!!previewMunicipality} onOpenChange={(open) => { if (!open) { setPreviewMunicipality(null); setHighlightedTariffName(null); } }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {previewMunicipality?.name} - Tariffs
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>Review extracted tariffs. Click Edit to modify values.</span>
              {(() => {
                const tariffs = previewMunicipality?.tariffs || [];
                const nameCount = new Map<string, number>();
                tariffs.forEach(t => nameCount.set(t.name, (nameCount.get(t.name) || 0) + 1));
                const hasMultiPeriod = [...nameCount.values()].some(c => c >= 2);
                if (!hasMultiPeriod) return null;
                const multiName = [...nameCount.entries()].find(([, c]) => c >= 2)?.[0];
                const muniId = tariffs[0]?.municipality_id;
                if (!multiName || !muniId) return null;
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 ml-2 shrink-0"
                    onClick={() => {
                      setComparisonTariffName(multiName);
                      setComparisonMunicipalityId(muniId);
                      setComparisonOpen(true);
                    }}
                  >
                    <BarChart3 className="h-3 w-3" />
                    Compare Periods
                  </Button>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 max-h-[70vh]">
            {previewMunicipality?.tariffs.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                No tariffs extracted for this municipality.
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {[...(previewMunicipality?.tariffs || [])].sort((a, b) => a.name.localeCompare(b.name)).map((tariff) => {
                  const rates = tariffRates[tariff.id] || tariff.tariff_rates || [];
                  const basicCharge = getChargeAmount(rates, 'basic');
                  const demandCharge = getChargeAmount(rates, 'demand');
                  const energyRates = rates.filter(r => r.charge === 'energy');
                  
                  return (
                    <Card 
                      key={tariff.id} 
                      className={`text-xs cursor-pointer transition-all ${highlightedTariffName === tariff.name ? "ring-2 ring-primary bg-primary/5" : "hover:bg-accent/50"}`}
                      onClick={() => setHighlightedTariffName(highlightedTariffName === tariff.name ? null : tariff.name)}
                    >
                      <CardHeader className="py-2 px-3">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                            <div className="font-medium text-sm">{tariff.name}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-muted-foreground">{tariff.category}</span>
                              {tariff.voltage && (
                                <Badge variant="outline" className="text-[10px]">{tariff.voltage}</Badge>
                              )}
                              {tariff.effective_from && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {new Date(tariff.effective_from).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
                                  {tariff.effective_to ? ` – ${new Date(tariff.effective_to).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}` : " →"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">{structureLabel(tariff.structure)}</Badge>
                            {tariff.is_recommended && <Badge variant="secondary" className="text-[10px]">Recommended</Badge>}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs gap-1"
                              onClick={async (e) => {
                                e.stopPropagation();
                                let loadedRates = tariffRates[tariff.id];
                                if (!loadedRates) {
                                  const { data } = await supabase
                                    .from("tariff_rates")
                                    .select("*")
                                    .eq("tariff_plan_id", tariff.id);
                                  loadedRates = (data || []) as unknown as TariffRate[];
                                  setTariffRates(prev => ({ ...prev, [tariff.id]: loadedRates }));
                                }
                                setEditDialogTariff(tariff);
                                setEditDialogRates(loadedRates);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2 px-3 border-t space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {basicCharge !== null && basicCharge > 0 && (
                            <div>
                              <span className="text-muted-foreground">Basic Charge:</span>{" "}
                              <span className="font-medium text-primary">R{basicCharge.toFixed(2)}/m</span>
                            </div>
                          )}
                          {demandCharge !== null && demandCharge > 0 && (
                            <div>
                              <span className="text-muted-foreground">Demand Charge:</span>{" "}
                              <span className="font-medium text-primary">R{demandCharge.toFixed(2)}/kVA</span>
                            </div>
                          )}
                          {tariff.phase && (
                            <div>
                              <span className="text-muted-foreground">Phase:</span> {tariff.phase}
                            </div>
                          )}
                          {tariff.voltage && (
                            <div>
                              <span className="text-muted-foreground">Voltage:</span> {tariff.voltage}
                            </div>
                          )}
                        </div>
                        {energyRates.length > 0 && (
                          <div className="pt-2 border-t">
                            <div className="text-muted-foreground mb-1">Energy Rates:</div>
                            <div className="space-y-0.5">
                              {[...energyRates]
                                .sort((a, b) => {
                                  if (tariff.structure === "inclining_block") {
                                    return (a.block_min_kwh ?? 0) - (b.block_min_kwh ?? 0);
                                  }
                                  return 0;
                                })
                                .map((rate, idx) => {
                                const isIBT = tariff.structure === "inclining_block";
                                const hasBlockRange = rate.block_min_kwh !== null || rate.block_max_kwh !== null;
                                
                                let displayLabel = touLabel(rate.tou);
                                if (isIBT && hasBlockRange) {
                                  const start = rate.block_min_kwh ?? 0;
                                  const end = rate.block_max_kwh;
                                  displayLabel = end !== null ? `${start}-${end} kWh` : `>${start} kWh`;
                                } else if (rate.tou === "all" && rate.season !== "all") {
                                  displayLabel = seasonLabel(rate.season);
                                }
                                
                                const seasonSuffix = tariff.structure === "time_of_use" && rate.season !== "all" 
                                  ? ` (${rate.season === "high" ? "Winter" : "Summer"})` 
                                  : "";
                                
                                return (
                                <div key={idx} className="flex items-center justify-between bg-muted/50 px-2 py-0.5 rounded">
                                  <span className={`font-medium ${
                                    rate.tou === "peak" ? "text-red-600" :
                                    rate.tou === "off_peak" ? "text-green-600" :
                                    isIBT ? "text-purple-600" :
                                    "text-foreground"
                                  }`}>
                                    {displayLabel}{seasonSuffix}
                                  </span>
                                  <span className="font-mono">{rate.amount.toFixed(2)} {rate.unit || 'c/kWh'}</span>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Full Edit Dialog */}
      <TariffEditDialog
        tariff={editDialogTariff}
        rates={editDialogRates}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditDialogTariff(null);
            setEditDialogRates([]);
          }
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["tariff-counts-per-municipality"] });
          queryClient.invalidateQueries({ queryKey: ["municipalities-with-counts"] });
          if (editDialogTariff) {
            setTariffRates(prev => {
              const next = { ...prev };
              delete next[editDialogTariff.id];
              return next;
            });
            if (previewMunicipality) {
              setMunicipalityTariffs(prev => {
                const next = { ...prev };
                delete next[previewMunicipality.name];
                return next;
              });
              loadTariffsForMunicipality(previewMunicipality.name);
            }
          }
        }}
      />

      {/* Period Comparison Dialog */}
      <TariffPeriodComparisonDialog
        tariffName={comparisonTariffName}
        municipalityId={comparisonMunicipalityId}
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
      />
    </div>
  );
}
