import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, Edit2, Trash2, Tag, Palette, Hash, Store, Ruler, Search, X, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ScadaImport {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  area_sqm: number | null;
  meter_label: string | null;
  meter_color: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  data_points: number | null;
  created_at: string;
}

const METER_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

interface MeterLibraryProps {
  siteId?: string | null;
}

export function MeterLibrary({ siteId }: MeterLibraryProps) {
  const queryClient = useQueryClient();
  const [editingMeter, setEditingMeter] = useState<ScadaImport | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [editShopNumber, setEditShopNumber] = useState("");
  const [editShopName, setEditShopName] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editSiteName, setEditSiteName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: meters, isLoading } = useQuery({
    queryKey: ["meter-library", siteId],
    queryFn: async () => {
      let query = supabase
        .from("scada_imports")
        .select("id, site_name, site_id, shop_number, shop_name, area_sqm, meter_label, meter_color, date_range_start, date_range_end, data_points, created_at")
        .order("created_at", { ascending: false });
      
      if (siteId) {
        query = query.eq("site_id", siteId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ScadaImport[];
    },
  });
  const updateMeter = useMutation({
    mutationFn: async (params: { id: string; meter_label: string; meter_color: string; shop_number: string | null; shop_name: string | null; area_sqm: number | null; site_name: string }) => {
      const { error } = await supabase
        .from("scada_imports")
        .update({
          meter_label: params.meter_label || null,
          meter_color: params.meter_color,
          shop_number: params.shop_number || null,
          shop_name: params.shop_name || null,
          area_sqm: params.area_sqm,
          site_name: params.site_name,
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      toast.success("Meter updated");
      setDialogOpen(false);
      setEditingMeter(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scada_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      toast.success("Meter deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkDeleteMeters = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("scada_imports").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} meters deleted`);
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMeters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMeters.map(m => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} meter(s)?`)) {
      bulkDeleteMeters.mutate(Array.from(selectedIds));
    }
  };

  const openEditDialog = (meter: ScadaImport) => {
    setEditingMeter(meter);
    setEditLabel(meter.meter_label || "");
    setEditColor(meter.meter_color || "#3b82f6");
    setEditShopNumber(meter.shop_number || "");
    setEditShopName(meter.shop_name || "");
    setEditArea(meter.area_sqm?.toString() || "");
    setEditSiteName(meter.site_name || "");
    setDialogOpen(true);
  };

  const getMeterDisplayName = (meter: ScadaImport) => {
    if (meter.meter_label) return meter.meter_label;
    if (meter.shop_name) return `${meter.shop_name} - ${meter.site_name}`;
    if (meter.shop_number) return `${meter.shop_number} - ${meter.site_name}`;
    return meter.site_name;
  };

  // Get unique site names for filter
  const uniqueSites = useMemo(() => {
    if (!meters) return [];
    const sites = meters.map(m => m.site_name).filter(Boolean);
    return [...new Set(sites)].sort();
  }, [meters]);

  // Filter and sort meters
  const filteredMeters = useMemo(() => {
    if (!meters) return [];
    
    // First filter
    const filtered = meters.filter(meter => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        meter.site_name?.toLowerCase().includes(searchLower) ||
        meter.shop_name?.toLowerCase().includes(searchLower) ||
        meter.shop_number?.toLowerCase().includes(searchLower) ||
        meter.meter_label?.toLowerCase().includes(searchLower);
      
      // Site filter
      const matchesSite = siteFilter === "all" || meter.site_name === siteFilter;
      
      return matchesSearch && matchesSite;
    });
    
    // Then sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return getMeterDisplayName(a).localeCompare(getMeterDisplayName(b));
        case "name-desc":
          return getMeterDisplayName(b).localeCompare(getMeterDisplayName(a));
        case "date-asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "date-desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "area-asc":
          return (a.area_sqm || 0) - (b.area_sqm || 0);
        case "area-desc":
          return (b.area_sqm || 0) - (a.area_sqm || 0);
        case "points-desc":
          return (b.data_points || 0) - (a.data_points || 0);
        case "points-asc":
          return (a.data_points || 0) - (b.data_points || 0);
        default:
          return 0;
      }
    });
  }, [meters, searchQuery, siteFilter, sortBy]);

  const hasActiveFilters = searchQuery || siteFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSiteFilter("all");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading meter library...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Meter Library
          </CardTitle>
          <CardDescription>
            Global reference meters - used to build project load profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search meters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {uniqueSites.map(site => (
                  <SelectItem key={site} value={site}>{site}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="name-desc">Name Z-A</SelectItem>
                <SelectItem value="area-desc">Largest Area</SelectItem>
                <SelectItem value="area-asc">Smallest Area</SelectItem>
                <SelectItem value="points-desc">Most Data</SelectItem>
                <SelectItem value="points-asc">Least Data</SelectItem>
              </SelectContent>
            </Select>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                disabled={bulkDeleteMeters.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete {selectedIds.size} selected
              </Button>
            )}
          </div>

          {!meters?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No meters imported yet</p>
              <p className="text-sm">Use the "New SCADA Import" tab to add meters</p>
            </div>
          ) : filteredMeters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No meters match your filters</p>
              <Button variant="link" onClick={clearFilters}>Clear filters</Button>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Showing {filteredMeters.length} of {meters.length} meters
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredMeters.length > 0 && selectedIds.size === filteredMeters.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-8">Color</TableHead>
                    <TableHead>Meter / Label</TableHead>
                    <TableHead>Area (m²)</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeters.map(meter => (
                    <TableRow key={meter.id} className={selectedIds.has(meter.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(meter.id)}
                          onCheckedChange={() => toggleSelect(meter.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: meter.meter_color || "#3b82f6" }}
                        />
                      </TableCell>
                      <TableCell>
                      <div>
                        <div className="font-medium">{getMeterDisplayName(meter)}</div>
                        {meter.meter_label && (
                          <div className="text-xs text-muted-foreground">
                            {meter.shop_name || meter.shop_number || meter.site_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {meter.area_sqm ? (
                        <span className="text-sm">{meter.area_sqm.toLocaleString()} m²</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {meter.date_range_start && meter.date_range_end ? (
                        <span className="text-sm">
                          {format(new Date(meter.date_range_start), "MMM d")} - {format(new Date(meter.date_range_end), "MMM d, yyyy")}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {meter.data_points?.toLocaleString() || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(meter)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this meter?")) {
                              deleteMeter.mutate(meter.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Meter</DialogTitle>
            <DialogDescription>
              Update meter details for the reference library
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Site Name
              </Label>
              <Input
                placeholder="e.g., Mall of Africa, Sandton City"
                value={editSiteName}
                onChange={(e) => setEditSiteName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Shop Number
                </Label>
                <Input
                  placeholder="e.g., 101, A12"
                  value={editShopNumber}
                  onChange={(e) => setEditShopNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Shop Name
                </Label>
                <Input
                  placeholder="e.g., Pick n Pay, Woolworths"
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Area (m²)
              </Label>
              <Input
                type="number"
                placeholder="e.g., 250"
                value={editArea}
                onChange={(e) => setEditArea(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Custom Label
              </Label>
              <Input
                placeholder="e.g., Main Incomer, Tenant A"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Chart Color
              </Label>
              <div className="flex gap-2 flex-wrap">
                {METER_COLORS.map(color => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      editColor === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (editingMeter && editSiteName.trim()) {
                  updateMeter.mutate({
                    id: editingMeter.id,
                    meter_label: editLabel,
                    meter_color: editColor,
                    shop_number: editShopNumber || null,
                    shop_name: editShopName || null,
                    area_sqm: editArea ? parseFloat(editArea) : null,
                    site_name: editSiteName.trim(),
                  });
                }
              }}
              disabled={!editSiteName.trim()}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
