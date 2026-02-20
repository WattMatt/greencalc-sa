import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, FileText, Trash2, Settings2, Eye, ChevronDown, Check, ChevronsUpDown, Database, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface FileEntry {
  file: File;
  name: string;
  tenantId: string | null;
  status: "pending" | "ready" | "parsed" | "error";
  content?: string; // raw CSV text after reading
}

interface ColumnInterpretation {
  originalName: string;
  displayName: string;
  visible: boolean;
  dataType: "DateTime" | "Float" | "Int" | "String" | "Boolean";
  dateTimeFormat: string;
  splitBy: "none" | "tab" | "comma" | "semicolon" | "space";
}

interface ScadaImportWizardProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Called when the wizard finishes with parsed data for each file */
  onComplete?: (results: ParsedFileResult[]) => void;
}

export interface ParsedFileResult {
  fileName: string;
  tenantId: string | null;
  headers: string[];
  rows: string[][];
  columns: ColumnInterpretation[];
  rawContent?: string;
}

// ── Separator helpers ──────────────────────────────────────────

const SEPARATORS: Record<string, string> = {
  tab: "\t",
  comma: ",",
  semicolon: ";",
  space: " ",
};

const DATETIME_FORMATS = [
  "YYYY-MM-DD HH:mm:ss",
  "YYYY-MM-DD HH:mm",
  "YYYY-MM-DD",
  "DD/MM/YYYY HH:mm:ss",
  "DD/MM/YYYY",
  "MM/DD/YYYY HH:mm:ss",
  "MM/DD/YYYY",
  "YYYY/MM/DD HH:mm:ss",
  "DD-MM-YYYY HH:mm:ss",
  "DD-MM-YYYY",
  "DD MMM YYYY HH:mm",
];

function detectSeparator(content: string): string {
  const firstLines = content.split("\n").slice(0, 5).join("\n");
  const tabCount = (firstLines.match(/\t/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return "tab";
  if (semicolonCount > commaCount) return "semicolon";
  return "comma";
}

function splitLine(line: string, sep: string): string[] {
  const actualSep = SEPARATORS[sep] || ",";
  // Simple split — handles basic CSV without quoted fields containing separators
  if (actualSep === ",") {
    // Handle quoted CSV fields
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }
  return line.split(actualSep);
}

function parseContent(
  content: string,
  separator: string,
  headerRow: number
): { headers: string[]; rows: string[][] } {
  const lines = content
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  const headerIdx = Math.max(0, headerRow - 1);
  if (headerIdx >= lines.length) return { headers: [], rows: [] };

  const headers = splitLine(lines[headerIdx], separator);
  const rows = lines
    .slice(headerIdx + 1)
    .map((l) => splitLine(l, separator));

  return { headers, rows };
}

function guessDataType(values: string[]): ColumnInterpretation["dataType"] {
  const sample = values.filter((v) => v.trim().length > 0).slice(0, 20);
  if (sample.length === 0) return "String";

  // Check datetime first
  const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}/;
  if (sample.every((v) => datePattern.test(v))) return "DateTime";

  // Check numeric
  const numericPattern = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
  if (sample.every((v) => numericPattern.test(v))) {
    return sample.some((v) => v.includes(".")) ? "Float" : "Int";
  }

  // Check boolean
  const boolValues = new Set(sample.map((v) => v.toLowerCase()));
  if (
    boolValues.size <= 2 &&
    [...boolValues].every((v) => ["true", "false", "0", "1", "yes", "no"].includes(v))
  ) {
    return "Boolean";
  }

  return "String";
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        resolve(csv);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    }
  });
}

// ── Component ──────────────────────────────────────────────────

