import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, Loader2, Check, FileUp, Calendar, Database, 
  CheckCircle2, XCircle, Zap 
} from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface ColumnAnalysis {
  timestampColumn: string | null;
  dateColumn?: string | null;
  timeColumn?: string | null;
  powerColumn: string | null;
  ignoredColumns: string[];
  confidence: number;
  explanation: string;
}

interface RawDataPoint {
  timestamp: string;
  values: Record<string, number>;
}

interface ProcessedData {
  dataPoints: number;
  dateRange: { start: string; end: string };
  weekdayDays: number;
  weekendDays: number;
  rawData: RawDataPoint[];
  weekdayProfile: number[];
  weekendProfile: number[];
}

interface ScadaImportProps {
  categories: Category[];
}

export function ScadaImport({ categories }: ScadaImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [analysis, setAnalysis] = useState<ColumnAnalysis | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  
  // Form fields for the SCADA import
  const [siteName, setSiteName] = useState("");
  const [shopName, setShopName] = useState("");
  const [area, setArea] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Manual column mapping state
  const [selectedTimestampCol, setSelectedTimestampCol] = useState<string>("none");
  const [selectedDateCol, setSelectedDateCol] = useState<string>("none");
  const [selectedTimeCol, setSelectedTimeCol] = useState<string>("none");
  const [selectedPowerCol, setSelectedPowerCol] = useState<string>("");

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setAnalysis(null);
      setProcessedData(null);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    
    e.target.value = "";
  }, []);

  const handleAnalyze = async () => {
    if (!csvContent) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("process-scada-profile", {
        body: { csvContent, action: "analyze" },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setHeaders(data.headers);
      setRowCount(data.rowCount);
      setAnalysis(data.analysis);
      
      // Auto-set defaults after analysis
      if (!siteName) {
        const suggestedName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setSiteName(suggestedName);
      }
      
      toast.success("CSV analyzed successfully");
      
      // Pre-select columns based on analysis
      if (data.analysis) {
        if (data.analysis.timestampColumn) {
          setSelectedTimestampCol(data.analysis.timestampColumn);
          setSelectedDateCol("none");
          setSelectedTimeCol("none");
        } else if (data.analysis.dateColumn && data.analysis.timeColumn) {
          setSelectedTimestampCol("none");
          setSelectedDateCol(data.analysis.dateColumn);
          setSelectedTimeCol(data.analysis.timeColumn);
        }
        
        if (data.analysis.powerColumn) {
          setSelectedPowerCol(data.analysis.powerColumn);
        } else if (data.analysis.powerColumns && data.analysis.powerColumns.length > 0) {
           setSelectedPowerCol(data.analysis.powerColumns[0]);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze CSV");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProcess = async () => {
    // Check we have either timestampColumn or both dateColumn+timeColumn
    const hasTimestamp = selectedTimestampCol !== "none";
    const hasSeparateDateTime = selectedDateCol !== "none" && selectedTimeCol !== "none";
    
    if (!csvContent || !selectedPowerCol || (!hasTimestamp && !hasSeparateDateTime)) {
      toast.error("Please ensure Timestamp (or Date+Time) and Power columns are selected");
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("process-scada-profile", {
        body: { 
          csvContent, 
          action: "process",
          timestampColumn: selectedTimestampCol !== "none" ? selectedTimestampCol : null,
          dateColumn: selectedDateCol !== "none" ? selectedDateCol : null,
          timeColumn: selectedTimeCol !== "none" ? selectedTimeCol : null,
          powerColumn: selectedPowerCol
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Store processed data (raw kWh values, no percentage conversion)
      setProcessedData({
        dataPoints: data.dataPoints,
        dateRange: data.dateRange,
        weekdayDays: data.weekdayDays,
        weekendDays: data.weekendDays,
        rawData: data.rawData,
        weekdayProfile: data.weekdayProfile,
        weekendProfile: data.weekendProfile,
      });
      
      toast.success(`Processed ${data.dataPoints.toLocaleString()} readings`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!siteName || !processedData?.rawData?.length) {
      toast.error("Please provide a site name and process the CSV first");
      return;
    }

    setIsSaving(true);

    try {
      // Save raw kWh data directly with computed profiles
      const { error } = await supabase.from("scada_imports").insert([
        {
          site_name: siteName,
          shop_name: shopName || null,
          area_sqm: area ? parseFloat(area) : null,
          file_name: fileName,
          raw_data: JSON.parse(JSON.stringify(processedData.rawData)),
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
      
      toast.success("Meter data imported - view in Meter Library to analyze");
      
      // Reset state
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save import");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to parse raw data for storage
  const parseRawData = (content: string, columnAnalysis: ColumnAnalysis | null): Array<{ timestamp: string; value: number }> | null => {
    if (!columnAnalysis?.timestampColumn || !columnAnalysis?.powerColumn) return null;
    
    try {
      const lines = content.split('\n').filter((l: string) => {
        const trimmed = l.trim();
        return trimmed && !trimmed.toLowerCase().startsWith('sep=');
      });
      
      // Find header line
      let headerLineIdx = 0;
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const cols = lines[i].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const lowerCols = cols.map(c => c.toLowerCase());
        const hasHeaderKeywords = lowerCols.some(c => 
          c.includes('time') || c === 'date' || c.includes('kwh') || 
          c.includes('kw') || /^p\d+$/.test(c)
        );
        if (cols.length >= 2 && hasHeaderKeywords) {
          headerLineIdx = i;
          break;
        }
      }
      
      const headers = lines[headerLineIdx].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const timestampIdx = headers.indexOf(columnAnalysis.timestampColumn);
      const powerIdx = headers.indexOf(columnAnalysis.powerColumn);
      
      if (timestampIdx === -1 || powerIdx === -1) return null;
      
      const data: Array<{ timestamp: string; value: number }> = [];
      for (let i = headerLineIdx + 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const timestamp = cols[timestampIdx];
        const value = parseFloat(cols[powerIdx]);
        if (timestamp && !isNaN(value)) {
          data.push({ timestamp, value });
        }
      }
      return data;
    } catch {
      return null;
    }
  };

  const reset = () => {
    setCsvContent(null);
    setFileName("");
    setHeaders([]);
    setRowCount(0);
    setAnalysis(null);
    setProcessedData(null);
    setSiteName("");
    setShopName("");
    setArea("");
    setCategoryId("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Import SCADA / Meter Data
        </CardTitle>
        <CardDescription>
          Upload raw time-series meter data (CSV) to automatically generate a 24-hour load profile.
          The AI will detect columns and aggregate readings into hourly patterns.
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
            {csvContent ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{rowCount || '?'} rows</Badge>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileUp className="h-8 w-8" />
                <span>Click to upload or drag and drop</span>
                <span className="text-xs">CSV files with timestamp and kWh columns</span>
              </div>
            )}
          </div>
          
          {csvContent && !analysis && (
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Columns...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Analyze CSV Structure
                </>
              )}
            </Button>
          )}
        </div>

        {/* Metadata fields - available immediately after upload */}
        {csvContent && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Site Name *</Label>
                <Input
                  placeholder="e.g., Clearwater Mall"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
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
              <div className="space-y-2">
                <Label>Area (m²)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 250"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category (helps with classification)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-64">
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

        {analysis && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Column Mapping</span>
                <Badge variant={analysis.confidence >= 80 ? "default" : "secondary"}>
                  {analysis.confidence}% Confidence
                </Badge>
              </CardTitle>
              <CardDescription>
                Verify or change the column mappings below before processing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Timestamp Selection */}
                <div className="space-y-2">
                  <Label className="text-xs">Timestamp Format</Label>
                  <Select 
                    value={selectedTimestampCol !== "none" ? "combined" : "separate"} 
                    onValueChange={(v) => {
                      if (v === "combined") {
                        setSelectedDateCol("none");
                        setSelectedTimeCol("none");
                        // Try to find a good default if switching back
                        if (analysis.timestampColumn) setSelectedTimestampCol(analysis.timestampColumn);
                        else setSelectedTimestampCol(headers[0] || "");
                      } else {
                        setSelectedTimestampCol("none");
                        if (analysis.dateColumn) setSelectedDateCol(analysis.dateColumn);
                        if (analysis.timeColumn) setSelectedTimeCol(analysis.timeColumn);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="combined">Single Timestamp Column</SelectItem>
                      <SelectItem value="separate">Separate Date & Time Columns</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Power Column Selection */}
                <div className="space-y-2">
                  <Label className="text-xs">Power Column (kWh)</Label>
                  <Select value={selectedPowerCol} onValueChange={setSelectedPowerCol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select power column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Detailed Column Selectors */}
                {selectedTimestampCol !== "none" ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Select Timestamp Column</Label>
                    <Select value={selectedTimestampCol} onValueChange={setSelectedTimestampCol}>
                      <SelectTrigger className="border-green-200 bg-green-50/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Select Date Column</Label>
                      <Select value={selectedDateCol} onValueChange={setSelectedDateCol}>
                        <SelectTrigger className="border-blue-200 bg-blue-50/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Select Date --</SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Select Time Column</Label>
                      <Select value={selectedTimeCol} onValueChange={setSelectedTimeCol}>
                        <SelectTrigger className="border-blue-200 bg-blue-50/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Select Time --</SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground mt-2">
                <span className="font-semibold">Detected Information:</span> {analysis.explanation}
              </div>

              {((selectedTimestampCol !== "none" || (selectedDateCol !== "none" && selectedTimeCol !== "none")) && selectedPowerCol && !processedData) && (
                <Button onClick={handleProcess} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing {rowCount} readings...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Process Meter Data
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Data Summary - no percentage editor, just raw data preview */}
        {processedData && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Data Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground text-xs">Date Range</div>
                      <div className="font-medium">
                        {processedData.dateRange.start} — {processedData.dateRange.end}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Readings</div>
                    <div className="font-medium">{processedData.dataPoints.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Weekdays</div>
                    <div className="font-medium">{processedData.weekdayDays} days</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Weekends</div>
                    <div className="font-medium">{processedData.weekendDays} days</div>
                  </div>
                </div>
              </CardContent>
            </Card>

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
              <Button variant="outline" onClick={reset}>
                Reset
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              After saving, view and analyze actual kWh data in the Meter Library tab
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}