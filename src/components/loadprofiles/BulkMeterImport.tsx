import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, Loader2, FileUp, Save, X, FileText, Link2, AlertCircle, CheckCircle2, Settings2
} from "lucide-react";
import { toast } from "sonner";
import { CsvImportWizard, WizardParseConfig, ColumnConfig } from "./CsvImportWizard";
import { processCSVToLoadProfile, ProcessedLoadProfile } from "./utils/csvToLoadProfile";

interface PendingFile {
  id: string;
  fileName: string;
  content: string;
  rowCount: number;
  matchedMeterId?: string;
  matchType?: "auto" | "manual" | "new";
  parseConfig?: WizardParseConfig;
  meterName?: string;
  dateRange?: { start: string; end: string };
  processedProfile?: ProcessedLoadProfile;
  parsedHeaders?: string[];
  parsedRows?: string[][];
  isConfigured: boolean; // Track if user has explicitly configured this file
}

interface ExistingMeter {
  id: string;
  shop_name: string | null;
  area_sqm: number | null;
  file_name: string | null;
}

interface BulkMeterImportProps {
  siteId: string | null;
  onImportComplete?: () => void;
}

// Normalize string for matching
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, "") // Remove file extension
    .replace(/[_\-\.]/g, " ") // Replace separators with space
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

// Find best match for a filename among existing meters
function findBestMatch(fileName: string, meters: ExistingMeter[]): { meter: ExistingMeter; score: number } | null {
  const normalizedFileName = normalizeForMatch(fileName);
  
  let bestMatch: { meter: ExistingMeter; score: number } | null = null;
  
  for (const meter of meters) {
    if (!meter.shop_name || meter.file_name) continue; // Skip if no shop name or already has file
    
    const normalizedShopName = normalizeForMatch(meter.shop_name);
    
    // Exact match after normalization
    if (normalizedFileName === normalizedShopName) {
      return { meter, score: 100 };
    }
    
    // Check if one contains the other
    if (normalizedFileName.includes(normalizedShopName) || normalizedShopName.includes(normalizedFileName)) {
      const score = Math.min(normalizedFileName.length, normalizedShopName.length) / 
                   Math.max(normalizedFileName.length, normalizedShopName.length) * 80;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { meter, score };
      }
    }
    
    // Check word overlap
    const fileWords = normalizedFileName.split(" ").filter(w => w.length > 2);
    const shopWords = normalizedShopName.split(" ").filter(w => w.length > 2);
    const commonWords = fileWords.filter(w => shopWords.includes(w));
    
    if (commonWords.length > 0) {
      const score = (commonWords.length / Math.max(fileWords.length, shopWords.length)) * 60;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { meter, score };
      }
    }
  }
  
  // Only return if score is above threshold
  return bestMatch && bestMatch.score >= 40 ? bestMatch : null;
}

