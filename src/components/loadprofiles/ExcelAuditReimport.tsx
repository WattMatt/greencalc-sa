import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Upload, Loader2, FileSpreadsheet, Save, X, AlertCircle, CheckCircle2, 
  RefreshCw, Link2, Unlink, Trash2, AlertTriangle, Info
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface MeterColumn {
  colIndex: number;
  headerName: string;
  normalizedName: string;
  matchedMeterId?: string;
  matchConfidence: number;
  matchType: "exact" | "fuzzy" | "manual" | "new" | "duplicate" | "none";
  isDuplicate: boolean;
  duplicateOf?: string;
  weekdayProfile: number[];
  weekendProfile: number[];
  weekdayDays: number;
  weekendDays: number;
  totalKwh: number;
  peakKw: number;
  dataPoints: number;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

interface ExistingMeter {
  id: string;
  shop_name: string | null;
  meter_label: string | null;
  site_name: string;
  data_points: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
}

interface ExcelAuditReimportProps {
  projectId?: string;
  siteId?: string;
  onImportComplete?: () => void;
}

// Normalize string for matching
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\-\.]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\d+$/, "") // Remove trailing numbers
    .trim();
}

// Find best match for a column header among existing meters
function findBestMatch(
  columnName: string, 
  meters: ExistingMeter[],
  usedMeterIds: Set<string>
): { meter: ExistingMeter; score: number; type: "exact" | "fuzzy" } | null {
  const normalizedColName = normalizeForMatch(columnName);
  
  let bestMatch: { meter: ExistingMeter; score: number; type: "exact" | "fuzzy" } | null = null;
  
  for (const meter of meters) {
    if (usedMeterIds.has(meter.id)) continue;
    
    const meterNames = [
      meter.shop_name,
      meter.meter_label,
      meter.site_name
    ].filter(Boolean) as string[];
    
    for (const meterName of meterNames) {
      const normalizedMeterName = normalizeForMatch(meterName);
      
      // Exact match after normalization
      if (normalizedColName === normalizedMeterName) {
        return { meter, score: 100, type: "exact" };
      }
      
      // Check if one contains the other
      if (normalizedColName.includes(normalizedMeterName) || normalizedMeterName.includes(normalizedColName)) {
        const score = Math.min(normalizedColName.length, normalizedMeterName.length) / 
                     Math.max(normalizedColName.length, normalizedMeterName.length) * 80;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { meter, score, type: "fuzzy" };
        }
      }
      
      // Check word overlap
      const colWords = normalizedColName.split(" ").filter(w => w.length > 2);
      const meterWords = normalizedMeterName.split(" ").filter(w => w.length > 2);
      const commonWords = colWords.filter(w => meterWords.includes(w));
      
      if (commonWords.length > 0) {
        const score = (commonWords.length / Math.max(colWords.length, meterWords.length)) * 60;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { meter, score, type: "fuzzy" };
        }
      }
    }
  }
  
  return bestMatch && bestMatch.score >= 40 ? bestMatch : null;
}

// Detect duplicate columns (same data with different names)
function detectDuplicates(columns: MeterColumn[]): Map<number, number> {
  const duplicates = new Map<number, number>();
  
  for (let i = 0; i < columns.length; i++) {
    if (duplicates.has(i)) continue;
    
    for (let j = i + 1; j < columns.length; j++) {
      if (duplicates.has(j)) continue;
      
      // Compare weekday profiles - if they're identical, mark as duplicate
      const profile1 = columns[i].weekdayProfile;
      const profile2 = columns[j].weekdayProfile;
      
      if (profile1.length === profile2.length) {
        let identical = true;
        for (let k = 0; k < profile1.length; k++) {
          if (Math.abs(profile1[k] - profile2[k]) > 0.01) {
            identical = false;
            break;
          }
        }
        
        if (identical) {
          duplicates.set(j, i);
        }
      }
    }
  }
  
  return duplicates;
}