export function ScadaImportWizard({
  open,
  onClose,
  projectId,
  onComplete,
}: ScadaImportWizardProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("upload");

  // Step 1 state
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Step 2 state
  const [separator, setSeparator] = useState("comma");
  const [headerRow, setHeaderRow] = useState(1);
  const [columns, setColumns] = useState<ColumnInterpretation[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);

  // Step 3 state
  const [previewActive, setPreviewActive] = useState(false);
  const [openSection, setOpenSection] = useState<"parsing" | "columns">("parsing");
  // Track which file's tenant popover is open
  const [openTenantPopover, setOpenTenantPopover] = useState<number | null>(null);

  // Step 4 state
  const [uploadStatuses, setUploadStatuses] = useState<Record<number, { status: 'pending' | 'uploading' | 'parsing' | 'done' | 'error'; error?: string }>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  // Fetch tenants for assignment
  const { data: tenants = [] } = useQuery({
    queryKey: ["project-tenants-for-wizard", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tenants")
        .select("id, name, shop_name, shop_number")
        .eq("project_id", projectId)
        .order("shop_number");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Tenants already assigned to files
  const assignedTenantIds = useMemo(
    () => new Set(files.filter((f) => f.tenantId).map((f) => f.tenantId!)),
    [files]
  );

  const availableTenants = useMemo(
    () => tenants.filter((t) => !assignedTenantIds.has(t.id)),
    [tenants, assignedTenantIds]
  );

  // Fetch existing imports for this project
  const { data: existingImports = [], isLoading: isLoadingExisting } = useQuery({
    queryKey: ["existing-scada-imports", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, file_name, site_name, shop_name, data_points, date_range_start, date_range_end, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const deleteImportMutation = useMutation({
    mutationFn: async (importId: string) => {
      // Get the import record first (need file_name for storage cleanup)
      const { data: imp } = await supabase
        .from("scada_imports")
        .select("file_name")
        .eq("id", importId)
        .single();

      // 1. Clear tenant references
      await supabase
        .from("project_tenants")
        .update({ scada_import_id: null })
        .eq("scada_import_id", importId);

      // 2. Remove file from storage
      if (imp?.file_name) {
        const { data: files } = await supabase.storage
          .from("scada-csvs")
          .list(projectId);
        const matches = (files || []).filter(f =>
          f.name.endsWith(`_${imp.file_name}`)
        );
        if (matches.length > 0) {
          await supabase.storage
            .from("scada-csvs")
            .remove(matches.map(f => `${projectId}/${f.name}`));
        }
      }

      // 3. Delete the DB record
      const { error } = await supabase
        .from("scada_imports")
        .delete()
        .eq("id", importId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["existing-scada-imports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-tenants"] });
      toast.success("Import and associated data deleted");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });

  const deleteAllImportsMutation = useMutation({
    mutationFn: async () => {
      for (const imp of existingImports) {
        // 1. Clear tenant references
        await supabase
          .from("project_tenants")
          .update({ scada_import_id: null })
          .eq("scada_import_id", imp.id);

        // 2. Remove file from storage
        if (imp.file_name) {
          const { data: files } = await supabase.storage
            .from("scada-csvs")
            .list(projectId);
          const matches = (files || []).filter(f =>
            f.name.endsWith(`_${imp.file_name}`)
          );
          if (matches.length > 0) {
            await supabase.storage
              .from("scada-csvs")
              .remove(matches.map(f => `${projectId}/${f.name}`));
          }
        }

        // 3. Delete the DB record
        const { error } = await supabase
          .from("scada_imports")
          .delete()
          .eq("id", imp.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["existing-scada-imports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-tenants"] });
      toast.success(`All ${existingImports.length} imports deleted`);
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete all: ${err.message}`);
    },
  });

  // ── Step 1: File handling ────────────────────────────────────

  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files || []);
      const newEntries: FileEntry[] = selected.map((f) => ({
        file: f,
        name: f.name,
        tenantId: null,
        status: "pending" as const,
      }));
      setFiles((prev) => [...prev, ...newEntries]);
      e.target.value = "";
    },
    []
  );

  const assignTenant = useCallback((fileIdx: number, tenantId: string | null) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === fileIdx ? { ...f, tenantId } : f))
    );
  }, []);

  const removeFile = useCallback((fileIdx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== fileIdx));
  }, []);

  const handleReadAll = useCallback(async () => {
    if (files.length === 0) {
      toast.error("No files selected");
      return;
    }

    setIsUploading(true);
    try {
      const updated = [...files];
      for (let i = 0; i < updated.length; i++) {
        const entry = updated[i];
        if (entry.status === "ready") continue;

        // Read content locally only — no network calls
        const content = await readFileAsText(entry.file);
        updated[i] = { ...entry, status: "ready", content };
      }

      setFiles(updated);

      // Auto-detect separator from first file with content
      const firstContent = updated.find((f) => f.content)?.content;
      if (firstContent) {
        const detected = detectSeparator(firstContent);
        setSeparator(detected);
        loadPreview(firstContent, detected, headerRow);
      }

      toast.success("Files loaded successfully");
      setActiveTab("parse");
    } catch (err) {
      toast.error("Failed to read files");
    } finally {
      setIsUploading(false);
    }
  }, [files, projectId, headerRow]);

  // ── Step 2: Parse config ─────────────────────────────────────

  const loadPreview = useCallback(
    (content: string, sep: string, hRow: number) => {
      const { headers, rows } = parseContent(content, sep, hRow);
      setPreviewHeaders(headers);
      setPreviewRows(rows.slice(0, 20));

      // Build column interpretations
      const colInterps: ColumnInterpretation[] = headers.map((h, i) => {
        const colValues = rows.map((r) => r[i] || "");
        return {
          originalName: h,
          displayName: h,
          visible: true,
          dataType: guessDataType(colValues),
          dateTimeFormat: "YYYY-MM-DD HH:mm:ss",
          splitBy: "none" as const,
        };
      });
      setColumns(colInterps);
    },
    []
  );

  const handleSeparatorChange = useCallback(
    (val: string) => {
      setSeparator(val);
      const firstContent = files.find((f) => f.content)?.content;
      if (firstContent) loadPreview(firstContent, val, headerRow);
    },
    [files, headerRow, loadPreview]
  );

  const handleHeaderRowChange = useCallback(
    (val: string) => {
      const num = parseInt(val) || 1;
      setHeaderRow(num);
      const firstContent = files.find((f) => f.content)?.content;
      if (firstContent) loadPreview(firstContent, separator, num);
    },
    [files, separator, loadPreview]
  );

  const toggleColumnVisibility = useCallback((idx: number) => {
    setColumns((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, visible: !c.visible } : c))
    );
  }, []);

  const toggleAllColumns = useCallback(
    (checked: boolean) => {
      setColumns((prev) => prev.map((c) => ({ ...c, visible: checked })));
    },
    []
  );

  const updateColumnName = useCallback((idx: number, name: string) => {
    setColumns((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, displayName: name } : c))
    );
  }, []);

  const updateColumnDataType = useCallback(
    (idx: number, dataType: ColumnInterpretation["dataType"]) => {
      setColumns((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, dataType } : c))
      );
    },
    []
  );

  const updateColumnDateFormat = useCallback((idx: number, fmt: string) => {
    setColumns((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, dateTimeFormat: fmt } : c))
    );
  }, []);

  const updateColumnSplit = useCallback(
    (idx: number, splitBy: ColumnInterpretation["splitBy"]) => {
      setColumns((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, splitBy } : c))
      );
    },
    []
  );

  const allVisible = columns.length > 0 && columns.every((c) => c.visible);
  const someVisible = columns.some((c) => c.visible);

  // ── Step 3: Preview ──────────────────────────────────────────

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns]
  );

  const visibleColIndices = useMemo(
    () => columns.map((c, i) => (c.visible ? i : -1)).filter((i) => i >= 0),
    [columns]
  );

  const filteredPreviewRows = useMemo(
    () =>
      previewRows.map((row) => visibleColIndices.map((ci) => row[ci] || "")),
    [previewRows, visibleColIndices]
  );

  // ── Navigate to Step 4 ───────────────────────────────────────

  const handleGoToImport = useCallback(() => {
    const statuses: Record<number, { status: 'pending' | 'uploading' | 'parsing' | 'done' | 'error'; error?: string }> = {};
    files.forEach((_, i) => {
      statuses[i] = { status: 'pending' };
    });
    setUploadStatuses(statuses);
    setImportComplete(false);
    setIsImporting(false);
    setActiveTab("import");
  }, [files]);

  // ── Step 4: Sequential import ──────────────────────────────

  const handleStartImport = useCallback(async () => {
    setIsImporting(true);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.content) {
        setUploadStatuses(prev => ({ ...prev, [i]: { status: 'error', error: 'No file content' } }));
        continue;
      }

      try {
        // Uploading
        setUploadStatuses(prev => ({ ...prev, [i]: { status: 'uploading' } }));
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${projectId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("scada-csvs")
          .upload(path, f.file, { upsert: true });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // Parsing
        setUploadStatuses(prev => ({ ...prev, [i]: { status: 'parsing' } }));
        const { headers, rows } = parseContent(f.content, separator, headerRow);
        const result: ParsedFileResult = {
          fileName: f.name,
          tenantId: f.tenantId,
          headers: visibleColumns.map((c) => c.displayName),
          rows: rows.map((r) => visibleColIndices.map((ci) => r[ci] || "")),
          columns: visibleColumns,
          rawContent: f.content,
        };

        // Call onComplete for this single file
        if (onComplete) {
          onComplete([result]);
        }

        setUploadStatuses(prev => ({ ...prev, [i]: { status: 'done' } }));
      } catch (err: any) {
        setUploadStatuses(prev => ({ ...prev, [i]: { status: 'error', error: err.message || 'Unknown error' } }));
      }
    }

    setIsImporting(false);
    setImportComplete(true);
    queryClient.invalidateQueries({ queryKey: ["existing-scada-imports", projectId] });
  }, [files, projectId, separator, headerRow, visibleColumns, visibleColIndices, onComplete, queryClient]);

  const doneCount = useMemo(() => Object.values(uploadStatuses).filter(s => s.status === 'done').length, [uploadStatuses]);
  const processedCount = useMemo(() => Object.values(uploadStatuses).filter(s => s.status === 'done' || s.status === 'error').length, [uploadStatuses]);

  const handleDialogClose = useCallback(() => {
    setFiles([]);
    setColumns([]);
    setPreviewHeaders([]);
    setPreviewRows([]);
    setUploadStatuses({});
    setIsImporting(false);
    setImportComplete(false);
    setActiveTab("upload");
    setSeparator("comma");
    setHeaderRow(1);
    onClose();
  }, [onClose]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDialogClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Bulk Upload</DialogTitle>
          <DialogDescription>
            Select files, configure parsing, preview your data, then upload and import with a single click
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="upload">1. Select Files</TabsTrigger>
            <TabsTrigger
              value="parse"
              disabled={files.every((f) => f.status === "pending")}
            >
              2. Parse &amp; Ingest
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              disabled={columns.length === 0}
            >
              3. Preview
            </TabsTrigger>
            <TabsTrigger
              value="import"
              disabled={Object.keys(uploadStatuses).length === 0}
            >
              4. Upload
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Upload ────────────────────────────────── */}
          <TabsContent
            value="upload"
            className="flex-1 flex flex-col min-h-0 overflow-auto space-y-4"
          >
            {/* Existing Imports Section */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">
                    Previously Imported Files
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {isLoadingExisting ? "…" : existingImports.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {isLoadingExisting ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : existingImports.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-1">
                    No files have been imported yet.
                  </p>
                ) : (
                  <div className="overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs h-8">File</TableHead>
                          <TableHead className="text-xs h-8">Site / Shop</TableHead>
                          <TableHead className="text-xs h-8 text-right">Points</TableHead>
                          <TableHead className="text-xs h-8">Date Range</TableHead>
                          <TableHead className="text-xs h-8">Imported</TableHead>
                          <TableHead className="text-xs h-8 w-10">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                if (confirm(`Delete all ${existingImports.length} imports? This will also remove uploaded files and unlink any assigned tenants.`)) {
                                  deleteAllImportsMutation.mutate();
                                }
                              }}
                              disabled={deleteAllImportsMutation.isPending || deleteImportMutation.isPending}
                            >
                              {deleteAllImportsMutation.isPending 
                                ? <Loader2 className="h-3 w-3 animate-spin text-destructive" />
                                : <Trash2 className="h-3 w-3 text-destructive" />}
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {existingImports.map((imp) => (
                          <TableRow key={imp.id}>
                            <TableCell className="text-xs py-1.5 max-w-[150px] truncate">
                              {imp.file_name || "—"}
                            </TableCell>
                            <TableCell className="text-xs py-1.5">
                              {imp.shop_name || imp.site_name}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-right">
                              {imp.data_points ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs py-1.5">
                              {imp.date_range_start && imp.date_range_end
                                ? `${imp.date_range_start} → ${imp.date_range_end}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs py-1.5">
                              {new Date(imp.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  if (confirm("Delete this import? This will also remove the uploaded file and unlink any assigned tenants.")) {
                                    deleteImportMutation.mutate(imp.id);
                                  }
                                }}
                                disabled={deleteImportMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
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

            <div>
              <Label className="font-semibold">Select CSV Files</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Files
                </Button>
                <span className="text-sm text-muted-foreground">
                  {files.length === 0
                    ? "No file chosen"
                    : `${files.length} file(s) selected`}
                </span>
              </div>
            </div>

            {files.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {files.length} file(s) selected
                    </span>
                    {files.filter((f) => f.status === "pending").length > 0 && (
                      <Badge variant="default" className="bg-green-600">
                        {files.filter((f) => f.status === "pending").length} new
                      </Badge>
                    )}
                  </div>
                  <Button
                    onClick={handleReadAll}
                    disabled={
                      isUploading ||
                      files.every((f) => f.status === "ready")
                    }
                  >
                    {isUploading ? "Reading..." : "Continue"}
                  </Button>
                </div>

                <div className="space-y-2">
                  {files.map((entry, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {entry.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.status === "ready"
                                ? "Ready"
                                : entry.status === "error"
                                ? "Error"
                                : "Pending"}
                            </p>
                          </div>
                          {entry.status === "pending" && (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              New
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Popover
                            open={openTenantPopover === idx}
                            onOpenChange={(v) => setOpenTenantPopover(v ? idx : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-[200px] h-8 justify-between text-sm font-normal"
                              >
                                {entry.tenantId
                                  ? (() => {
                                      const t = tenants.find((t) => t.id === entry.tenantId);
                                      return t ? `${t.shop_name || t.name}${t.shop_number ? ` (${t.shop_number})` : ""}` : "No tenant";
                                    })()
                                  : "No tenant"}
                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0" align="end">
                              <Command>
                                <CommandInput placeholder="Search tenants..." />
                                <CommandList>
                                  <CommandEmpty>No tenant found.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="no-tenant"
                                      onSelect={() => {
                                        assignTenant(idx, null);
                                        setOpenTenantPopover(null);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", !entry.tenantId ? "opacity-100" : "opacity-0")} />
                                      No tenant
                                    </CommandItem>
                                    {tenants
                                      .filter(
                                        (t) =>
                                          t.id === entry.tenantId ||
                                          !assignedTenantIds.has(t.id)
                                      )
                                      .map((t) => (
                                        <CommandItem
                                          key={t.id}
                                          value={`${t.shop_name || t.name} ${t.shop_number || ""}`}
                                          onSelect={() => {
                                            assignTenant(idx, t.id);
                                            setOpenTenantPopover(null);
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", entry.tenantId === t.id ? "opacity-100" : "opacity-0")} />
                                          {t.shop_name || t.name}
                                          {t.shop_number ? ` (${t.shop_number})` : ""}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeFile(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Tab 2: Parse & Ingest ────────────────────────── */}
          <TabsContent
            value="parse"
            className="flex-1 flex flex-col min-h-0 overflow-auto space-y-4"
          >
            {/* Parsing Configuration */}
            <Collapsible
              open={openSection === "parsing"}
              onOpenChange={(open) => open && setOpenSection("parsing")}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Parsing Configuration
                      <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${openSection === "parsing" ? "rotate-180" : ""}`} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <p className="text-sm font-medium mb-3">File Interpretation</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Column Separator</Label>
                        <Select
                          value={separator}
                          onValueChange={handleSeparatorChange}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tab">Tab</SelectItem>
                            <SelectItem value="comma">Comma</SelectItem>
                            <SelectItem value="semicolon">Semicolon</SelectItem>
                            <SelectItem value="space">Space</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Header Row Number</Label>
                        <Input
                          type="number"
                          min={1}
                          value={headerRow}
                          onChange={(e) => handleHeaderRowChange(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Column Interpretation */}
            {columns.length > 0 && (
              <Collapsible
                open={openSection === "columns"}
                onOpenChange={(open) => open && setOpenSection("columns")}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Column Interpretation
                        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${openSection === "columns" ? "rotate-180" : ""}`} />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3">
                      {/* Select All header */}
                      <div className="flex items-center gap-2 border rounded-md p-3 bg-muted/30">
                        <Checkbox
                          checked={allVisible}
                          onCheckedChange={(v) => toggleAllColumns(!!v)}
                          className="mr-1"
                        />
                        <span className="text-sm font-medium">Column Name</span>
                      </div>

                      {/* Column cards */}
                      {columns.map((col, idx) => (
                        <div
                          key={idx}
                          className="border rounded-md p-3 space-y-3 bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={col.visible}
                              onCheckedChange={() => toggleColumnVisibility(idx)}
                            />
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
                              <div className="space-y-1">
                                <Label className="text-xs">Column Name</Label>
                                <Input
                                  value={col.displayName}
                                  onChange={(e) =>
                                    updateColumnName(idx, e.target.value)
                                  }
                                  className="h-8"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Data Type</Label>
                                <Select
                                  value={col.dataType}
                                  onValueChange={(v) =>
                                    updateColumnDataType(
                                      idx,
                                      v as ColumnInterpretation["dataType"]
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="DateTime">DateTime</SelectItem>
                                    <SelectItem value="Float">Float</SelectItem>
                                    <SelectItem value="Int">Int</SelectItem>
                                    <SelectItem value="String">String</SelectItem>
                                    <SelectItem value="Boolean">Boolean</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {col.dataType === "DateTime" && (
                                <div className="space-y-1">
                                  <Label className="text-xs">DateTime Format</Label>
                                  <Select
                                    value={DATETIME_FORMATS.includes(col.dateTimeFormat) ? col.dateTimeFormat : "__custom__"}
                                    onValueChange={(v) => {
                                      if (v === "__custom__") {
                                        updateColumnDateFormat(idx, "");
                                      } else {
                                        updateColumnDateFormat(idx, v);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DATETIME_FORMATS.map((fmt) => (
                                        <SelectItem key={fmt} value={fmt}>
                                          {fmt}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="__custom__">Custom Format</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {!DATETIME_FORMATS.includes(col.dateTimeFormat) && (
                                    <Input
                                      value={col.dateTimeFormat}
                                      onChange={(e) => updateColumnDateFormat(idx, e.target.value)}
                                      placeholder="e.g. DD/MMM/YY HH:mm"
                                      className="h-8 mt-1"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pl-8">
                            <div className="space-y-1 max-w-xs">
                              <Label className="text-xs">Split Column By</Label>
                              <Select
                                value={col.splitBy}
                                onValueChange={(v) =>
                                  updateColumnSplit(
                                    idx,
                                    v as ColumnInterpretation["splitBy"]
                                  )
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No split</SelectItem>
                                  <SelectItem value="tab">Tab</SelectItem>
                                  <SelectItem value="comma">Comma</SelectItem>
                                  <SelectItem value="semicolon">Semicolon</SelectItem>
                                  <SelectItem value="space">Space</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Preview Data button */}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab("preview");
                }}
                disabled={columns.length === 0 || !someVisible}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Data
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab 3: Preview ───────────────────────────────── */}
          <TabsContent
            value="preview"
            className="flex-1 flex flex-col min-h-0 space-y-4"
          >
            <div>
              <h3 className="text-sm font-semibold">Parsed CSV Data</h3>
              <p className="text-xs text-muted-foreground">
                Data displayed using the column interpretation from the Parsing Configuration
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {previewRows.length} readings processed
              </p>
            </div>

            <div className="overflow-auto border rounded-md flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map((col, i) => (
                      <TableHead
                        key={i}
                        className="whitespace-nowrap text-xs"
                      >
                        {col.displayName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPreviewRows.map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell
                          key={ci}
                          className="text-xs whitespace-nowrap"
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button onClick={handleGoToImport}>
                <Upload className="h-4 w-4 mr-2" />
                Continue to Upload
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab 4: Upload Progress ───────────────────────── */}
          <TabsContent
            value="import"
            className="flex-1 flex flex-col min-h-0 space-y-4"
          >
            {/* Summary bar */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {importComplete
                  ? `${doneCount} of ${files.length} files imported successfully`
                  : isImporting
                  ? `Importing... (${processedCount}/${files.length})`
                  : `${files.length} files ready to import`}
              </div>
              {importComplete && doneCount < files.length && (
                <Badge variant="destructive" className="text-xs">
                  {files.length - doneCount} failed
                </Badge>
              )}
            </div>

            {/* File list */}
            <div className="overflow-auto flex-1 min-h-0 space-y-2">
              {files.map((entry, idx) => {
                const st = uploadStatuses[idx] || { status: 'pending' };
                const tenantName = entry.tenantId
                  ? (() => {
                      const t = tenants.find((t) => t.id === entry.tenantId);
                      return t ? `${t.shop_name || t.name}${t.shop_number ? ` (${t.shop_number})` : ""}` : "Unassigned";
                    })()
                  : "Unassigned";

                return (
                  <Card key={idx} className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Status icon */}
                      <div className="shrink-0">
                        {st.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                        {(st.status === 'uploading' || st.status === 'parsing') && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        {st.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {st.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                      </div>

                      {/* File info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{entry.name}</p>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {tenantName}
                          </Badge>
                        </div>
                        {st.status === 'uploading' && (
                          <p className="text-xs text-muted-foreground">Uploading to storage...</p>
                        )}
                        {st.status === 'parsing' && (
                          <p className="text-xs text-muted-foreground">Parsing and importing...</p>
                        )}
                        {st.status === 'error' && st.error && (
                          <p className="text-xs text-destructive mt-0.5">{st.error}</p>
                        )}
                        {st.status === 'done' && (
                          <p className="text-xs text-green-600">Imported successfully</p>
                        )}
                      </div>

                      {/* Status badge */}
                      <Badge
                        variant={st.status === 'done' ? 'default' : st.status === 'error' ? 'destructive' : 'secondary'}
                        className={cn("text-xs shrink-0", st.status === 'done' && "bg-green-600")}
                      >
                        {st.status === 'pending' && 'Pending'}
                        {st.status === 'uploading' && 'Uploading'}
                        {st.status === 'parsing' && 'Parsing'}
                        {st.status === 'done' && 'Done'}
                        {st.status === 'error' && 'Failed'}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Action button */}
            <div className="flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={handleDialogClose}>
                {importComplete ? "Close" : "Cancel"}
              </Button>
              {!importComplete && (
                <Button onClick={handleStartImport} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing... ({processedCount}/{files.length})
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Complete Import
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