export function BulkMeterImport({ siteId, onImportComplete }: BulkMeterImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardFile, setWizardFile] = useState<{ name: string; content: string } | null>(null);
  const [isProcessingWizard, setIsProcessingWizard] = useState(false);

  // Fetch existing site name if siteId provided
  const { data: site } = useQuery({
    queryKey: ["site", siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase
        .from("sites")
        .select("name")
        .eq("id", siteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Fetch existing meter placeholders for this site (meters without processed data)
  const { data: existingMeters = [] } = useQuery({
    queryKey: ["site-meter-placeholders", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, shop_name, area_sqm, file_name")
        .eq("site_id", siteId)
        .order("shop_name");
      if (error) throw error;
      return data as ExistingMeter[];
    },
    enabled: !!siteId,
  });

  // Get unassigned meters (placeholders without file data)
  const unassignedMeters = useMemo(() => 
    existingMeters.filter(m => !m.file_name),
    [existingMeters]
  );

  // Get meters that are already used for matching
  const usedMeterIds = useMemo(() => 
    new Set(pendingFiles.filter(f => f.matchedMeterId).map(f => f.matchedMeterId!)),
    [pendingFiles]
  );

  // Available meters for manual selection (not already matched)
  const availableMeters = useMemo(() =>
    unassignedMeters.filter(m => !usedMeterIds.has(m.id)),
    [unassignedMeters, usedMeterIds]
  );

  // Auto-parse CSV content with auto-detected configuration
  const autoParseCSV = useCallback((content: string, fileName: string): { 
    parseConfig: WizardParseConfig; 
    parsedData: { headers: string[]; rows: string[][]; meterName?: string; dateRange?: { start: string; end: string } };
    processedProfile: ProcessedLoadProfile;
  } => {
    // Detect PnP SCADA format
    const lines = content.split('\n').filter(l => l.trim());
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
        startRow = 2; // Headers are on row 2
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

    // Build parse config
    const parseConfig: WizardParseConfig = {
      fileType: "delimited",
      startRow,
      delimiters,
      treatConsecutiveAsOne: false,
      textQualifier: '"',
      columns: [],
      detectedFormat: isPnPScada ? "pnp-scada" : undefined,
    };

    // Parse the CSV
    const delimPattern = [
      delimiters.tab ? '\t' : null,
      delimiters.semicolon ? ';' : null,
      delimiters.comma ? ',' : null,
    ].filter(Boolean).join('|') || ',';
    
    const regex = new RegExp(delimPattern);

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
        } else if (!inQuotes && regex.test(char)) {
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

    // Auto-detect column types (using ColumnConfig interface)
    const columns: ColumnConfig[] = headers.map((header, idx) => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('date') || lowerHeader.includes('rdate')) {
        return { index: idx, name: header, dataType: 'date' as const, dateFormat: 'YMD' };
      } else if (lowerHeader.includes('kwh') || lowerHeader.includes('energy') || lowerHeader.includes('consumption')) {
        return { index: idx, name: header, dataType: 'general' as const };
      }
      return { index: idx, name: header, dataType: 'text' as const };
    });
    parseConfig.columns = columns;

    // If no meter name from SCADA format, derive from filename
    if (!meterName) {
      meterName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    }

    // Process into load profile
    const processedProfile = processCSVToLoadProfile(headers, rows, parseConfig);

    return {
      parseConfig,
      parsedData: { headers, rows, meterName, dateRange },
      processedProfile,
    };
  }, []);

  // Track which file is being configured in the wizard
  const [configuringFileId, setConfiguringFileId] = useState<string | null>(null);

  const handleFilesUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    // For all files (single or multiple), add them to pending list requiring configuration
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const rowCount = content.split('\n').filter(l => l.trim()).length;
        const match = findBestMatch(file.name, unassignedMeters.filter(m => !usedMeterIds.has(m.id)));
        
        const newFileId = crypto.randomUUID();
        const newFile: PendingFile = {
          id: newFileId,
          fileName: file.name,
          content,
          rowCount,
          matchedMeterId: match?.meter.id,
          matchType: match ? "auto" : "new",
          isConfigured: false, // Require explicit configuration
        };

        setPendingFiles((prev) => [...prev, newFile]);
        
        // For single file upload, automatically open the wizard
        if (files.length === 1) {
          setConfiguringFileId(newFileId);
          setWizardFile({ name: file.name, content });
          setWizardOpen(true);
        }
      };
      reader.readAsText(file);
    });

    e.target.value = "";
  }, [unassignedMeters, usedMeterIds]);

  const handleWizardProcess = useCallback((config: WizardParseConfig, parsedData: { headers: string[]; rows: string[][]; meterName?: string; dateRange?: { start: string; end: string } }) => {
    if (!wizardFile) return;
    
    setIsProcessingWizard(true);
    
    try {
      const meterName = parsedData.meterName || wizardFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      
      // Process CSV data into load profiles
      const processedProfile = processCSVToLoadProfile(parsedData.headers, parsedData.rows, config);

      if (configuringFileId) {
        // Update existing pending file
        setPendingFiles((prev) => prev.map((f) => 
          f.id === configuringFileId ? {
            ...f,
            parseConfig: config,
            meterName: parsedData.meterName || f.meterName,
            dateRange: parsedData.dateRange || f.dateRange,
            processedProfile,
            parsedHeaders: parsedData.headers,
            parsedRows: parsedData.rows,
            rowCount: parsedData.rows.length,
            isConfigured: true,
          } : f
        ));
        setConfiguringFileId(null);
      } else {
        // Create new pending file (this shouldn't happen with the new flow, but keep for safety)
        const match = findBestMatch(meterName, unassignedMeters.filter(m => !usedMeterIds.has(m.id)));
        
        const newFile: PendingFile = {
          id: crypto.randomUUID(),
          fileName: wizardFile.name,
          content: wizardFile.content,
          rowCount: parsedData.rows.length,
          matchedMeterId: match?.meter.id,
          matchType: match ? "auto" : "new",
          parseConfig: config,
          meterName: parsedData.meterName,
          dateRange: parsedData.dateRange,
          processedProfile,
          parsedHeaders: parsedData.headers,
          parsedRows: parsedData.rows,
          isConfigured: true,
        };

        setPendingFiles((prev) => [...prev, newFile]);
      }
      
      setWizardOpen(false);
      setWizardFile(null);
      
      const profileSummary = processedProfile.dataPoints > 0 
        ? ` (Peak: ${processedProfile.peakKw} kW, ${processedProfile.weekdayDays} weekdays, ${processedProfile.weekendDays} weekend days)`
        : "";
      toast.success(`Configured "${meterName}" with ${parsedData.rows.length} data rows${profileSummary}`);
    } finally {
      setIsProcessingWizard(false);
    }
  }, [wizardFile, unassignedMeters, usedMeterIds, configuringFileId]);

  const openWizardForFile = (fileId: string) => {
    const file = pendingFiles.find(f => f.id === fileId);
    if (file) {
      setConfiguringFileId(fileId);
      setWizardFile({ name: file.fileName, content: file.content });
      setWizardOpen(true);
    }
  };

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const updateFileMatch = (fileId: string, meterId: string | null) => {
    setPendingFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, matchedMeterId: meterId || undefined, matchType: meterId ? "manual" : "new" }
          : f
      )
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (pendingFiles.every(f => selectedIds.has(f.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiles.map(f => f.id)));
    }
  };

  const saveSelectedFiles = async () => {
    const filesToSave = pendingFiles.filter(f => selectedIds.has(f.id));
    
    if (filesToSave.length === 0) {
      toast.error("No files selected");
      return;
    }

    // Check if all selected files are configured
    const unconfiguredFiles = filesToSave.filter(f => !f.isConfigured);
    if (unconfiguredFiles.length > 0) {
      toast.error(`${unconfiguredFiles.length} file(s) need column configuration before saving. Click the ⚙ icon to configure.`);
      return;
    }

    setIsSaving(true);

    try {
      let updatedCount = 0;
      let createdCount = 0;

      for (const file of filesToSave) {
        // Use processed profile data if available, otherwise use empty arrays
        const profile = file.processedProfile;
        const weekdayProfile = profile?.weekdayProfile || Array(24).fill(0);
        const weekendProfile = profile?.weekendProfile || Array(24).fill(0);
        const weekdayDays = profile?.weekdayDays || 0;
        const weekendDays = profile?.weekendDays || 0;
        const dateRangeStart = profile?.dateRangeStart || file.dateRange?.start || null;
        const dateRangeEnd = profile?.dateRangeEnd || file.dateRange?.end || null;

        // Build raw_data with actual consumption stats
        const rawDataPayload = [{
          csvContent: file.content,
          totalKwh: profile?.totalKwh || 0,
          avgDailyKwh: profile ? (profile.totalKwh / Math.max(1, profile.weekdayDays + profile.weekendDays)) : 0,
          peakKw: profile?.peakKw || 0,
          avgKw: profile?.avgKw || 0,
          dataPoints: profile?.dataPoints || file.rowCount,
          dateStart: dateRangeStart,
          dateEnd: dateRangeEnd,
        }];

        if (file.matchedMeterId) {
          // Update existing meter placeholder with processed CSV data
          const { error } = await supabase
            .from("scada_imports")
            .update({
              file_name: file.fileName,
              raw_data: rawDataPayload,
              data_points: profile?.dataPoints || file.rowCount,
              load_profile_weekday: weekdayProfile,
              load_profile_weekend: weekendProfile,
              weekday_days: weekdayDays,
              weekend_days: weekendDays,
              date_range_start: dateRangeStart,
              date_range_end: dateRangeEnd,
            })
            .eq("id", file.matchedMeterId);

          if (error) throw error;
          updatedCount++;
        } else {
          // Create new meter record with processed data
          const meterName = file.meterName || file.fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          const { error } = await supabase.from("scada_imports").insert({
            site_name: site?.name || meterName,
            site_id: siteId || null,
            shop_name: meterName,
            file_name: file.fileName,
            raw_data: rawDataPayload,
            data_points: profile?.dataPoints || file.rowCount,
            load_profile_weekday: weekdayProfile,
            load_profile_weekend: weekendProfile,
            weekday_days: weekdayDays,
            weekend_days: weekendDays,
            date_range_start: dateRangeStart,
            date_range_end: dateRangeEnd,
          });

          if (error) throw error;
          createdCount++;
        }
      }

      // Remove saved files from pending list
      setPendingFiles((prev) => prev.filter(f => !selectedIds.has(f.id)));
      setSelectedIds(new Set());

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["site-meter-placeholders"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });

      const messages = [];
      if (updatedCount > 0) messages.push(`${updatedCount} assigned to existing shops`);
      if (createdCount > 0) messages.push(`${createdCount} created as new`);
      toast.success(messages.join(", "));
      
      onImportComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save files");
    } finally {
      setIsSaving(false);
    }
  };

  const getMatchedMeterName = (meterId: string) => {
    const meter = existingMeters.find(m => m.id === meterId);
    return meter?.shop_name || "Unknown";
  };

  const selectedCount = selectedIds.size;
  const matchedCount = pendingFiles.filter(f => f.matchedMeterId).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Meters
          </CardTitle>
          <CardDescription>
            Upload CSV files to assign to existing shop placeholders or create new meters.
            {site && <span className="font-medium"> Importing to: {site.name}</span>}
            {unassignedMeters.length > 0 && (
              <span className="ml-2 text-primary">({unassignedMeters.length} unassigned shops available)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          <div className="space-y-2">
            <input
              type="file"
              accept=".csv"
              multiple
              ref={fileInputRef}
              onChange={handleFilesUpload}
              className="hidden"
            />
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileUp className="h-10 w-10" />
                <span className="font-medium">Click to upload or drag and drop</span>
                <span className="text-sm">Multiple CSV files supported</span>
              </div>
            </div>
          </div>

          {/* Files Table */}
          {pendingFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} uploaded
                  </span>
                  {pendingFiles.filter(f => f.isConfigured).length > 0 && (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {pendingFiles.filter(f => f.isConfigured).length} configured
                    </Badge>
                  )}
                  {pendingFiles.filter(f => !f.isConfigured).length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {pendingFiles.filter(f => !f.isConfigured).length} need configuration
                    </Badge>
                  )}
                  {matchedCount > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Link2 className="h-3 w-3" />
                      {matchedCount} matched
                    </Badge>
                  )}
                  {selectedCount > 0 && (
                    <Badge variant="secondary">{selectedCount} selected</Badge>
                  )}
                </div>
                <Button
                  onClick={saveSelectedFiles}
                  disabled={isSaving || selectedCount === 0 || pendingFiles.filter(f => selectedIds.has(f.id) && !f.isConfigured).length > 0}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Selected ({selectedCount})
                    </>
                  )}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={pendingFiles.length > 0 && pendingFiles.every(f => selectedIds.has(f.id))}
                        onCheckedChange={toggleSelectAll}
                        disabled={isSaving}
                      />
                    </TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Meter Info</TableHead>
                    <TableHead>Assign to Shop</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingFiles.map((file) => (
                    <TableRow key={file.id} className={selectedIds.has(file.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(file.id)}
                          onCheckedChange={() => toggleSelect(file.id)}
                          disabled={isSaving}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{file.fileName}</span>
                            {file.isConfigured ? (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Needs Config
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{file.rowCount.toLocaleString()}</Badge>
                      </TableCell>
                      <TableCell>
                        {file.isConfigured && file.processedProfile && file.processedProfile.dataPoints > 0 ? (
                          <div className="text-sm space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{file.meterName || "-"}</span>
                              <Badge variant="default" className="text-xs">
                                {file.processedProfile.peakKw} kW peak
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {file.processedProfile.weekdayDays} weekdays, {file.processedProfile.weekendDays} weekend days
                              {file.processedProfile.dateRangeStart && (
                                <> • {file.processedProfile.dateRangeStart} → {file.processedProfile.dateRangeEnd}</>
                              )}
                            </p>
                          </div>
                        ) : !file.isConfigured ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openWizardForFile(file.id)}
                            disabled={isSaving}
                            className="gap-2"
                          >
                            <Settings2 className="h-4 w-4" />
                            Configure Columns
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">No data</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {unassignedMeters.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={file.matchedMeterId || "new"}
                              onValueChange={(value) => updateFileMatch(file.id, value === "new" ? null : value)}
                            >
                              <SelectTrigger className="w-[250px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">
                                  <span className="flex items-center gap-2">
                                    <AlertCircle className="h-3 w-3 text-muted-foreground" />
                                    Create new meter
                                  </span>
                                </SelectItem>
                                {file.matchedMeterId && (
                                  <SelectItem value={file.matchedMeterId}>
                                    <span className="flex items-center gap-2">
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      {getMatchedMeterName(file.matchedMeterId)}
                                      {file.matchType === "auto" && <Badge variant="secondary" className="ml-1 text-xs">auto</Badge>}
                                    </span>
                                  </SelectItem>
                                )}
                                {availableMeters
                                  .filter(m => m.id !== file.matchedMeterId)
                                  .map((meter) => (
                                    <SelectItem key={meter.id} value={meter.id}>
                                      <span className="flex items-center gap-2">
                                        {meter.shop_name}
                                        {meter.area_sqm && (
                                          <span className="text-muted-foreground text-xs">
                                            ({meter.area_sqm}m²)
                                          </span>
                                        )}
                                      </span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {file.matchType === "auto" && (
                              <Badge variant="outline" className="text-green-600 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Will create new meter</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant={file.isConfigured ? "ghost" : "default"}
                            size="icon"
                            onClick={() => openWizardForFile(file.id)}
                            disabled={isSaving}
                            title={file.isConfigured ? "Reconfigure columns" : "Configure columns (required)"}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSV Import Wizard */}
      <CsvImportWizard
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setWizardFile(null);
          setConfiguringFileId(null);
        }}
        csvContent={wizardFile?.content || null}
        fileName={wizardFile?.name || ""}
        onProcess={handleWizardProcess}
        isProcessing={isProcessingWizard}
      />
    </div>
  );
}