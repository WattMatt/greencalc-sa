import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload, Loader2, Check, FileUp, Calendar, Zap, Settings2, 
  AlertTriangle, Info, Layers, TrendingUp, MinusCircle
} from "lucide-react";
import { toast } from "sonner";
import { CsvImportWizard, WizardParseConfig } from "./CsvImportWizard";
import { processCSVToLoadProfile, ProcessedLoadProfile } from "./utils/csvToLoadProfile";
import { MeterAnalysisChart, MeterChartDataPoint } from "./MeterAnalysisChart";

interface Category {
  id: string;
  name: string;
}

interface FormatDetection {
  format: "pnp-scada" | "standard" | "multi-meter" | "cumulative" | "unknown";
  delimiter: string;
  headerRow: number;
  hasNegatives: boolean;
  isCumulative: boolean;
  meterIds?: string[];
  confidence: number;
  columns?: {
    dateCol: number;
    timeCol: number;
    valueCol: number;
    meterIdCol: number;
  };
  headers?: string[];
  sampleRows?: string[][];
}

interface ProcessedData {
  dataPoints: number;
  dateRange: { start: string; end: string };
  weekdayDays: number;
  weekendDays: number;
  rawData: any[];
  weekdayProfile: number[];
  weekendProfile: number[];
  hourlyProfile?: MeterChartDataPoint[];
  stats?: {
    totalRows: number;
    processedRows: number;
    skippedRows: number;
    negativeValues: number;
    parseErrors: string[];
  };
  meterData?: Record<string, { weekdayProfile: number[]; weekendProfile: number[]; dataPoints: number }>;
}

interface ScadaImportProps {
  categories: Category[];
  siteId?: string | null;
  onImportComplete?: () => void;
}

