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
import { Database, Edit2, Trash2, Tag, Palette, Hash, Store, Ruler, Search, X, ArrowUpDown, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { processCSVToLoadProfile } from "./utils/csvToLoadProfile";
import { WizardParseConfig, ColumnConfig } from "./types/csvImportTypes";

interface RawDataStats {
  csvContent?: string;
  totalKwh?: number;
  avgDailyKwh?: number;
  peakKw?: number;
  avgKw?: number;
  dataPoints?: number;
}

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
  raw_data: RawDataStats[] | null;
  load_profile_weekday: number[] | null;
  weekday_days: number | null;
  weekend_days: number | null;
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
        .select("id, site_name, site_id, shop_number, shop_name, area_sqm, meter_label, meter_color, date_range_start, date_range_end, data_points, created_at, raw_data, load_profile_weekday, weekday_days, weekend_days")
        .order("created_at", { ascending: false });
      
      if (siteId) {
        query = query.eq("site_id", siteId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(row => ({
        ...row,
        raw_data: row.raw_data as RawDataStats[] | null
      })) as ScadaImport[];
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

  // Re-process meters from stored CSV content - fetches one at a time to avoid timeout
  const reprocessMeters = useMutation({
    mutationFn: async (meterIds: string[]) => {
      if (!meterIds.length) throw new Error("No meters to process");

      let processed = 0;
      let failed = 0;
      let skipped = 0;

      for (const meterId of meterIds) {
        try {
          // Fetch one meter at a time to avoid timeout with large raw_data
          const { data: meter, error: fetchError } = await supabase
            .from("scada_imports")
            .select("id, raw_data, shop_name")
            .eq("id", meterId)
            .single();

          if (fetchError) {
            console.error(`Failed to fetch meter ${meterId}:`, fetchError);
            failed++;
            continue;
          }

          // Extract CSV content from raw_data
          const rawData = meter.raw_data as { csvContent?: string }[] | null;
          const csvContent = rawData?.[0]?.csvContent;

          if (!csvContent) {
            console.warn(`Meter ${meter.shop_name || meter.id} has no CSV content to reprocess`);
            skipped++;
            continue;
          }

          // Auto-parse the CSV
          const lines = csvContent.split('\n').filter((l: string) => l.trim());
          let isPnPScada = false;
          let meterName: string | undefined;
          let dateRange: { start: string; end: string } | undefined;
          let startRow = 1;

          // Check for PnP SCADA format
          if (lines.length >= 2) {
            const firstLine = lines[0];
            const meterMatch = firstLine.match(/^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/);
            const secondLine = lines[1]?.toLowerCase() || "";
            const hasScadaHeaders = secondLine.includes('rdate') && secondLine.includes('rtime') && secondLine.includes('kwh');
            
            if (meterMatch && hasScadaHeaders) {
              isPnPScada = true;
              meterName = meterMatch[1];
              dateRange = { start: meterMatch[2], end: meterMatch[3] };
              startRow = 2;
            }
          }

          // Auto-detect delimiter
          const sampleLine = lines[startRow - 1] || lines[0] || "";
          const tabCount = (sampleLine.match(/\t/g) || []).length;
          const semicolonCount = (sampleLine.match(/;/g) || []).length;
          const commaCount = (sampleLine.match(/,/g) || []).length;

          const delimiters = {
            tab: tabCount > 0,
            semicolon: semicolonCount > 0,
            comma: commaCount > 0 || (tabCount === 0 && semicolonCount === 0),
            space: false,
            other: false,
            otherChar: "",
          };

          // Build set of delimiter characters
          const delimChars = new Set<string>();
          if (delimiters.tab) delimChars.add('\t');
          if (delimiters.semicolon) delimChars.add(';');
          if (delimiters.comma) delimChars.add(',');
          if (delimChars.size === 0) delimChars.add(',');

          const parseRow = (line: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"' && !inQuotes) {
                inQuotes = true;
              } else if (char === '"' && inQuotes) {
                if (line[i + 1] === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = false;
                }
              } else if (!inQuotes && delimChars.has(char)) {
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const headerIdx = startRow - 1;
          const headers = headerIdx < lines.length ? parseRow(lines[headerIdx]) : [];
          const rows = lines.slice(headerIdx + 1).map(parseRow);

          // Auto-detect column types
          const columns: ColumnConfig[] = headers.map((header, idx) => {
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('date') || lowerHeader.includes('rdate')) {
              return { index: idx, name: header, dataType: 'date' as const, dateFormat: 'YMD' };
            } else if (lowerHeader.includes('kwh') || lowerHeader.includes('energy') || lowerHeader.includes('consumption')) {
              return { index: idx, name: header, dataType: 'general' as const };
            }
            return { index: idx, name: header, dataType: 'text' as const };
          });

          const parseConfig: WizardParseConfig = {
            fileType: "delimited",
            startRow,
            delimiters,
            treatConsecutiveAsOne: false,
            textQualifier: '"',
            columns,
            detectedFormat: isPnPScada ? "pnp-scada" : undefined,
          };

          // Process into load profile
          console.log(`[Reprocess] ${meter.shop_name || meterId}: Detected ${headers.length} columns, ${rows.length} rows`);
          console.log(`[Reprocess] Headers:`, headers);
          console.log(`[Reprocess] Columns config:`, columns.map(c => `${c.name}:${c.dataType}`).join(', '));
          
          const profile = processCSVToLoadProfile(headers, rows, parseConfig);

          // Validation check - if profile has zeros, something went wrong
          if (profile.dataPoints === 0 || profile.totalKwh === 0) {
            console.warn(`[Reprocess] ${meter.shop_name || meterId}: Profile empty! dataPoints=${profile.dataPoints}, totalKwh=${profile.totalKwh}`);
            console.warn(`[Reprocess] Sample row:`, rows[0]);
          } else {
            console.log(`[Reprocess] ${meter.shop_name || meterId}: SUCCESS - ${profile.dataPoints} points, ${profile.totalKwh.toFixed(1)} total kWh, peak ${profile.peakKw.toFixed(1)} kW`);
          }

          // Calculate stats
          const dateRangeStart = profile.dateRangeStart || dateRange?.start || null;
          const dateRangeEnd = profile.dateRangeEnd || dateRange?.end || null;
          const totalDays = Math.max(1, profile.weekdayDays + profile.weekendDays);
          const avgDailyKwh = profile.totalKwh / totalDays;

          // Build new raw_data with stats
          const newRawData = [{
            csvContent,
            totalKwh: profile.totalKwh,
            avgDailyKwh,
            peakKw: profile.peakKw,
            avgKw: profile.avgKw,
            dataPoints: profile.dataPoints,
            dateStart: dateRangeStart,
            dateEnd: dateRangeEnd,
          }];

          // Update the meter
          const { error: updateError } = await supabase
            .from("scada_imports")
            .update({
              raw_data: newRawData,
              data_points: profile.dataPoints,
              load_profile_weekday: profile.weekdayProfile,
              load_profile_weekend: profile.weekendProfile,
              weekday_days: profile.weekdayDays,
              weekend_days: profile.weekendDays,
              date_range_start: dateRangeStart,
              date_range_end: dateRangeEnd,
            })
            .eq("id", meter.id);

          if (updateError) {
            console.error(`Failed to update meter ${meter.id}:`, updateError);
            failed++;
          } else {
            processed++;
            console.log(`Reprocessed ${meter.shop_name || meter.id}: ${profile.dataPoints} points, peak ${profile.peakKw} kW, avg daily ${avgDailyKwh.toFixed(1)} kWh`);
          }
        } catch (err) {
          console.error(`Error processing meter ${meterId}:`, err);
          failed++;
        }
      }

      return { processed, failed, skipped };
    },
    onSuccess: ({ processed, failed, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      if (failed > 0 || skipped > 0) {
        toast.warning(`Reprocessed ${processed} meters, ${skipped} skipped (no CSV), ${failed} failed`);
      } else {
        toast.success(`Reprocessed ${processed} meters successfully`);
      }
    },
    onError: (error) => toast.error(`Reprocess failed: ${error.message}`),
  });

  const handleReprocessSelected = () => {
    if (selectedIds.size === 0) {
      toast.error("No meters selected");
      return;
    }
    reprocessMeters.mutate(Array.from(selectedIds));
  };

  const handleReprocessAll = () => {
    if (!filteredMeters.length) {
      toast.error("No meters to reprocess");
      return;
    }
    if (confirm(`Reprocess ${filteredMeters.length} meter(s) from stored CSV data? This will recalculate all load profiles.`)) {
      reprocessMeters.mutate(filteredMeters.map(m => m.id));
    }
  };

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
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReprocessSelected}
                  disabled={reprocessMeters.isPending}
                >
                  {reprocessMeters.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Reprocess {selectedIds.size} selected
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMeters.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete {selectedIds.size} selected
                </Button>
              </>
            )}
            
            {/* Re-process All button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReprocessAll}
              disabled={reprocessMeters.isPending || !meters?.length}
            >
              {reprocessMeters.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Re-process All
            </Button>
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
                    <TableHead>Days (WD/WE)</TableHead>
                    <TableHead>Peak kW</TableHead>
                    <TableHead>Avg Daily kWh</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead>CSV</TableHead>
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
                      {(meter.weekday_days || meter.weekend_days) ? (
                        <span className="text-sm font-mono">
                          {meter.weekday_days || 0}/{meter.weekend_days || 0}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const peakKw = meter.raw_data?.[0]?.peakKw;
                        // Fallback: calculate from load profile if raw_data doesn't have it
                        const profilePeak = meter.load_profile_weekday 
                          ? Math.max(...meter.load_profile_weekday, 0)
                          : 0;
                        const displayPeak = peakKw || profilePeak;
                        return displayPeak > 0 ? (
                          <span className="text-sm font-mono">{displayPeak.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const avgDaily = meter.raw_data?.[0]?.avgDailyKwh;
                        return avgDaily && avgDaily > 0 ? (
                          <span className="text-sm font-mono">{avgDaily.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {meter.data_points?.toLocaleString() || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {meter.raw_data?.[0]?.csvContent ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
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
