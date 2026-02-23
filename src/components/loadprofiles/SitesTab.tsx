import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Edit2, Trash2, MapPin, Ruler, Upload, Database, ArrowLeft, FileText, Calendar, Loader2, CheckCircle2, FileSpreadsheet, RefreshCw, Clock, Settings, Navigation, List, Map as MapIcon, Layers, GitCompare, BarChart3, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { BulkCsvDropzone } from "@/components/loadprofiles/BulkCsvDropzone";
import { SheetImport } from "@/components/loadprofiles/SheetImport";
import { MeterReimportDialog } from "@/components/loadprofiles/MeterReimportDialog";
import { ColumnSelectionDialog } from "@/components/loadprofiles/ColumnSelectionDialog";
import { CsvImportWizard, WizardParseConfig, ParsedData } from "@/components/loadprofiles/CsvImportWizard";
import { processCSVToLoadProfile } from "./utils/csvToLoadProfile";
import { SiteLocationMap } from "@/components/loadprofiles/SiteLocationMap";
import { SitesMapView } from "@/components/loadprofiles/SitesMapView";
import { MeterAnalysis } from "@/components/loadprofiles/MeterAnalysis";
import { ProfileStacking } from "@/components/loadprofiles/ProfileStacking";
import { MeterComparison } from "@/components/loadprofiles/MeterComparison";
import { SiteMeterOverview } from "@/components/loadprofiles/SiteMeterOverview";

interface Site {
  id: string;
  name: string;
  site_type: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  total_area_sqm: number | null;
  created_at: string;
  meter_count?: number;
  meters_with_data?: number;
  meters_listed_only?: number;
}

interface Meter {
  id: string;
  site_name: string;
  shop_name: string | null;
  file_name: string | null;
  data_points: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  created_at: string;
  load_profile_weekday: number[] | null;
  load_profile_weekend: number[] | null;
  detected_interval_minutes: number | null;
}

