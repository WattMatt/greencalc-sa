import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronDown, ChevronRight, MapPin, Building2, Zap, Filter, Eye, Pencil, Save, X, Loader2, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  rates?: TariffRate[]; // Optional - loaded on demand
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

interface TariffListProps {
  filterMunicipalityId?: string | null;
  filterMunicipalityName?: string | null;
  onClearFilter?: () => void;
}

export function TariffList({ filterMunicipalityId, filterMunicipalityName, onClearFilter }: TariffListProps) {
  const queryClient = useQueryClient();
  const [expandedTariffs, setExpandedTariffs] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [previewMunicipality, setPreviewMunicipality] = useState<{ name: string; tariffs: Tariff[] } | null>(null);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [editedTariff, setEditedTariff] = useState<Tariff | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewRawData, setPreviewRawData] = useState<{ data: string[][]; rowCount: number; sheetTitle: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [highlightedTariffName, setHighlightedTariffName] = useState<string | null>(null);

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch municipalities with source_file_path and total_tariffs for accurate counts
  const { data: municipalities } = useQuery({
    queryKey: ["municipalities-with-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("id, name, source_file_path, total_tariffs, province_id");
      if (error) throw error;
      return data;
    },
  });

  // Pre-compute province-level counts from municipalities table (avoids 1000 row limit issue)
  const provinceCounts = useMemo(() => {
    if (!municipalities) return new Map<string, { municipalities: number; tariffs: number }>();
    const counts = new Map<string, { municipalities: number; tariffs: number }>();
    municipalities.forEach((m) => {
      if (!m.province_id) return;
      const current = counts.get(m.province_id) || { municipalities: 0, tariffs: 0 };
      counts.set(m.province_id, {
        municipalities: current.municipalities + 1,
        tariffs: current.tariffs + (m.total_tariffs || 0),
      });
    });
    return counts;
  }, [municipalities]);

  // Pre-compute municipality-level tariff counts
  const municipalityCounts = useMemo(() => {
    if (!municipalities) return new Map<string, number>();
    const counts = new Map<string, number>();
    municipalities.forEach((m) => {
      counts.set(m.name, m.total_tariffs || 0);
    });
    return counts;
  }, [municipalities]);

  // State for lazily loaded rates
  const [tariffRates, setTariffRates] = useState<Record<string, TariffRate[]>>({});
  const [loadingRates, setLoadingRates] = useState<Set<string>>(new Set());

  // State for lazily loaded municipality tariffs
  const [municipalityTariffs, setMunicipalityTariffs] = useState<Record<string, Tariff[]>>({});
  const [loadingMunicipalities, setLoadingMunicipalities] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Load tariffs for a specific municipality on demand
  const loadTariffsForMunicipality = async (municipalityName: string) => {
    if (municipalityTariffs[municipalityName] || loadingMunicipalities.has(municipalityName)) return;
    
    const muni = municipalities?.find(m => m.name === municipalityName);
    if (!muni) return;
    
    setLoadingMunicipalities(prev => new Set(prev).add(municipalityName));
    try {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          municipality:municipalities(name, province_id, source_file_path),
          category:tariff_categories(name)
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
        .eq("tariff_id", tariffId);
      
      if (!error && data) {
        setTariffRates(prev => ({ ...prev, [tariffId]: data }));
      }
    } finally {
      setLoadingRates(prev => {
        const next = new Set(prev);
        next.delete(tariffId);
        return next;
      });
    }
  };

  // Function to open preview with raw data fetching
  const handleOpenPreview = async (municipalityName: string, municipalityTariffs: Tariff[]) => {
    setPreviewMunicipality({ name: municipalityName, tariffs: municipalityTariffs });
    setPreviewRawData(null);
    setIsLoadingPreview(true);

    try {
      // Find the source file path for this municipality
      const muni = municipalities?.find(m => m.name.toLowerCase() === municipalityName.toLowerCase());
      
      if (muni?.source_file_path) {
        const fileType = muni.source_file_path.endsWith('.pdf') ? 'pdf' : 'xlsx';
        
        const { data, error } = await supabase.functions.invoke("process-tariff-file", {
          body: { 
            filePath: muni.source_file_path, 
            fileType,
            municipality: municipalityName,
            action: "preview" 
          },
        });

        if (!error && data && !data.error) {
          setPreviewRawData({
            data: data.data || [],
            rowCount: data.rowCount || 0,
            sheetTitle: data.sheetTitle || municipalityName
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch raw data:", err);
    } finally {
      setIsLoadingPreview(false);
    }
    };

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
        // Delete all tariff rates first using gte on uuid (matches all)
        const { error: ratesError } = await supabase
          .from("tariff_rates")
          .delete()
          .gte("id", "00000000-0000-0000-0000-000000000000");
        if (ratesError) throw ratesError;
        // Delete all tariffs
        const { error } = await supabase
          .from("tariffs")
          .delete()
          .gte("id", "00000000-0000-0000-0000-000000000000");
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
      queryClient.invalidateQueries({ queryKey: ["municipalities-with-counts"] });
      // Clear cached municipality tariffs to force reload
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

  // Group municipalities by province (no tariffs upfront - they're loaded on demand)
  const groupedData = useMemo(() => {
    if (!municipalities || !provinces) return [];

    const provinceMap = new Map<string, Province>();
    provinces.forEach((p) => provinceMap.set(p.id, p));

    const grouped: Record<string, { name: string; id: string; total_tariffs: number }[]> = {};

    municipalities.forEach((muni) => {
      if (!muni.province_id) return;
      
      if (!grouped[muni.province_id]) {
        grouped[muni.province_id] = [];
      }
      grouped[muni.province_id].push({
        name: muni.name,
        id: muni.id,
        total_tariffs: muni.total_tariffs || 0
      });
    });

    const result: GroupedData[] = [];
    Object.entries(grouped).forEach(([provinceId, muniList]) => {
      const province = provinceMap.get(provinceId);
      if (!province) return;

      const municipalityList = muniList
        .filter(m => m.total_tariffs > 0) // Only show municipalities with tariffs
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(m => ({ 
          name: m.name, 
          tariffs: municipalityTariffs[m.name] || [] 
        }));

      if (municipalityList.length > 0) {
        result.push({ province, municipalities: municipalityList });
      }
    });

    return result.sort((a, b) => a.province.name.localeCompare(b.province.name));
  }, [municipalities, provinces, municipalityTariffs]);

  // Filter grouped data by selected province and municipality
  const filteredData = useMemo(() => {
    let data = groupedData;
    
    // Filter by province
    if (selectedProvince !== "all") {
      data = data.filter((d) => d.province.id === selectedProvince);
    }
    
    // Filter by municipality if one is selected from map
    if (filterMunicipalityId) {
      data = data.map((provinceGroup) => ({
        ...provinceGroup,
        municipalities: provinceGroup.municipalities.filter((m) => 
          m.tariffs.some((t) => t.municipality_id === filterMunicipalityId)
        ),
      })).filter((d) => d.municipalities.length > 0);
    }
    
    return data;
  }, [groupedData, selectedProvince, filterMunicipalityId]);

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
        // Load rates when expanding
        loadRatesForTariff(id);
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
  
  if (!totalTariffCount) {
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
              {/* Municipality Level Accordion */}
              <Accordion type="multiple" className="space-y-2" onValueChange={(values) => {
                // Load tariffs for any newly expanded municipalities
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
                            // Load tariffs first if not loaded
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
                            No tariffs loaded. Click to expand and load tariffs.
                          </p>
                        ) : (
                        (() => {
                          // Group tariffs by family for Eskom
                          const isEskom = provinceData.province.name?.toLowerCase() === 'eskom';
                          
                          if (isEskom && municipality.tariffs.length > 5) {
                            // Eskom tariff families
                            const eskomFamilies = [
                              { prefix: 'Megaflex', label: 'Urban LPU - Megaflex' },
                              { prefix: 'Miniflex', label: 'Urban LPU - Miniflex' },
                              { prefix: 'Nightsave', label: 'Urban LPU - Nightsave' },
                              { prefix: 'Businessrate', label: 'Urban SPU - Businessrate' },
                              { prefix: 'Public Lighting', label: 'Urban SPU - Public Lighting' },
                              { prefix: 'Homepower', label: 'Residential - Homepower' },
                              { prefix: 'Homeflex', label: 'Residential - Homeflex' },
                              { prefix: 'Homelight', label: 'Residential - Homelight' },
                              { prefix: 'Ruraflex', label: 'Rural - Ruraflex' },
                              { prefix: 'Landrate', label: 'Rural - Landrate' },
                              { prefix: 'Landlight', label: 'Rural - Landlight' },
                              { prefix: 'Municflex', label: 'Municipal - Municflex' },
                              { prefix: 'Municrate', label: 'Municipal - Municrate' },
                              { prefix: 'WEPS', label: 'Wholesale - WEPS' },
                              { prefix: 'Gen', label: 'Generator Tariffs' },
                              { prefix: 'Excess', label: 'Excess NCC' },
                            ];
                            
                            // Group tariffs by family
                            const groupedTariffs: { label: string; tariffs: Tariff[] }[] = [];
                            const ungrouped: Tariff[] = [];
                            
                            eskomFamilies.forEach(family => {
                              const matching = municipality.tariffs.filter(t => 
                                t.name.toLowerCase().startsWith(family.prefix.toLowerCase())
                              );
                              if (matching.length > 0) {
                                groupedTariffs.push({ label: family.label, tariffs: matching });
                              }
                            });
                            
                            // Find any tariffs that didn't match a family
                            const matched = new Set(groupedTariffs.flatMap(g => g.tariffs.map(t => t.id)));
                            municipality.tariffs.forEach(t => {
                              if (!matched.has(t.id)) ungrouped.push(t);
                            });
                            if (ungrouped.length > 0) {
                              groupedTariffs.push({ label: 'Other', tariffs: ungrouped });
                            }
                            
                            return (
                              <Accordion type="multiple" className="space-y-2">
                                {groupedTariffs.map((group) => (
                                  <AccordionItem key={group.label} value={group.label} className="border rounded bg-muted/30">
                                    <AccordionTrigger className="px-3 py-2 hover:no-underline">
                                      <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-sm">{group.label}</span>
                                        <Badge variant="outline" className="text-xs">{group.tariffs.length}</Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-3 pb-3 space-y-2">
                                      {group.tariffs.map((tariff) => (
                                        <div key={tariff.id} className="flex items-center justify-between p-2 rounded border bg-background hover:bg-accent/20">
                                          <div className="flex items-center gap-2 flex-1" onClick={() => toggleExpanded(tariff.id)}>
                                            {expandedTariffs.has(tariff.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                            <span className="text-sm font-medium">{tariff.name}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant={tariff.tariff_type === "TOU" ? "secondary" : tariff.tariff_type === "IBT" ? "default" : "outline"} className="text-xs">
                                              {tariff.tariff_type}
                                            </Badge>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTariff.mutate(tariff.id)}>
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            );
                          }
                          
                          // Default flat list for non-Eskom
                          return municipality.tariffs.map((tariff) => (
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

                                  {/* Rates Table - lazy loaded */}
                                  {loadingRates.has(tariff.id) ? (
                                    <div className="text-xs text-muted-foreground py-2">Loading rates...</div>
                                  ) : tariffRates[tariff.id]?.length > 0 ? (
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
                                            {tariffRates[tariff.id].map((rate) => (
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
                                  ) : null}
                                </div>
                              </CollapsibleContent>
                            </div>
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

      {/* Preview Dialog - Side by Side Comparison */}
      <Dialog open={!!previewMunicipality} onOpenChange={(open) => { if (!open) { setPreviewMunicipality(null); setHighlightedTariffName(null); } }}>
        <DialogContent className="sm:max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {previewMunicipality?.name} - Side-by-Side Comparison
            </DialogTitle>
            <DialogDescription>
              Compare raw document data with extracted tariffs. Click Edit to modify values.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Left: Raw Document Data */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-2 px-3 border-b bg-muted/50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Raw Document Data
                  {previewRawData && (
                    <Badge variant="secondary" className="text-xs">{previewRawData.rowCount} rows</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center h-full py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : previewRawData && previewRawData.data.length > 0 ? (
                  <ScrollArea className="h-[55vh]">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8 text-xs sticky left-0 bg-background">#</TableHead>
                            {previewRawData.data[0]?.slice(0, 8).map((_, colIdx) => (
                              <TableHead key={colIdx} className="text-xs min-w-[80px]">
                                {colIdx + 1}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRawData.data.slice(0, 60).map((row, rowIdx) => {
                            const rowText = row.join(' ').toLowerCase();
                            const isHighlighted = highlightedTariffName && rowText.includes(highlightedTariffName.toLowerCase());
                            return (
                              <TableRow 
                                key={rowIdx} 
                                className={`${isHighlighted ? "bg-primary/20 ring-1 ring-primary" : rowIdx % 2 === 0 ? "bg-muted/30" : ""}`}
                              >
                                <TableCell className={`text-xs font-mono sticky left-0 ${isHighlighted ? "bg-primary/20 text-primary font-bold" : "bg-background text-muted-foreground"}`}>
                                  {rowIdx + 1}
                                </TableCell>
                                {row.slice(0, 8).map((cell, cellIdx) => (
                                  <TableCell key={cellIdx} className={`text-xs whitespace-nowrap p-1 ${isHighlighted ? "font-medium" : ""}`}>
                                    {cell !== null && cell !== undefined && cell !== "" ? String(cell).slice(0, 30) : "-"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground text-sm">
                    <FileSpreadsheet className="h-8 w-8 mb-2 opacity-50" />
                    <p>No source file available.</p>
                    <p className="text-xs">Re-import to enable side-by-side comparison.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: Extracted Tariffs */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-2 px-3 border-b bg-muted/50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Extracted Tariffs
                  <Badge variant="secondary" className="text-xs">{previewMunicipality?.tariffs.length || 0} tariffs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-[55vh]">
                  {previewMunicipality?.tariffs.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-8 text-muted-foreground text-sm">
                      No tariffs extracted for this municipality.
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {[...(previewMunicipality?.tariffs || [])].sort((a, b) => a.name.localeCompare(b.name)).map((tariff) => {
                        const isEditing = editingTariffId === tariff.id;
                        const displayTariff = isEditing && editedTariff ? editedTariff : tariff;
                        
                        return (
                          <Card 
                            key={tariff.id} 
                            className={`text-xs cursor-pointer transition-all ${isEditing ? "ring-2 ring-primary" : highlightedTariffName === tariff.name ? "ring-2 ring-primary bg-primary/5" : "hover:bg-accent/50"}`}
                            onClick={() => setHighlightedTariffName(highlightedTariffName === tariff.name ? null : tariff.name)}
                          >
                            <CardHeader className="py-2 px-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-sm">{tariff.name}</div>
                                  <div className="text-muted-foreground">{tariff.category?.name || "Uncategorized"}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px]">{tariff.tariff_type}</Badge>
                                  {tariff.is_prepaid && <Badge variant="secondary" className="text-[10px]">Prepaid</Badge>}
                                  {isEditing ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => {
                                          setEditingTariffId(null);
                                          setEditedTariff(null);
                                        }}
                                        disabled={isSaving}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-6 px-2 text-xs gap-1"
                                        onClick={async () => {
                                          if (!editedTariff) return;
                                          setIsSaving(true);
                                          try {
                                            const { error } = await supabase
                                              .from("tariffs")
                                              .update({
                                                fixed_monthly_charge: editedTariff.fixed_monthly_charge,
                                                demand_charge_per_kva: editedTariff.demand_charge_per_kva,
                                                phase_type: editedTariff.phase_type as any,
                                                amperage_limit: editedTariff.amperage_limit,
                                              })
                                              .eq("id", editedTariff.id);
                                            if (error) throw error;
                                            
                                            toast.success(`${editedTariff.name} updated`);
                                            queryClient.invalidateQueries({ queryKey: ["tariffs"] });
                                            setEditingTariffId(null);
                                            setEditedTariff(null);
                                          } catch (err) {
                                            toast.error("Failed to save: " + (err as Error).message);
                                          } finally {
                                            setIsSaving(false);
                                          }
                                        }}
                                        disabled={isSaving}
                                      >
                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                        Save
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs gap-1"
                                      onClick={async () => {
                                        // Load rates if not already loaded
                                        let rates = tariffRates[tariff.id];
                                        if (!rates) {
                                          const { data } = await supabase
                                            .from("tariff_rates")
                                            .select("*")
                                            .eq("tariff_id", tariff.id);
                                          rates = data || [];
                                          setTariffRates(prev => ({ ...prev, [tariff.id]: rates }));
                                        }
                                        setEditingTariffId(tariff.id);
                                        setEditedTariff({ ...tariff, rates: rates });
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="py-2 px-3 border-t space-y-2">
                              {isEditing ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Basic Charge (R/month)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-7 text-xs"
                                      value={displayTariff.fixed_monthly_charge || ""}
                                      onChange={(e) => setEditedTariff(prev => prev ? { ...prev, fixed_monthly_charge: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Demand Charge (R/kVA)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-7 text-xs"
                                      value={displayTariff.demand_charge_per_kva || ""}
                                      onChange={(e) => setEditedTariff(prev => prev ? { ...prev, demand_charge_per_kva: e.target.value ? parseFloat(e.target.value) : null } : null)}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Phase Type</Label>
                                    <Select
                                      value={displayTariff.phase_type || ""}
                                      onValueChange={(v) => setEditedTariff(prev => prev ? { ...prev, phase_type: v || null } : null)}
                                    >
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-popover">
                                        <SelectItem value="Single Phase">Single Phase</SelectItem>
                                        <SelectItem value="Three Phase">Three Phase</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-muted-foreground">Amperage Limit</Label>
                                    <Input
                                      type="text"
                                      className="h-7 text-xs"
                                      value={displayTariff.amperage_limit || ""}
                                      onChange={(e) => setEditedTariff(prev => prev ? { ...prev, amperage_limit: e.target.value || null } : null)}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    {displayTariff.fixed_monthly_charge !== null && displayTariff.fixed_monthly_charge > 0 && (
                                      <div>
                                        <span className="text-muted-foreground">Basic Charge:</span>{" "}
                                        <span className="font-medium text-primary">R{displayTariff.fixed_monthly_charge.toFixed(2)}/m</span>
                                      </div>
                                    )}
                                    {displayTariff.demand_charge_per_kva !== null && displayTariff.demand_charge_per_kva > 0 && (
                                      <div>
                                        <span className="text-muted-foreground">Demand Charge:</span>{" "}
                                        <span className="font-medium text-primary">R{displayTariff.demand_charge_per_kva.toFixed(2)}/kVA</span>
                                      </div>
                                    )}
                                    {displayTariff.phase_type && (
                                      <div>
                                        <span className="text-muted-foreground">Phase:</span> {displayTariff.phase_type}
                                      </div>
                                    )}
                                    {displayTariff.amperage_limit && (
                                      <div>
                                        <span className="text-muted-foreground">Amperage:</span> {displayTariff.amperage_limit}
                                      </div>
                                    )}
                                  </div>
                                  {displayTariff.rates && displayTariff.rates.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <div className="text-muted-foreground mb-1">Energy Rates:</div>
                                      <div className="space-y-0.5">
                                        {[...displayTariff.rates]
                                          .sort((a, b) => {
                                            // Sort IBT rates by block_start_kwh
                                            if (displayTariff.tariff_type === "IBT") {
                                              return (a.block_start_kwh ?? 0) - (b.block_start_kwh ?? 0);
                                            }
                                            return 0;
                                          })
                                          .map((rate, idx) => {
                                          // For IBT tariffs, show block range instead of "Any"
                                          const isIBT = displayTariff.tariff_type === "IBT";
                                          const hasBlockRange = rate.block_start_kwh !== null || rate.block_end_kwh !== null;
                                          
                                          let displayLabel = rate.time_of_use;
                                          if (isIBT && hasBlockRange) {
                                            const start = rate.block_start_kwh ?? 0;
                                            const end = rate.block_end_kwh;
                                            displayLabel = end !== null ? `${start}-${end} kWh` : `>${start} kWh`;
                                          } else if (rate.time_of_use === "Any" && rate.season !== "All Year") {
                                            displayLabel = rate.season;
                                          }
                                          
                                          // Add season indicator for TOU
                                          const seasonSuffix = displayTariff.tariff_type === "TOU" && rate.season !== "All Year" 
                                            ? ` (${rate.season === "High/Winter" ? "Winter" : "Summer"})` 
                                            : "";
                                          
                                          return (
                                          <div key={idx} className="flex items-center justify-between bg-muted/50 px-2 py-0.5 rounded">
                                            <span className={`font-medium ${
                                              rate.time_of_use === "High Demand" ? "text-orange-600" :
                                              rate.time_of_use === "Low Demand" ? "text-blue-600" :
                                              rate.time_of_use === "Peak" ? "text-red-600" :
                                              rate.time_of_use === "Off-Peak" ? "text-green-600" :
                                              isIBT ? "text-purple-600" :
                                              "text-foreground"
                                            }`}>
                                              {displayLabel}{seasonSuffix}
                                            </span>
                                            <span className="font-mono">{(rate.rate_per_kwh * 100).toFixed(2)} c/kWh</span>
                                          </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
