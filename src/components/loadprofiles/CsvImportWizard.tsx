import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { ChevronLeft, ChevronRight, Zap, TrendingUp, Activity, Clock, BarChart3 } from "lucide-react";
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

  const firstLine = lines[0];
  const meterMatch = firstLine.match(/^,?"([^"]+)"?,(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/);
  
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

  const tabCount = (sampleLine.match(/\t/g) || []).length;
  const semicolonCount = (sampleLine.match(/;/g) || []).length;
  const commaCount = (sampleLine.match(/,/g) || []).length;

  if (tabCount > 0) delimiters.tab = true;
  if (semicolonCount > 0) delimiters.semicolon = true;
  if (commaCount > 0) delimiters.comma = true;

  if (!delimiters.tab && !delimiters.semicolon && !delimiters.comma) {
    delimiters.comma = true;
  }

  return delimiters;
}

// Parse CSV with given configuration
function parseWithConfig(content: string, config: WizardParseConfig): ParsedData {
  const lines = content.split('\n').filter(l => l.trim());
  
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

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    const qualifier = config.textQualifier === "none" ? "" : config.textQualifier;

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

// Get raw lines for preview (before parsing)
function getRawLines(content: string, startRow: number, maxLines: number = 10): string[] {
  const lines = content.split('\n').filter(l => l.trim());
  return lines.slice(startRow - 1, startRow - 1 + maxLines);
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
  // Step 4: Column selection for load profile
  const [selectedValueColumn, setSelectedValueColumn] = useState<number | null>(null);
  const [selectedDateColumn, setSelectedDateColumn] = useState<number | null>(null);
  const [selectedTimeColumn, setSelectedTimeColumn] = useState<number | null>(null);
  const [selectedValueUnit, setSelectedValueUnit] = useState<"kW" | "kWh" | "auto">("auto");

  // Auto-detect format on open
  useEffect(() => {
    if (isOpen && csvContent) {
      const detection = detectPnPScadaFormat(csvContent);
      
      if (detection.isPnPScada) {
        setConfig({
          ...DEFAULT_CONFIG,
          startRow: 2,
          delimiters: { ...DEFAULT_CONFIG.delimiters, comma: true },
          detectedFormat: "pnp-scada",
          meterName: detection.meterName,
          dateRange: detection.dateRange,
        });
      } else {
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

  // Raw lines for step 1 preview
  const rawLines = useMemo(() => {
    if (!csvContent) return [];
    return getRawLines(csvContent, config.startRow, 8);
  }, [csvContent, config.startRow]);

  // Initialize column configs when headers change
  useEffect(() => {
    if (previewData?.headers) {
      const newColumns: ColumnConfig[] = previewData.headers.map((name, index) => {
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
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = () => {
    if (previewData) {
      // Include selected columns in the config
      const finalConfig: WizardParseConfig = {
        ...config,
        valueColumnIndex: selectedValueColumn ?? undefined,
        dateColumnIndex: selectedDateColumn ?? undefined,
        timeColumnIndex: selectedTimeColumn ?? undefined,
        valueUnit: selectedValueUnit,
      };
      onProcess(finalConfig, previewData);
    }
  };

  // Auto-detect columns for step 4
  const autoDetectedColumns = useMemo(() => {
    if (!previewData) return { date: -1, time: -1, value: -1, detectedUnit: "auto" as "kW" | "kWh" | "auto" };
    
    const lowerHeaders = previewData.headers.map(h => h.toLowerCase().trim());
    
    // Find date column
    let dateIdx = lowerHeaders.findIndex(h => h.includes("rdate") || h.includes("date") || h.includes("timestamp"));
    
    // Find time column
    let timeIdx = lowerHeaders.findIndex(h => h.includes("rtime") || (h.includes("time") && !h.includes("timestamp")));
    
    // Find value column - look for numeric columns that aren't date/time
    let valueIdx = -1;
    let detectedUnit: "kW" | "kWh" | "auto" = "auto";
    
    // First check for kWh patterns (energy)
    const kwhPatterns = ["kwh", "energy", "consumption", "usage"];
    for (const pattern of kwhPatterns) {
      const idx = lowerHeaders.findIndex(h => h.includes(pattern));
      if (idx !== -1) {
        valueIdx = idx;
        detectedUnit = "kWh";
        break;
      }
    }
    
    // Then check for kW patterns (power)
    if (valueIdx === -1) {
      const kwPatterns = ["kw", "power", "load", "demand"];
      for (const pattern of kwPatterns) {
        const idx = lowerHeaders.findIndex(h => h.includes(pattern) && !h.includes("kwh"));
        if (idx !== -1) {
          valueIdx = idx;
          detectedUnit = "kW";
          break;
        }
      }
    }
    
    // Generic patterns
    if (valueIdx === -1) {
      const genericPatterns = ["reading", "value", "amount"];
      for (const pattern of genericPatterns) {
        const idx = lowerHeaders.findIndex(h => h.includes(pattern));
        if (idx !== -1) {
          valueIdx = idx;
          break;
        }
      }
    }
    
    // If no match, find first numeric column that's not date/time
    if (valueIdx === -1 && previewData.rows.length > 0) {
      for (let i = 0; i < previewData.headers.length; i++) {
        if (i === dateIdx || i === timeIdx) continue;
        const sampleVal = previewData.rows[0]?.[i];
        if (sampleVal && !isNaN(parseFloat(sampleVal.replace(/[^\d.-]/g, "")))) {
          valueIdx = i;
          break;
        }
      }
    }
    
    return { date: dateIdx, time: timeIdx, value: valueIdx, detectedUnit };
  }, [previewData]);

  // Detect unit from column header
  const detectUnitFromHeader = useCallback((header: string): "kW" | "kWh" | "auto" => {
    const lower = header.toLowerCase();
    if (lower.includes("kwh") || lower.includes("energy") || lower.includes("consumption") || lower.includes("usage")) {
      return "kWh";
    }
    if (lower.includes("kw") || lower.includes("power") || lower.includes("load") || lower.includes("demand")) {
      return "kW";
    }
    return "auto";
  }, []);

  // Auto-detect unit when value column changes
  useEffect(() => {
    if (selectedValueColumn !== null && previewData) {
      const header = previewData.headers[selectedValueColumn] || "";
      const detected = detectUnitFromHeader(header);
      if (detected !== "auto") {
        setSelectedValueUnit(detected);
      }
    }
  }, [selectedValueColumn, previewData, detectUnitFromHeader]);

  // Initialize column selections when entering step 4
  useEffect(() => {
    if (step === 4) {
      if (selectedDateColumn === null && autoDetectedColumns.date !== -1) {
        setSelectedDateColumn(autoDetectedColumns.date);
      }
      if (selectedTimeColumn === null && autoDetectedColumns.time !== -1) {
        setSelectedTimeColumn(autoDetectedColumns.time);
      }
      if (selectedValueColumn === null && autoDetectedColumns.value !== -1) {
        setSelectedValueColumn(autoDetectedColumns.value);
      }
    }
  }, [step, autoDetectedColumns, selectedDateColumn, selectedTimeColumn, selectedValueColumn]);

  // Analyze columns for step 4 display
  const columnAnalysis = useMemo(() => {
    if (!previewData) return [];
    
    return previewData.headers.map((header, idx) => {
      const values = previewData.rows.slice(0, 10).map(row => row[idx]).filter(Boolean);
      const numericValues = values.map(v => parseFloat(v?.replace(/[^\d.-]/g, "") || "")).filter(v => !isNaN(v));
      const isNumeric = numericValues.length >= values.length * 0.5;
      const avg = isNumeric && numericValues.length > 0 
        ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length 
        : 0;
      const nonZero = numericValues.filter(v => v !== 0).length;
      
      return {
        index: idx,
        header,
        isNumeric,
        sampleValues: values.slice(0, 3),
        avg: Math.round(avg * 100) / 100,
        nonZeroCount: nonZero,
      };
    });
  }, [previewData]);

  // Calculate load profile preview based on selected column
  const loadProfilePreview = useMemo(() => {
    if (!previewData || selectedValueColumn === null) {
      return null;
    }

    // Extract all numeric values from the selected column
    const allValues = previewData.rows
      .map(row => {
        const val = row[selectedValueColumn];
        if (!val) return NaN;
        return parseFloat(val.replace(/[^\d.-]/g, ""));
      })
      .filter(v => !isNaN(v));

    if (allValues.length === 0) return null;

    // Calculate statistics
    const peak = Math.max(...allValues);
    const min = Math.min(...allValues);
    const sum = allValues.reduce((a, b) => a + b, 0);
    const avg = sum / allValues.length;
    
    // Get unique dates if date column is selected
    let uniqueDays = 0;
    if (selectedDateColumn !== null) {
      const dates = new Set(
        previewData.rows
          .map(row => row[selectedDateColumn])
          .filter(Boolean)
      );
      uniqueDays = dates.size;
    }

    // Estimate readings per day based on data count and unique days
    const readingsPerDay = uniqueDays > 0 ? allValues.length / uniqueDays : 48; // Default: 30-min intervals
    const estimatedDays = uniqueDays > 0 ? uniqueDays : allValues.length / 48;
    
    // Calculate daily energy based on unit type
    let dailyKwh: number;
    let peakKw: number;
    let avgKw: number;
    
    if (selectedValueUnit === "kWh") {
      // Values are already energy readings
      dailyKwh = uniqueDays > 0 ? sum / uniqueDays : sum / estimatedDays;
      // For kWh readings, peak power is estimated from interval energy
      // Assume 30-min intervals, so kW = kWh * 2
      const intervalHours = 24 / readingsPerDay;
      peakKw = peak / intervalHours; // Convert energy to power
      avgKw = avg / intervalHours;
    } else if (selectedValueUnit === "kW") {
      // Values are power readings - need to integrate for energy
      const hoursPerReading = 24 / readingsPerDay;
      const dailyEnergyFromPower = sum * hoursPerReading / estimatedDays;
      dailyKwh = uniqueDays > 0 ? dailyEnergyFromPower : sum * hoursPerReading / estimatedDays;
      peakKw = peak;
      avgKw = avg;
    } else {
      // Auto mode - assume values are what they claim (likely kWh interval readings)
      dailyKwh = uniqueDays > 0 ? sum / uniqueDays : sum / estimatedDays;
      peakKw = peak;
      avgKw = avg;
    }
    
    // Calculate load factor (average / peak)
    const loadFactor = peakKw > 0 ? (avgKw / peakKw) * 100 : 0;

    return {
      peak: Math.round(peakKw * 100) / 100,
      min: Math.round(min * 100) / 100,
      avg: Math.round(avgKw * 100) / 100,
      dailyKwh: Math.round(dailyKwh * 100) / 100,
      totalKwh: Math.round(sum * 100) / 100,
      loadFactor: Math.round(loadFactor),
      dataPoints: allValues.length,
      estimatedDays: uniqueDays > 0 ? uniqueDays : Math.round(estimatedDays * 10) / 10,
      hasDateColumn: selectedDateColumn !== null && uniqueDays > 0,
      readingsPerDay: Math.round(readingsPerDay * 10) / 10,
      unit: selectedValueUnit,
    };
  }, [previewData, selectedValueColumn, selectedDateColumn, selectedValueUnit]);

  // Step 1: File Type & Start Row
  const renderStep1 = () => (
    <div className="space-y-6">
      {config.detectedFormat === "pnp-scada" && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-primary text-sm">PnP SCADA Format Detected</p>
                <p className="text-xs text-muted-foreground">
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

      <div>
        <h3 className="font-semibold text-foreground mb-1">
          The Text Wizard has determined that your data is {config.fileType === "delimited" ? "Delimited" : "Fixed Width"}.
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          If this is correct, choose Next, or choose the data type that best describes your data.
        </p>

        <RadioGroup
          value={config.fileType}
          onValueChange={(v) => setConfig(prev => ({ ...prev, fileType: v as "delimited" | "fixed" }))}
          className="space-y-2"
        >
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="delimited" id="delimited" />
            <Label htmlFor="delimited" className="cursor-pointer">
              <span className="font-medium">Delimited</span>
              <span className="text-muted-foreground ml-2">– Characters such as commas or tabs separate each field.</span>
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="fixed" id="fixed" />
            <Label htmlFor="fixed" className="cursor-pointer">
              <span className="font-medium">Fixed width</span>
              <span className="text-muted-foreground ml-2">– Fields are aligned in columns with spaces between each field.</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="startRow">Start import at row:</Label>
          <Input
            id="startRow"
            type="number"
            min={1}
            value={config.startRow}
            onChange={(e) => setConfig(prev => ({ ...prev, startRow: parseInt(e.target.value) || 1 }))}
            className="w-16 h-8"
          />
        </div>
      </div>

      {/* Raw Preview */}
      <div className="space-y-2">
        <Label className="font-medium">Preview of selected data:</Label>
        <Card className="bg-muted/30">
          <CardContent className="p-0">
            <div className="bg-muted px-3 py-1.5 border-b">
              <span className="text-xs font-medium text-muted-foreground">Preview of file {fileName}</span>
            </div>
            <ScrollArea className="h-[180px]">
              <div className="p-3 font-mono text-xs">
                {rawLines.map((line, idx) => (
                  <div key={idx} className="flex">
                    <span className="text-muted-foreground w-6 flex-shrink-0">{config.startRow + idx}</span>
                    <span className="break-all">{line}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Step 2: Delimiter Configuration
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground mb-4">
          This screen lets you set the delimiters your data contains.
        </h3>

        <div className="flex gap-12">
          <div className="space-y-3">
            <Label className="font-medium text-sm">Delimiters</Label>
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
                <Label htmlFor={key} className="cursor-pointer text-sm">{label}</Label>
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="other"
                checked={config.delimiters.other}
                onCheckedChange={(checked) => updateDelimiter("other", !!checked)}
              />
              <Label htmlFor="other" className="cursor-pointer text-sm">Other:</Label>
              <Input
                value={config.delimiters.otherChar}
                onChange={(e) => updateDelimiter("otherChar", e.target.value.slice(0, 1))}
                className="w-10 h-7 text-center"
                maxLength={1}
                disabled={!config.delimiters.other}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="consecutive"
                checked={config.treatConsecutiveAsOne}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, treatConsecutiveAsOne: !!checked }))}
              />
              <Label htmlFor="consecutive" className="cursor-pointer text-sm">
                Treat consecutive delimiters as one
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-sm">Text qualifier:</Label>
              <Select
                value={config.textQualifier}
                onValueChange={(v) => setConfig(prev => ({ ...prev, textQualifier: v }))}
              >
                <SelectTrigger className="w-16 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='"'>"</SelectItem>
                  <SelectItem value="'">'</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Parsed Preview */}
      <div className="space-y-2">
        <Label className="font-medium">Preview of selected data:</Label>
        <ParsedPreviewTable data={previewData} maxRows={6} />
      </div>
    </div>
  );

  // Step 3: Column Format Configuration
  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground mb-4">
          This screen lets you select each column and set the Data Format.
        </h3>

        <div className="flex gap-8">
          <div className="space-y-3">
            <Label className="font-medium text-sm">Column data format</Label>
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
                <Label htmlFor="general" className="cursor-pointer text-sm">General</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text" className="cursor-pointer text-sm">Text</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date" id="date" />
                <Label htmlFor="date" className="cursor-pointer text-sm">Date:</Label>
                <Select
                  value={selectedColumn !== null ? (config.columns[selectedColumn]?.dateFormat || "YMD") : "YMD"}
                  onValueChange={(v) => {
                    if (selectedColumn !== null) {
                      updateColumnConfig(selectedColumn, { dateFormat: v });
                    }
                  }}
                  disabled={selectedColumn === null || config.columns[selectedColumn]?.dataType !== "date"}
                >
                  <SelectTrigger className="w-16 h-7">
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
                <Label htmlFor="skip" className="cursor-pointer text-sm">Do not import column (skip)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>

      {/* Preview with selectable columns */}
      <div className="space-y-2">
        <Label className="font-medium">Preview of selected data:</Label>
        <ColumnSelectPreview 
          data={previewData} 
          config={config}
          selectedColumn={selectedColumn}
          onColumnSelect={setSelectedColumn}
          maxRows={6}
        />
      </div>
    </div>
  );

  // Step 4: Load Profile Column Selection
  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground mb-2">
          Select the columns to use for load profile extraction
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which column contains the energy/power values for the load profile. This is critical for accurate profile generation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Column */}
          <div className="space-y-2">
            <Label className="font-medium text-sm">Date/Timestamp Column</Label>
            <Select
              value={selectedDateColumn?.toString() ?? "auto"}
              onValueChange={(v) => setSelectedDateColumn(v === "auto" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                {columnAnalysis.map(col => (
                  <SelectItem key={col.index} value={col.index.toString()}>
                    {col.header || `Column ${col.index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDateColumn !== null && (
              <p className="text-xs text-muted-foreground">
                Sample: {columnAnalysis[selectedDateColumn]?.sampleValues[0] || "N/A"}
              </p>
            )}
          </div>

          {/* Time Column (optional) */}
          <div className="space-y-2">
            <Label className="font-medium text-sm">Time Column (optional)</Label>
            <Select
              value={selectedTimeColumn?.toString() ?? "none"}
              onValueChange={(v) => setSelectedTimeColumn(v === "none" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (included in date)</SelectItem>
                {columnAnalysis.map(col => (
                  <SelectItem key={col.index} value={col.index.toString()}>
                    {col.header || `Column ${col.index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTimeColumn !== null && (
              <p className="text-xs text-muted-foreground">
                Sample: {columnAnalysis[selectedTimeColumn]?.sampleValues[0] || "N/A"}
              </p>
            )}
          </div>

          {/* Value Column */}
          <div className="space-y-2">
            <Label className="font-medium text-sm flex items-center gap-2">
              Value Column (kW/kWh)
              <Badge variant="destructive" className="text-[10px]">Required</Badge>
            </Label>
            <Select
              value={selectedValueColumn?.toString() ?? "auto"}
              onValueChange={(v) => setSelectedValueColumn(v === "auto" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                {columnAnalysis.filter(col => col.isNumeric).map(col => (
                  <SelectItem key={col.index} value={col.index.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{col.header || `Column ${col.index + 1}`}</span>
                      <span className="text-muted-foreground text-xs">
                        (avg: {col.avg})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedValueColumn !== null && (
              <p className="text-xs text-muted-foreground">
                Sample: {columnAnalysis[selectedValueColumn]?.sampleValues.join(", ") || "N/A"}
              </p>
            )}
          </div>
        </div>

        {/* Unit Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-medium text-sm flex items-center gap-2">
              Value Unit Type
              {selectedValueUnit !== "auto" && (
                <Badge variant="secondary" className="text-[10px]">
                  {selectedValueUnit === "kW" ? "Power" : "Energy"}
                </Badge>
              )}
            </Label>
            <Select
              value={selectedValueUnit}
              onValueChange={(v) => setSelectedValueUnit(v as "kW" | "kWh" | "auto")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex flex-col">
                    <span>Auto-detect</span>
                    <span className="text-xs text-muted-foreground">Detect from column header</span>
                  </div>
                </SelectItem>
                <SelectItem value="kWh">
                  <div className="flex flex-col">
                    <span>kWh (Energy)</span>
                    <span className="text-xs text-muted-foreground">Interval energy readings - will be summed</span>
                  </div>
                </SelectItem>
                <SelectItem value="kW">
                  <div className="flex flex-col">
                    <span>kW (Power)</span>
                    <span className="text-xs text-muted-foreground">Instantaneous power - will be averaged</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Unit explanation */}
          <Card className="bg-muted/30 p-3">
            <div className="text-xs space-y-1">
              <p className="font-medium">
                {selectedValueUnit === "kWh" && "📊 Energy readings (kWh)"}
                {selectedValueUnit === "kW" && "⚡ Power readings (kW)"}
                {selectedValueUnit === "auto" && "🔍 Auto-detecting unit type..."}
              </p>
              <p className="text-muted-foreground">
                {selectedValueUnit === "kWh" && "Each value represents energy consumed during an interval. Values will be summed for daily totals."}
                {selectedValueUnit === "kW" && "Each value represents instantaneous power. Values will be averaged for load profile, integrated for energy."}
                {selectedValueUnit === "auto" && "The system will detect the unit from the column header name (kwh, energy, power, etc.)."}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Numeric Columns Analysis */}
      <div className="space-y-2">
        <Label className="font-medium">Available Numeric Columns:</Label>
        <Card className="overflow-hidden">
          <ScrollArea className="h-[180px]">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Column</th>
                  <th className="px-3 py-2 text-left font-medium">Sample Values</th>
                  <th className="px-3 py-2 text-right font-medium">Avg Value</th>
                  <th className="px-3 py-2 text-center font-medium">Selected</th>
                </tr>
              </thead>
              <tbody>
                {columnAnalysis.filter(col => col.isNumeric).map(col => (
                  <tr 
                    key={col.index} 
                    className={cn(
                      "border-t cursor-pointer hover:bg-muted/50",
                      selectedValueColumn === col.index && "bg-primary/10"
                    )}
                    onClick={() => setSelectedValueColumn(col.index)}
                  >
                    <td className="px-3 py-2 font-medium">{col.header || `Column ${col.index + 1}`}</td>
                    <td className="px-3 py-2 text-muted-foreground">{col.sampleValues.join(", ")}</td>
                    <td className="px-3 py-2 text-right">{col.avg}</td>
                    <td className="px-3 py-2 text-center">
                      {selectedValueColumn === col.index && (
                        <Badge variant="default" className="text-[10px]">Selected</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </Card>
      </div>

      {/* Load Profile Preview */}
      {loadProfilePreview ? (
        <div className="space-y-2">
          <Label className="font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Load Profile Preview
          </Label>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Peak kW */}
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-3 w-3" />
                    Peak
                  </div>
                  <div className="text-2xl font-bold text-primary">{loadProfilePreview.peak}</div>
                  <div className="text-xs text-muted-foreground">kW</div>
                </div>
                
                {/* Average kW */}
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Activity className="h-3 w-3" />
                    Average
                  </div>
                  <div className="text-2xl font-bold">{loadProfilePreview.avg}</div>
                  <div className="text-xs text-muted-foreground">kW</div>
                </div>
                
                {/* Daily kWh */}
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Zap className="h-3 w-3" />
                    Daily Usage
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{loadProfilePreview.dailyKwh.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">kWh/day</div>
                </div>
                
                {/* Load Factor */}
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Clock className="h-3 w-3" />
                    Load Factor
                  </div>
                  <div className="text-2xl font-bold">{loadProfilePreview.loadFactor}%</div>
                  <div className="text-xs text-muted-foreground">avg/peak</div>
                </div>
              </div>
              
              {/* Additional stats */}
              <div className="mt-4 pt-3 border-t border-primary/20 grid grid-cols-3 gap-4 text-xs text-center">
                <div>
                  <span className="text-muted-foreground">Data Points:</span>{" "}
                  <span className="font-medium">{loadProfilePreview.dataPoints.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Days:</span>{" "}
                  <span className="font-medium">
                    {loadProfilePreview.hasDateColumn ? loadProfilePreview.estimatedDays : `~${loadProfilePreview.estimatedDays}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <span className="font-medium">{loadProfilePreview.totalKwh.toLocaleString()} kWh</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="font-medium">Preview with selected columns:</Label>
          <Card className="bg-muted/30 p-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                <span className="font-medium">
                  {selectedDateColumn !== null 
                    ? previewData?.headers[selectedDateColumn] || `Col ${selectedDateColumn + 1}`
                    : "Auto-detect"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>{" "}
                <span className="font-medium">
                  {selectedTimeColumn !== null 
                    ? previewData?.headers[selectedTimeColumn] || `Col ${selectedTimeColumn + 1}`
                    : "Included in date"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Value:</span>{" "}
                <span className="font-medium text-muted-foreground">
                  Select a value column above
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">
            Text Import Wizard - Step {step} of 4
          </DialogTitle>
          <DialogDescription>
            Configure how your CSV data should be parsed and imported.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-2">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Finish"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple parsed preview table for Step 2
function ParsedPreviewTable({ data, maxRows = 8 }: { data: ParsedData | null; maxRows?: number }) {
  if (!data) {
    return (
      <Card className="bg-muted/30 p-4 text-center text-muted-foreground text-sm">
        No preview available
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ScrollArea className="h-[200px]">
        <table className="w-full text-xs font-mono border-collapse">
          <thead className="bg-muted sticky top-0">
            <tr>
              {data.headers.map((header, idx) => (
                <th 
                  key={idx} 
                  className="px-3 py-2 text-left font-medium border-r border-border last:border-r-0 whitespace-nowrap"
                >
                  {header || `Column ${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, maxRows).map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-border">
                {row.map((cell, cellIdx) => (
                  <td 
                    key={cellIdx} 
                    className="px-3 py-1.5 border-r border-border last:border-r-0 whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {data.rows.length > maxRows && (
        <div className="px-3 py-1 text-xs text-muted-foreground border-t bg-muted/30">
          Showing {maxRows} of {data.rows.length} rows
        </div>
      )}
    </Card>
  );
}

// Column selection preview for Step 3 (Excel-style)
function ColumnSelectPreview({ 
  data, 
  config,
  selectedColumn,
  onColumnSelect,
  maxRows = 8 
}: { 
  data: ParsedData | null; 
  config: WizardParseConfig;
  selectedColumn: number | null;
  onColumnSelect: (idx: number) => void;
  maxRows?: number;
}) {
  if (!data) {
    return (
      <Card className="bg-muted/30 p-4 text-center text-muted-foreground text-sm">
        No preview available
      </Card>
    );
  }

  const getDataTypeLabel = (idx: number): string => {
    const col = config.columns[idx];
    if (!col) return "General";
    switch (col.dataType) {
      case "general": return "General";
      case "text": return "Text";
      case "date": return "Date";
      case "skip": return "Skip";
      default: return "General";
    }
  };

  return (
    <Card className="overflow-hidden">
      <ScrollArea className="h-[220px]">
        <table className="w-full text-xs font-mono border-collapse">
          {/* Data type row */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80">
              {data.headers.map((_, idx) => (
                <th 
                  key={`type-${idx}`} 
                  onClick={() => onColumnSelect(idx)}
                  className={cn(
                    "px-3 py-1 text-left font-normal text-muted-foreground border-r border-border last:border-r-0 cursor-pointer text-[10px]",
                    selectedColumn === idx && "bg-foreground text-background"
                  )}
                >
                  {getDataTypeLabel(idx)}
                </th>
              ))}
            </tr>
            {/* Header row */}
            <tr className="bg-muted">
              {data.headers.map((header, idx) => (
                <th 
                  key={idx}
                  onClick={() => onColumnSelect(idx)}
                  className={cn(
                    "px-3 py-2 text-left font-medium border-r border-border last:border-r-0 whitespace-nowrap cursor-pointer",
                    selectedColumn === idx && "bg-foreground text-background"
                  )}
                >
                  {header || `Column ${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, maxRows).map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-border">
                {row.map((cell, cellIdx) => (
                  <td 
                    key={cellIdx}
                    onClick={() => onColumnSelect(cellIdx)}
                    className={cn(
                      "px-3 py-1.5 border-r border-border last:border-r-0 whitespace-nowrap cursor-pointer",
                      selectedColumn === cellIdx && "bg-foreground/10"
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {data.rows.length > maxRows && (
        <div className="px-3 py-1 text-xs text-muted-foreground border-t bg-muted/30">
          Showing {maxRows} of {data.rows.length} rows
        </div>
      )}
    </Card>
  );
}
