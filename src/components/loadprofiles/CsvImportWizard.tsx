import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Settings2, Columns, Check, Zap } from "lucide-react";
import { ColumnConfig, WizardParseConfig, ParsedData } from "./types/csvImportTypes";

// Re-export types for convenience
export type { ColumnConfig, WizardParseConfig, ParsedData };

interface CsvImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  csvContent: string | null;
  fileName: string;
  onProcess: (config: WizardParseConfig, parsedData: ParsedData) => void;
  isProcessing: boolean;
}

const DEFAULT_CONFIG: WizardParseConfig = {
  fileType: "delimited",
  startRow: 1,
  delimiters: {
    tab: false,
    semicolon: false,
    comma: true,
    space: false,
    other: false,
    otherChar: "",
  },
  treatConsecutiveAsOne: false,
  textQualifier: '"',
  columns: [],
};

// Detect PnP SCADA format
function detectPnPScadaFormat(content: string): {
  isPnPScada: boolean;
  meterName?: string;
  dateRange?: { start: string; end: string };
} {
  const lines = content.split('\n').slice(0, 5);
  if (lines.length < 2) return { isPnPScada: false };

  // Check if first line has meter name pattern: ,"{name}",date,date
  const firstLine = lines[0];
  const meterMatch = firstLine.match(/^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/);
  
  // Check if second line has SCADA headers
  const secondLine = lines[1]?.toLowerCase() || "";
  const hasScadaHeaders = secondLine.includes('rdate') && 
                          secondLine.includes('rtime') && 
                          secondLine.includes('kwh');

  if (meterMatch && hasScadaHeaders) {
    return {
      isPnPScada: true,
      meterName: meterMatch[1],
      dateRange: { start: meterMatch[2], end: meterMatch[3] }
    };
  }

  return { isPnPScada: false };
}

// Auto-detect delimiter from content
function detectDelimiter(content: string, startRow: number): WizardParseConfig["delimiters"] {
  const lines = content.split('\n').filter(l => l.trim());
  const sampleLine = lines[startRow - 1] || lines[0] || "";
  
  const delimiters = {
    tab: false,
    semicolon: false,
    comma: false,
    space: false,
    other: false,
    otherChar: "",
  };

  // Count occurrences
  const tabCount = (sampleLine.match(/\t/g) || []).length;
  const semicolonCount = (sampleLine.match(/;/g) || []).length;
  const commaCount = (sampleLine.match(/,/g) || []).length;

  // Set the most likely delimiter
  if (tabCount > 0) delimiters.tab = true;
  if (semicolonCount > 0) delimiters.semicolon = true;
  if (commaCount > 0) delimiters.comma = true;

  // If none detected, default to comma
  if (!delimiters.tab && !delimiters.semicolon && !delimiters.comma) {
    delimiters.comma = true;
  }

  return delimiters;
}

