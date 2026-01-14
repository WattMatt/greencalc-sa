import { useState, useMemo, useCallback } from "react";
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
import { Database, Edit2, Trash2, Tag, Palette, Hash, Store, Ruler, Search, X, ArrowUpDown, RefreshCw, Loader2, CheckCircle2, Circle, Info, Eye, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { processCSVToLoadProfile } from "./utils/csvToLoadProfile";
import { WizardParseConfig, ColumnConfig, ParsedData } from "./types/csvImportTypes";
import { MeterProfilePreview } from "./MeterProfilePreview";
import { CsvImportWizard } from "./CsvImportWizard";

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
  load_profile_weekday: number[] | null;
  load_profile_weekend: number[] | null;
  weekday_days: number | null;
  weekend_days: number | null;
  processed_at: string | null;
  category_id: string | null;
}

interface MonthlyEstimate {
  kwhPerMonth: number;
  method: 'profile' | 'area-estimate';
  dailyWeekdayKwh: number;
  dailyWeekendKwh: number;
  weekdayDays: number;
  weekendDays: number;
  // For area-based estimates
  vaPerSqm?: number;
  operatingHours?: number;
  diversityFactor?: number;
  powerFactor?: number;
}

interface CompletedMeter {
  id: string;
  name: string;
  status: 'success' | 'skipped' | 'failed';
  message: string;
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
  const [previewMeter, setPreviewMeter] = useState<ScadaImport | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Reprocess progress and completed list
  const [reprocessProgress, setReprocessProgress] = useState<{ 
    current: number; 
    total: number; 
    currentMeter: string;
    batch: number;
    totalBatches: number;
  } | null>(null);
  const [completedMeters, setCompletedMeters] = useState<CompletedMeter[]>([]);
  
  // Wizard-based processing queue
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [currentWizardMeterId, setCurrentWizardMeterId] = useState<string | null>(null);
  const [currentWizardCsvContent, setCurrentWizardCsvContent] = useState<string | null>(null);
  const [currentWizardFileName, setCurrentWizardFileName] = useState<string>("");
  const [isWizardProcessing, setIsWizardProcessing] = useState(false);
  
  const BATCH_SIZE = 20; // Process 20 meters at a time