export function ScadaImport({ categories, siteId, onImportComplete }: ScadaImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Format detection state
  const [formatDetection, setFormatDetection] = useState<FormatDetection | null>(null);
  
  // Processing options
  const [handleNegatives, setHandleNegatives] = useState<"filter" | "absolute" | "keep">("filter");
  const [handleCumulative, setHandleCumulative] = useState(false);

  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form fields for the SCADA import
  const [siteName, setSiteName] = useState("");
  const [shopNumber, setShopNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [area, setArea] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Quick format detection on file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setProcessedData(null);
    setFormatDetection(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setRowCount(content.split('\n').filter(l => l.trim()).length);

      // Auto-set site name from file name
      if (!siteName) {
        const suggestedName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setSiteName(suggestedName);
      }

      // Step 1: Quick format detection (instant preview)
      setIsDetecting(true);
      try {
        const { data, error } = await supabase.functions.invoke("process-scada-profile", {
          body: {
            csvContent: content,
            action: "detect",
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        setFormatDetection(data);
        
        // Auto-enable cumulative handling if detected
        if (data.isCumulative) {
          setHandleCumulative(true);
        }

        toast.success(`Format detected: ${data.format}`, {
          description: `Confidence: ${Math.round(data.confidence * 100)}%${data.meterIds?.length > 1 ? ` • ${data.meterIds.length} meters found` : ''}`
        });

      } catch (error) {
        console.error("Format detection failed:", error);
        toast.info("Could not auto-detect format. Click 'Configure' for manual setup.");
      } finally {
        setIsDetecting(false);
      }
    };
    reader.readAsText(file);

    e.target.value = "";
  }, [siteName]);

  // Full processing with detected settings
  const handleProcess = useCallback(async () => {
    if (!csvContent || !formatDetection) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-scada-profile", {
        body: {
          csvContent,
          action: "process",
          autoDetect: true,
          handleNegatives,
          handleCumulative,
          headerRowNumber: formatDetection.headerRow,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      if (data.dataPoints > 0) {
        // Transform for chart display
        const chartData: MeterChartDataPoint[] = [];
        for (let i = 0; i < 24; i++) {
          chartData.push({
            period: `${i}:00`,
            amount: data.weekdayProfile[i],
            meterReading: data.weekendProfile[i],
          });
        }

        setProcessedData({
          dataPoints: data.dataPoints,
          dateRange: data.dateRange,
          weekdayDays: data.weekdayDays,
          weekendDays: data.weekendDays,
          rawData: data.rawData,
          weekdayProfile: data.weekdayProfile,
          weekendProfile: data.weekendProfile,
          hourlyProfile: chartData,
          stats: data.stats,
          meterData: data.meterData,
        });

        const statsMsg = data.stats?.skippedRows > 0 
          ? ` (${data.stats.skippedRows} rows skipped)`
          : '';
        toast.success(`Processed ${data.dataPoints.toLocaleString()} readings${statsMsg}`);
      } else {
        toast.warning("No data points found. Try manual configuration.");
        setDialogOpen(true);
      }
    } catch (error) {
      console.error("Processing failed:", error);
      toast.error("Processing failed. Try manual configuration.");
      setDialogOpen(true);
    } finally {
      setIsProcessing(false);
    }
  }, [csvContent, formatDetection, handleNegatives, handleCumulative]);

  const handleWizardProcess = useCallback((
    config: WizardParseConfig, 
    parsedData: { headers: string[]; rows: string[][]; meterName?: string; dateRange?: { start: string; end: string } }
  ) => {
    setIsProcessing(true);
    setDialogOpen(false);

    try {
      const profile = processCSVToLoadProfile(parsedData.headers, parsedData.rows, config);
      
      const chartData: MeterChartDataPoint[] = [];
      for (let i = 0; i < 24; i++) {
        chartData.push({
          period: `${i}:00`,
          amount: profile.weekdayProfile[i],
          meterReading: profile.weekendProfile[i],
        });
      }

      const headers = parsedData.headers.map(h => h.toLowerCase());
      const dateIdx = headers.findIndex(h => h.includes('date') || h === 'rdate');
      const timeIdx = headers.findIndex(h => h.includes('time') || h === 'rtime');
      const valueIdx = headers.findIndex(h => h.includes('kwh') || h.includes('value') || h.includes('active'));
      
      const rawData = parsedData.rows.map(row => ({
        timestamp: `${row[dateIdx] || ''} ${row[timeIdx] || ''}`.trim(),
        value: parseFloat(row[valueIdx]?.replace(/[^\d.-]/g, '') || '0') || 0
      })).filter(d => d.value !== 0 || d.timestamp);

      setProcessedData({
        dataPoints: profile.dataPoints,
        dateRange: { 
          start: profile.dateRangeStart || parsedData.dateRange?.start || '', 
          end: profile.dateRangeEnd || parsedData.dateRange?.end || '' 
        },
        weekdayDays: profile.weekdayDays,
        weekendDays: profile.weekendDays,
        rawData,
        weekdayProfile: profile.weekdayProfile,
        weekendProfile: profile.weekendProfile,
        hourlyProfile: chartData
      });

      if (parsedData.meterName && !siteName) {
        setSiteName(parsedData.meterName);
      }
      if (parsedData.meterName && !shopName) {
        setShopName(parsedData.meterName);
      }

      toast.success(`Processed ${profile.dataPoints.toLocaleString()} readings (Peak: ${profile.peakKw} kW)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV");
      setDialogOpen(true);
    } finally {
      setIsProcessing(false);
    }
  }, [siteName, shopName]);

  const handleSave = async () => {
    if (!siteName || !processedData?.rawData?.length) {
      toast.error("Please provide a site name and process the CSV first");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("scada_imports").insert([
        {
          site_name: siteName,
          site_id: siteId || null,
          shop_name: shopName || null,
          area_sqm: area ? parseFloat(area) : null,
          file_name: fileName,
          raw_data: processedData.rawData,
          data_points: processedData.dataPoints,
          date_range_start: processedData.dateRange.start,
          date_range_end: processedData.dateRange.end,
          weekday_days: processedData.weekdayDays,
          weekend_days: processedData.weekendDays,
          category_id: categoryId || null,
          load_profile_weekday: processedData.weekdayProfile,
          load_profile_weekend: processedData.weekendProfile,
        }
      ]);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });

      toast.success("Meter data imported successfully");
      onImportComplete?.();

      // Reset state
      setCsvContent(null);
      setFileName("");
      setProcessedData(null);
      setFormatDetection(null);
      setSiteName("");
      setShopNumber("");
      setShopName("");
      setCategoryId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save import");
    } finally {
      setIsSaving(false);
    }
  };

  const getFormatBadge = () => {
    if (!formatDetection) return null;
    
    const formatLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      "pnp-scada": { label: "PnP SCADA", variant: "default" },
      "standard": { label: "Standard CSV", variant: "secondary" },
      "multi-meter": { label: "Multi-Meter", variant: "outline" },
      "cumulative": { label: "Cumulative", variant: "outline" },
      "unknown": { label: "Unknown", variant: "destructive" },
    };
    
    const fmt = formatLabels[formatDetection.format] || formatLabels.unknown;
    return <Badge variant={fmt.variant}>{fmt.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Import SCADA / Meter Data
          </CardTitle>
          <CardDescription>
            Upload raw time-series meter data (CSV) to generate load profiles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: File Upload */}
          <div className="space-y-2">
            <Label>Upload SCADA CSV File</Label>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isDetecting ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Detecting format...</span>
                </div>
              ) : csvContent ? (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{fileName}</span>
                  <Badge variant="secondary">{rowCount.toLocaleString()} lines</Badge>
                  {getFormatBadge()}
                  <Button variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    setDialogOpen(true);
                  }}>
                    <Settings2 className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileUp className="h-8 w-8" />
                  <span>Click to upload or drag and drop</span>
                  <span className="text-xs">CSV files with timestamp and kWh columns</span>
                </div>
              )}
            </div>
          </div>

          {/* Format Detection Preview */}
          {formatDetection && !processedData && (
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Format Preview</span>
                  </div>
                  <Badge variant="outline">
                    {Math.round(formatDetection.confidence * 100)}% confidence
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Delimiter:</span>
                    <span className="ml-2 font-mono">
                      {formatDetection.delimiter === '\t' ? 'TAB' : formatDetection.delimiter === ',' ? 'comma' : formatDetection.delimiter}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Header Row:</span>
                    <span className="ml-2">{formatDetection.headerRow}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date Col:</span>
                    <span className="ml-2">{formatDetection.headers?.[formatDetection.columns?.dateCol || 0] || `Col ${(formatDetection.columns?.dateCol || 0) + 1}`}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Value Col:</span>
                    <span className="ml-2">{formatDetection.headers?.[formatDetection.columns?.valueCol || 1] || `Col ${(formatDetection.columns?.valueCol || 1) + 1}`}</span>
                  </div>
                </div>

                {/* Warnings and Options */}
                <div className="flex flex-wrap gap-4">
                  {formatDetection.hasNegatives && (
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">Negative values</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>File contains negative values (possibly export/generation)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Select value={handleNegatives} onValueChange={(v) => setHandleNegatives(v as any)}>
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="filter">Filter out</SelectItem>
                          <SelectItem value="absolute">Use absolute</SelectItem>
                          <SelectItem value="keep">Keep as-is</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(formatDetection.isCumulative || formatDetection.format === "cumulative") && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Cumulative readings</span>
                      <Switch checked={handleCumulative} onCheckedChange={setHandleCumulative} />
                      <span className="text-xs text-muted-foreground">Calculate delta</span>
                    </div>
                  )}

                  {formatDetection.meterIds && formatDetection.meterIds.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">{formatDetection.meterIds.length} meters detected</span>
                    </div>
                  )}
                </div>

                {/* Sample Data Preview */}
                {formatDetection.sampleRows && formatDetection.sampleRows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b">
                          {formatDetection.headers?.slice(0, 6).map((h, i) => (
                            <th key={i} className="p-1 text-left font-medium text-muted-foreground">
                              {h || `Col ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {formatDetection.sampleRows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-dashed">
                            {row.slice(0, 6).map((cell, j) => (
                              <td key={j} className="p-1 font-mono truncate max-w-32">
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Button onClick={handleProcess} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Process File
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Metadata fields */}
          {csvContent && processedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Site Name *</Label>
                  <Input
                    placeholder="e.g., Clearwater Mall"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shop Number</Label>
                  <Input
                    placeholder="e.g., G12"
                    value={shopNumber}
                    onChange={(e) => setShopNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input
                    placeholder="e.g., Woolworths"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Processing Stats */}
          {processedData?.stats && (processedData.stats.skippedRows > 0 || processedData.stats.negativeValues > 0) && (
            <div className="flex flex-wrap gap-2 text-sm">
              {processedData.stats.skippedRows > 0 && (
                <Badge variant="outline" className="text-yellow-600">
                  <MinusCircle className="h-3 w-3 mr-1" />
                  {processedData.stats.skippedRows} rows skipped
                </Badge>
              )}
              {processedData.stats.negativeValues > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {processedData.stats.negativeValues} negative values
                </Badge>
              )}
            </div>
          )}

          {/* Result Summary & Graph */}
          {processedData && (
            <div className="space-y-6 border-t pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Range</div>
                    <div className="font-medium text-sm flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {processedData.dateRange.start}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">to {processedData.dateRange.end}</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Readings</div>
                    <div className="font-medium text-lg">{processedData.dataPoints.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Weekdays</div>
                    <div className="font-medium text-lg">{processedData.weekdayDays}</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Weekend Days</div>
                    <div className="font-medium text-lg">{processedData.weekendDays}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Graph */}
              {processedData.hourlyProfile && (
                <div className="h-[300px] w-full border rounded-lg p-4">
                  <Label className="mb-2 block">Average Profile (Weekday vs Weekend)</Label>
                  <MeterAnalysisChart
                    data={processedData.hourlyProfile}
                    meterNumber={shopName || siteName}
                    metricLabel="Usage Profile (%)"
                    height={260}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving || !siteName} className="flex-1">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Meter Data
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => {
                  setProcessedData(null);
                  setCsvContent(null);
                  setFileName("");
                  setFormatDetection(null);
                }}>
                  Reset
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CsvImportWizard
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        csvContent={csvContent}
        fileName={fileName}
        onProcess={handleWizardProcess}
        isProcessing={isProcessing}
      />
    </div>
  );
}