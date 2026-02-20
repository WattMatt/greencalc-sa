import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Upload, FileText, Trash2, Settings2, Eye, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface FileEntry {
  file: File;
  name: string;
  tenantId: string | null;
  status: "pending" | "uploaded" | "parsed" | "error";
  storagePath?: string;
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
        const wb = XLSX.read(data, { type: "array" });
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

  const handleUploadAll = useCallback(async () => {
    if (files.length === 0) {
      toast.error("No files selected");
      return;
    }

    setIsUploading(true);
    try {
      const updated = [...files];
      for (let i = 0; i < updated.length; i++) {
        const entry = updated[i];
        if (entry.status === "uploaded") continue;

        // Read content
        const content = await readFileAsText(entry.file);
        const path = `${projectId}/${Date.now()}_${entry.name}`;

        // Upload to storage (upsert to replace existing)
        const { error } = await supabase.storage
          .from("scada-csvs")
          .upload(path, entry.file, { upsert: true });

        if (error) {
          updated[i] = { ...entry, status: "error" };
          toast.error(`Failed to upload ${entry.name}: ${error.message}`);
          continue;
        }

        updated[i] = { ...entry, status: "uploaded", storagePath: path, content };
      }

      setFiles(updated);

      // Auto-detect separator from first file with content
      const firstContent = updated.find((f) => f.content)?.content;
      if (firstContent) {
        const detected = detectSeparator(firstContent);
        setSeparator(detected);
        // Load preview
        loadPreview(firstContent, detected, headerRow);
      }

      toast.success("Files uploaded successfully");
      setActiveTab("parse");
    } catch (err) {
      toast.error("Upload failed");
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

  // ── Complete / Close ─────────────────────────────────────────

  const handleComplete = useCallback(() => {
    if (!onComplete) {
      onClose();
      return;
    }

    const results: ParsedFileResult[] = [];
    for (const f of files) {
      if (!f.content) continue;
      const { headers, rows } = parseContent(f.content, separator, headerRow);
      results.push({
        fileName: f.name,
        tenantId: f.tenantId,
        headers: visibleColumns.map((c) => c.displayName),
        rows: rows.map((r) =>
          visibleColIndices.map((ci) => r[ci] || "")
        ),
        columns: visibleColumns,
      });
    }

    onComplete(results);
    onClose();
  }, [files, separator, headerRow, visibleColumns, visibleColIndices, onComplete, onClose]);

  const handleDialogClose = useCallback(() => {
    setFiles([]);
    setColumns([]);
    setPreviewHeaders([]);
    setPreviewRows([]);
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
            Upload multiple files, preview and transform your data, and ingest with a single click
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="upload">1. Upload Files</TabsTrigger>
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
          </TabsList>

          {/* ── Tab 1: Upload ────────────────────────────────── */}
          <TabsContent
            value="upload"
            className="flex-1 flex flex-col min-h-0 overflow-auto space-y-4"
          >
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
                    onClick={handleUploadAll}
                    disabled={
                      isUploading ||
                      files.every((f) => f.status === "uploaded")
                    }
                  >
                    {isUploading ? "Uploading..." : "Upload All"}
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
                              {entry.status === "uploaded"
                                ? "Uploaded"
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
                          <Popover>
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
                                      onSelect={() => assignTenant(idx, null)}
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
                                          onSelect={() => assignTenant(idx, t.id)}
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
              <Button onClick={handleComplete}>
                <Upload className="h-4 w-4 mr-2" />
                Complete Import
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
