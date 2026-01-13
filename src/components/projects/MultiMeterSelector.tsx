import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, X, Layers, Database, BarChart3, Trash2, Scale } from "lucide-react";
import { toast } from "sonner";

interface ScadaImport {
  id: string;
  shop_name: string | null;
  site_name: string;
  area_sqm: number | null;
  data_points: number | null;
  load_profile_weekday: number[] | null;
  load_profile_weekend: number[] | null;
}

interface TenantMeter {
  id: string;
  scada_import_id: string;
  weight: number;
  scada_imports?: ScadaImport;
}

interface MultiMeterSelectorProps {
  tenantId: string;
  tenantName: string;
  tenantArea: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableMeters: ScadaImport[];
}

function formatMeterName(meter: ScadaImport): string {
  const name = meter.shop_name || meter.site_name || "Unknown";
  const area = meter.area_sqm ? `${Math.round(meter.area_sqm)} m²` : "No area";
  return `${name} (${area})`;
}

function formatDataPoints(points: number | null | undefined): string {
  if (!points) return "0";
  if (points >= 1_000_000) return (points / 1_000_000).toFixed(1) + "M";
  if (points >= 1_000) return (points / 1_000).toFixed(1) + "K";
  return points.toLocaleString();
}

function calculateAveragedProfile(meters: TenantMeter[]): number[] | null {
  const validMeters = meters.filter(m => m.scada_imports?.load_profile_weekday?.length === 24);
  if (validMeters.length === 0) return null;
  
  const totalWeight = validMeters.reduce((sum, m) => sum + (m.weight || 1), 0);
  const averaged: number[] = Array(24).fill(0);
  
  for (const meter of validMeters) {
    const profile = meter.scada_imports!.load_profile_weekday!;
    const weight = (meter.weight || 1) / totalWeight;
    for (let h = 0; h < 24; h++) {
      averaged[h] += profile[h] * weight;
    }
  }
  
  return averaged;
}