  const { data: meters, isLoading } = useQuery({
    queryKey: ["meter-library", siteId],
    queryFn: async () => {
      // IMPORTANT: Do NOT include raw_data here - it's huge and causes timeouts
      let query = supabase
        .from("scada_imports")
        .select("id, site_name, site_id, shop_number, shop_name, area_sqm, meter_label, meter_color, date_range_start, date_range_end, data_points, created_at, load_profile_weekday, load_profile_weekend, weekday_days, weekend_days, processed_at, category_id")
        .order("created_at", { ascending: false });
      
      if (siteId) {
        query = query.eq("site_id", siteId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ScadaImport[];
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

  // Re-process meters in batches to avoid timeouts and system strain
  const reprocessMeters = useMutation({
    mutationFn: async (meterIds: string[]) => {
      if (!meterIds.length) throw new Error("No meters to process");

      console.log(`[Reprocess] Requested to process ${meterIds.length} meters`);

      // For large batches, don't pre-filter - just process directly
      // The filtering was causing issues with large IN queries
      let unprocessedIds: string[] = [];
      
      if (meterIds.length > 100) {
        // For large sets, process in chunks to check unprocessed status
        const chunkSize = 50;
        for (let i = 0; i < meterIds.length; i += chunkSize) {
          const chunk = meterIds.slice(i, i + chunkSize);
          const { data: unprocessedChunk, error } = await supabase
            .from("scada_imports")
            .select("id")
            .in("id", chunk)
            .is("processed_at", null);
          
          if (error) {
            console.error(`[Reprocess] Error checking unprocessed status:`, error);
            continue;
          }
          unprocessedIds.push(...(unprocessedChunk?.map(m => m.id) || []));
        }
      } else {
        // For smaller sets, single query is fine
        const { data: unprocessedCheck, error } = await supabase
          .from("scada_imports")
          .select("id, shop_name, processed_at")
          .in("id", meterIds)
          .is("processed_at", null);
        
        if (error) {
          console.error(`[Reprocess] Error checking unprocessed status:`, error);
        }
        unprocessedIds = unprocessedCheck?.map(m => m.id) || [];
      }
      
      console.log(`[Reprocess] Found ${unprocessedIds.length} unprocessed meters out of ${meterIds.length}`);
      
      if (unprocessedIds.length === 0) {
        toast.info("All meters already processed. Use 'Clear Processed' to reset.");
        return { processed: 0, failed: 0, skipped: 0, alreadyDone: meterIds.length };
      }

      let processed = 0;
      let failed = 0;
      let skipped = 0;
      const total = unprocessedIds.length;
      const totalBatches = Math.ceil(total / BATCH_SIZE);
      
      console.log(`[Reprocess] Starting: ${total} unprocessed meters in ${totalBatches} batches of ${BATCH_SIZE}`);
      setCompletedMeters([]);

      // Process in batches
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batchStart = batchIdx * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
        const batchMeterIds = unprocessedIds.slice(batchStart, batchEnd);
        
        console.log(`[Reprocess] Batch ${batchIdx + 1}/${totalBatches}: Processing meters ${batchStart + 1}-${batchEnd}`);
        
        setReprocessProgress({ 
          current: batchStart, 
          total, 
          currentMeter: `Starting batch ${batchIdx + 1} of ${totalBatches}...`,
          batch: batchIdx + 1,
          totalBatches
        });

        // Process each meter in the batch
        for (let i = 0; i < batchMeterIds.length; i++) {
          const meterId = batchMeterIds[i];
          const overallIdx = batchStart + i;
          
          try {
            setReprocessProgress({ 
              current: overallIdx + 1, 
              total, 
              currentMeter: `Fetching meter ${overallIdx + 1}...`,
              batch: batchIdx + 1,
              totalBatches
            });
            
            // Fetch one meter at a time to avoid timeout with large raw_data
            const { data: meter, error: fetchError } = await supabase
              .from("scada_imports")
              .select("id, raw_data, shop_name, site_name")
              .eq("id", meterId)
              .single();

            if (fetchError) {
              console.error(`[Reprocess] Failed to fetch meter ${meterId}:`, fetchError);
              failed++;
              setCompletedMeters(prev => [...prev, { 
                id: meterId, 
                name: meterId.slice(0, 8), 
                status: 'failed', 
                message: 'Fetch error' 
              }]);
              continue;
            }

            const displayName = meter.shop_name || meter.site_name || meterId.slice(0, 8);
            setReprocessProgress({ 
              current: overallIdx + 1, 
              total, 
              currentMeter: `Processing ${displayName}...`,
              batch: batchIdx + 1,
              totalBatches
            });

            // Extract CSV content from raw_data
            const rawData = meter.raw_data as { csvContent?: string }[] | null;
            const csvContent = rawData?.[0]?.csvContent;

            if (!csvContent) {
              console.warn(`[Reprocess] ${displayName}: No CSV content stored - skipping`);
              skipped++;
              setCompletedMeters(prev => [...prev, { 
                id: meter.id, 
                name: displayName, 
                status: 'skipped', 
                message: 'No CSV data' 
              }]);
              continue;
            }
            
            console.log(`[Reprocess] ${displayName}: Found CSV with ${csvContent.length} chars`);

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

              for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"' && !inQuotes) {
                  inQuotes = true;
                } else if (char === '"' && inQuotes) {
                  if (line[j + 1] === '"') {
                    current += '"';
                    j++;
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
            console.log(`[Reprocess] ${displayName}: Detected ${headers.length} columns, ${rows.length} rows`);
            
            const profile = processCSVToLoadProfile(headers, rows, parseConfig);

            // Validation check - if profile has zeros, something went wrong
            if (profile.dataPoints === 0 || profile.totalKwh === 0) {
              console.warn(`[Reprocess] ${displayName}: Profile empty! dataPoints=${profile.dataPoints}, totalKwh=${profile.totalKwh}`);
              failed++;
              setCompletedMeters(prev => [...prev, { 
                id: meter.id, 
                name: displayName, 
                status: 'failed', 
                message: 'Empty profile' 
              }]);
              continue;
            }
            
            console.log(`[Reprocess] ${displayName}: SUCCESS - ${profile.dataPoints} points, ${profile.totalKwh.toFixed(1)} total kWh`);

            // Calculate stats
            const dateRangeStart = profile.dateRangeStart || dateRange?.start || null;
            const dateRangeEnd = profile.dateRangeEnd || dateRange?.end || null;
            const totalDays = Math.max(1, profile.weekdayDays + profile.weekendDays);
            const avgDailyKwh = profile.totalKwh / totalDays;

            // Build new raw_data WITHOUT CSV content (clear it to save space)
            const newRawData = [{
              // csvContent intentionally removed to save storage
              totalKwh: profile.totalKwh,
              avgDailyKwh,
              peakKw: profile.peakKw,
              avgKw: profile.avgKw,
              dataPoints: profile.dataPoints,
              dateStart: dateRangeStart,
              dateEnd: dateRangeEnd,
            }];

            // Update the meter with processed_at timestamp
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
              .eq("id", meter.id);

            if (updateError) {
              console.error(`Failed to update meter ${meter.id}:`, updateError);
              failed++;
              setCompletedMeters(prev => [...prev, { 
                id: meter.id, 
                name: displayName, 
                status: 'failed', 
                message: updateError.message 
              }]);
            } else {
              processed++;
              setCompletedMeters(prev => [...prev, { 
                id: meter.id, 
                name: displayName, 
                status: 'success', 
                message: `${profile.dataPoints} pts, ${profile.peakKw.toFixed(1)} kW peak` 
              }]);
            }
          } catch (err) {
            console.error(`Error processing meter ${meterId}:`, err);
            failed++;
            setCompletedMeters(prev => [...prev, { 
              id: meterId, 
              name: meterId.slice(0, 8), 
              status: 'failed', 
              message: String(err) 
            }]);
          }
        } // end inner for (meters in batch)
        
        // Pause between batches to let the system breathe
        if (batchIdx < totalBatches - 1) {
          console.log(`[Reprocess] Batch ${batchIdx + 1} complete. Pausing before next batch...`);
          setReprocessProgress({ 
            current: batchEnd, 
            total, 
            currentMeter: `Batch ${batchIdx + 1} complete. Pausing...`,
            batch: batchIdx + 1,
            totalBatches
          });
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms pause between batches
        }
      } // end outer for (batches)

      console.log(`[Reprocess] Complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);
      return { processed, failed, skipped };
    },
    onSuccess: ({ processed, failed, skipped }) => {
      setReprocessProgress(null);
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      if (failed > 0 || skipped > 0) {
        toast.warning(`Reprocessed ${processed} meters, ${skipped} skipped (no CSV), ${failed} failed`);
      } else {
        toast.success(`Reprocessed ${processed} meters successfully`);
      }
    },
    onError: (error) => {
      setReprocessProgress(null);
      toast.error(`Reprocess failed: ${error.message}`);
    },
  });

  const handleReprocessSelected = () => {
    if (selectedIds.size === 0) {
      toast.error("No meters selected");
      return;
    }
    // Use wizard-based processing for selected meters
    startWizardProcessing(Array.from(selectedIds));
  };

  const handleReprocessAll = () => {
    if (!filteredMeters.length) {
      toast.error("No meters to reprocess");
      return;
    }
    // Count unprocessed meters
    const unprocessedMeters = filteredMeters.filter(m => !m.processed_at);
    if (unprocessedMeters.length === 0) {
      toast.info("All meters already processed. Use 'Clear Processed' to reset.");
      return;
    }
    // Start wizard-based processing - user must configure columns for each meter
    toast.info(`Starting column configuration for ${unprocessedMeters.length} meters...`);
    startWizardProcessing(unprocessedMeters.map(m => m.id));
  };

  // Start wizard-based processing for a list of meter IDs
  const startWizardProcessing = async (meterIds: string[]) => {
    if (meterIds.length === 0) return;
    
    // Filter to only unprocessed meters
    const { data: unprocessedCheck } = await supabase
      .from("scada_imports")
      .select("id")
      .in("id", meterIds)
      .is("processed_at", null);
    
    const unprocessedIds = unprocessedCheck?.map(m => m.id) || [];
    
    if (unprocessedIds.length === 0) {
      toast.info("All selected meters already processed.");
      return;
    }
    
    setCompletedMeters([]);
    setProcessingQueue(unprocessedIds);
    // Load the first meter's CSV and open wizard
    await loadMeterForWizard(unprocessedIds[0]);
  };

  // Load a meter's CSV content and open the wizard
  const loadMeterForWizard = async (meterId: string) => {
    try {
      const { data: meter, error } = await supabase
        .from("scada_imports")
        .select("id, raw_data, shop_name, site_name")
        .eq("id", meterId)
        .single();
      
      if (error || !meter) {
        console.error("Failed to fetch meter for wizard:", error);
        toast.error("Failed to load meter data");
        moveToNextMeterInQueue(meterId, 'failed', 'Failed to load');
        return;
      }
      
      const rawData = meter.raw_data as { csvContent?: string }[] | null;
      const csvContent = rawData?.[0]?.csvContent;
      
      if (!csvContent) {
        console.warn("No CSV content for meter:", meterId);
        moveToNextMeterInQueue(meterId, 'skipped', 'No CSV data stored');
        return;
      }
      
      const displayName = meter.shop_name || meter.site_name || meterId.slice(0, 8);
      setCurrentWizardMeterId(meterId);
      setCurrentWizardCsvContent(csvContent);
      setCurrentWizardFileName(displayName);
    } catch (err) {
      console.error("Error loading meter for wizard:", err);
      moveToNextMeterInQueue(meterId, 'failed', String(err));
    }
  };

  // Handle wizard close (skip current meter)
  const handleWizardClose = () => {
    if (currentWizardMeterId) {
      moveToNextMeterInQueue(currentWizardMeterId, 'skipped', 'User skipped');
    } else {
      // Just close if no meter
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
    setCompletedMeters(prev => [...prev, {
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
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      toast.success("All meters processed!");
    }
  };

  const handleClearProcessed = async () => {
    if (!meters?.length) return;
    const processedCount = meters.filter(m => m.processed_at).length;
    if (processedCount === 0) {
      toast.info("No processed meters to clear");
      return;
    }
    if (confirm(`Clear processed status from ${processedCount} meter(s)? This will allow them to be reprocessed.`)) {
      const { error } = await supabase
        .from("scada_imports")
        .update({ processed_at: null })
        .not("processed_at", "is", null);
      
      if (error) {
        toast.error(error.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["meter-library"] });
        toast.success(`Cleared processed status from ${processedCount} meters`);
      }
    }
  };

  // Single meter configure via wizard
  const handleConfigureSingleMeter = async (meterId: string) => {
    // First clear the processed_at flag so it will be reprocessed
    await supabase
      .from("scada_imports")
      .update({ processed_at: null })
      .eq("id", meterId);
    
    // Start wizard processing for just this meter
    setCompletedMeters([]);
    setProcessingQueue([meterId]);
    await loadMeterForWizard(meterId);
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

  // Calculate estimated monthly kWh from load profile data OR area-based estimate
  // Method 1 (profile): Use actual 48 half-hour values × days
  // Method 2 (area-estimate): VA/sqm × area × operating hours × derating factors
  const getMonthlyKwhEstimate = (meter: ScadaImport): MonthlyEstimate | null => {
    const avgWeekdaysPerMonth = 22;
    const avgWeekendsPerMonth = 8;
    
    // METHOD 1: Use actual load profile data if available
    if (meter.load_profile_weekday && meter.load_profile_weekday.length > 0) {
      // Sum the 48 half-hourly values to get daily kWh
      const dailyWeekdayKwh = meter.load_profile_weekday.reduce((sum, val) => sum + (val || 0), 0);
      
      // Use weekend profile if available, otherwise use weekday as fallback
      const dailyWeekendKwh = meter.load_profile_weekend && meter.load_profile_weekend.length > 0
        ? meter.load_profile_weekend.reduce((sum, val) => sum + (val || 0), 0)
        : dailyWeekdayKwh * 0.7; // Assume 70% of weekday for weekend if no data
      
      // Use actual recorded days if available
      const weekdayDays = meter.weekday_days || avgWeekdaysPerMonth;
      const weekendDays = meter.weekend_days || avgWeekendsPerMonth;
      
      // Scale to monthly estimate
      const monthlyEstimate = (dailyWeekdayKwh * avgWeekdaysPerMonth) + (dailyWeekendKwh * avgWeekendsPerMonth);
      
      return {
        kwhPerMonth: monthlyEstimate,
        method: 'profile',
        dailyWeekdayKwh,
        dailyWeekendKwh,
        weekdayDays,
        weekendDays,
      };
    }
    
    // METHOD 2: Area-based estimate using VA/sqm methodology
    if (meter.area_sqm && meter.area_sqm > 0) {
      // Default retail benchmarks (can be refined by category)
      const vaPerSqm = 65;           // VA/m² - typical retail (range: 50-100)
      const operatingHours = 12;     // Hours per day (retail typically 10-14)
      const daysPerMonth = 30;
      const diversityFactor = 0.65;  // Not all loads run simultaneously (0.5-0.8)
      const powerFactor = 0.92;      // Typical commercial PF (0.85-0.95)
      const loadFactor = 0.55;       // Average vs peak demand ratio (0.4-0.7)
      
      // Formula: kWh = (VA/sqm × area × hours × days × diversity × loadFactor × PF) / 1000
      // Simplified: Connected load (kVA) × hours × load factor × days
      const connectedLoadKva = (vaPerSqm * meter.area_sqm) / 1000;
      const dailyKwh = connectedLoadKva * operatingHours * loadFactor * diversityFactor * powerFactor;
      const monthlyKwh = dailyKwh * daysPerMonth;
      
      return {
        kwhPerMonth: monthlyKwh,
        method: 'area-estimate',
        dailyWeekdayKwh: dailyKwh,
        dailyWeekendKwh: dailyKwh * 0.7, // Assume 70% on weekends
        weekdayDays: avgWeekdaysPerMonth,
        weekendDays: avgWeekendsPerMonth,
        vaPerSqm,
        operatingHours,
        diversityFactor,
        powerFactor,
      };
    }
    
    return null;
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
                  disabled={processingQueue.length > 0}
                >
                  {processingQueue.length > 0 ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-1" />
                  )}
                  Process {selectedIds.size} selected
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
            
            {/* Process All button - requires column selection for each */}
            {(() => {
              const unprocessedCount = filteredMeters.filter(m => !m.processed_at).length;
              return unprocessedCount > 0 && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleReprocessAll}
                  disabled={processingQueue.length > 0 || !meters?.length}
                >
                  {processingQueue.length > 0 ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-1" />
                  )}
                  Process All ({unprocessedCount})
                </Button>
              );
            })()}
            
            {/* Clear Processed button */}
            {meters && meters.some(m => m.processed_at) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearProcessed}
                disabled={processingQueue.length > 0}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Processed ({meters.filter(m => m.processed_at).length})
              </Button>
            )}
          </div>
          
          {/* Progress indicator */}
          {reprocessProgress && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">
                      Batch {reprocessProgress.batch} of {reprocessProgress.totalBatches} — Meter {reprocessProgress.current} of {reprocessProgress.total}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round((reprocessProgress.current / reprocessProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(reprocessProgress.current / reprocessProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{reprocessProgress.currentMeter}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Completed meters list (shown during/after processing) */}
          {completedMeters.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 border max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Completed ({completedMeters.length})</span>
                {!reprocessProgress && (
                  <Button variant="ghost" size="sm" onClick={() => setCompletedMeters([])}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {completedMeters.map((cm, idx) => (
                  <div key={`${cm.id}-${idx}`} className="flex items-center gap-2 text-xs">
                    {cm.status === 'success' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    {cm.status === 'skipped' && <Circle className="h-3 w-3 text-yellow-500" />}
                    {cm.status === 'failed' && <X className="h-3 w-3 text-destructive" />}
                    <span className="font-medium">{cm.name}</span>
                    <span className="text-muted-foreground">{cm.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    <TableHead className="w-8">Status</TableHead>
                    <TableHead className="w-8">Color</TableHead>
                    <TableHead>Meter / Label</TableHead>
                    <TableHead className="text-right">Total kWh</TableHead>
                    <TableHead>Area (m²)</TableHead>
                    <TableHead>Days (WD/WE)</TableHead>
                    <TableHead>Peak kW</TableHead>
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
                        <div title={meter.processed_at ? `Processed: ${format(new Date(meter.processed_at), 'MMM d, HH:mm')}` : "Not processed"}>
                          {meter.processed_at ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
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
                    <TableCell className="text-right">
                      {(() => {
                        // Only show actual recorded data - no estimates
                        if (!meter.load_profile_weekday || meter.load_profile_weekday.length === 0) {
                          return <span className="text-muted-foreground text-sm">-</span>;
                        }
                        
                        // Calculate total recorded kWh from actual days
                        const dailyWeekdayKwh = meter.load_profile_weekday.reduce((sum, val) => sum + (val || 0), 0);
                        const dailyWeekendKwh = meter.load_profile_weekend && meter.load_profile_weekend.length > 0
                          ? meter.load_profile_weekend.reduce((sum, val) => sum + (val || 0), 0)
                          : 0;
                        
                        const weekdayDays = meter.weekday_days || 0;
                        const weekendDays = meter.weekend_days || 0;
                        const totalDays = weekdayDays + weekendDays;
                        
                        // Calculate total recorded kWh
                        const totalKwh = (dailyWeekdayKwh * weekdayDays) + (dailyWeekendKwh * weekendDays);
                        
                        const displayValue = totalKwh >= 1000 
                          ? `${(totalKwh / 1000).toFixed(1)}K`
                          : totalKwh.toFixed(0);
                        
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-mono font-medium cursor-help underline decoration-dotted underline-offset-2">
                                  {displayValue}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1.5 text-xs">
                                  <p className="font-semibold">Recorded Consumption</p>
                                  <div className="border-t pt-1 space-y-0.5">
                                    <p>Weekdays: <span className="font-mono">{dailyWeekdayKwh.toFixed(1)} kWh/day</span> × {weekdayDays} days</p>
                                    {weekendDays > 0 && (
                                      <p>Weekends: <span className="font-mono">{dailyWeekendKwh.toFixed(1)} kWh/day</span> × {weekendDays} days</p>
                                    )}
                                    <p className="font-medium pt-1 border-t mt-1">
                                      Total: <span className="font-mono">{totalKwh.toLocaleString()} kWh</span> ({totalDays} days)
                                    </p>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
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
                        // Calculate peak from load profile
                        const profilePeak = meter.load_profile_weekday 
                          ? Math.max(...meter.load_profile_weekday, 0)
                          : 0;
                        return profilePeak > 0 ? (
                          <span className="text-sm font-mono">{profilePeak.toFixed(1)}</span>
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
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={!meter.processed_at ? "default" : "ghost"}
                                size="icon"
                                onClick={() => handleConfigureSingleMeter(meter.id)}
                                disabled={processingQueue.includes(meter.id)}
                                title="Configure columns"
                              >
                                {processingQueue.includes(meter.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Settings className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{meter.processed_at ? "Reconfigure columns" : "Configure columns"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewMeter(meter)}
                          title="Preview profile"
                          disabled={!meter.load_profile_weekday}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

      {/* Profile Preview Dialog */}
      <MeterProfilePreview
        isOpen={!!previewMeter}
        onClose={() => setPreviewMeter(null)}
        meter={previewMeter}
      />

      {/* CSV Import Wizard for processing meters */}
      <CsvImportWizard
        isOpen={!!currentWizardMeterId}
        onClose={handleWizardClose}
        csvContent={currentWizardCsvContent}
        fileName={currentWizardFileName}
        onProcess={handleWizardProcess}
        isProcessing={isWizardProcessing}
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
