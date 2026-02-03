import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, CheckCircle2, XCircle, AlertTriangle, X, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { processCSVToLoadProfile, validateLoadProfile } from "./utils/csvToLoadProfile";
import { WizardParseConfig, ColumnConfig } from "./types/csvImportTypes";

interface ProcessingResult {
  id: string;
  name: string;
  status: 'success' | 'failed' | 'skipped' | 'needs_review';
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

// Score a column to determine if it's a good value column
const scoreValueColumn = (header: string, sampleValues: string[]): { score: number; unit: 'kWh' | 'kW' } => {
  const lower = header.toLowerCase().trim();
  let score = 0;
  let unit: 'kWh' | 'kW' = 'kWh'; // Default to kWh
  
  // Exact matches get highest priority
  if (lower === 'kwh' || lower === 'kwh_del') {
    score += 100;
    unit = 'kWh';
  } else if (lower === 'kw' || lower === 'power') {
    score += 80;
    unit = 'kW';
  }
  // Pattern matches
  else if (lower.includes('kwh') || lower.includes('energy') || lower.includes('consumption')) {
    score += 70;
    unit = 'kWh';
  } else if (lower.includes('kw') || lower.includes('demand')) {
    score += 60;
    unit = 'kW';
  } else if (lower.includes('value') || lower.includes('reading')) {
    score += 40;
    unit = 'kWh'; // Default to kWh for generic value columns
  }
  
  // Check if values are numeric - boost score if they are
  const numericCount = sampleValues.filter(v => {
    const num = parseFloat(v?.replace?.(',', '.') || '');
    return !isNaN(num) && isFinite(num);
  }).length;
  
  if (numericCount > sampleValues.length * 0.8) {
    score += 25;
  }
  
  // Analyze value patterns to distinguish kW vs kWh
  if (score > 0 && sampleValues.length > 1) {
    const numericValues = sampleValues
      .map(v => parseFloat(v?.replace?.(',', '.') || ''))
      .filter(n => !isNaN(n) && isFinite(n));
    
    if (numericValues.length >= 2) {
      // Check if values are cumulative (monotonically increasing)
      let increasing = 0;
      for (let i = 1; i < numericValues.length; i++) {
        if (numericValues[i] > numericValues[i - 1]) increasing++;
      }
      const isCumulative = increasing > numericValues.length * 0.9;
      
      if (isCumulative) {
        unit = 'kWh'; // Cumulative readings are energy
      }
      
      // Check value magnitude - large values more likely kWh totals
      const maxVal = Math.max(...numericValues);
      if (maxVal > 1000) {
        // Very large values suggest cumulative kWh
        unit = 'kWh';
      }
    }
  }
  
  return { score, unit };
};

export function OneClickBatchProcessor({ 
  meterIds, 
  onComplete, 
  onCancel 
}: OneClickBatchProcessorProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const isPausedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [currentMeterName, setCurrentMeterName] = useState("");

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const needsReviewCount = results.filter(r => r.status === 'needs_review').length;

  // Auto-detect and parse CSV content with smart column detection
  const autoParseCSV = useCallback((csvContent: string, previousConfig?: {
    column?: string;
    unit?: string;
    voltageV?: number;
    powerFactor?: number;
  }) => {
    const lines = csvContent.split('\n').filter(l => l.trim());
    
    // Header keywords to identify the actual data header row
    const headerKeywords = ['time', 'date', 'rdate', 'rtime', 'kwh', 'kw', 
      'power', 'energy', 'value', 'p1', 'p14', 'active', 'timestamp'];
    
    const isValidHeaderRow = (line: string): boolean => {
      const lowerLine = line.toLowerCase();
      return headerKeywords.some(kw => lowerLine.includes(kw));
    };
    
    let meterName: string | undefined;
    let dateRange: { start: string; end: string } | undefined;

    // Detect PnP SCADA format by checking for domain in first line
    const firstLineLower = lines[0]?.toLowerCase() || "";
    const isPnPScada = firstLineLower.includes('pnpscada') || 
                       firstLineLower.includes('scada.com');

    // Find actual header row by scanning for valid column keywords
    let headerRow = 0;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      if (isValidHeaderRow(lines[i])) {
        headerRow = i;
        break;
      }
    }

    // If PnP format, try to extract meter name from first line
    if (isPnPScada && headerRow > 0) {
      const parts = lines[0].split(',');
      meterName = parts[1]?.trim() || undefined;
      // Try to find date range in metadata rows
      for (let i = 0; i < headerRow; i++) {
        const dateMatch = lines[i].match(/(\d{4}-\d{2}-\d{2})/g);
        if (dateMatch && dateMatch.length >= 2) {
          dateRange = { start: dateMatch[0], end: dateMatch[1] };
          break;
        }
      }
    }

    const startRow = headerRow + 1;

    // Auto-detect delimiter with improved counting
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

    // Get sample values for each column (first 10 data rows)
    const sampleRows = rows.slice(0, 10);

    // Auto-detect column types with improved patterns
    const columns: ColumnConfig[] = headers.map((header, idx) => {
      const lowerHeader = header.toLowerCase();
      // Date patterns (including German and various formats)
      if (lowerHeader.includes('date') || lowerHeader.includes('rdate') || 
          lowerHeader.includes('datum') || lowerHeader.includes('timestamp') ||
          lowerHeader.includes('datetime') || lowerHeader === 'dd/mm/yyyy') {
        return { index: idx, name: header, dataType: 'date' as const, dateFormat: 'YMD' };
      }
      // Time patterns
      if (lowerHeader.includes('time') || lowerHeader.includes('rtime') ||
          lowerHeader.includes('zeit') || lowerHeader === 'hh:mm') {
        return { index: idx, name: header, dataType: 'text' as const };
      }
      return { index: idx, name: header, dataType: 'general' as const };
    });

    // Find best value column using scoring system
    let valueColumnIndex: number | undefined;
    let detectedUnit: 'kWh' | 'kW' = 'kWh'; // Default to kWh
    
    // First try previous config
    if (previousConfig?.column) {
      const prevColIdx = headers.findIndex(h => 
        h.toLowerCase() === previousConfig.column?.toLowerCase()
      );
      if (prevColIdx >= 0) {
        valueColumnIndex = prevColIdx;
        detectedUnit = (previousConfig.unit as 'kWh' | 'kW') || 'kWh';
      }
    }
    
    // If no previous config, use smart detection
    if (valueColumnIndex === undefined) {
      let bestScore = 0;
      
      headers.forEach((header, idx) => {
        const sampleValues = sampleRows.map(row => row[idx] || '');
        const { score, unit } = scoreValueColumn(header, sampleValues);
        
        if (score > bestScore) {
          bestScore = score;
          valueColumnIndex = idx;
          detectedUnit = unit;
        }
      });
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
      valueUnit: (previousConfig?.unit as WizardParseConfig['valueUnit']) || detectedUnit,
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
    isPausedRef.current = false;
    setResults([]);
    setProgress({ current: 0, total: meterIds.length });

    const totalBatches = Math.ceil(meterIds.length / BATCH_SIZE);
    const allResults: ProcessingResult[] = [];

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      // Check if paused using ref for immediate response
      while (isPausedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const batchStart = batchIdx * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, meterIds.length);
      const batchMeterIds = meterIds.slice(batchStart, batchEnd);

      // Process batch
      for (let i = 0; i < batchMeterIds.length; i++) {
        // Check pause state again for each meter
        while (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const meterId = batchMeterIds[i];
        const result = await processMeter(meterId);
        
        allResults.push(result);
        setResults([...allResults]);
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

    // Calculate final counts from allResults
    const finalSuccess = allResults.filter(r => r.status === 'success').length;
    const finalFailed = allResults.filter(r => r.status === 'failed').length;
    const finalNeedsReview = allResults.filter(r => r.status === 'needs_review').length;
    
    toast.success(`Batch processing complete`, {
      description: `✅ ${finalSuccess} success, ❌ ${finalFailed} failed${finalNeedsReview > 0 ? `, ⚠️ ${finalNeedsReview} needs review` : ''}`
    });

    onComplete?.();
  };

  const handlePauseToggle = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    isPausedRef.current = newPaused;
  };

  const handleCancel = () => {
    setIsProcessing(false);
    setIsPaused(false);
    isPausedRef.current = false;
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePauseToggle}
                className="gap-2"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
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
                {isProcessing ? (isPaused ? 'Paused' : currentMeterName || 'Processing...') : 'Complete'}
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            
            {/* Stats */}
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{successCount} success</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>{failedCount} failed</span>
              </div>
              {needsReviewCount > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span>{needsReviewCount} review</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
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
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1 pl-2 border-l-2 border-muted">
              {results.map((result, idx) => (
                <div key={`${result.id}-${idx}`} className="flex items-center gap-2 py-0.5">
                  {result.status === 'success' && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
                  {result.status === 'failed' && <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                  {result.status === 'needs_review' && <AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0" />}
                  {result.status === 'skipped' && <X className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
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