// Parse time slot string to get hour
function parseTimeSlot(timeStr: string): { hour: number; minute: number } | null {
  // Handle formats like "00:00", "0:00", "12:30", etc.
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return { hour: parseInt(match[1]), minute: parseInt(match[2]) };
  }
  return null;
}

// Check if a date is a weekend
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function ExcelAuditReimport({ projectId, siteId, onImportComplete }: ExcelAuditReimportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [meterColumns, setMeterColumns] = useState<MeterColumn[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saveProgress, setSaveProgress] = useState(0);
  const [parseStats, setParseStats] = useState<{
    totalRows: number;
    dateRange: { start: string; end: string };
    meterCount: number;
    duplicateCount: number;
  } | null>(null);

  // Fetch existing meters
  const { data: existingMeters = [] } = useQuery({
    queryKey: ["all-meters-for-matching"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, shop_name, meter_label, site_name, data_points, date_range_start, date_range_end")
        .order("shop_name");
      if (error) throw error;
      return data as ExistingMeter[];
    },
  });

  // Get already matched meter IDs
  const usedMeterIds = useMemo(() => 
    new Set(meterColumns.filter(m => m.matchedMeterId).map(m => m.matchedMeterId!)),
    [meterColumns]
  );

  // Available meters for manual selection
  const availableMeters = useMemo(() =>
    existingMeters.filter(m => !usedMeterIds.has(m.id)),
    [existingMeters, usedMeterIds]
  );

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    setMeterColumns([]);
    setSelectedIds(new Set());
    setParseStats(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with headers - use header: 1 to get array of arrays
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        dateNF: "yyyy-mm-dd"
      }) as unknown[][];

      if (jsonData.length < 2) {
        toast.error("Excel file appears to be empty or has no data rows");
        return;
      }

      // Find the header row (look for a row with time-like values in first column)
      let headerRowIndex = 0;
      let timeColumnIndex = -1;
      
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i] as unknown[];
        if (!row || row.length === 0) continue;
        
        // Check if first cell looks like a time (00:00, 0:00, etc.)
        const firstCell = String(row[0] || "").trim();
        if (parseTimeSlot(firstCell)) {
          headerRowIndex = i > 0 ? i - 1 : i;
          timeColumnIndex = 0;
          break;
        }
        
        // Also check for "Time" header
        if (firstCell.toLowerCase().includes("time") || firstCell.toLowerCase() === "period") {
          headerRowIndex = i;
          timeColumnIndex = 0;
          break;
        }
      }

      const headerRow = jsonData[headerRowIndex] as string[];
      const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => {
        const r = row as unknown[];
        return r && r.length > 1 && r[0];
      });

      console.log("[ExcelAudit] Header row:", headerRow);
      console.log("[ExcelAudit] Data rows count:", dataRows.length);
      console.log("[ExcelAudit] Sample rows:", dataRows.slice(0, 3));

      // Identify meter columns (skip time column and any date column)
      const meterColumnIndices: number[] = [];
      for (let i = 1; i < headerRow.length; i++) {
        const header = String(headerRow[i] || "").trim();
        if (!header) continue;
        
        // Skip if it looks like a date column
        if (header.toLowerCase().includes("date") || /^\d{4}-\d{2}-\d{2}$/.test(header)) {
          continue;
        }
        
        // Check if this column has numeric data
        let hasNumericData = false;
        for (const row of dataRows.slice(0, 10)) {
          const r = row as unknown[];
          const val = r[i];
          if (val !== undefined && val !== null && val !== "") {
            const num = parseFloat(String(val).replace(/[^\d.-]/g, ""));
            if (!isNaN(num)) {
              hasNumericData = true;
              break;
            }
          }
        }
        
        if (hasNumericData) {
          meterColumnIndices.push(i);
        }
      }

      console.log("[ExcelAudit] Meter column indices:", meterColumnIndices);

      // Determine the time interval (30-min or 60-min based on row count)
      const expectedRowsFor30Min = 48; // 48 half-hours in a day
      const expectedRowsFor60Min = 24;
      const uniqueTimeSlots = new Set(dataRows.map(r => {
        const row = r as unknown[];
        return String(row[0] || "").trim();
      }));
      
      const intervalMinutes = uniqueTimeSlots.size >= 40 ? 30 : 60;
      console.log("[ExcelAudit] Detected interval:", intervalMinutes, "minutes, unique slots:", uniqueTimeSlots.size);

      // Parse data for each meter column
      const usedIds = new Set<string>();
      const columns: MeterColumn[] = [];

      for (const colIdx of meterColumnIndices) {
        const headerName = String(headerRow[colIdx] || `Column ${colIdx}`).trim();
        const normalizedName = normalizeForMatch(headerName);

        // Aggregate data by hour
        const weekdayHours: { [hour: number]: number[] } = {};
        const weekendHours: { [hour: number]: number[] } = {};
        for (let h = 0; h < 24; h++) {
          weekdayHours[h] = [];
          weekendHours[h] = [];
        }

        let minDate: Date | null = null;
        let maxDate: Date | null = null;
        const weekdayDates = new Set<string>();
        const weekendDates = new Set<string>();
        let totalKwh = 0;
        let peakKw = 0;
        let dataPoints = 0;

        for (const row of dataRows) {
          const r = row as unknown[];
          const timeStr = String(r[0] || "").trim();
          const time = parseTimeSlot(timeStr);
          if (!time) continue;

          const valueStr = String(r[colIdx] || "").replace(/[^\d.-]/g, "");
          const value = parseFloat(valueStr);
          if (isNaN(value)) continue;

          // For pivot tables, we need to detect if there's a date dimension
          // If not, we'll assume all data is representative of typical days
          // For now, treat all as weekday data
          
          // Convert kW value to kWh based on interval
          const kwhValue = value * (intervalMinutes / 60);
          
          weekdayHours[time.hour].push(value);
          totalKwh += kwhValue;
          if (value > peakKw) peakKw = value;
          dataPoints++;
        }

        // Calculate average profiles
        const weekdayProfile: number[] = [];
        const weekendProfile: number[] = [];
        
        for (let h = 0; h < 24; h++) {
          const weekdayVals = weekdayHours[h];
          const weekendVals = weekendHours[h];
          
          // Average the values for this hour (may have multiple readings if 30-min data)
          weekdayProfile.push(
            weekdayVals.length > 0 
              ? weekdayVals.reduce((a, b) => a + b, 0) / weekdayVals.length
              : 0
          );
          weekendProfile.push(
            weekendVals.length > 0 
              ? weekendVals.reduce((a, b) => a + b, 0) / weekendVals.length
              : weekdayProfile[h] // Default to weekday if no weekend data
          );
        }

        // Find best match
        const match = findBestMatch(headerName, existingMeters, usedIds);
        if (match) {
          usedIds.add(match.meter.id);
        }

        columns.push({
          colIndex: colIdx,
          headerName,
          normalizedName,
          matchedMeterId: match?.meter.id,
          matchConfidence: match?.score || 0,
          matchType: match ? match.type : "none",
          isDuplicate: false,
          weekdayProfile,
          weekendProfile,
          weekdayDays: 1, // Placeholder - pivot table represents typical day
          weekendDays: 0,
          totalKwh,
          peakKw,
          dataPoints,
        });
      }

      // Detect duplicates
      const duplicates = detectDuplicates(columns);
      let duplicateCount = 0;
      
      for (const [dupIdx, origIdx] of duplicates.entries()) {
        columns[dupIdx].isDuplicate = true;
        columns[dupIdx].duplicateOf = columns[origIdx].headerName;
        columns[dupIdx].matchType = "duplicate";
        duplicateCount++;
      }

      setMeterColumns(columns);
      setParseStats({
        totalRows: dataRows.length,
        dateRange: { start: "N/A", end: "N/A" },
        meterCount: columns.length,
        duplicateCount,
      });

      // Auto-select non-duplicate columns with matches
      const autoSelected = new Set<number>();
      columns.forEach((col, idx) => {
        if (!col.isDuplicate && col.matchedMeterId) {
          autoSelected.add(idx);
        }
      });
      setSelectedIds(autoSelected);

      toast.success(`Parsed ${columns.length} meter columns from Excel`, {
        description: duplicateCount > 0 
          ? `Found ${duplicateCount} duplicate columns (highlighted in yellow)`
          : undefined
      });

    } catch (error) {
      console.error("Excel parse error:", error);
      toast.error("Failed to parse Excel file", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [existingMeters]);

  const updateColumnMatch = (colIndex: number, meterId: string | null) => {
    setMeterColumns(prev => prev.map((col, idx) => 
      idx === colIndex 
        ? { 
            ...col, 
            matchedMeterId: meterId || undefined,
            matchType: meterId ? "manual" : "new",
            matchConfidence: meterId ? 100 : 0
          }
        : col
    ));
  };

  const toggleSelect = (idx: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const nonDuplicates = meterColumns
      .map((col, idx) => ({ col, idx }))
      .filter(({ col }) => !col.isDuplicate);
    
    if (nonDuplicates.every(({ idx }) => selectedIds.has(idx))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(nonDuplicates.map(({ idx }) => idx)));
    }
  };

  const handleSave = async () => {
    const columnsToSave = meterColumns.filter((_, idx) => selectedIds.has(idx));
    
    if (columnsToSave.length === 0) {
      toast.error("No columns selected");
      return;
    }

    setIsSaving(true);
    setSaveProgress(0);

    try {
      let updatedCount = 0;
      let createdCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < columnsToSave.length; i++) {
        const col = columnsToSave[i];
        setSaveProgress(Math.round((i / columnsToSave.length) * 100));

        // Build raw data payload
        const rawDataPayload = [{
          source: "excel-audit-reimport",
          fileName,
          columnHeader: col.headerName,
          totalKwh: col.totalKwh,
          peakKw: col.peakKw,
          dataPoints: col.dataPoints,
          importedAt: new Date().toISOString(),
        }];

        if (col.matchedMeterId) {
          // Update existing meter
          const { error } = await supabase
            .from("scada_imports")
            .update({
              raw_data: rawDataPayload,
              data_points: col.dataPoints,
              load_profile_weekday: col.weekdayProfile,
              load_profile_weekend: col.weekendProfile,
              weekday_days: col.weekdayDays,
              weekend_days: col.weekendDays,
              updated_at: new Date().toISOString(),
            })
            .eq("id", col.matchedMeterId);

          if (error) {
            console.error(`Failed to update ${col.headerName}:`, error);
            skippedCount++;
          } else {
            updatedCount++;
          }
        } else {
          // Create new meter
          const { error } = await supabase
            .from("scada_imports")
            .insert({
              site_name: col.headerName,
              shop_name: col.headerName,
              file_name: fileName,
              raw_data: rawDataPayload,
              data_points: col.dataPoints,
              load_profile_weekday: col.weekdayProfile,
              load_profile_weekend: col.weekendProfile,
              weekday_days: col.weekdayDays,
              weekend_days: col.weekendDays,
            });

          if (error) {
            console.error(`Failed to create ${col.headerName}:`, error);
            skippedCount++;
          } else {
            createdCount++;
          }
        }
      }

      setSaveProgress(100);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["all-meters-for-matching"] });
      queryClient.invalidateQueries({ queryKey: ["project-tenants"] });

      const message = [
        updatedCount > 0 && `${updatedCount} updated`,
        createdCount > 0 && `${createdCount} created`,
        skippedCount > 0 && `${skippedCount} skipped`,
      ].filter(Boolean).join(", ");

      toast.success(`Import complete: ${message}`);
      
      // Reset state
      setMeterColumns([]);
      setSelectedIds(new Set());
      setFileName("");
      setParseStats(null);
      
      onImportComplete?.();

    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save imports", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
    }
  };

  const selectedCount = selectedIds.size;
  const matchedCount = meterColumns.filter((_, idx) => selectedIds.has(idx) && meterColumns[idx].matchedMeterId).length;
  const newCount = selectedCount - matchedCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel Metering Audit Reimport
        </CardTitle>
        <CardDescription>
          Parse Excel audit files with pivot table format and update SCADA imports with corrected load profiles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="space-y-2">
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            className="w-full h-24 border-dashed"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Parsing Excel file...</span>
              </div>
            ) : fileName ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>{fileName}</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileName("");
                    setMeterColumns([]);
                    setSelectedIds(new Set());
                    setParseStats(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <span>Upload Excel Metering Audit File</span>
                <span className="text-xs">.xlsx, .xls, .xlsm - Pivot table format with time slots as rows</span>
              </div>
            )}
          </Button>
        </div>

        {/* Parse Stats */}
        {parseStats && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Parsed Successfully</AlertTitle>
            <AlertDescription className="flex flex-wrap gap-4 mt-2">
              <span><strong>{parseStats.meterCount}</strong> meter columns</span>
              <span><strong>{parseStats.totalRows}</strong> time slots</span>
              {parseStats.duplicateCount > 0 && (
                <span className="text-yellow-600">
                  <strong>{parseStats.duplicateCount}</strong> duplicates detected
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Duplicate Warning */}
        {meterColumns.some(c => c.isDuplicate) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Duplicate Data Detected</AlertTitle>
            <AlertDescription>
              Some columns contain identical data (highlighted in yellow). These are likely mislabeled columns in the source file.
              Review carefully before importing.
            </AlertDescription>
          </Alert>
        )}

        {/* Meter Columns Table */}
        {meterColumns.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={meterColumns.filter(c => !c.isDuplicate).every((_, idx) => selectedIds.has(idx))}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCount} selected ({matchedCount} to update, {newCount} new)
                </span>
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving || selectedCount === 0}
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Selected
                  </>
                )}
              </Button>
            </div>

            {isSaving && (
              <Progress value={saveProgress} className="h-2" />
            )}

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Column Header</TableHead>
                    <TableHead>Peak kW</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead className="w-[250px]">Match To Meter</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meterColumns.map((col, idx) => (
                    <TableRow 
                      key={idx}
                      className={col.isDuplicate ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(idx)}
                          onCheckedChange={() => toggleSelect(idx)}
                          disabled={col.isDuplicate}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{col.headerName}</span>
                          {col.isDuplicate && (
                            <span className="text-xs text-yellow-600">
                              Duplicate of: {col.duplicateOf}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{col.peakKw.toFixed(1)} kW</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{col.dataPoints}</span>
                      </TableCell>
                      <TableCell>
                        {col.isDuplicate ? (
                          <Badge variant="outline" className="text-yellow-600">
                            <Trash2 className="h-3 w-3 mr-1" />
                            Skipped (Duplicate)
                          </Badge>
                        ) : (
                          <Select
                            value={col.matchedMeterId || "__new__"}
                            onValueChange={(value) => 
                              updateColumnMatch(idx, value === "__new__" ? null : value)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select meter..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__new__">
                                <span className="flex items-center gap-2">
                                  <Unlink className="h-3 w-3" />
                                  Create New Meter
                                </span>
                              </SelectItem>
                              {col.matchedMeterId && (
                                <SelectItem value={col.matchedMeterId}>
                                  {existingMeters.find(m => m.id === col.matchedMeterId)?.shop_name || "Matched Meter"}
                                </SelectItem>
                              )}
                              {availableMeters.map(meter => (
                                <SelectItem key={meter.id} value={meter.id}>
                                  {meter.shop_name || meter.site_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {col.isDuplicate ? (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30">
                            Duplicate
                          </Badge>
                        ) : col.matchedMeterId ? (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {col.matchType === "exact" ? "Exact" : col.matchType === "manual" ? "Manual" : "Fuzzy"}
                            {col.matchConfidence > 0 && ` (${Math.round(col.matchConfidence)}%)`}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            New
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
