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
import { CsvImportWizard, WizardParseConfig } from "./CsvImportWizard";
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

  const handleFilesUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    // For single file, open the wizard
    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setWizardFile({ name: file.name, content });
        setWizardOpen(true);
      };
      reader.readAsText(file);
    } else {
      // For multiple files, use quick import (existing behavior)
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const rowCount = content.split('\n').filter(l => l.trim()).length;

          const match = findBestMatch(file.name, unassignedMeters.filter(m => !usedMeterIds.has(m.id)));

          const newFile: PendingFile = {
            id: crypto.randomUUID(),
            fileName: file.name,
            content,
            rowCount,
            matchedMeterId: match?.meter.id,
            matchType: match ? "auto" : "new",
          };

          setPendingFiles((prev) => [...prev, newFile]);
        };
        reader.readAsText(file);
      });
    }

    e.target.value = "";
  }, [unassignedMeters, usedMeterIds]);

  const handleWizardProcess = useCallback((config: WizardParseConfig, parsedData: { headers: string[]; rows: string[][]; meterName?: string; dateRange?: { start: string; end: string } }) => {
    if (!wizardFile) return;
    
    setIsProcessingWizard(true);
    
    try {
      const meterName = parsedData.meterName || wizardFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      const match = findBestMatch(meterName, unassignedMeters.filter(m => !usedMeterIds.has(m.id)));

      // Process CSV data into load profiles
      const processedProfile = processCSVToLoadProfile(parsedData.headers, parsedData.rows, config);

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
      };

      setPendingFiles((prev) => [...prev, newFile]);
      setWizardOpen(false);
      setWizardFile(null);
      
      const profileSummary = processedProfile.dataPoints > 0 
        ? ` (Peak: ${processedProfile.peakKw} kW, ${processedProfile.weekdayDays} weekdays, ${processedProfile.weekendDays} weekend days)`
        : "";
      toast.success(`Parsed "${meterName}" with ${parsedData.rows.length} data rows${profileSummary}`);
    } finally {
      setIsProcessingWizard(false);
    }
  }, [wizardFile, unassignedMeters, usedMeterIds]);

  const openWizardForFile = (fileId: string) => {
    const file = pendingFiles.find(f => f.id === fileId);
    if (file) {
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

        if (file.matchedMeterId) {
          // Update existing meter placeholder with processed CSV data
          const { error } = await supabase
            .from("scada_imports")
            .update({
              file_name: file.fileName,
              raw_data: [{ csvContent: file.content }],
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
            raw_data: [{ csvContent: file.content }],
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
                    {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} ready
                  </span>
                  {matchedCount > 0 && (
                    <Badge variant="default" className="gap-1">
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
                  disabled={isSaving || selectedCount === 0}
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
                            {file.parseConfig?.detectedFormat === "pnp-scada" && (
                              <Badge variant="secondary" className="ml-2 text-xs">SCADA</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{file.rowCount.toLocaleString()}</Badge>
                      </TableCell>
                      <TableCell>
                        {file.processedProfile && file.processedProfile.dataPoints > 0 ? (
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
                        ) : file.meterName ? (
                          <div className="text-sm">
                            <span className="font-medium">{file.meterName}</span>
                            {file.dateRange && (
                              <p className="text-xs text-muted-foreground">
                                {file.dateRange.start} → {file.dateRange.end}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not processed</span>
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
                            variant="ghost"
                            size="icon"
                            onClick={() => openWizardForFile(file.id)}
                            disabled={isSaving}
                            title="Configure parsing"
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
        }}
        csvContent={wizardFile?.content || null}
        fileName={wizardFile?.name || ""}
        onProcess={handleWizardProcess}
        isProcessing={isProcessingWizard}
      />
    </div>
  );
}