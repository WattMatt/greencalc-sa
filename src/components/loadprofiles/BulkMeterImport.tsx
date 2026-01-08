import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, Loader2, Check, FileUp, Trash2, Play, AlertCircle, X, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface PendingFile {
  id: string;
  fileName: string;
  content: string;
  rowCount: number;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
  meterName?: string;
}

interface BulkMeterImportProps {
  siteId: string | null;
  onImportComplete?: () => void;
}

export function BulkMeterImport({ siteId, onImportComplete }: BulkMeterImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

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

  const handleFilesUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const newFiles: PendingFile[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const rowCount = content.split('\n').filter(l => l.trim()).length;
        
        // Extract meter name from file name
        const meterName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

        const newFile: PendingFile = {
          id: crypto.randomUUID(),
          fileName: file.name,
          content,
          rowCount,
          status: "pending",
          meterName,
        };

        setPendingFiles((prev) => [...prev, newFile]);
      };
      reader.readAsText(file);
    });

    e.target.value = "";
  }, []);

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
    const pendingIds = pendingFiles.filter(f => f.status === "pending").map(f => f.id);
    if (pendingIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const processAndSaveFiles = async () => {
    const filesToProcess = pendingFiles.filter(f => selectedIds.has(f.id) && f.status === "pending");
    
    if (filesToProcess.length === 0) {
      toast.error("No files selected to process");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      
      // Update status to processing
      setPendingFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "processing" as const } : f))
      );

      try {
        // Process the CSV
        const { data, error } = await supabase.functions.invoke("process-scada-profile", {
          body: {
            csvContent: file.content,
            action: "process",
            autoDetect: true,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || "Processing failed");

        if (data.dataPoints === 0) {
          throw new Error("No data points detected");
        }

        // Save to database
        const { error: insertError } = await supabase.from("scada_imports").insert([
          {
            site_name: file.meterName || file.fileName,
            site_id: siteId || null,
            shop_name: file.meterName || null,
            file_name: file.fileName,
            raw_data: data.rawData,
            data_points: data.dataPoints,
            date_range_start: data.dateRange.start,
            date_range_end: data.dateRange.end,
            weekday_days: data.weekdayDays,
            weekend_days: data.weekendDays,
            load_profile_weekday: data.weekdayProfile,
            load_profile_weekend: data.weekendProfile,
          },
        ]);

        if (insertError) throw insertError;

        // Update status to success
        setPendingFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: "success" as const } : f))
        );
        successCount++;
      } catch (err) {
        // Update status to error
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "error" as const, error: err instanceof Error ? err.message : "Unknown error" }
              : f
          )
        );
        errorCount++;
      }

      setProgress(((i + 1) / filesToProcess.length) * 100);
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
    queryClient.invalidateQueries({ queryKey: ["sites"] });
    queryClient.invalidateQueries({ queryKey: ["meter-library"] });
    queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });

    setIsProcessing(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} meter${successCount !== 1 ? "s" : ""}`, {
        description: errorCount > 0 ? `${errorCount} failed` : undefined,
      });
    } else if (errorCount > 0) {
      toast.error(`All ${errorCount} imports failed`);
    }

    // Call callback if all processed
    if (errorCount === 0 && successCount > 0) {
      onImportComplete?.();
    }
  };

  const clearCompleted = () => {
    setPendingFiles((prev) => prev.filter((f) => f.status === "pending" || f.status === "error"));
  };

  const pendingCount = pendingFiles.filter(f => f.status === "pending").length;
  const selectedCount = Array.from(selectedIds).filter(id => 
    pendingFiles.find(f => f.id === id)?.status === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Meter Import
          </CardTitle>
          <CardDescription>
            Upload multiple CSV files at once. Files will be auto-processed and saved.
            {site && <span className="font-medium"> Importing to: {site.name}</span>}
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

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing files...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Files Table */}
          {pendingFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} uploaded
                  </span>
                  {pendingCount > 0 && selectedCount > 0 && (
                    <Badge variant="secondary">{selectedCount} selected</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {pendingFiles.some(f => f.status === "success") && (
                    <Button variant="outline" size="sm" onClick={clearCompleted}>
                      Clear Completed
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={processAndSaveFiles}
                    disabled={isProcessing || selectedCount === 0}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Process & Save ({selectedCount})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={pendingCount > 0 && pendingFiles.filter(f => f.status === "pending").every(f => selectedIds.has(f.id))}
                        onCheckedChange={toggleSelectAll}
                        disabled={isProcessing || pendingCount === 0}
                      />
                    </TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Meter Name</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingFiles.map((file) => (
                    <TableRow key={file.id} className={selectedIds.has(file.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(file.id)}
                          onCheckedChange={() => toggleSelect(file.id)}
                          disabled={isProcessing || file.status !== "pending"}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{file.fileName}</TableCell>
                      <TableCell className="text-muted-foreground">{file.meterName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{file.rowCount.toLocaleString()}</Badge>
                      </TableCell>
                      <TableCell>
                        {file.status === "pending" && (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                        {file.status === "processing" && (
                          <Badge variant="default" className="flex items-center gap-1 w-fit">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        {file.status === "success" && (
                          <Badge variant="default" className="bg-green-600 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" />
                            Imported
                          </Badge>
                        )}
                        {file.status === "error" && (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit" title={file.error}>
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {file.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            disabled={isProcessing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Error details */}
              {pendingFiles.some(f => f.status === "error") && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">Failed Imports</h4>
                  {pendingFiles
                    .filter(f => f.status === "error")
                    .map(f => (
                      <div key={f.id} className="text-sm text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium">{f.fileName}:</span>
                        <span>{f.error}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
