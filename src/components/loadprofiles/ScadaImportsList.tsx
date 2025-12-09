import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Trash2, Eye, Database, Calendar, MapPin, Store, Hash, 
  ChevronDown, ChevronUp, BarChart3, RefreshCw, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { LoadProfileEditor } from "./LoadProfileEditor";

// TOU period helpers
const getTOUPeriod = (hour: number, isWeekend: boolean): { name: string; color: string } => {
  if (isWeekend) {
    return { name: "Off-Peak", color: "bg-green-500/70" };
  }
  // Peak: 7-10am, 6-8pm
  if ((hour >= 7 && hour < 10) || (hour >= 18 && hour < 20)) {
    return { name: "Peak", color: "bg-red-500/70" };
  }
  // Standard: 6-7am, 10am-6pm, 8-10pm
  if ((hour >= 6 && hour < 7) || (hour >= 10 && hour < 18) || (hour >= 20 && hour < 22)) {
    return { name: "Standard", color: "bg-yellow-500/70" };
  }
  // Off-peak: 10pm-6am
  return { name: "Off-Peak", color: "bg-green-500/70" };
};

interface RawDataPoint {
  timestamp: string;
  values: Record<string, number>;
}

// Calculate profiles from raw data
function calculateProfilesFromRawData(rawData: RawDataPoint[]): { weekday: number[]; weekend: number[] } {
  const weekdayHours: number[][] = Array.from({ length: 24 }, () => []);
  const weekendHours: number[][] = Array.from({ length: 24 }, () => []);

  for (const point of rawData) {
    const date = new Date(point.timestamp);
    const hour = date.getUTCHours();
    const dayOfWeek = date.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Get the first numeric value from values object (typically P1 or power column)
    const value = Object.values(point.values).find(v => typeof v === 'number' && v > 0) || 0;
    
    if (isWeekend) {
      weekendHours[hour].push(value as number);
    } else {
      weekdayHours[hour].push(value as number);
    }
  }

  // Calculate averages for each hour
  const weekdayAvgs = weekdayHours.map(vals => vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const weekendAvgs = weekendHours.map(vals => vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);

  // Convert to percentages (sum to 100)
  const weekdayTotal = weekdayAvgs.reduce((a, b) => a + b, 0) || 1;
  const weekendTotal = weekendAvgs.reduce((a, b) => a + b, 0) || 1;

  const weekdayProfile = weekdayAvgs.map(v => Math.round((v / weekdayTotal) * 100 * 100) / 100);
  const weekendProfile = weekendAvgs.map(v => Math.round((v / weekendTotal) * 100 * 100) / 100);

  return { weekday: weekdayProfile, weekend: weekendProfile };
}

interface ScadaImport {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  file_name: string | null;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
  data_points: number;
  date_range_start: string | null;
  date_range_end: string | null;
  weekday_days: number;
  weekend_days: number;
  category_id: string | null;
  created_at: string;
  shop_type_categories?: { name: string } | null;
  raw_data?: unknown;
}

export function ScadaImportsList() {
  const queryClient = useQueryClient();
  const [selectedImport, setSelectedImport] = useState<ScadaImport | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isRecalculating, setIsRecalculating] = useState(false);

  const { data: imports, isLoading } = useQuery({
    queryKey: ["scada-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("*, shop_type_categories(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ScadaImport[];
    },
  });

  // Check if any imports need profile recalculation
  const importsNeedingRecalc = imports?.filter(imp => {
    if (!imp.load_profile_weekday || !imp.load_profile_weekend) return true;
    // Check if all values are the same (default 4.17)
    const allSameWeekday = imp.load_profile_weekday.every(v => v === imp.load_profile_weekday[0]);
    const allSameWeekend = imp.load_profile_weekend.every(v => v === imp.load_profile_weekend[0]);
    return allSameWeekday && allSameWeekend;
  }) || [];

  const recalculateAllProfiles = async () => {
    if (importsNeedingRecalc.length === 0) {
      toast.info("All imports already have calculated profiles");
      return;
    }

    setIsRecalculating(true);
    let updated = 0;
    let failed = 0;

    for (const imp of importsNeedingRecalc) {
      if (!imp.raw_data || !Array.isArray(imp.raw_data) || imp.raw_data.length === 0) {
        failed++;
        continue;
      }

      try {
        const { weekday, weekend } = calculateProfilesFromRawData(imp.raw_data as RawDataPoint[]);
        
        const { error } = await supabase
          .from("scada_imports")
          .update({
            load_profile_weekday: weekday,
            load_profile_weekend: weekend,
          })
          .eq("id", imp.id);

        if (error) throw error;
        updated++;
      } catch (err) {
        console.error(`Failed to update ${imp.site_name}:`, err);
        failed++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
    toast.success(`Recalculated ${updated} profiles${failed > 0 ? `, ${failed} failed` : ""}`);
    setIsRecalculating(false);
  };

  const deleteImport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scada_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      toast.success("Import deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading imports...</div>
        </CardContent>
      </Card>
    );
  }

  if (!imports || imports.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No SCADA imports yet</h3>
          <p className="text-muted-foreground text-center max-w-sm mt-1">
            Use the SCADA Import tab to upload meter data files.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Saved SCADA Imports
              </CardTitle>
              <CardDescription>
                {imports.length} import{imports.length !== 1 ? 's' : ''} in the global reference library
              </CardDescription>
            </div>
            {importsNeedingRecalc.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={recalculateAllProfiles}
                disabled={isRecalculating}
              >
                {isRecalculating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Recalculate {importsNeedingRecalc.length} Profile{importsNeedingRecalc.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Site Name</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Data Range</TableHead>
                <TableHead>Readings</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((imp) => (
                <>
                  <TableRow key={imp.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => toggleRowExpanded(imp.id)}>
                      {expandedRows.has(imp.id) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpanded(imp.id)}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{imp.site_name}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpanded(imp.id)}>
                      {imp.shop_number || imp.shop_name ? (
                        <div className="flex flex-col gap-0.5">
                          {imp.shop_number && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Hash className="h-3 w-3" />
                              {imp.shop_number}
                            </div>
                          )}
                          {imp.shop_name && (
                            <div className="flex items-center gap-1">
                              <Store className="h-3 w-3 text-muted-foreground" />
                              {imp.shop_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpanded(imp.id)}>
                      {imp.shop_type_categories?.name ? (
                        <Badge variant="secondary">{imp.shop_type_categories.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpanded(imp.id)}>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(imp.date_range_start)} — {formatDate(imp.date_range_end)}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpanded(imp.id)}>
                      <div className="text-sm">
                        {imp.data_points.toLocaleString()}
                        <span className="text-muted-foreground text-xs ml-1">
                          ({imp.weekday_days}wd/{imp.weekend_days}we)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => toggleRowExpanded(imp.id)}>
                      <span className="text-sm text-muted-foreground">
                        {new Date(imp.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedImport(imp)}
                          title="View profile"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this import?")) {
                              deleteImport.mutate(imp.id);
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded row with mini profile chart */}
                  {expandedRows.has(imp.id) && (
                    <TableRow key={`${imp.id}-expanded`}>
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        <TooltipProvider delayDuration={0}>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Weekday Profile
                              </h4>
                              {(() => {
                                const maxVal = Math.max(...(imp.load_profile_weekday || [1]));
                                return (
                                  <div className="h-24 flex items-end gap-0.5">
                                    {imp.load_profile_weekday?.map((val, idx) => {
                                      const tou = getTOUPeriod(idx, false);
                                      return (
                                        <Tooltip key={idx}>
                                          <TooltipTrigger asChild>
                                            <div
                                              className={`flex-1 rounded-t cursor-pointer hover:opacity-80 transition-opacity ${tou.color}`}
                                              style={{ height: `${(val / maxVal) * 100}%` }}
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            <div className="font-medium">{idx}:00 - {idx + 1}:00</div>
                                            <div>{val.toFixed(2)}% of daily load</div>
                                            <div className="text-muted-foreground">{tou.name} period</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>0h</span>
                                <span>12h</span>
                                <span>24h</span>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Weekend Profile
                              </h4>
                              {(() => {
                                const maxVal = Math.max(...(imp.load_profile_weekend || [1]));
                                return (
                                  <div className="h-24 flex items-end gap-0.5">
                                    {imp.load_profile_weekend?.map((val, idx) => {
                                      const tou = getTOUPeriod(idx, true);
                                      return (
                                        <Tooltip key={idx}>
                                          <TooltipTrigger asChild>
                                            <div
                                              className={`flex-1 rounded-t cursor-pointer hover:opacity-80 transition-opacity ${tou.color}`}
                                              style={{ height: `${(val / maxVal) * 100}%` }}
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            <div className="font-medium">{idx}:00 - {idx + 1}:00</div>
                                            <div>{val.toFixed(2)}% of daily load</div>
                                            <div className="text-muted-foreground">{tou.name} period</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>0h</span>
                                <span>12h</span>
                                <span>24h</span>
                              </div>
                            </div>
                          </div>
                        </TooltipProvider>
                        {/* TOU Legend */}
                        <div className="flex gap-4 mt-3 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-red-500/70" />
                            <span className="text-muted-foreground">Peak</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-yellow-500/70" />
                            <span className="text-muted-foreground">Standard</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-green-500/70" />
                            <span className="text-muted-foreground">Off-Peak</span>
                          </div>
                        </div>
                        {imp.file_name && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Source file: {imp.file_name}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedImport} onOpenChange={(open) => !open && setSelectedImport(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedImport?.site_name}</DialogTitle>
            <DialogDescription>
              {selectedImport?.shop_number && `#${selectedImport.shop_number}`}
              {selectedImport?.shop_number && selectedImport?.shop_name && " - "}
              {selectedImport?.shop_name}
              {!selectedImport?.shop_number && !selectedImport?.shop_name && "SCADA Import Details"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedImport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Date Range</div>
                  <div className="font-medium">
                    {formatDate(selectedImport.date_range_start)} — {formatDate(selectedImport.date_range_end)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Total Readings</div>
                  <div className="font-medium">{selectedImport.data_points.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Weekdays</div>
                  <div className="font-medium">{selectedImport.weekday_days} days</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Weekends</div>
                  <div className="font-medium">{selectedImport.weekend_days} days</div>
                </div>
              </div>

              <LoadProfileEditor
                weekdayProfile={selectedImport.load_profile_weekday || []}
                weekendProfile={selectedImport.load_profile_weekend || []}
                onWeekdayChange={() => {}}
                onWeekendChange={() => {}}
                readOnly
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}