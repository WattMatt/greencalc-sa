import { useState, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, 
  Zap, Play, Pause, X, RefreshCw, Loader2, Link2, Link2Off,
  FolderUp, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { processCSVToLoadProfile, validateLoadProfile } from "./utils/csvToLoadProfile";
import { WizardParseConfig, ColumnConfig } from "./types/csvImportTypes";
import { matchFilesToMeters, MatchResult, MeterInfo, normalizeName } from "./utils/fuzzyMatcher";

interface FileMatchInfo {
  file: File;
  content: string;
  match: MatchResult | null;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'needs_review' | 'skipped';
  message?: string;
  dataPoints?: number;
}

interface BulkCsvDropzoneProps {
  siteId?: string | null;
  onComplete?: () => void;
}

// Auto-detect CSV configuration
function autoDetectConfig(content: string): {
  delimiter: string;
  startRow: number;
  isPnpScada: boolean;
  meterName?: string;
  dateRange?: { start: string; end: string };
} {
  const lines = content.split('\n').filter(l => l.trim());
  let isPnpScada = false;
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
      isPnpScada = true;
      meterName = meterMatch[1];
      dateRange = { start: meterMatch[2], end: meterMatch[3] };
      startRow = 2;
    }
  }

  // Detect delimiter
  const sampleLine = lines[startRow - 1] || lines[0] || "";
  const tabCount = (sampleLine.match(/\t/g) || []).length;
  const semicolonCount = (sampleLine.match(/;/g) || []).length;
  const commaCount = (sampleLine.match(/,/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';
  else if (semicolonCount > commaCount) delimiter = ';';

  return { delimiter, startRow, isPnpScada, meterName, dateRange };
}

// Score columns to find date and value columns
function detectColumns(headers: string[], sampleRows: string[][]) {
  let dateCol = -1;
  let timeCol = -1;
  let valueCol = -1;
  let bestValueScore = 0;
  let valueUnit: 'kWh' | 'kW' = 'kWh';

  const datePatterns = ['date', 'rdate', 'datetime', 'timestamp', 'datum', 'zeit', 'time'];
  const timePatterns = ['time', 'rtime', 'zeit', 'hour'];
  const valuePatterns = ['kwh', 'kwh_del', 'energy', 'consumption', 'kw', 'power', 'demand', 'value', 'reading'];

  headers.forEach((header, idx) => {
    const lower = header.toLowerCase().trim();
    
    // Date detection
    if (dateCol === -1 && datePatterns.some(p => lower.includes(p))) {
      // Prefer date-only columns, not time
      if (!lower.includes('time') || lower.includes('datetime') || lower.includes('timestamp')) {
        dateCol = idx;
      }
    }
    
    // Time detection (separate column)
    if (timeCol === -1 && timePatterns.some(p => lower === p || lower.startsWith(p))) {
      if (!lower.includes('date')) {
        timeCol = idx;
      }
    }
    
    // Value detection with scoring
    let score = 0;
    let unit: 'kWh' | 'kW' = 'kWh';
    
    if (lower === 'kwh' || lower === 'kwh_del') { score = 100; unit = 'kWh'; }
    else if (lower === 'kw' || lower === 'power') { score = 80; unit = 'kW'; }
    else if (lower.includes('kwh') || lower.includes('energy') || lower.includes('consumption')) { score = 70; unit = 'kWh'; }
    else if (lower.includes('kw') || lower.includes('demand')) { score = 60; unit = 'kW'; }
    else if (lower.includes('value') || lower.includes('reading')) { score = 40; unit = 'kWh'; }
    
    // Boost score for numeric columns
    if (score > 0 && sampleRows.length > 0) {
      const numericCount = sampleRows.filter(row => {
        const val = row[idx];
        const num = parseFloat(val?.replace?.(',', '.') || '');
        return !isNaN(num) && isFinite(num);
      }).length;
      if (numericCount > sampleRows.length * 0.8) score += 20;
    }
    
    if (score > bestValueScore) {
      bestValueScore = score;
      valueCol = idx;
      valueUnit = unit;
    }
  });

  // Fallback: find first numeric column if no value column detected
  if (valueCol === -1 && sampleRows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      if (i === dateCol || i === timeCol) continue;
      const isNumeric = sampleRows.every(row => {
        const val = row[i];
        const num = parseFloat(val?.replace?.(',', '.') || '');
        return !isNaN(num) && isFinite(num);
      });
      if (isNumeric) {
        valueCol = i;
        valueUnit = 'kWh'; // Default
        break;
      }
    }
  }

  return { dateCol, timeCol, valueCol, valueUnit };
}

