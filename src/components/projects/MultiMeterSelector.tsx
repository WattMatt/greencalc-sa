import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, X, Layers } from "lucide-react";
import { toast } from "sonner";

interface ScadaImport {
  id: string;
  shop_name: string | null;
  site_name: string;
  area_sqm: number | null;
  load_profile_weekday: number[] | null;
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
        .select("id, scada_import_id, weight, scada_imports:scada_import_id(id, shop_name, site_name, area_sqm, load_profile_weekday)")
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
      toast.success("Meter removed");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
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

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          {/* Left: Available meters */}
          <div className="flex flex-col min-h-0">
            <h4 className="text-sm font-medium mb-2">Available Meters</h4>
            <Command className="border rounded-md flex-1">
              <CommandInput 
                placeholder="Search meters..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList className="max-h-[300px]">
                <CommandEmpty>No meters found.</CommandEmpty>
                <CommandGroup>
                  {filteredMeters.map((meter) => {
                    const isAssigned = assignedIds.has(meter.id);
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
                        <span className={isAssigned ? "text-muted-foreground" : ""}>
                          {formatMeterName(meter)}
                        </span>
                        {meter.load_profile_weekday?.length === 24 && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {Math.round(meter.load_profile_weekday.reduce((s, v) => s + v, 0))} kWh/day
                          </Badge>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          {/* Right: Assigned meters */}
          <div className="flex flex-col min-h-0">
            <h4 className="text-sm font-medium mb-2">
              Assigned Meters ({assignedMeters.length})
            </h4>
            <ScrollArea className="border rounded-md flex-1 p-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-2">Loading...</p>
              ) : assignedMeters.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">
                  No meters assigned. Select meters from the left to build an averaged profile.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedMeters.map((meter) => (
                    <div 
                      key={meter.id} 
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {meter.scada_imports?.shop_name || meter.scada_imports?.site_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {meter.scada_imports?.area_sqm 
                            ? `${Math.round(meter.scada_imports.area_sqm)} m²` 
                            : "No area"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeMeter.mutate(meter.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Summary stats */}
            {assignedMeters.length > 0 && (
              <div className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/20">
                <p className="text-xs font-medium text-primary mb-1">Averaged Profile Stats</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
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
                    <span className="text-muted-foreground">Tenant Area:</span>{" "}
                    <span className="font-medium">{tenantArea} m²</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
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
        .select("id, scada_import_id, weight, scada_imports:scada_import_id(id, shop_name, site_name, area_sqm, load_profile_weekday, load_profile_weekend)")
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