export function MultiMeterSelector({
  tenantId,
  tenantName,
  tenantArea,
  open,
  onOpenChange,
  availableMeters,
}: MultiMeterSelectorProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch assigned meters for this tenant
  const { data: assignedMeters = [], isLoading } = useQuery({
    queryKey: ["tenant-meters", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tenant_meters")
        .select("id, scada_import_id, weight, scada_imports:scada_import_id(id, shop_name, site_name, area_sqm, data_points, load_profile_weekday, load_profile_weekend)")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return (data || []) as TenantMeter[];
    },
    enabled: open,
  });

  const addMeter = useMutation({
    mutationFn: async (scadaImportId: string) => {
      const { error } = await supabase
        .from("project_tenant_meters")
        .insert({ tenant_id: tenantId, scada_import_id: scadaImportId, weight: 1.0 });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-meters", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-meter-counts"] });
      toast.success("Meter added");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_tenant_meters")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-meters", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-meter-counts"] });
      toast.success("Meter removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeAllMeters = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_tenant_meters")
        .delete()
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-meters", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-meter-counts"] });
      toast.success("All meters removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateWeight = useMutation({
    mutationFn: async ({ meterId, weight }: { meterId: string; weight: number }) => {
      const { error } = await supabase
        .from("project_tenant_meters")
        .update({ weight })
        .eq("id", meterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-meters", tenantId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const assignedIds = useMemo(() => 
    new Set(assignedMeters.map(m => m.scada_import_id)), 
    [assignedMeters]
  );

  const filteredMeters = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return availableMeters.filter(m => {
      const name = (m.shop_name || m.site_name || "").toLowerCase();
      return name.includes(query);
    }).sort((a, b) => {
      // Sort by area similarity
      const aDiff = Math.abs((a.area_sqm || 0) - tenantArea);
      const bDiff = Math.abs((b.area_sqm || 0) - tenantArea);
      return aDiff - bDiff;
    });
  }, [availableMeters, searchQuery, tenantArea]);

  const averagedProfile = useMemo(() => 
    calculateAveragedProfile(assignedMeters), 
    [assignedMeters]
  );

  const avgDailyKwh = averagedProfile 
    ? averagedProfile.reduce((sum, v) => sum + v, 0)
    : 0;

  // Calculate accumulative stats
  const accumulativeStats = useMemo(() => {
    const totalDataPoints = assignedMeters.reduce(
      (sum, m) => sum + (m.scada_imports?.data_points || 0),
      0
    );
    const totalArea = assignedMeters.reduce(
      (sum, m) => sum + (m.scada_imports?.area_sqm || 0),
      0
    );
    const metersWithData = assignedMeters.filter(
      m => m.scada_imports?.data_points && m.scada_imports.data_points > 0
    ).length;
    return { totalDataPoints, totalArea, metersWithData };
  }, [assignedMeters]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Multi-Meter Profile for {tenantName}
          </DialogTitle>
          <DialogDescription>
            Select multiple meters to create an averaged load profile. 
            This combines data from similar shops to improve accuracy.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Assigned Meters Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Assigned Meters ({assignedMeters.length})
              </h4>
              {assignedMeters.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {formatDataPoints(accumulativeStats.totalDataPoints)} data points
                    </span>
                    <span>
                      {accumulativeStats.metersWithData}/{assignedMeters.length} with data
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-7"
                    onClick={() => removeAllMeters.mutate()}
                    disabled={removeAllMeters.isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove All
                  </Button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground p-4 text-center border rounded-md bg-muted/20">
                Loading assigned meters...
              </div>
            ) : assignedMeters.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center border rounded-md bg-muted/20">
                No meters assigned. Select meters below to build an averaged profile.
              </div>
            ) : (
              <ScrollArea className="h-[200px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meter</TableHead>
                      <TableHead className="text-right">Data Points</TableHead>
                      <TableHead className="text-right">Daily kWh</TableHead>
                      <TableHead className="w-[100px]">
                        <div className="flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          Scale
                        </div>
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedMeters.map((meter) => {
                      const dailyKwh = meter.scada_imports?.load_profile_weekday
                        ? meter.scada_imports.load_profile_weekday.reduce((s, v) => s + v, 0)
                        : 0;
                      return (
                        <TableRow key={meter.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">
                                {meter.scada_imports?.shop_name || "Unnamed"}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {meter.scada_imports?.site_name || ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={meter.scada_imports?.data_points ? "secondary" : "outline"}
                              className="font-mono text-xs"
                            >
                              {formatDataPoints(meter.scada_imports?.data_points)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {dailyKwh > 0 ? `${Math.round(dailyKwh)}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0.1}
                              max={10}
                              step={0.1}
                              value={meter.weight}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                  updateWeight.mutate({ meterId: meter.id, weight: value });
                                }
                              }}
                              className="h-7 w-16 text-center font-mono text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeMeter.mutate(meter.id)}
                              disabled={removeMeter.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {/* Summary stats card */}
            {assignedMeters.length > 0 && (
              <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-2">Averaged Profile Summary</p>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Meters:</span>{" "}
                    <span className="font-medium">{assignedMeters.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Daily:</span>{" "}
                    <span className="font-medium">{Math.round(avgDailyKwh)} kWh</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Monthly:</span>{" "}
                    <span className="font-medium">{Math.round(avgDailyKwh * 30).toLocaleString()} kWh</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Data:</span>{" "}
                    <span className="font-medium">{formatDataPoints(accumulativeStats.totalDataPoints)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Available Meters Section */}
          <div className="flex flex-col min-h-0 flex-1">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Available Meters ({filteredMeters.length})
            </h4>
            <Command className="border rounded-md flex-1">
              <CommandInput 
                placeholder="Search meters by name or site..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList className="max-h-[200px]">
                <CommandEmpty>No meters found.</CommandEmpty>
                <CommandGroup>
                  {filteredMeters.map((meter) => {
                    const isAssigned = assignedIds.has(meter.id);
                    const dailyKwh = meter.load_profile_weekday
                      ? meter.load_profile_weekday.reduce((s, v) => s + v, 0)
                      : 0;
                    return (
                      <CommandItem
                        key={meter.id}
                        value={`${meter.shop_name || ""} ${meter.site_name || ""}`}
                        onSelect={() => {
                          if (!isAssigned) {
                            addMeter.mutate(meter.id);
                          }
                        }}
                        disabled={isAssigned}
                        className="flex items-center gap-2"
                      >
                        <Checkbox 
                          checked={isAssigned} 
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <span className={isAssigned ? "text-muted-foreground" : ""}>
                            {formatMeterName(meter)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <Badge 
                            variant={meter.data_points ? "secondary" : "outline"} 
                            className="text-xs font-mono"
                          >
                            {formatDataPoints(meter.data_points)}
                          </Badge>
                          {dailyKwh > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(dailyKwh)} kWh/day
                            </Badge>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to get averaged profile for a tenant
export function useAveragedProfile(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: ["tenant-meters", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tenant_meters")
        .select("id, scada_import_id, weight, scada_imports:scada_import_id(id, shop_name, site_name, area_sqm, data_points, load_profile_weekday, load_profile_weekend)")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data as TenantMeter[];
    },
    enabled,
  });
}

// Utility to calculate averaged weekday/weekend profiles
export function calculateAveragedProfiles(meters: TenantMeter[]): {
  weekday: number[] | null;
  weekend: number[] | null;
} {
  const validMetersWeekday = meters.filter(m => 
    (m.scada_imports as any)?.load_profile_weekday?.length === 24
  );
  const validMetersWeekend = meters.filter(m => 
    (m.scada_imports as any)?.load_profile_weekend?.length === 24
  );
  
  const averageProfile = (validMeters: TenantMeter[], profileKey: 'load_profile_weekday' | 'load_profile_weekend'): number[] | null => {
    if (validMeters.length === 0) return null;
    const totalWeight = validMeters.reduce((sum, m) => sum + (m.weight || 1), 0);
    const averaged: number[] = Array(24).fill(0);
    
    for (const meter of validMeters) {
      const profile = (meter.scada_imports as any)?.[profileKey] as number[];
      if (!profile) continue;
      const weight = (meter.weight || 1) / totalWeight;
      for (let h = 0; h < 24; h++) {
        averaged[h] += profile[h] * weight;
      }
    }
    return averaged;
  };
  
  return {
    weekday: averageProfile(validMetersWeekday, 'load_profile_weekday'),
    weekend: averageProfile(validMetersWeekend, 'load_profile_weekend'),
  };
}
