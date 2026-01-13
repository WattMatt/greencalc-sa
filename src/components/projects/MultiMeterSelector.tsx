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
  // Single assigned profile from project_tenants.scada_import_id
  singleProfileId?: string | null;
  onClearSingleProfile?: () => void;
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

// Calculate auto-scale factor: tenantArea / meterArea
// If meter has no area, assume it's the same as tenant (scale = 1)
function calculateAutoScale(meterArea: number | null, tenantArea: number): number {
  if (!meterArea || meterArea <= 0 || !tenantArea || tenantArea <= 0) {
    return 1; // If no area available, assume same area
  }
  return tenantArea / meterArea;
}

function calculateAveragedProfile(
  meters: TenantMeter[], 
  tenantArea: number,
  singleProfile?: ScadaImport | null
): number[] | null {
  // Combine meters with single profile if present
  const allProfiles: { profile: number[]; scale: number }[] = [];
  
  // Add single profile first
  if (singleProfile?.load_profile_weekday?.length === 24) {
    const scale = calculateAutoScale(singleProfile.area_sqm, tenantArea);
    allProfiles.push({ profile: singleProfile.load_profile_weekday, scale });
  }
  
  // Add multi-meter profiles
  for (const m of meters) {
    if (m.scada_imports?.load_profile_weekday?.length === 24) {
      const scale = calculateAutoScale(m.scada_imports.area_sqm, tenantArea);
      allProfiles.push({ profile: m.scada_imports.load_profile_weekday, scale });
    }
  }
  
  if (allProfiles.length === 0) return null;
  
  // Average the scaled profiles
  const averaged: number[] = Array(24).fill(0);
  for (const { profile, scale } of allProfiles) {
    for (let h = 0; h < 24; h++) {
      averaged[h] += (profile[h] * scale) / allProfiles.length;
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
  singleProfileId,
  onClearSingleProfile,
}: MultiMeterSelectorProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch assigned meters for this tenant (from junction table)
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

  // Get the single profile data if assigned via dropdown
  const singleProfile = useMemo(() => {
    if (!singleProfileId) return null;
    return availableMeters.find(m => m.id === singleProfileId) || null;
  }, [singleProfileId, availableMeters]);

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

  // Include single profile ID in assigned IDs set
  const assignedIds = useMemo(() => {
    const ids = new Set(assignedMeters.map(m => m.scada_import_id));
    if (singleProfileId) ids.add(singleProfileId);
    return ids;
  }, [assignedMeters, singleProfileId]);

  // Total assigned count (single + multi)
  const totalAssignedCount = assignedMeters.length + (singleProfile ? 1 : 0);

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
    calculateAveragedProfile(assignedMeters, tenantArea, singleProfile), 
    [assignedMeters, tenantArea, singleProfile]
  );

  const avgDailyKwh = averagedProfile 
    ? averagedProfile.reduce((sum, v) => sum + v, 0)
    : 0;

  // Calculate accumulative stats (include single profile)
  const accumulativeStats = useMemo(() => {
    let totalDataPoints = assignedMeters.reduce(
      (sum, m) => sum + (m.scada_imports?.data_points || 0),
      0
    );
    let totalArea = assignedMeters.reduce(
      (sum, m) => sum + (m.scada_imports?.area_sqm || 0),
      0
    );
    let metersWithData = assignedMeters.filter(
      m => m.scada_imports?.data_points && m.scada_imports.data_points > 0
    ).length;
    
    // Include single profile stats
    if (singleProfile) {
      totalDataPoints += singleProfile.data_points || 0;
      totalArea += singleProfile.area_sqm || 0;
      if (singleProfile.data_points && singleProfile.data_points > 0) {
        metersWithData += 1;
      }
    }
    
    return { totalDataPoints, totalArea, metersWithData };
  }, [assignedMeters, singleProfile]);

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
                Assigned Meters ({totalAssignedCount})
              </h4>
              {totalAssignedCount > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {formatDataPoints(accumulativeStats.totalDataPoints)} data points
                    </span>
                    <span>
                      {accumulativeStats.metersWithData}/{totalAssignedCount} with data
                    </span>
                  </div>
                  {assignedMeters.length > 0 && (
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
                  )}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground p-4 text-center border rounded-md bg-muted/20">
                Loading assigned meters...
              </div>
            ) : totalAssignedCount === 0 ? (
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
                        <div className="flex items-center gap-1 text-xs">
                          <Scale className="h-3 w-3" />
                          Auto Scale
                        </div>
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Show single profile first if exists */}
                    {singleProfile && (
                      <TableRow className="bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1">Primary</Badge>
                            <div>
                              <span className="font-medium">
                                {singleProfile.shop_name || "Unnamed"}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {singleProfile.site_name || ""}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={singleProfile.data_points ? "secondary" : "outline"}
                            className="font-mono text-xs"
                          >
                            {formatDataPoints(singleProfile.data_points)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {singleProfile.load_profile_weekday 
                            ? Math.round(singleProfile.load_profile_weekday.reduce((s, v) => s + v, 0))
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {calculateAutoScale(singleProfile.area_sqm, tenantArea).toFixed(2)}x
                          </span>
                        </TableCell>
                        <TableCell>
                          {onClearSingleProfile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={onClearSingleProfile}
                              title="Remove primary profile assignment"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Multi-meter assignments */}
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
                            <span className="text-xs text-muted-foreground font-mono">
                              {calculateAutoScale(meter.scada_imports?.area_sqm || null, tenantArea).toFixed(2)}x
                            </span>
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
            {totalAssignedCount > 0 && (
              <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-2">Profile Summary (Scaled to {tenantArea} m²)</p>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Meters:</span>{" "}
                    <span className="font-medium">{totalAssignedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Daily kWh:</span>{" "}
                    <span className="font-medium">
                      {Math.round(avgDailyKwh)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Monthly:</span>{" "}
                    <span className="font-medium">
                      {Math.round(avgDailyKwh * 30).toLocaleString()} kWh
                    </span>
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