// Parse CSV with given configuration
function parseWithConfig(content: string, config: WizardParseConfig): ParsedData {
  const lines = content.split('\n').filter(l => l.trim());
  
  // Build delimiter regex
  const delims: string[] = [];
  if (config.delimiters.tab) delims.push('\t');
  if (config.delimiters.semicolon) delims.push(';');
  if (config.delimiters.comma) delims.push(',');
  if (config.delimiters.space) delims.push(' ');
  if (config.delimiters.other && config.delimiters.otherChar) {
    delims.push(config.delimiters.otherChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }

  const delimPattern = delims.length > 0 ? delims.join('|') : ',';
  const regex = config.treatConsecutiveAsOne 
    ? new RegExp(`(${delimPattern})+`)
    : new RegExp(delimPattern);

  // Parse rows
  const parseRow = (line: string): string[] => {
    // Handle quoted values
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    const qualifier = config.textQualifier;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === qualifier && !inQuotes) {
        inQuotes = true;
      } else if (char === qualifier && inQuotes) {
        if (line[i + 1] === qualifier) {
          current += qualifier;
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

  const headerIdx = config.startRow - 1;
  const headers = headerIdx < lines.length ? parseRow(lines[headerIdx]) : [];
  const rows = lines.slice(headerIdx + 1).map(parseRow);

  // Extract metadata for PnP SCADA format
  let meterName: string | undefined;
  let dateRange: { start: string; end: string } | undefined;

  if (config.detectedFormat === "pnp-scada" && headerIdx > 0) {
    const metaLine = lines[0];
    const match = metaLine.match(/^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/);
    if (match) {
      meterName = match[1];
      dateRange = { start: match[2], end: match[3] };
    }
  }

  return { headers, rows, meterName, dateRange };
}

export function CsvImportWizard({
  isOpen,
  onClose,
  csvContent,
  fileName,
  onProcess,
  isProcessing,
}: CsvImportWizardProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<WizardParseConfig>(DEFAULT_CONFIG);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);

  // Auto-detect format on open
  useEffect(() => {
    if (isOpen && csvContent) {
      const detection = detectPnPScadaFormat(csvContent);
      
      if (detection.isPnPScada) {
        // PnP SCADA format detected - auto-configure
        setConfig({
          ...DEFAULT_CONFIG,
          startRow: 2, // Headers are on row 2
          delimiters: { ...DEFAULT_CONFIG.delimiters, comma: true },
          detectedFormat: "pnp-scada",
          meterName: detection.meterName,
          dateRange: detection.dateRange,
        });
      } else {
        // Generic CSV - auto-detect delimiter
        const delimiters = detectDelimiter(csvContent, 1);
        setConfig({
          ...DEFAULT_CONFIG,
          delimiters,
          detectedFormat: "generic",
        });
      }
      setStep(1);
      setSelectedColumn(null);
    }
  }, [isOpen, csvContent]);

  // Parse preview data
  const previewData = useMemo(() => {
    if (!csvContent) return null;
    return parseWithConfig(csvContent, config);
  }, [csvContent, config]);

  // Initialize column configs when headers change
  useEffect(() => {
    if (previewData?.headers) {
      const newColumns: ColumnConfig[] = previewData.headers.map((name, index) => {
        // Auto-detect column types
        let dataType: ColumnConfig["dataType"] = "general";
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes('date') || lowerName === 'rdate') {
          dataType = "date";
        } else if (lowerName === 'status') {
          dataType = "text";
        }

        return { index, name, dataType };
      });
      setConfig(prev => ({ ...prev, columns: newColumns }));
    }
  }, [previewData?.headers]);

  const updateDelimiter = (key: keyof WizardParseConfig["delimiters"], value: boolean | string) => {
    setConfig(prev => ({
      ...prev,
      delimiters: { ...prev.delimiters, [key]: value }
    }));
  };

  const updateColumnConfig = (index: number, updates: Partial<ColumnConfig>) => {
    setConfig(prev => ({
      ...prev,
      columns: prev.columns.map(col => 
        col.index === index ? { ...col, ...updates } : col
      )
    }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = () => {
    if (previewData) {
      onProcess(config, previewData);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      {config.detectedFormat === "pnp-scada" && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-primary">PnP SCADA Format Detected</p>
                <p className="text-sm text-muted-foreground">
                  Meter: <span className="font-medium">{config.meterName}</span>
                  {config.dateRange && (
                    <> • {config.dateRange.start} to {config.dateRange.end}</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">File Type</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Choose the data type that best describes your data.
          </p>
          <RadioGroup
            value={config.fileType}
            onValueChange={(v) => setConfig(prev => ({ ...prev, fileType: v as "delimited" | "fixed" }))}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="delimited" id="delimited" className="mt-0.5" />
              <div>
                <Label htmlFor="delimited" className="font-medium cursor-pointer">Delimited</Label>
                <p className="text-xs text-muted-foreground">
                  Characters such as commas or tabs separate each field.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors opacity-50">
              <RadioGroupItem value="fixed" id="fixed" className="mt-0.5" disabled />
              <div>
                <Label htmlFor="fixed" className="font-medium cursor-pointer">Fixed width</Label>
                <p className="text-xs text-muted-foreground">
                  Fields are aligned in columns with spaces between each field.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start import at row</Label>
            <Input
              type="number"
              min={1}
              value={config.startRow}
              onChange={(e) => setConfig(prev => ({ ...prev, startRow: parseInt(e.target.value) || 1 }))}
              className="w-24"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preview of selected data:</Label>
        <PreviewTable data={previewData} config={config} maxRows={8} />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          This screen lets you set the delimiters your data contains.
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <Label className="font-medium">Delimiters</Label>
            <div className="space-y-3">
              {[
                { key: "tab", label: "Tab" },
                { key: "semicolon", label: "Semicolon" },
                { key: "comma", label: "Comma" },
                { key: "space", label: "Space" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={config.delimiters[key as keyof typeof config.delimiters] as boolean}
                    onCheckedChange={(checked) => updateDelimiter(key as keyof WizardParseConfig["delimiters"], !!checked)}
                  />
                  <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="other"
                  checked={config.delimiters.other}
                  onCheckedChange={(checked) => updateDelimiter("other", !!checked)}
                />
                <Label htmlFor="other" className="cursor-pointer">Other:</Label>
                <Input
                  value={config.delimiters.otherChar}
                  onChange={(e) => updateDelimiter("otherChar", e.target.value.slice(0, 1))}
                  className="w-12 h-8"
                  maxLength={1}
                  disabled={!config.delimiters.other}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="consecutive"
                checked={config.treatConsecutiveAsOne}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, treatConsecutiveAsOne: !!checked }))}
              />
              <Label htmlFor="consecutive" className="cursor-pointer">
                Treat consecutive delimiters as one
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Text qualifier</Label>
              <Select
                value={config.textQualifier}
                onValueChange={(v) => setConfig(prev => ({ ...prev, textQualifier: v }))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='"'>"</SelectItem>
                  <SelectItem value="'">'</SelectItem>
                  <SelectItem value="">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preview of selected data:</Label>
        <PreviewTable data={previewData} config={config} maxRows={8} showColumns />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          This screen lets you select each column and set the Data Format.
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <Label className="font-medium">Column data format</Label>
            <RadioGroup
              value={selectedColumn !== null ? (config.columns[selectedColumn]?.dataType || "general") : "general"}
              onValueChange={(v) => {
                if (selectedColumn !== null) {
                  updateColumnConfig(selectedColumn, { dataType: v as ColumnConfig["dataType"] });
                }
              }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="general" id="general" />
                <Label htmlFor="general" className="cursor-pointer">General</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text" className="cursor-pointer">Text</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date" id="date" />
                <Label htmlFor="date" className="cursor-pointer">Date:</Label>
                <Select
                  value={selectedColumn !== null ? (config.columns[selectedColumn]?.dateFormat || "YMD") : "YMD"}
                  onValueChange={(v) => {
                    if (selectedColumn !== null) {
                      updateColumnConfig(selectedColumn, { dateFormat: v });
                    }
                  }}
                  disabled={selectedColumn === null || config.columns[selectedColumn]?.dataType !== "date"}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YMD">YMD</SelectItem>
                    <SelectItem value="DMY">DMY</SelectItem>
                    <SelectItem value="MDY">MDY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="skip" id="skip" />
                <Label htmlFor="skip" className="cursor-pointer">Do not import column (skip)</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            {selectedColumn !== null && config.columns[selectedColumn] && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Selected:</span>{" "}
                    <span className="font-medium">{config.columns[selectedColumn].name}</span>
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {config.columns[selectedColumn].dataType}
                  </Badge>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Preview with column selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preview of selected data:</Label>
        <p className="text-xs text-muted-foreground">Click a column to select it for formatting</p>
        <PreviewTable 
          data={previewData} 
          config={config} 
          maxRows={8} 
          showColumns 
          showDataTypes
          selectedColumn={selectedColumn}
          onColumnSelect={setSelectedColumn}
        />
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Text Import Wizard - Step {step} of 3
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            
            {step < 3 ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Finish"}
                <Check className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Preview Table Component
interface PreviewTableProps {
  data: ParsedData | null;
  config: WizardParseConfig;
  maxRows?: number;
  showColumns?: boolean;
  showDataTypes?: boolean;
  selectedColumn?: number | null;
  onColumnSelect?: (index: number) => void;
}

function PreviewTable({ 
  data, 
  config, 
  maxRows = 10, 
  showColumns = false,
  showDataTypes = false,
  selectedColumn,
  onColumnSelect 
}: PreviewTableProps) {
  if (!data) {
    return (
      <div className="border rounded-lg p-4 bg-muted/30 text-center text-muted-foreground">
        No preview available
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ScrollArea className="h-[250px]">
        <div className="min-w-max">
          <table className="w-full text-xs font-mono">
            {showDataTypes && (
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {data.headers.map((_, idx) => {
                    const colConfig = config.columns[idx];
                    return (
                      <th 
                        key={`type-${idx}`} 
                        className={cn(
                          "px-2 py-1 text-left font-normal text-muted-foreground border-r last:border-r-0",
                          selectedColumn === idx && "bg-primary/20"
                        )}
                      >
                        {colConfig?.dataType || "General"}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <thead className="bg-muted sticky top-0">
              <tr>
                {data.headers.map((header, idx) => (
                  <th 
                    key={idx} 
                    className={cn(
                      "px-2 py-1.5 text-left font-medium border-r last:border-r-0 whitespace-nowrap",
                      onColumnSelect && "cursor-pointer hover:bg-primary/10",
                      selectedColumn === idx && "bg-primary/20 text-primary"
                    )}
                    onClick={() => onColumnSelect?.(idx)}
                  >
                    {showColumns && (
                      <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                    )}
                    {header || `Col ${idx + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, maxRows).map((row, rowIdx) => (
                <tr key={rowIdx} className="border-t hover:bg-muted/30">
                  {row.map((cell, cellIdx) => (
                    <td 
                      key={cellIdx} 
                      className={cn(
                        "px-2 py-1 border-r last:border-r-0 whitespace-nowrap",
                        selectedColumn === cellIdx && "bg-primary/10"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
      {data.rows.length > maxRows && (
        <div className="px-2 py-1 text-xs text-muted-foreground border-t bg-muted/30">
          Showing {maxRows} of {data.rows.length} rows
        </div>
      )}
    </Card>
  );
}
