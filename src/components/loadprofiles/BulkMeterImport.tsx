import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, Loader2, FileUp, Trash2, Save, X, FileText
} from "lucide-react";
import { toast } from "sonner";

interface PendingFile {
  id: string;
  fileName: string;
  content: string;
  rowCount: number;
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
  const [isSaving, setIsSaving] = useState(false);

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

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const rowCount = content.split('\n').filter(l => l.trim()).length;

        const newFile: PendingFile = {
          id: crypto.randomUUID(),
          fileName: file.name,
          content,
          rowCount,
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
      // Save each file as a raw scada_import (unprocessed)
      const inserts = filesToSave.map(file => {
        const meterName = file.fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        return {
          site_name: meterName,
          site_id: siteId || null,
          shop_name: meterName,
          file_name: file.fileName,
          raw_data: [{ csvContent: file.content }], // Store raw CSV for later processing
          data_points: file.rowCount,
          load_profile_weekday: Array(24).fill(0),
          load_profile_weekend: Array(24).fill(0),
          weekday_days: 0,
          weekend_days: 0,
        };
      });

      const { error } = await supabase.from("scada_imports").insert(inserts);
      if (error) throw error;

      // Remove saved files from pending list
      setPendingFiles((prev) => prev.filter(f => !selectedIds.has(f.id)));
      setSelectedIds(new Set());

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });

      toast.success(`Saved ${filesToSave.length} file${filesToSave.length !== 1 ? "s" : ""}`);
      onImportComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save files");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Meters
          </CardTitle>
          <CardDescription>
            Upload multiple CSV files. Files are saved raw and can be processed afterward.
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

          {/* Files Table */}
          {pendingFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} ready
                  </span>
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
                          disabled={isSaving}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{file.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{file.rowCount.toLocaleString()}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(file.id)}
                          disabled={isSaving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