export function BulkCsvDropzone({ siteId, onComplete }: BulkCsvDropzoneProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileMatches, setFileMatches] = useState<FileMatchInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [createNewForUnmatched, setCreateNewForUnmatched] = useState(true);

  // Fetch existing meters for matching
  const { data: meters } = useQuery({
    queryKey: ["meters-for-matching", siteId],
    queryFn: async () => {
      let query = supabase
        .from("scada_imports")
        .select("id, shop_name, meter_label, site_name, shop_number")
        .limit(5000);
      
      if (siteId) query = query.eq("site_id", siteId);
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MeterInfo[];
    },
  });

  // Stats
  const stats = useMemo(() => {
    const matched = fileMatches.filter(f => f.match && f.match.confidence >= 50);
    const unmatched = fileMatches.filter(f => !f.match || f.match.confidence < 50);
    const success = fileMatches.filter(f => f.status === 'success');
    const failed = fileMatches.filter(f => f.status === 'failed');
    const needsReview = fileMatches.filter(f => f.status === 'needs_review');
    
    return { 
      total: fileMatches.length, 
      matched: matched.length, 
      unmatched: unmatched.length,
      success: success.length,
      failed: failed.length,
      needsReview: needsReview.length
    };
  }, [fileMatches]);

  // Handle file selection
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const csvFiles = Array.from(files).filter(f => 
      f.name.toLowerCase().endsWith('.csv') || 
      f.type === 'text/csv' ||
      f.type === 'application/vnd.ms-excel'
    );

    if (csvFiles.length === 0) {
      toast.error("No CSV files selected");
      return;
    }

    toast.info(`Reading ${csvFiles.length} CSV files...`);

    // Read file contents
    const fileContents = await Promise.all(csvFiles.map(async (file) => {
      try {
        const content = await file.text();
        return { file, content };
      } catch (err) {
        console.error(`Failed to read ${file.name}:`, err);
        return { file, content: '' };
      }
    }));

    // Match files to meters
    const matchResults = matchFilesToMeters(csvFiles, meters || []);

    // Create file match info
    const matches: FileMatchInfo[] = fileContents.map(({ file, content }) => ({
      file,
      content,
      match: matchResults.get(file) || null,
      status: 'pending' as const
    }));

    setFileMatches(matches);
    
    const matchedCount = matches.filter(m => m.match && m.match.confidence >= 50).length;
    toast.success(`${csvFiles.length} files loaded, ${matchedCount} matched to meters`);
  }, [meters]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // Parse and process a single CSV
  const processFile = async (fileInfo: FileMatchInfo): Promise<FileMatchInfo> => {
    const { file, content, match } = fileInfo;
    
    console.log(`[BulkCSV] Processing file: ${file.name}`);
    
    try {
      // Detect configuration
      const config = autoDetectConfig(content);
      const lines = content.split('\n').filter(l => l.trim());
      
      // Parse rows
      const delimChars = new Set([config.delimiter]);
      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' && !inQuotes) { inQuotes = true; }
          else if (char === '"' && inQuotes) {
            if (line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = false; }
          } else if (!inQuotes && delimChars.has(char)) {
            result.push(current.trim());
            current = "";
          } else { current += char; }
        }
        result.push(current.trim());
        return result;
      };

      const headerIdx = config.startRow - 1;
      const headers = headerIdx < lines.length ? parseRow(lines[headerIdx]) : [];
      const rows = lines.slice(headerIdx + 1).map(parseRow);

      console.log(`[BulkCSV] ${file.name}: ${rows.length} rows, headers:`, headers.slice(0, 5));

      if (rows.length < 10) {
        console.warn(`[BulkCSV] ${file.name}: Only ${rows.length} rows`);
        return { ...fileInfo, status: 'failed', message: `Only ${rows.length} data rows (need 10+)` };
      }

      // Detect columns
      const sampleRows = rows.slice(0, 20);
      const { dateCol, timeCol, valueCol, valueUnit } = detectColumns(headers, sampleRows);

      console.log(`[BulkCSV] ${file.name}: dateCol=${dateCol}, timeCol=${timeCol}, valueCol=${valueCol}, unit=${valueUnit}`);

      if (dateCol === -1) {
        console.warn(`[BulkCSV] ${file.name}: No date column. Headers:`, headers);
        return { ...fileInfo, status: 'failed', message: `No date column found in: ${headers.slice(0, 5).join(', ')}` };
      }
      if (valueCol === -1) {
        console.warn(`[BulkCSV] ${file.name}: No value column. Headers:`, headers);
        return { ...fileInfo, status: 'failed', message: `No value column found in: ${headers.slice(0, 5).join(', ')}` };
      }

      // Build column config - note: ColumnConfig only supports date/general/text/skip
      const columns: ColumnConfig[] = headers.map((header, idx) => {
        if (idx === dateCol) return { index: idx, name: header, dataType: 'date' as const, dateFormat: 'YMD' };
        if (idx === timeCol) return { index: idx, name: header, dataType: 'general' as const }; // Use general for time
        if (idx === valueCol) return { index: idx, name: header, dataType: 'general' as const };
        return { index: idx, name: header, dataType: 'text' as const };
      });

      // Build parse config
      const delimiters = {
        tab: config.delimiter === '\t',
        semicolon: config.delimiter === ';',
        comma: config.delimiter === ',',
        space: false,
        other: false,
        otherChar: ""
      };

      const parseConfig: WizardParseConfig = {
        fileType: "delimited",
        startRow: config.startRow,
        delimiters,
        treatConsecutiveAsOne: false,
        textQualifier: '"',
        columns,
        detectedFormat: config.isPnpScada ? "pnp-scada" : undefined,
        valueColumnIndex: valueCol,
        dateColumnIndex: dateCol,
        timeColumnIndex: timeCol >= 0 ? timeCol : undefined,
        valueUnit,
      };

      // Process CSV
      console.log(`[BulkCSV] ${file.name}: Calling processCSVToLoadProfile...`);
      const profile = processCSVToLoadProfile(headers, rows, parseConfig);

      console.log(`[BulkCSV] ${file.name}: Profile result - weekdayProfile length=${profile.weekdayProfile?.length}, dataPoints=${profile.dataPoints}`);

      if (!profile.weekdayProfile || profile.weekdayProfile.length === 0) {
        console.warn(`[BulkCSV] ${file.name}: Empty profile returned`);
        return { ...fileInfo, status: 'failed', message: 'Failed to generate profile (no data parsed)' };
      }

      // Validate
      const validation = validateLoadProfile(profile);
      console.log(`[BulkCSV] ${file.name}: Validation result - isValid=${validation.isValid}, reason=${validation.reason}`);

      // Determine target meter ID
      let targetMeterId = match?.meterId;
      
      // If no match and createNewForUnmatched, create a new meter
      if (!targetMeterId && createNewForUnmatched) {
        const displayName = config.meterName || normalizeName(file.name) || file.name.replace(/\.csv$/i, '');
        
        const { data: newMeter, error: insertError } = await supabase
          .from("scada_imports")
          .insert({
            site_name: displayName,
            shop_name: displayName,
            file_name: file.name,
            raw_data: [{ csvContent: content }],
            site_id: siteId || null,
          })
          .select("id")
          .single();
        
        if (insertError) {
          console.error("Failed to create meter:", insertError);
          return { ...fileInfo, status: 'failed', message: 'Failed to create meter' };
        }
        
        targetMeterId = newMeter.id;
      }

      if (!targetMeterId) {
        return { ...fileInfo, status: 'skipped', message: 'No meter match found' };
      }

      // Update meter in database
      const { error: updateError } = await supabase
        .from("scada_imports")
        .update({
          load_profile_weekday: profile.weekdayProfile,
          load_profile_weekend: profile.weekendProfile,
          weekday_days: profile.weekdayDays,
          weekend_days: profile.weekendDays,
          data_points: profile.dataPoints,
          date_range_start: profile.dateRangeStart,
          date_range_end: profile.dateRangeEnd,
          detected_interval_minutes: profile.detectedInterval,
          processed_at: new Date().toISOString(),
          raw_data: [{ csvContent: content }],
          file_name: file.name,
        })
        .eq("id", targetMeterId);

      if (updateError) {
        return { ...fileInfo, status: 'failed', message: updateError.message };
      }

      // Check for issues
      if (!validation.isValid) {
        return { 
          ...fileInfo, 
          status: 'needs_review', 
          message: validation.reason || 'Quality issues detected',
          dataPoints: profile.dataPoints
        };
      }

      return { 
        ...fileInfo, 
        status: 'success', 
        message: `${profile.dataPoints} data points`,
        dataPoints: profile.dataPoints
      };
      
    } catch (err: any) {
      console.error(`Error processing ${file.name}:`, err);
      return { ...fileInfo, status: 'failed', message: err.message || 'Processing error' };
    }
  };

  // Process all files
  const processAllFiles = async () => {
    if (fileMatches.length === 0) return;
    
    setIsProcessing(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setProgress({ current: 0, total: fileMatches.length });

    const results: FileMatchInfo[] = [...fileMatches];

    for (let i = 0; i < results.length; i++) {
      // Check pause
      while (isPausedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setProgress({ current: i + 1, total: results.length });
      
      // Update status to processing
      results[i] = { ...results[i], status: 'processing' };
      setFileMatches([...results]);

      // Process
      results[i] = await processFile(results[i]);
      setFileMatches([...results]);
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["meter-library"] });
    queryClient.invalidateQueries({ queryKey: ["meters-for-matching"] });

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const reviewCount = results.filter(r => r.status === 'needs_review').length;

    toast.success(
      `Processed ${results.length} files: ${successCount} ✓, ${reviewCount} ⚠️, ${failedCount} ✗`
    );

    onComplete?.();
  };

  const togglePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    isPausedRef.current = newPaused;
  };

  const clearFiles = () => {
    setFileMatches([]);
    setProgress({ current: 0, total: 0 });
  };

  const removeFile = (index: number) => {
    setFileMatches(prev => prev.filter((_, i) => i !== index));
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return <Badge className="bg-green-500/20 text-green-700">{confidence}%</Badge>;
    if (confidence >= 70) return <Badge className="bg-yellow-500/20 text-yellow-700">{confidence}%</Badge>;
    return <Badge className="bg-orange-500/20 text-orange-700">{confidence}%</Badge>;
  };

  const getStatusIcon = (status: FileMatchInfo['status']) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'needs_review': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'skipped': return <X className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          One-Click Bulk Import
        </CardTitle>
        <CardDescription>
          Drop CSV files to auto-match with meters and process automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${fileMatches.length > 0 ? 'py-4' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {fileMatches.length === 0 ? (
            <>
              <FolderUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Drop CSV files here</p>
              <p className="text-sm text-muted-foreground mt-1">
                Files will be automatically matched to existing meters
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              <span>Drop more files to add</span>
            </div>
          )}
        </div>

        {/* Stats & Controls */}
        {fileMatches.length > 0 && (
          <div className="space-y-4">
            {/* Stats Bar */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-4 text-sm">
                <span><strong>{stats.total}</strong> files</span>
                <span className="flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5 text-green-500" />
                  <strong>{stats.matched}</strong> matched
                </span>
                <span className="flex items-center gap-1">
                  <Link2Off className="h-3.5 w-3.5 text-muted-foreground" />
                  <strong>{stats.unmatched}</strong> new
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearFiles} disabled={isProcessing}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={createNewForUnmatched}
                  onCheckedChange={(c) => setCreateNewForUnmatched(!!c)}
                  disabled={isProcessing}
                />
                <span>Create new meters for unmatched files</span>
              </label>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing file {progress.current} of {progress.total}</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
              </div>
            )}

            {/* File List */}
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                {fileMatches.map((fm, idx) => (
                  <div 
                    key={`${fm.file.name}-${idx}`}
                    className={`flex items-center gap-3 p-2 rounded-md text-sm
                      ${fm.status === 'processing' ? 'bg-primary/10' : ''}
                      ${fm.status === 'success' ? 'bg-green-500/10' : ''}
                      ${fm.status === 'failed' ? 'bg-destructive/10' : ''}
                      ${fm.status === 'needs_review' ? 'bg-yellow-500/10' : ''}
                    `}
                  >
                    {/* Status */}
                    <div className="w-6 flex justify-center">
                      {getStatusIcon(fm.status) || <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    
                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{fm.file.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {fm.match ? (
                          <span className="flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {fm.match.meterName}
                            {getConfidenceBadge(fm.match.confidence)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Link2Off className="h-3 w-3" />
                            {createNewForUnmatched ? 'Will create new meter' : 'No match'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Message */}
                    {fm.message && (
                      <span className="text-xs text-muted-foreground">{fm.message}</span>
                    )}
                    
                    {/* Remove button */}
                    {!isProcessing && fm.status === 'pending' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!isProcessing ? (
                <Button onClick={processAllFiles} className="flex-1">
                  <Zap className="h-4 w-4 mr-2" />
                  Process All ({fileMatches.filter(f => f.status === 'pending').length})
                </Button>
              ) : (
                <>
                  <Button onClick={togglePause} variant="outline" className="flex-1">
                    {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button variant="destructive" onClick={() => setIsProcessing(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            {/* Results Summary */}
            {!isProcessing && (stats.success > 0 || stats.failed > 0 || stats.needsReview > 0) && (
              <div className="flex items-center gap-4 text-sm bg-muted/50 rounded-lg p-3">
                {stats.success > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {stats.success} processed
                  </span>
                )}
                {stats.needsReview > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    {stats.needsReview} needs review
                  </span>
                )}
                {stats.failed > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {stats.failed} failed
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
