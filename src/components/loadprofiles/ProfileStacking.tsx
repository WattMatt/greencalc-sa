import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from "recharts";
import { Layers, Download, Calendar as CalendarIcon, Save, FolderOpen, Trash2, Plus } from "lucide-react";
import { format, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RawDataPoint {
  timestamp: string;
  values: Record<string, number>;
}

interface ScadaImport {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  meter_label: string | null;
  meter_color: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  data_points: number | null;
  raw_data: RawDataPoint[] | null;
}

interface Project {
  id: string;
  name: string;
}

interface StackedProfile {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  meter_ids: string[];
  created_at: string;
}

type DayFilter = "all" | "weekday" | "weekend";
type AggregationType = "sum" | "average";

const DEFAULT_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

export function ProfileStacking() {
  const queryClient = useQueryClient();
  const [selectedMeters, setSelectedMeters] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [aggregationType, setAggregationType] = useState<AggregationType>("sum");
  const [showChart, setShowChart] = useState(false);
  const [isDateFromOpen, setIsDateFromOpen] = useState(false);
  const [isDateToOpen, setIsDateToOpen] = useState(false);

  // Save configuration state
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [configName, setConfigName] = useState("");
  const [configDescription, setConfigDescription] = useState("");
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  const { data: meters, isLoading } = useQuery({
    queryKey: ["scada-imports-stacking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_number, shop_name, meter_label, meter_color, date_range_start, date_range_end, data_points, raw_data")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map(row => ({
        ...row,
        raw_data: Array.isArray(row.raw_data) ? row.raw_data : null
      })) as ScadaImport[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: savedConfigs, refetch: refetchConfigs } = useQuery({
    queryKey: ["stacked-profiles", selectedProjectId],
    queryFn: async () => {
      let query = supabase
        .from("stacked_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (selectedProjectId) {
        query = query.eq("project_id", selectedProjectId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as StackedProfile[];
    },
    enabled: true,
  });

  const saveConfig = useMutation({
    mutationFn: async (params: { name: string; description: string; project_id: string | null; meter_ids: string[] }) => {
      const { error } = await supabase.from("stacked_profiles").insert({
        name: params.name,
        description: params.description || null,
        project_id: params.project_id || null,
        meter_ids: params.meter_ids,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stacked-profiles"] });
      toast.success("Configuration saved");
      setSaveDialogOpen(false);
      setConfigName("");
      setConfigDescription("");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stacked_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stacked-profiles"] });
      toast.success("Configuration deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleLoadConfig = (config: StackedProfile) => {
    // Set selected meters from the saved config
    const validMeterIds = config.meter_ids.filter(id => 
      metersWithData.some(m => m.id === id)
    );
    setSelectedMeters(new Set(validMeterIds));
    setLoadDialogOpen(false);
    setShowChart(false);
    
    if (validMeterIds.length < config.meter_ids.length) {
      toast.info(`Loaded ${validMeterIds.length} of ${config.meter_ids.length} meters (some no longer exist)`);
    } else {
      toast.success(`Loaded "${config.name}" with ${validMeterIds.length} meters`);
    }
  };

  const handleSaveConfig = () => {
    if (!configName.trim()) {
      toast.error("Please enter a configuration name");
      return;
    }
    if (selectedMeters.size === 0) {
      toast.error("Please select at least one meter to save");
      return;
    }
    saveConfig.mutate({
      name: configName,
      description: configDescription,
      project_id: selectedProjectId || null,
      meter_ids: Array.from(selectedMeters),
    });
  };

  const metersWithData = useMemo(() => {
    return meters?.filter(m => m.raw_data && m.raw_data.length > 0) || [];
  }, [meters]);

  const getMeterDisplayName = (meter: ScadaImport) => {
    if (meter.meter_label) return meter.meter_label;
    if (meter.shop_name) return meter.shop_name;
    if (meter.shop_number) return meter.shop_number;
    return meter.site_name;
  };

  const getMeterColor = (meter: ScadaImport, index: number) => {
    return meter.meter_color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  const handleMeterToggle = (meterId: string, checked: boolean) => {
    setSelectedMeters(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(meterId);
      } else {
        newSet.delete(meterId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedMeters.size === metersWithData.length) {
      setSelectedMeters(new Set());
    } else {
      setSelectedMeters(new Set(metersWithData.map(m => m.id)));
    }
  };

  // Generate stacked data by hour across all selected meters
  const stackedData = useMemo(() => {
    if (!showChart || selectedMeters.size === 0) return [];

    const selectedMetersList = metersWithData.filter(m => selectedMeters.has(m.id));
    
    // Group all data by hour (0-23)
    const hourlyData: Record<number, Record<string, number[]>> = {};
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = {};
      selectedMetersList.forEach(m => {
        hourlyData[h][m.id] = [];
      });
    }

    selectedMetersList.forEach(meter => {
      if (!meter.raw_data) return;
      
      meter.raw_data.forEach(point => {
        try {
          const date = new Date(point.timestamp);
          
          // Apply date filter
          if (dateFrom && date < dateFrom) return;
          if (dateTo) {
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            if (date > endOfDay) return;
          }
          
          // Apply day filter
          const weekend = isWeekend(date);
          if (dayFilter === "weekday" && weekend) return;
          if (dayFilter === "weekend" && !weekend) return;
          
          const hour = date.getHours();
          
          // Get primary value (first column or P1)
          const values = point.values;
          const primaryKey = Object.keys(values).find(k => k.includes("P1") || k.includes("kWh")) || Object.keys(values)[0];
          const value = values[primaryKey];
          
          if (typeof value === "number" && !isNaN(value)) {
            hourlyData[hour][meter.id].push(value);
          }
        } catch (e) {
          // Skip invalid dates
        }
      });
    });

    // Calculate aggregated values per hour
    return Array.from({ length: 24 }, (_, hour) => {
      const point: Record<string, any> = {
        hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
      };
      
      let total = 0;
      selectedMetersList.forEach(meter => {
        const values = hourlyData[hour][meter.id];
        let value: number;
        
        if (values.length === 0) {
          value = 0;
        } else if (aggregationType === "sum") {
          value = values.reduce((a, b) => a + b, 0);
        } else {
          value = values.reduce((a, b) => a + b, 0) / values.length;
        }
        
        point[meter.id] = Math.round(value * 100) / 100;
        total += point[meter.id];
      });
      
      point.total = Math.round(total * 100) / 100;
      return point;
    });
  }, [showChart, selectedMeters, metersWithData, dateFrom, dateTo, dayFilter, aggregationType]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (stackedData.length === 0) return null;
    
    const totals = stackedData.map(d => d.total);
    const dailyTotal = totals.reduce((a, b) => a + b, 0);
    const peakHour = stackedData.reduce((max, d) => d.total > max.total ? d : max, stackedData[0]);
    const minHour = stackedData.reduce((min, d) => d.total < min.total ? d : min, stackedData[0]);
    
    return {
      dailyTotal: Math.round(dailyTotal),
      peakHour: peakHour.hour,
      peakValue: Math.round(peakHour.total * 100) / 100,
      minHour: minHour.hour,
      minValue: Math.round(minHour.total * 100) / 100,
    };
  }, [stackedData]);

  const handleGenerateStack = () => {
    if (selectedMeters.size === 0) {
      toast.error("Please select at least one meter");
      return;
    }
    setShowChart(true);
    toast.success(`Stacking ${selectedMeters.size} meters`);
  };

  const handleExportCSV = () => {
    if (stackedData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const selectedMetersList = metersWithData.filter(m => selectedMeters.has(m.id));
    const headers = ["Hour", ...selectedMetersList.map(getMeterDisplayName), "Total"];
    
    const rows = stackedData.map(d => {
      return [
        d.label,
        ...selectedMetersList.map(m => d[m.id] || 0),
        d.total
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stacked-profile-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading meters...</div>
        </CardContent>
      </Card>
    );
  }

  if (metersWithData.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No meter data available</h3>
          <p className="text-muted-foreground text-center max-w-sm mt-1">
            Import SCADA data first to enable profile stacking.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedMetersList = metersWithData.filter(m => selectedMeters.has(m.id));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Profile Stacking
              </CardTitle>
              <CardDescription>
                Select multiple meters to generate a combined stacked load profile
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Project Filter for Saved Configs */}
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All projects</SelectItem>
                  {projects?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Load Config Button */}
              <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Load
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Load Saved Configuration</DialogTitle>
                    <DialogDescription>
                      Select a saved meter configuration to load
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {!savedConfigs?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No saved configurations{selectedProjectId ? " for this project" : ""}
                      </div>
                    ) : (
                      savedConfigs.map(config => (
                        <div
                          key={config.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => handleLoadConfig(config)}
                        >
                          <div>
                            <div className="font-medium">{config.name}</div>
                            {config.description && (
                              <div className="text-sm text-muted-foreground">{config.description}</div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary">{config.meter_ids.length} meters</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(config.created_at), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete this configuration?")) {
                                deleteConfig.mutate(config.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Save Config Button */}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selectedMeters.size === 0}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Configuration</DialogTitle>
                    <DialogDescription>
                      Save the current meter selection for reuse
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Configuration Name *</Label>
                      <Input
                        placeholder="e.g., Main Centre Load"
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Input
                        placeholder="e.g., All ground floor meters"
                        value={configDescription}
                        onChange={(e) => setConfigDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assign to Project</Label>
                      <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No project</SelectItem>
                          {projects?.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedMeters.size} meter(s) will be saved
                    </div>
                    <Button className="w-full" onClick={handleSaveConfig} disabled={!configName.trim()}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Configuration
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Meter Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Meters to Stack</Label>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedMeters.size === metersWithData.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {metersWithData.map((meter, index) => (
                <div
                  key={meter.id}
                  className={cn(
                    "flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors",
                    selectedMeters.has(meter.id) && "bg-accent border-accent-foreground/20"
                  )}
                  onClick={() => handleMeterToggle(meter.id, !selectedMeters.has(meter.id))}
                >
                  <Checkbox
                    checked={selectedMeters.has(meter.id)}
                    onCheckedChange={(checked) => handleMeterToggle(meter.id, !!checked)}
                  />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getMeterColor(meter, index) }}
                  />
                  <span className="text-sm truncate">{getMeterDisplayName(meter)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "All dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => {
                      setDateFrom(date);
                      setIsDateFromOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "All dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => {
                      setDateTo(date);
                      setIsDateToOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Day Type</Label>
              <Select value={dayFilter} onValueChange={(v) => setDayFilter(v as DayFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  <SelectItem value="weekday">Weekdays Only</SelectItem>
                  <SelectItem value="weekend">Weekends Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aggregation</Label>
              <Select value={aggregationType} onValueChange={(v) => setAggregationType(v as AggregationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum (Total kWh)</SelectItem>
                  <SelectItem value="average">Average (Mean kWh)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={handleGenerateStack} disabled={selectedMeters.size === 0}>
              <Layers className="h-4 w-4 mr-2" />
              Generate Stacked Profile
            </Button>
            {showChart && stackedData.length > 0 && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chart & Summary */}
      {showChart && stackedData.length > 0 && (
        <>
          {/* Summary Stats */}
          {summaryStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Meters Stacked</CardDescription>
                  <CardTitle className="text-2xl">{selectedMeters.size}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Daily Total</CardDescription>
                  <CardTitle className="text-2xl">{summaryStats.dailyTotal.toLocaleString()} kWh</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Peak Hour</CardDescription>
                  <CardTitle className="text-2xl">
                    {summaryStats.peakHour.toString().padStart(2, "0")}:00
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({summaryStats.peakValue} kWh)
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Minimum Hour</CardDescription>
                  <CardTitle className="text-2xl">
                    {summaryStats.minHour.toString().padStart(2, "0")}:00
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({summaryStats.minValue} kWh)
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Stacked Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Stacked Load Profile (24-Hour)</CardTitle>
              <CardDescription>
                Combined consumption from {selectedMeters.size} meters • {dayFilter === "all" ? "All days" : dayFilter}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stackedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <div className="font-medium mb-2">{label}</div>
                            {payload.map((entry: any) => {
                              const meter = selectedMetersList.find(m => m.id === entry.dataKey);
                              if (!meter) return null;
                              return (
                                <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: entry.fill }}
                                  />
                                  <span>{getMeterDisplayName(meter)}:</span>
                                  <span className="font-medium">{entry.value} kWh</span>
                                </div>
                              );
                            })}
                            <div className="border-t mt-2 pt-2 font-medium">
                              Total: {payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0).toFixed(2)} kWh
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      content={({ payload }) => (
                        <div className="flex flex-wrap justify-center gap-4 mt-4">
                          {payload?.map((entry: any, index: number) => {
                            const meter = selectedMetersList.find(m => m.id === entry.dataKey);
                            if (!meter) return null;
                            return (
                              <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span>{getMeterDisplayName(meter)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    />
                    {selectedMetersList.map((meter, index) => (
                      <Area
                        key={meter.id}
                        type="monotone"
                        dataKey={meter.id}
                        stackId="1"
                        stroke={getMeterColor(meter, index)}
                        fill={getMeterColor(meter, index)}
                        fillOpacity={0.6}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}