export function SitesTab() {
  const queryClient = useQueryClient();
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [sheetImportOpen, setSheetImportOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [siteDetailTab, setSiteDetailTab] = useState<string>("meters");
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [processingMeterId, setProcessingMeterId] = useState<string | null>(null);
  const [reprocessingMeterId, setReprocessingMeterId] = useState<string | null>(null);
  const [selectedMeterIds, setSelectedMeterIds] = useState<Set<string>>(new Set());
  const [reimportMeter, setReimportMeter] = useState<Meter | null>(null);
  const [columnSelectionMeter, setColumnSelectionMeter] = useState<Meter | null>(null);
  const [columnSelectionCsvContent, setColumnSelectionCsvContent] = useState<string | null>(null);
  
  // Wizard-based processing queue
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [currentWizardMeterId, setCurrentWizardMeterId] = useState<string | null>(null);
  const [currentWizardCsvContent, setCurrentWizardCsvContent] = useState<string | null>(null);
  const [currentWizardFileName, setCurrentWizardFileName] = useState<string>("");
  const [isWizardProcessing, setIsWizardProcessing] = useState(false);
  const [wizardCompletedMeters, setWizardCompletedMeters] = useState<Array<{id: string; name: string; status: 'success' | 'skipped' | 'failed'; message: string}>>([]);
  // Error state for wizard - show error UI when CSV extraction fails
  const [wizardError, setWizardError] = useState<{
    meterId: string;
    meterName: string;
    message: string;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    site_type: "",
    location: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites-with-stats"],
    queryFn: async () => {
      const { data: sitesData, error } = await supabase
        .from("sites")
        .select("*")
        .order("name");
      if (error) throw error;

      // Fetch ALL meters - use range to bypass 1000 row limit
      // First get count, then fetch in batches if needed
      const { count: totalCount } = await supabase
        .from("scada_imports")
        .select("id", { count: "exact", head: true });
      
      // Fetch all meters with pagination to avoid 1000 row limit
      let allMeters: { site_id: string | null; data_points: number | null }[] = [];
      const pageSize = 1000;
      const totalPages = Math.ceil((totalCount || 0) / pageSize);
      
      for (let page = 0; page < totalPages; page++) {
        const { data: pageMeters } = await supabase
          .from("scada_imports")
          .select("site_id, data_points")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (pageMeters) {
          allMeters = [...allMeters, ...pageMeters];
        }
      }

      // Track total meters and those with actual CSV data imported (data_points > 0)
      // Note: load_profile_weekday may contain estimated profiles for "listed only" meters
      const meterStats: Record<string, { total: number; withData: number }> = {};
      
      allMeters.forEach(m => {
        if (m.site_id) {
          if (!meterStats[m.site_id]) {
            meterStats[m.site_id] = { total: 0, withData: 0 };
          }
          meterStats[m.site_id].total += 1;
          
          // "With Data" means actual raw CSV data was imported (data_points > 0)
          // "Listed Only" means meter was listed but no CSV data uploaded yet
          const hasDataPoints = m.data_points && m.data_points > 0;
          
          if (hasDataPoints) {
            meterStats[m.site_id].withData += 1;
          }
        }
      });

      // Calculate stats per site
      const result = (sitesData || []).map(site => {
        const stats = meterStats[site.id] || { total: 0, withData: 0 };
        const listedOnly = stats.total - stats.withData;
        return {
          ...site,
          meter_count: stats.total,
          meters_with_data: stats.withData,
          meters_listed_only: listedOnly,
        };
      }) as Site[];
      
      return result;
    },
    staleTime: 0, // Always refetch
  });

  // Fetch meters for selected site
  const { data: siteMeters, isLoading: isLoadingMeters } = useQuery({
    queryKey: ["site-meters", selectedSite?.id],
    queryFn: async () => {
      if (!selectedSite) return [];
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_name, file_name, data_points, date_range_start, date_range_end, created_at, load_profile_weekday, load_profile_weekend, detected_interval_minutes")
        .eq("site_id", selectedSite.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Meter[];
    },
    enabled: !!selectedSite,
  });

  const saveSite = useMutation({
    mutationFn: async (data: {
      name: string;
      site_type: string | null;
      location: string | null;
      latitude: number | null;
      longitude: number | null;
    }) => {
      if (editingSite) {
        const { error } = await supabase
          .from("sites")
          .update(data)
          .eq("id", editingSite.id);
        if (error) throw error;
      } else {
        const { data: newSite, error } = await supabase
          .from("sites")
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        return newSite;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      toast.success(editingSite ? "Site updated" : "Site created");
      setSiteDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteSite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      toast.success("Site deleted");
      setSelectedSite(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scada_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["sites-with-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["sites-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      setSelectedMeterIds(new Set());
      toast.success(`Deleted ${ids.length} meter(s)`);
    },
    onError: (error) => toast.error(error.message),
  });

  const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);

  const deleteDuplicateMeters = async () => {
    if (!siteMeters || siteMeters.length === 0) return;
    
    setIsDeletingDuplicates(true);
    try {
      // Group meters by normalized shop name
      const meterGroups = new Map<string, Meter[]>();
      
      for (const meter of siteMeters) {
        const name = (meter.shop_name || meter.site_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!meterGroups.has(name)) {
          meterGroups.set(name, []);
        }
        meterGroups.get(name)!.push(meter);
      }
      
      // Find duplicates - keep the one with most data points or newest if tie
      const idsToDelete: string[] = [];
      
      for (const [, meters] of meterGroups) {
        if (meters.length > 1) {
          // Sort by data_points desc, then by created_at desc
          meters.sort((a, b) => {
            const pointsDiff = (b.data_points || 0) - (a.data_points || 0);
            if (pointsDiff !== 0) return pointsDiff;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          
          // Keep first (best), delete rest
          for (let i = 1; i < meters.length; i++) {
            idsToDelete.push(meters[i].id);
          }
        }
      }
      
      if (idsToDelete.length === 0) {
        toast.info("No duplicate meters found");
        return;
      }
      
      if (!confirm(`Found ${idsToDelete.length} duplicate meter(s). Delete them?`)) {
        return;
      }
      
      const { error } = await supabase.from("scada_imports").delete().in("id", idsToDelete);
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      toast.success(`Deleted ${idsToDelete.length} duplicate meter(s)`);
    } catch (error) {
      console.error("Error deleting duplicates:", error);
      toast.error("Failed to delete duplicates");
    } finally {
      setIsDeletingDuplicates(false);
    }
  };

  const toggleMeterSelection = (id: string) => {
    setSelectedMeterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllMeters = () => {
    if (!siteMeters) return;
    if (selectedMeterIds.size === siteMeters.length) {
      setSelectedMeterIds(new Set());
    } else {
      setSelectedMeterIds(new Set(siteMeters.map(m => m.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedMeterIds.size === 0) return;
    if (confirm(`Delete ${selectedMeterIds.size} selected meter(s)?`)) {
      bulkDeleteMeters.mutate(Array.from(selectedMeterIds));
    }
  };

  // Open column selection dialog for reprocessing a meter
  const handleReprocessMeter = async (meter: Meter) => {
    try {
      console.log('[Reprocess] Starting reprocess for meter:', meter.id, meter.shop_name || meter.site_name);
      
      // Fetch the raw data to extract CSV content for column detection
      const { data: meterData, error: fetchError } = await supabase
        .from("scada_imports")
        .select("raw_data")
        .eq("id", meter.id)
        .single();
      
      if (fetchError) {
        console.error('[Reprocess] Fetch error:', fetchError);
        toast.error("Failed to fetch meter data");
        return;
      }
      
      if (!meterData?.raw_data) {
        console.warn('[Reprocess] No raw_data field for meter:', meter.id);
        toast.error("No raw data stored for this meter. Please re-upload the CSV file.");
        return;
      }
      
      console.log('[Reprocess] raw_data type:', typeof meterData.raw_data, 'isArray:', Array.isArray(meterData.raw_data));
      
      // Extract CSV content
      const rawData = meterData.raw_data as unknown;
      let csvContent: string | null = null;
      
      if (Array.isArray(rawData) && rawData.length > 0) {
        const firstItem = rawData[0] as Record<string, unknown>;
        console.log('[Reprocess] First item keys:', Object.keys(firstItem));
        
        if (firstItem && 'csvContent' in firstItem && typeof firstItem.csvContent === 'string') {
          csvContent = firstItem.csvContent;
          console.log('[Reprocess] Found csvContent, length:', csvContent.length);
        } else {
          console.warn('[Reprocess] No csvContent in first item. Available fields:', Object.keys(firstItem));
        }
      } else {
        console.warn('[Reprocess] raw_data is not an array or is empty');
      }
      
      if (!csvContent) {
        toast.error("No CSV content stored for this meter. The original CSV data was not preserved during import. Please re-upload the CSV file using the upload button.");
        return;
      }
      
      // Open the column selection dialog
      setColumnSelectionMeter(meter);
      setColumnSelectionCsvContent(csvContent);
    } catch (error) {
      console.error("[Reprocess] Error preparing reprocess:", error);
      toast.error("Failed to load meter data for reprocessing");
    }
  };

  // Unit type for column selection
  type ValueUnit = "kW" | "kWh" | "W" | "Wh" | "MW" | "MWh" | "kVA" | "kVAh" | "A";
  
  // Process meter with a specific selected column and unit
  const handleColumnSelected = async (selectedColumn: string, unit: ValueUnit, voltageV?: number, powerFactor?: number) => {
    if (!columnSelectionMeter) return;
    
    setReprocessingMeterId(columnSelectionMeter.id);
    try {
      // Clear the processed status first
      await supabase
        .from("scada_imports")
        .update({ 
          processed_at: null,
          load_profile_weekday: null,
          load_profile_weekend: null,
          weekday_days: null,
          weekend_days: null
        })
        .eq("id", columnSelectionMeter.id);
      
      // Now process it with the selected column and unit
      await processWithColumn(columnSelectionMeter, selectedColumn, unit, voltageV, powerFactor);
      
      queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      toast.success(`Meter reprocessed using column: ${selectedColumn} (${unit})`);
    } catch (error) {
      console.error("Reprocess failed:", error);
      toast.error("Failed to reprocess meter");
    } finally {
      setReprocessingMeterId(null);
      setColumnSelectionMeter(null);
      setColumnSelectionCsvContent(null);
    }
  };

  // Unit conversion utilities (local copies)
  const convertToKwLocal = (value: number, unit: ValueUnit, voltageV: number = 400, powerFactor: number = 0.9): number => {
    switch (unit) {
      case "kW": return value;
      case "W": return value / 1000;
      case "MW": return value * 1000;
      case "kVA": return value * powerFactor;
      case "A": 
        return (Math.sqrt(3) * voltageV * value * powerFactor) / 1000;
      default: return value;
    }
  };

  const convertToKwhLocal = (value: number, unit: ValueUnit, powerFactor: number = 0.9): number => {
    switch (unit) {
      case "kWh": return value;
      case "Wh": return value / 1000;
      case "MWh": return value * 1000;
      case "kVAh": return value * powerFactor;
      default: return value;
    }
  };

  const isEnergyUnitLocal = (unit: ValueUnit): boolean => {
    return ["kWh", "Wh", "MWh", "kVAh"].includes(unit);
  };

  // Detect data interval from timestamps (returns interval in minutes)
  const detectDataIntervalLocal = (dataPoints: Array<{ date?: string; time?: string; timestamp?: string }>): number => {
    if (dataPoints.length < 2) return 60; // Default to hourly
    
    // Parse timestamps
    const timestamps: number[] = [];
    for (const point of dataPoints.slice(0, 200)) { // Sample first 200 points
      const dateStr = point.date || (point.timestamp ? point.timestamp.split("T")[0] : null);
      const timeStr = point.time || (point.timestamp ? point.timestamp.split("T")[1]?.substring(0, 8) : null);
      
      if (dateStr && timeStr) {
        const dt = new Date(`${dateStr}T${timeStr}`);
        if (!isNaN(dt.getTime())) {
          timestamps.push(dt.getTime());
        }
      }
    }
    
    if (timestamps.length < 2) return 60;
    
    // Sort and calculate intervals
    timestamps.sort((a, b) => a - b);
    const intervals: number[] = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      const diffMinutes = (timestamps[i] - timestamps[i - 1]) / 60000;
      if (diffMinutes > 0 && diffMinutes <= 240) { // Reasonable range: 1 min to 4 hours
        intervals.push(diffMinutes);
      }
    }
    
    if (intervals.length === 0) return 60;
    
    // Find mode (most common interval), rounded to standard values
    const roundToStandard = (min: number): number => {
      const standards = [1, 5, 10, 15, 30, 60, 120, 180, 240];
      return standards.reduce((prev, curr) => 
        Math.abs(curr - min) < Math.abs(prev - min) ? curr : prev
      );
    };
    
    const counts: Record<number, number> = {};
    for (const interval of intervals) {
      const rounded = roundToStandard(interval);
      counts[rounded] = (counts[rounded] || 0) + 1;
    }
    
    let mostCommon = 60;
    let maxCount = 0;
    for (const [interval, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = parseInt(interval);
      }
    }
    
    console.log(`[detectDataInterval] Detected ${mostCommon}-minute intervals from ${intervals.length} samples`);
    return mostCommon;
  };

  // Process meter with optional column selection and unit
  const processWithColumn = async (
    meter: Meter, 
    selectedColumn: string | null, 
    unit: ValueUnit = "kWh",
    voltageV: number = 400,
    powerFactor: number = 0.9
  ) => {
    setProcessingMeterId(meter.id);

    try {
      console.log("Processing meter:", meter.id, meter.shop_name, "with column:", selectedColumn, "unit:", unit);
      
      // Fetch fresh raw_data directly from the database
      const { data: meterData, error: fetchError } = await supabase
        .from("scada_imports")
        .select("raw_data")
        .eq("id", meter.id)
        .single();

      console.log("Fetch result:", { hasData: !!meterData, error: fetchError?.message });

      if (fetchError) {
        toast.error(`Failed to fetch data: ${fetchError.message}`);
        setProcessingMeterId(null);
        return;
      }

      if (!meterData?.raw_data) {
        toast.error("No raw data available to process");
        setProcessingMeterId(null);
        return;
      }

      // Handle both formats: {csvContent: string} OR pre-parsed data points
      let rawDataArray: Array<{ date?: string; time?: string; timestamp?: string; value?: number }>;
      
      const rawData = meterData.raw_data as unknown;
      if (Array.isArray(rawData) && rawData.length === 1 && typeof rawData[0] === 'object' && 'csvContent' in (rawData[0] as object)) {
        // CSV content stored - need to parse it with selected column
        console.log("Parsing CSV content from raw_data with selected column:", selectedColumn);
        const csvContent = (rawData[0] as { csvContent: string }).csvContent;
        rawDataArray = parseCsvContentWithColumn(csvContent, selectedColumn, unit, voltageV, powerFactor);
        console.log(`Parsed ${rawDataArray.length} data points from CSV using column: ${selectedColumn || 'auto'} (${unit})`);
      } else if (Array.isArray(rawData)) {
        // Already parsed data points - apply unit conversion
        rawDataArray = (rawData as Array<{ date?: string; time?: string; timestamp?: string; value?: number }>).map(point => {
          const rawValue = typeof point.value === "number" ? point.value : parseFloat(String(point.value)) || 0;
          const convertedValue = isEnergyUnitLocal(unit)
            ? convertToKwhLocal(rawValue, unit, powerFactor)
            : convertToKwLocal(rawValue, unit, voltageV, powerFactor);
          return { ...point, value: convertedValue };
        });
      } else {
        toast.error("Invalid raw data format");
        setProcessingMeterId(null);
        return;
      }

      if (rawDataArray.length === 0) {
        toast.error("No data points could be parsed from the file");
        setProcessingMeterId(null);
        return;
      }

      // Process the data points to calculate hourly profiles
      const weekdayHours: number[][] = Array.from({ length: 24 }, () => []);
      const weekendHours: number[][] = Array.from({ length: 24 }, () => []);
      const weekdayDates = new Set<string>();
      const weekendDates = new Set<string>();
      let minDate: string | null = null;
      let maxDate: string | null = null;

      for (const point of rawDataArray) {
        const dateStr = point.date || (point.timestamp ? point.timestamp.split("T")[0] : null);
        const timeStr = point.time || (point.timestamp ? point.timestamp.split("T")[1]?.substring(0, 8) : null);
        const value = typeof point.value === "number" ? point.value : parseFloat(String(point.value));

        if (!dateStr || !timeStr || isNaN(value)) continue;

        // Track date range
        if (!minDate || dateStr < minDate) minDate = dateStr;
        if (!maxDate || dateStr > maxDate) maxDate = dateStr;

        // Parse hour from time
        const hour = parseInt(timeStr.split(":")[0], 10);
        if (isNaN(hour) || hour < 0 || hour > 23) continue;

        // Determine day of week
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWeekend) {
          weekendHours[hour].push(value);
          weekendDates.add(dateStr);
        } else {
          weekdayHours[hour].push(value);
          weekdayDates.add(dateStr);
        }
      }

      // Calculate average for each hour and normalize
      const weekdayAvg = weekdayHours.map((vals) =>
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      );
      const weekendAvg = weekendHours.map((vals) =>
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      );

      // Normalize to percentages (sum to 100)
      const weekdaySum = weekdayAvg.reduce((a, b) => a + b, 0);
      const weekendSum = weekendAvg.reduce((a, b) => a + b, 0);

      const weekdayProfile = weekdaySum > 0
        ? weekdayAvg.map((v) => Math.round((v / weekdaySum) * 100 * 100) / 100)
        : weekdayAvg;
      const weekendProfile = weekendSum > 0
        ? weekendAvg.map((v) => Math.round((v / weekendSum) * 100 * 100) / 100)
        : weekendAvg;

      // Detect data interval
      const detectedInterval = detectDataIntervalLocal(rawDataArray);

      // Update the meter with processed data
      const { error: updateError } = await supabase
        .from("scada_imports")
        .update({
          load_profile_weekday: weekdayProfile,
          load_profile_weekend: weekendProfile,
          date_range_start: minDate,
          date_range_end: maxDate,
          weekday_days: weekdayDates.size,
          weekend_days: weekendDates.size,
          data_points: rawDataArray.length,
          processed_at: new Date().toISOString(),
          detected_interval_minutes: detectedInterval,
          value_unit: unit,
        } as Record<string, unknown>)
        .eq("id", meter.id);

      if (updateError) throw updateError;

      toast.success(`Processed ${meter.shop_name || meter.site_name} (${rawDataArray.length} readings)`);
      queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process meter");
    } finally {
      setProcessingMeterId(null);
    }
  };

  // Helper function to parse CSV content into data points
  const parseCsvContent = (csvContent: string): Array<{ date: string; time: string; value: number }> => {
    // Split by newlines and filter empty lines, also handle \r\n
    let lines = csvContent.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    
    // Skip Excel separator directive lines like "sep=,"
    let headerIndex = 0;
    while (headerIndex < lines.length && (
      lines[headerIndex].toLowerCase().startsWith('sep=') || 
      !lines[headerIndex].includes(',') && !lines[headerIndex].includes('\t') && !lines[headerIndex].includes(';')
    )) {
      headerIndex++;
    }
    
    if (headerIndex >= lines.length) return [];
    
    // Detect separator from header line
    const headerLine = lines[headerIndex];
    let separator = ',';
    if (headerLine.includes('\t')) separator = '\t';
    else if (headerLine.includes(';') && !headerLine.includes(',')) separator = ';';
    
    // Parse header to find columns
    const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    console.log("CSV Headers detected:", headers, "separator:", JSON.stringify(separator));
    
    // Find date, time, and value columns by name patterns
    let dateCol = -1, timeCol = -1, valueCol = -1;
    
    headers.forEach((h, i) => {
      if (dateCol === -1 && (h.includes('date') || h.includes('datum') || h.includes('datetime'))) dateCol = i;
      if (timeCol === -1 && (h.includes('time') && !h.includes('datetime') || h.includes('tyd') || h === 'hour')) timeCol = i;
      if (valueCol === -1 && (h.includes('kwh') || h.includes('kw') || h.includes('value') || h.includes('energy') || h.includes('consumption') || h.includes('reading'))) valueCol = i;
    });
    
    // If value column not found by name, find first numeric column (not the date column)
    if (valueCol === -1) {
      const dataLines = lines.slice(headerIndex + 1);
      for (let lineIdx = 0; lineIdx < Math.min(5, dataLines.length); lineIdx++) {
        const sampleRow = dataLines[lineIdx]?.split(separator) || [];
        for (let i = 0; i < sampleRow.length; i++) {
          if (i === dateCol || i === timeCol) continue;
          const val = sampleRow[i]?.trim().replace(/['"]/g, '');
          // Check if it looks like a number and has non-zero values
          if (val && !isNaN(parseFloat(val)) && parseFloat(val) !== 0) {
            valueCol = i;
            break;
          }
        }
        if (valueCol !== -1) break;
      }
      // If still not found, just take the next column after date
      if (valueCol === -1 && headers.length > 1) {
        valueCol = dateCol === 0 ? 1 : 0;
      }
    }
    
    // If date not found, try first column
    if (dateCol === -1) dateCol = 0;
    
    console.log("Column mapping: date=", dateCol, "time=", timeCol, "value=", valueCol);
    
    const dataPoints: Array<{ date: string; time: string; value: number }> = [];
    
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(separator).map(c => c.trim().replace(/['"]/g, ''));
      
      let dateStr = cols[dateCol] || '';
      let timeStr = timeCol >= 0 ? (cols[timeCol] || '') : '';
      const valueStr = valueCol >= 0 ? (cols[valueCol] || '0') : '0';
      
      // Handle combined datetime in date column (e.g., "31/12/2024 23:30:00")
      if (!timeStr && dateStr.includes(' ')) {
        const spaceIdx = dateStr.indexOf(' ');
        const potentialTime = dateStr.substring(spaceIdx + 1);
        // Check if it looks like a time (contains :)
        if (potentialTime.includes(':')) {
          timeStr = potentialTime;
          dateStr = dateStr.substring(0, spaceIdx);
        }
      }
      // Handle ISO format with T separator
      if (!timeStr && dateStr.includes('T')) {
        const parts = dateStr.split('T');
        dateStr = parts[0];
        timeStr = parts[1]?.split(/[Z+]/)[0] || '';
      }
      
      // Parse value
      const value = parseFloat(valueStr.replace(/,/g, ''));
      if (isNaN(value)) continue;
      
      // Normalize date format (DD/MM/YYYY to YYYY-MM-DD)
      let normalizedDate = dateStr;
      
      // Match DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ddmmyyyy) {
        normalizedDate = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
      }
      // Match YYYY/MM/DD or YYYY-MM-DD
      const yyyymmdd = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (yyyymmdd) {
        normalizedDate = `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`;
      }
      
      // Normalize time format (extract HH:MM:SS)
      let normalizedTime = '00:00:00';
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (timeMatch) {
        const h = timeMatch[1].padStart(2, '0');
        const m = timeMatch[2].padStart(2, '0');
        const s = (timeMatch[3] || '00').padStart(2, '0');
        normalizedTime = `${h}:${m}:${s}`;
      }
      
      dataPoints.push({ date: normalizedDate, time: normalizedTime, value });
    }
    
    console.log(`Parsed ${dataPoints.length} data points. First:`, dataPoints[0], "Last:", dataPoints[dataPoints.length - 1]);
    return dataPoints;
  };

  // Parse CSV content with a specific column selection and unit conversion
  const parseCsvContentWithColumn = (
    csvContent: string, 
    selectedColumn: string | null,
    unit: ValueUnit = "kWh",
    voltageV: number = 400,
    powerFactor: number = 0.9
  ): Array<{ date: string; time: string; value: number }> => {
    // Split by newlines and filter empty lines, also handle \r\n
    let lines = csvContent.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    
    // Skip Excel separator directive lines like "sep=,"
    let headerIndex = 0;
    while (headerIndex < lines.length && (
      lines[headerIndex].toLowerCase().startsWith('sep=') || 
      !lines[headerIndex].includes(',') && !lines[headerIndex].includes('\t') && !lines[headerIndex].includes(';')
    )) {
      headerIndex++;
    }
    
    if (headerIndex >= lines.length) return [];
    
    // Detect separator from header line
    const headerLine = lines[headerIndex];
    let separator = ',';
    if (headerLine.includes('\t')) separator = '\t';
    else if (headerLine.includes(';') && !headerLine.includes(',')) separator = ';';
    
    // Parse header to find columns
    const headers = headerLine.split(separator).map(h => h.trim().replace(/['"]/g, ''));
    const headersLower = headers.map(h => h.toLowerCase());
    console.log("CSV Headers detected:", headers, "selected column:", selectedColumn, "unit:", unit);
    
    // Find date, time, and value columns
    let dateCol = -1, timeCol = -1, valueCol = -1;
    
    headersLower.forEach((h, i) => {
      if (dateCol === -1 && (h.includes('date') || h.includes('datum') || h.includes('datetime'))) dateCol = i;
      if (timeCol === -1 && (h.includes('time') && !h.includes('datetime') || h.includes('tyd') || h === 'hour')) timeCol = i;
    });
    
    // Use selected column if provided, otherwise auto-detect
    if (selectedColumn) {
      const selectedIdx = headers.findIndex(h => h === selectedColumn);
      if (selectedIdx >= 0) {
        valueCol = selectedIdx;
        console.log(`Using selected column "${selectedColumn}" at index ${valueCol}`);
      }
    }
    
    // If no selected column or not found, fallback to auto-detection
    if (valueCol === -1) {
      headersLower.forEach((h, i) => {
        if (valueCol === -1 && (h.includes('kwh') || h.includes('kw') || h.includes('value') || h.includes('energy'))) valueCol = i;
      });
      
      // If still not found, find first numeric column
      if (valueCol === -1) {
        const dataLines = lines.slice(headerIndex + 1);
        for (let lineIdx = 0; lineIdx < Math.min(5, dataLines.length); lineIdx++) {
          const sampleRow = dataLines[lineIdx]?.split(separator) || [];
          for (let i = 0; i < sampleRow.length; i++) {
            if (i === dateCol || i === timeCol) continue;
            const val = sampleRow[i]?.trim().replace(/['"]/g, '');
            if (val && !isNaN(parseFloat(val)) && parseFloat(val) !== 0) {
              valueCol = i;
              break;
            }
          }
          if (valueCol !== -1) break;
        }
        if (valueCol === -1 && headers.length > 1) {
          valueCol = dateCol === 0 ? 1 : 0;
        }
      }
    }
    
    // If date not found, try first column
    if (dateCol === -1) dateCol = 0;
    
    console.log("Column mapping: date=", dateCol, "time=", timeCol, "value=", valueCol, "(", headers[valueCol], ")");
    
    const isEnergy = isEnergyUnitLocal(unit);
    const dataPoints: Array<{ date: string; time: string; value: number }> = [];
    
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(separator).map(c => c.trim().replace(/['"]/g, ''));
      
      let dateStr = cols[dateCol] || '';
      let timeStr = timeCol >= 0 ? (cols[timeCol] || '') : '';
      const valueStr = valueCol >= 0 ? (cols[valueCol] || '0') : '0';
      
      // Handle combined datetime in date column
      if (!timeStr && dateStr.includes(' ')) {
        const spaceIdx = dateStr.indexOf(' ');
        const potentialTime = dateStr.substring(spaceIdx + 1);
        if (potentialTime.includes(':')) {
          timeStr = potentialTime;
          dateStr = dateStr.substring(0, spaceIdx);
        }
      }
      // Handle ISO format with T separator
      if (!timeStr && dateStr.includes('T')) {
        const parts = dateStr.split('T');
        dateStr = parts[0];
        timeStr = parts[1]?.split(/[Z+]/)[0] || '';
      }
      
      // Parse raw value
      const rawValue = parseFloat(valueStr.replace(/,/g, ''));
      if (isNaN(rawValue)) continue;
      
      // Convert value based on unit type
      const convertedValue = isEnergy
        ? convertToKwhLocal(rawValue, unit, powerFactor)
        : convertToKwLocal(rawValue, unit, voltageV, powerFactor);
      
      // Normalize date format (DD/MM/YYYY to YYYY-MM-DD)
      let normalizedDate = dateStr;
      
      const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ddmmyyyy) {
        normalizedDate = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
      }
      const yyyymmdd = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (yyyymmdd) {
        normalizedDate = `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`;
      }
      
      // Normalize time format (extract HH:MM:SS)
      let normalizedTime = '00:00:00';
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (timeMatch) {
        const h = timeMatch[1].padStart(2, '0');
        const m = timeMatch[2].padStart(2, '0');
        const s = (timeMatch[3] || '00').padStart(2, '0');
        normalizedTime = `${h}:${m}:${s}`;
      }
      
      dataPoints.push({ date: normalizedDate, time: normalizedTime, value: convertedValue });
    }
    
    console.log(`Parsed ${dataPoints.length} data points using column "${selectedColumn || 'auto'}" with unit ${unit}`);
    return dataPoints;
  };

  const processMeter = async (meter: Meter) => {
    // For initial processing, use auto-detection (null column)
    await processWithColumn(meter, null);
  };

  const isProcessed = (meter: Meter) => {
    // A meter is processed if it has:
    // 1. Actual CSV data uploaded (data_points > 0) AND
    // 2. Valid load profiles (not all zeros)
    // "Listed only" meters may have placeholder profiles but no real data
    const hasDataPoints = (meter.data_points || 0) > 0;
    if (!hasDataPoints) return false;
    
    const weekday = meter.load_profile_weekday || [];
    const weekend = meter.load_profile_weekend || [];
    const hasWeekdayData = weekday.some(v => v > 0);
    const hasWeekendData = weekend.some(v => v > 0);
    return hasWeekdayData || hasWeekendData;
  };

  // Start wizard-based processing for a list of meter IDs
  const startWizardProcessing = useCallback(async (meterIds: string[]) => {
    if (meterIds.length === 0) return;
    
    setWizardCompletedMeters([]);
    setProcessingQueue(meterIds);
    // Load the first meter's CSV and open wizard
    await loadMeterForWizard(meterIds[0]);
  }, []);

  // Load a meter's CSV content and open the wizard
  const loadMeterForWizard = async (meterId: string) => {
    console.log('[loadMeterForWizard] Loading meter:', meterId);
    try {
      const { data: meter, error } = await supabase
        .from("scada_imports")
        .select("id, raw_data, shop_name, site_name")
        .eq("id", meterId)
        .single();
      
      console.log('[loadMeterForWizard] Query result:', { meter: meter?.id, error, hasRawData: !!meter?.raw_data });
      
      if (error || !meter) {
        console.error("Failed to fetch meter for wizard:", error);
        toast.error("Failed to load meter data");
        moveToNextMeterInQueue(meterId, 'failed', 'Failed to load');
        return;
      }
      
      // Handle various raw_data structures
      let csvContent: string | null = null;
      const rawData = meter.raw_data;
      
      console.log('[loadMeterForWizard] raw_data type:', typeof rawData, Array.isArray(rawData));
      
      if (Array.isArray(rawData) && rawData.length > 0) {
        const firstItem = rawData[0] as Record<string, unknown> | string;
        // Check if it's the new format with csvContent
        if (typeof firstItem === 'object' && firstItem !== null && 'csvContent' in firstItem) {
          csvContent = firstItem.csvContent as string;
        } else if (typeof firstItem === 'string') {
          // Sometimes the CSV is stored directly as a string in the first element
          csvContent = firstItem;
        }
      } else if (typeof rawData === 'string') {
        csvContent = rawData;
      } else if (rawData && typeof rawData === 'object' && !Array.isArray(rawData) && 'csvContent' in rawData) {
        csvContent = (rawData as Record<string, unknown>).csvContent as string;
      }
      
      console.log('[loadMeterForWizard] Extracted csvContent length:', csvContent?.length || 0);
      
      if (!csvContent) {
        console.warn("No CSV content for meter:", meterId, "raw_data:", rawData);
        const displayName = meter.shop_name || meter.site_name || meterId.slice(0, 8);
        // Set error state and open wizard with error UI instead of just toast
        setWizardError({
          meterId,
          meterName: displayName,
          message: "No CSV data stored for this meter. Use the upload button to import CSV data first."
        });
        setCurrentWizardMeterId(meterId);
        setCurrentWizardFileName(displayName);
        // Keep csvContent as null - this triggers the error UI in wizard
        setCurrentWizardCsvContent(null);
        setProcessingQueue(prev => prev.filter(id => id !== meterId));
        return;
      }
      
      const displayName = meter.shop_name || meter.site_name || meterId.slice(0, 8);
      console.log('[loadMeterForWizard] Opening wizard for:', displayName);
      // Clear any previous error when successfully loading CSV
      setWizardError(null);
      setCurrentWizardMeterId(meterId);
      setCurrentWizardCsvContent(csvContent);
      setCurrentWizardFileName(displayName);
    } catch (err) {
      console.error("Error loading meter for wizard:", err);
      moveToNextMeterInQueue(meterId, 'failed', String(err));
    }
  };

  // Handle wizard close (skip current meter or close error dialog)
  const handleWizardClose = () => {
    // Clear error state if present
    if (wizardError) {
      setWizardError(null);
      setCurrentWizardMeterId(null);
      setCurrentWizardCsvContent(null);
      setCurrentWizardFileName("");
      return;
    }
    
    if (currentWizardMeterId) {
      moveToNextMeterInQueue(currentWizardMeterId, 'skipped', 'User skipped');
    } else {
      setCurrentWizardMeterId(null);
      setCurrentWizardCsvContent(null);
      setCurrentWizardFileName("");
      setProcessingQueue([]);
    }
  };

  // Handle wizard process completion
  const handleWizardProcess = async (config: WizardParseConfig, parsedData: ParsedData) => {
    if (!currentWizardMeterId) return;
    
    setIsWizardProcessing(true);
    const meterId = currentWizardMeterId;
    const displayName = currentWizardFileName;
    
    try {
      // Process the CSV with user-configured columns
      const profile = processCSVToLoadProfile(parsedData.headers, parsedData.rows, config);
      
      if (profile.dataPoints === 0 || profile.totalKwh === 0) {
        console.warn(`Profile empty for ${displayName}`);
        moveToNextMeterInQueue(meterId, 'failed', 'Empty profile - check column selection');
        return;
      }
      
      // Calculate stats
      const dateRangeStart = profile.dateRangeStart || parsedData.dateRange?.start || null;
      const dateRangeEnd = profile.dateRangeEnd || parsedData.dateRange?.end || null;
      const totalDays = Math.max(1, profile.weekdayDays + profile.weekendDays);
      const avgDailyKwh = profile.totalKwh / totalDays;

      // Build new raw_data WITHOUT CSV content
      const newRawData = [{
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
          processed_at: new Date().toISOString(),
        })
        .eq("id", meterId);

      if (updateError) {
        console.error("Failed to update meter:", updateError);
        moveToNextMeterInQueue(meterId, 'failed', updateError.message);
      } else {
        moveToNextMeterInQueue(meterId, 'success', `${profile.dataPoints} readings`);
      }
    } catch (err) {
      console.error("Error processing meter:", err);
      moveToNextMeterInQueue(meterId, 'failed', String(err));
    } finally {
      setIsWizardProcessing(false);
    }
  };

  // Move to next meter in queue after processing current one
  const moveToNextMeterInQueue = async (
    processedMeterId: string, 
    status: 'success' | 'skipped' | 'failed',
    message: string
  ) => {
    // Add to completed list
    setWizardCompletedMeters(prev => [...prev, {
      id: processedMeterId,
      name: currentWizardFileName || processedMeterId.slice(0, 8),
      status,
      message
    }]);
    
    // Remove from queue and get next
    const remainingQueue = processingQueue.filter(id => id !== processedMeterId);
    setProcessingQueue(remainingQueue);
    
    if (remainingQueue.length > 0) {
      // Load next meter
      await loadMeterForWizard(remainingQueue[0]);
    } else {
      // All done
      setCurrentWizardMeterId(null);
      setCurrentWizardCsvContent(null);
      setCurrentWizardFileName("");
      queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      toast.success("All meters processed!");
    }
  };

  // Process All handler using wizard
  // Only include meters that have actual CSV data (data_points > 0) and aren't processed yet
  const handleProcessAllWithWizard = () => {
    // Filter to meters that have data_points (CSV uploaded) but aren't processed yet
    const unprocessed = siteMeters?.filter(m => {
      const hasDataPoints = m.data_points && m.data_points > 0;
      return hasDataPoints && !isProcessed(m);
    }) || [];
    
    if (unprocessed.length === 0) {
      const listedOnly = siteMeters?.filter(m => !m.data_points || m.data_points === 0) || [];
      if (listedOnly.length > 0) {
        toast.info(`All meters with data are processed. ${listedOnly.length} meters are listed only (no CSV uploaded).`);
      } else {
        toast.info("All meters already processed");
      }
      return;
    }
    toast.info(`Starting column configuration for ${unprocessed.length} meters...`);
    startWizardProcessing(unprocessed.map(m => m.id));
  };

  // Process single meter with wizard
  const handleConfigureSingleMeter = async (meter: Meter) => {
    setWizardCompletedMeters([]);
    setProcessingQueue([meter.id]);
    await loadMeterForWizard(meter.id);
  };

  const resetForm = () => {
    setFormData({ name: "", site_type: "", location: "", latitude: null, longitude: null });
    setEditingSite(null);
  };

  const openEditDialog = (site: Site, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSite(site);
    setFormData({
      name: site.name,
      site_type: site.site_type || "",
      location: site.location || "",
      latitude: site.latitude,
      longitude: site.longitude,
    });
    setSiteDialogOpen(true);
  };

  const handleSubmit = () => {
    saveSite.mutate({
      name: formData.name,
      site_type: formData.site_type || null,
      location: formData.location || null,
      latitude: formData.latitude,
      longitude: formData.longitude,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  // Show site meters view when a site is selected
  if (selectedSite) {
    const processedCount = siteMeters?.filter(m => isProcessed(m)).length || 0;
    // Only count meters with actual CSV data (data_points > 0) that need processing
    const metersWithData = siteMeters?.filter(m => m.data_points && m.data_points > 0) || [];
    const unprocessedCount = metersWithData.filter(m => !isProcessed(m)).length;
    const listedOnlyCount = (siteMeters?.length || 0) - metersWithData.length;

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedSite(null); setSiteDetailTab("meters"); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {selectedSite.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedSite.location || "No location"} • {selectedSite.site_type || "No type"}
              </p>
            </div>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Meters
          </Button>
        </div>

        {/* Site Detail Tabs */}
        <Tabs value={siteDetailTab} onValueChange={setSiteDetailTab}>
          <TabsList>
            <TabsTrigger value="meters" className="gap-2">
              <Database className="h-4 w-4" />
              Meters
            </TabsTrigger>
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="stacking" className="gap-2">
              <Layers className="h-4 w-4" />
              Stacking
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2">
              <GitCompare className="h-4 w-4" />
              Comparison
            </TabsTrigger>
          </TabsList>

          {/* Meters Tab */}
          <TabsContent value="meters">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Uploaded Meters
                    </CardTitle>
                    <CardDescription>
                      {siteMeters?.length || 0} meter{(siteMeters?.length || 0) !== 1 ? "s" : ""}
                      {listedOnlyCount > 0 && (
                        <span className="ml-2 text-amber-600">• {listedOnlyCount} listed only</span>
                      )}
                      {unprocessedCount > 0 && (
                        <span className="ml-2 text-orange-600">• {unprocessedCount} with data need processing</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deleteDuplicateMeters}
                      disabled={isDeletingDuplicates || !siteMeters?.length}
                    >
                      {isDeletingDuplicates ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete Duplicates
                    </Button>
                    {selectedMeterIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleteMeters.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected ({selectedMeterIds.size})
                      </Button>
                    )}
                    {unprocessedCount > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleProcessAllWithWizard}
                        disabled={processingQueue.length > 0}
                      >
                        {processingQueue.length > 0 ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Settings className="h-4 w-4 mr-2" />
                        )}
                        Process All ({unprocessedCount})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingMeters ? (
                  <div className="text-center py-8 text-muted-foreground">Loading meters...</div>
                ) : !siteMeters?.length ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground mb-4">No meters uploaded yet</p>
                    <Button onClick={() => setUploadDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Meters
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={siteMeters.length > 0 && selectedMeterIds.size === siteMeters.length}
                            onCheckedChange={toggleAllMeters}
                          />
                        </TableHead>
                        <TableHead>Meter Name</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Interval</TableHead>
                        <TableHead>Data Points</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siteMeters.map((meter) => {
                        const processed = isProcessed(meter);
                        const isProcessing = processingMeterId === meter.id;

                        return (
                          <TableRow key={meter.id} className={selectedMeterIds.has(meter.id) ? "bg-muted/50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedMeterIds.has(meter.id)}
                                onCheckedChange={() => toggleMeterSelection(meter.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {meter.shop_name || meter.site_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {meter.file_name || "-"}
                            </TableCell>
                            <TableCell>
                              {processed ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Processed
                                </Badge>
                              ) : (meter.data_points || 0) > 0 ? (
                                <Badge variant="secondary">Pending</Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Listed Only
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {meter.detected_interval_minutes ? (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {meter.detected_interval_minutes}-min
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {meter.data_points?.toLocaleString() || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(meter.date_range_start)} — {formatDate(meter.date_range_end)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {/* Configure button - for meters with CSV data */}
                                {(meter.data_points || 0) > 0 ? (
                                  <>
                                    <Button
                                      variant={!processed ? "default" : "ghost"}
                                      size="icon"
                                      onClick={() => handleConfigureSingleMeter(meter)}
                                      disabled={processingQueue.includes(meter.id)}
                                      title={processed ? "Reconfigure columns" : "Configure columns"}
                                    >
                                      {processingQueue.includes(meter.id) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Settings className="h-4 w-4" />
                                      )}
                                    </Button>
                                    {/* Reprocess button - force reprocess with existing settings */}
                                    {processed && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleReprocessMeter(meter)}
                                        disabled={reprocessingMeterId === meter.id}
                                        title="Reprocess CSV data"
                                      >
                                        {reprocessingMeterId === meter.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  /* Upload button - for listed-only meters without CSV data */
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setReimportMeter(meter)}
                                    title="Upload CSV data for this meter"
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Delete this meter?")) {
                                      deleteMeter.mutate(meter.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <SiteMeterOverview 
              siteId={selectedSite.id}
              siteName={selectedSite.name}
            />
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis">
            <MeterAnalysis siteId={selectedSite.id} />
          </TabsContent>

          {/* Stacking Tab */}
          <TabsContent value="stacking">
            <ProfileStacking siteId={selectedSite.id} />
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison">
            <MeterComparison siteId={selectedSite.id} />
          </TabsContent>
        </Tabs>

        {/* Upload Dialog - with Bulk CSV Automation */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Meters to {selectedSite.name}
              </DialogTitle>
              <DialogDescription>
                Drag & drop CSV files for automatic processing with smart meter matching
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {/* One-Click Bulk Import - Primary Option */}
              <BulkCsvDropzone 
                siteId={selectedSite.id}
                onComplete={() => {
                  setUploadDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite.id] });
                  queryClient.invalidateQueries({ queryKey: ["sites"] });
                  queryClient.invalidateQueries({ queryKey: ["sites-with-stats"] });
                  queryClient.invalidateQueries({ queryKey: ["meter-library"] });
                  queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Re-import Dialog */}
        <MeterReimportDialog
          isOpen={!!reimportMeter}
          onClose={() => setReimportMeter(null)}
          meterId={reimportMeter?.id || ""}
          meterName={reimportMeter?.shop_name || reimportMeter?.site_name || ""}
          originalFileName={reimportMeter?.file_name || null}
          siteId={selectedSite?.id}
        />

        {/* Column Selection Dialog for Reprocessing */}
        <ColumnSelectionDialog
          isOpen={!!columnSelectionMeter}
          onClose={() => {
            setColumnSelectionMeter(null);
            setColumnSelectionCsvContent(null);
          }}
          onConfirm={handleColumnSelected}
          csvContent={columnSelectionCsvContent}
          meterName={columnSelectionMeter?.shop_name || columnSelectionMeter?.site_name || ""}
          isProcessing={reprocessingMeterId === columnSelectionMeter?.id}
        />
      </div>
    );
  }

  // Handle setting location from map view
  const handleMapLocationSet = async (siteId: string, lat: number, lng: number) => {
    try {
      const { error } = await supabase
        .from("sites")
        .update({ latitude: lat, longitude: lng })
        .eq("id", siteId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["sites-with-stats"] });
      toast.success("Site location updated");
    } catch (error) {
      console.error("Failed to update site location:", error);
      toast.error("Failed to update location");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sites</h2>
          <p className="text-sm text-muted-foreground">
            Manage sites and upload meter data for each location
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* View toggle */}
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "list" | "map")}>
            <ToggleGroupItem value="list" size="sm" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="map" size="sm" aria-label="Map view">
              <MapIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={() => setSheetImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import Sheet
          </Button>
          <Dialog
            open={siteDialogOpen}
            onOpenChange={(open) => {
              setSiteDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingSite ? "Edit" : "Add"} Site</DialogTitle>
                <DialogDescription>
                  {editingSite ? "Update site details" : "Create a new site to organize meter data"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Site Name *</Label>
                  <Input
                    placeholder="e.g., Clearwater Mall, Sandton City"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location Text</Label>
                  <Input
                    placeholder="e.g., Johannesburg, South Africa"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site Type</Label>
                  <Input
                    placeholder="e.g., Shopping Centre, Office Park, Industrial"
                    value={formData.site_type}
                    onChange={(e) => setFormData({ ...formData, site_type: e.target.value })}
                  />
                </div>
                {/* Map for location selection */}
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Map Location</span>
                    {formData.latitude && formData.longitude && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                      </Badge>
                    )}
                  </Label>
                  <SiteLocationMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    siteName={formData.name}
                    editable={true}
                    onLocationChange={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })}
                    compact={true}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!formData.name || saveSite.isPending}
                >
                  {editingSite ? "Update" : "Create"} Site
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sheet Import Dialog */}
      <Dialog open={sheetImportOpen} onOpenChange={setSheetImportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Sites & Shops from Excel
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to create sites and meter placeholders
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <SheetImport
              onImportComplete={() => {
                setSheetImportOpen(false);
                queryClient.invalidateQueries({ queryKey: ["sites"] });
                queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Sites View - List or Map */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading sites...</div>
      ) : !sites?.length ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">No sites yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create a site to start uploading meter data
            </p>
            <Button onClick={() => setSiteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Site
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "map" ? (
        <SitesMapView
          sites={sites}
          onSiteSelect={setSelectedSite}
          onLocationSet={handleMapLocationSet}
          selectedSiteId={selectedSite?.id}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card 
              key={site.id} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedSite(site)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{site.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => openEditDialog(site, e)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${site.name}"? Meters will be unassigned.`)) {
                          deleteSite.mutate(site.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {site.site_type && (
                  <Badge variant="outline" className="mt-1">{site.site_type}</Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Meters with CSV data */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      With Data
                    </span>
                    <Badge variant="default" className={site.meters_with_data ? "bg-green-600" : "bg-muted text-muted-foreground"}>
                      {site.meters_with_data || 0}
                    </Badge>
                  </div>
                  {/* Meters listed only (no CSV) */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-4 w-4 text-amber-500" />
                      Listed Only
                    </span>
                    <Badge variant="outline" className={site.meters_listed_only ? "border-amber-500/50 text-amber-600" : ""}>
                      {site.meters_listed_only || 0}
                    </Badge>
                  </div>
                  {/* Coordinates badge */}
                  {site.latitude && site.longitude ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Navigation className="h-4 w-4 text-primary" />
                      <Badge variant="secondary" className="font-mono text-xs">
                        {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                      </Badge>
                    </div>
                  ) : site.location ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {site.location}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground/50">
                      <MapPin className="h-4 w-4" />
                      No location set
                    </div>
                  )}
                  {site.total_area_sqm && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Ruler className="h-4 w-4" />
                      {site.total_area_sqm.toLocaleString()} m²
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CSV Import Wizard for processing meters */}
      <CsvImportWizard
        isOpen={!!currentWizardMeterId}
        onClose={handleWizardClose}
        csvContent={currentWizardCsvContent}
        fileName={currentWizardFileName}
        onProcess={handleWizardProcess}
        isProcessing={isWizardProcessing}
        errorMessage={wizardError?.message}
      />

      {/* Processing queue indicator */}
      {processingQueue.length > 0 && currentWizardMeterId && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-4 max-w-sm z-50">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary animate-pulse" />
            <div>
              <p className="font-medium text-sm">Configuring Meters</p>
              <p className="text-xs text-muted-foreground">
                {processingQueue.length} remaining • Configure columns for each meter
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
