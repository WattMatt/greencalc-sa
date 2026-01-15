import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, Loader2, CheckCircle2, XCircle, AlertCircle, X, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { processCSVToLoadProfile, validateLoadProfile } from "./utils/csvToLoadProfile";
import { WizardParseConfig, ColumnConfig } from "./types/csvImportTypes";

interface ProcessingResult {
  id: string;
  name: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  dataPoints?: number;
  peakKw?: number;
}

interface OneClickBatchProcessorProps {
  meterIds: string[];
  onComplete?: () => void;
  onCancel?: () => void;
}

const BATCH_SIZE = 10;

export function OneClickBatchProcessor({ 
  meterIds, 
  onComplete, 
  onCancel 
}: OneClickBatchProcessorProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [currentMeterName, setCurrentMeterName] = useState("");

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  // Auto-detect and parse CSV content
  const autoParseCSV = useCallback((csvContent: string, previousConfig?: {
    column?: string;
    unit?: string;
    voltageV?: number;
    powerFactor?: number;
  }) => {
    const lines = csvContent.split('\n').filter(l => l.trim());
    
    // Detect PnP SCADA format
    let isPnPScada = false;
    let meterName: string | undefined;
    let dateRange: { start: string; end: string } | undefined;
    let startRow = 1;

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
    const pipeCount = (sampleLine.match(/\|/g) || []).length;

    const delimiters = {
      tab: tabCount >= 2,
      semicolon: semicolonCount >= 2,
      comma: commaCount >= 2 || (tabCount < 2 && semicolonCount < 2 && pipeCount < 2),
      space: false,
      other: pipeCount >= 2,
      otherChar: pipeCount >= 2 ? "|" : "",
    };

    // Build delimiter set
    const delimChars = new Set<string>();
    if (delimiters.tab) delimChars.add('\t');
    if (delimiters.semicolon) delimChars.add(';');
    if (delimiters.comma) delimChars.add(',');
    if (delimiters.other && delimiters.otherChar) delimChars.add(delimiters.otherChar);
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

    // Auto-detect column types with improved patterns
    const columns: ColumnConfig[] = headers.map((header, idx) => {
      const lowerHeader = header.toLowerCase();
      // Date patterns (including German)
      if (lowerHeader.includes('date') || lowerHeader.includes('rdate') || 
          lowerHeader.includes('datum') || lowerHeader.includes('timestamp')) {
        return { index: idx, name: header, dataType: 'date' as const, dateFormat: 'YMD' };
      }
      // Energy/power patterns
      if (lowerHeader.includes('kwh') || lowerHeader.includes('energy') || 
          lowerHeader.includes('consumption') || lowerHeader.includes('kw') ||
          lowerHeader.includes('power') || lowerHeader.includes('demand')) {
        return { index: idx, name: header, dataType: 'general' as const };
      }
      return { index: idx, name: header, dataType: 'text' as const };
    });

    // Find value column - prefer previous config if available
    let valueColumnIndex: number | undefined;
    if (previousConfig?.column) {
      const prevColIdx = headers.findIndex(h => 
        h.toLowerCase() === previousConfig.column?.toLowerCase()
      );
      if (prevColIdx >= 0) valueColumnIndex = prevColIdx;
    }
    
    // If no previous config, auto-detect
    if (valueColumnIndex === undefined) {
      // Look for kWh column first
      const kwhIdx = headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'kwh' || lower.includes('kwh_del') || lower.includes('energy');
      });
      if (kwhIdx >= 0) valueColumnIndex = kwhIdx;
    }

    const parseConfig: WizardParseConfig = {
      fileType: "delimited",
      startRow,
      delimiters,
      treatConsecutiveAsOne: false,
      textQualifier: '"',
      columns,
      detectedFormat: isPnPScada ? "pnp-scada" : "generic",
      valueColumnIndex,
      valueUnit: (previousConfig?.unit as WizardParseConfig['valueUnit']) || "kWh",
      voltageV: previousConfig?.voltageV || 400,
      powerFactor: previousConfig?.powerFactor || 0.9,
    };

    return {
      headers,
      rows,
      parseConfig,
      meterName,
      dateRange,
    };
  }, []);

  // Process a single meter
  const processMeter = async (meterId: string): Promise<ProcessingResult> => {
    try {
      // Fetch meter with raw_data
      const { data: meter, error: fetchError } = await supabase
        .from("scada_imports")
        .select("id, raw_data, shop_name, site_name")
        .eq("id", meterId)
        .single();

      if (fetchError || !meter) {
        return {
          id: meterId,
          name: meterId.slice(0, 8),
          status: 'failed',
          message: 'Failed to fetch meter data'
        };
      }

      const displayName = meter.shop_name || meter.site_name || meterId.slice(0, 8);
      setCurrentMeterName(displayName);

      // Extract CSV and previous config
      const rawData = meter.raw_data as { 
        csvContent?: string;
        processingConfig?: {
          column?: string;
          unit?: string;
          voltageV?: number;
          powerFactor?: number;
        };
      }[] | null;
      
      const csvContent = rawData?.[0]?.csvContent;
      const previousConfig = rawData?.[0]?.processingConfig;

      if (!csvContent) {
        return {
          id: meterId,
          name: displayName,
          status: 'skipped',
          message: 'No CSV data stored'
        };
      }

      // Auto-parse with previous config
      const { headers, rows, parseConfig, dateRange } = autoParseCSV(csvContent, previousConfig);

      // Process into load profile
      const profile = processCSVToLoadProfile(headers, rows, parseConfig);

      // Validate
      if (profile.dataPoints === 0 || profile.totalKwh === 0) {
        return {
          id: meterId,
          name: displayName,
          status: 'failed',
          message: 'Empty profile - check column mapping'
        };
      }

      const validation = validateLoadProfile(profile);
      if (!validation.isValid) {
        return {
          id: meterId,
          name: displayName,
          status: 'failed',
          message: validation.reason || 'Validation failed'
        };
      }

      // Calculate stats
      const dateRangeStart = profile.dateRangeStart || dateRange?.start || null;
      const dateRangeEnd = profile.dateRangeEnd || dateRange?.end || null;
      const totalDays = Math.max(1, profile.weekdayDays + profile.weekendDays);
      const avgDailyKwh = profile.totalKwh / totalDays;

      // Build new raw_data preserving CSV for future reprocessing
      const newRawData = [{
        csvContent, // Preserve for reprocessing
        processingConfig: parseConfig.valueColumnIndex !== undefined ? {
          column: headers[parseConfig.valueColumnIndex],
          unit: parseConfig.valueUnit,
          voltageV: parseConfig.voltageV,
          powerFactor: parseConfig.powerFactor,
        } : undefined,
        totalKwh: profile.totalKwh,
        avgDailyKwh,
        peakKw: profile.peakKw,
        avgKw: profile.avgKw,
        dataPoints: profile.dataPoints,
        dateStart: dateRangeStart,
        dateEnd: dateRangeEnd,
      }];

      // Update meter
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
        return {
          id: meterId,
          name: displayName,
          status: 'failed',
          message: updateError.message
        };
      }

      return {
        id: meterId,
        name: displayName,
        status: 'success',
        message: `${profile.dataPoints} pts, ${profile.peakKw.toFixed(1)} kW peak`,
        dataPoints: profile.dataPoints,
        peakKw: profile.peakKw,
      };
    } catch (err) {
      return {
        id: meterId,
        name: meterId.slice(0, 8),
        status: 'failed',
        message: String(err)
      };
    }
  };

  // Main batch processing function
  const startProcessing = async () => {
    setIsProcessing(true);
    setIsPaused(false);
    setResults([]);
    setProgress({ current: 0, total: meterIds.length });

    const totalBatches = Math.ceil(meterIds.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      // Check if paused
      if (isPaused) {
        await new Promise<void>(resolve => {
          const checkResume = setInterval(() => {
            if (!isPaused) {
              clearInterval(checkResume);
              resolve();
            }
          }, 100);
        });
      }

      const batchStart = batchIdx * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, meterIds.length);
      const batchMeterIds = meterIds.slice(batchStart, batchEnd);

      // Process batch
      for (let i = 0; i < batchMeterIds.length; i++) {
        const meterId = batchMeterIds[i];
        const result = await processMeter(meterId);
        
        setResults(prev => [...prev, result]);
        setProgress({ current: batchStart + i + 1, total: meterIds.length });
      }

      // Brief pause between batches
      if (batchIdx < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    setIsProcessing(false);
    setCurrentMeterName("");
    
    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["meter-library"] });
    queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
    queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });

    const finalSuccess = results.filter(r => r.status === 'success').length + 
      (results.length === 0 ? meterIds.length : 0);
    
    toast.success(`Batch processing complete`, {
      description: `Processed ${meterIds.length} meters`
    });

    onComplete?.();
  };

  const handleCancel = () => {
    setIsProcessing(false);
    setIsPaused(false);
    onCancel?.();
  };

  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-medium">One-Click Batch Processing</span>
            <Badge variant="secondary">{meterIds.length} meters</Badge>
          </div>
          <div className="flex items-center gap-2">
            {!isProcessing ? (
              <Button onClick={startProcessing} size="sm" className="gap-2">
                <Play className="h-4 w-4" />
                Start Processing
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsPaused(!isPaused)}
                  className="gap-2"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        {(isProcessing || results.length > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isProcessing ? currentMeterName || 'Processing...' : 'Complete'}
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{successCount} success</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>{failedCount} failed</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>{skippedCount} skipped</span>
              </div>
            </div>
          </div>
        )}

        {/* Results list (collapsed by default, expandable) */}
        {results.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View details ({results.length} processed)
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1 pl-2 border-l-2 border-muted">
              {results.map((result, idx) => (
                <div key={`${result.id}-${idx}`} className="flex items-center gap-2 py-0.5">
                  {result.status === 'success' && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
                  {result.status === 'failed' && <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                  {result.status === 'skipped' && <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                  <span className="font-medium truncate max-w-[150px]">{result.name}</span>
                  <span className="text-muted-foreground truncate">{result.message}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
