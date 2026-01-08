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
  Upload, Loader2, Check, FileUp, Calendar, Zap, Settings2
} from "lucide-react";
import { toast } from "sonner";
import { CsvParseDialog, ParseConfiguration } from "./CsvParseDialog";
import { MeterAnalysisChart, MeterChartDataPoint } from "./MeterAnalysisChart";

interface Category {
  id: string;
  name: string;
}

interface ProcessedData {
  dataPoints: number;
  dateRange: { start: string; end: string };
  weekdayDays: number;
  weekendDays: number;
  rawData: any[]; // Kept as any[] to match backend response structure
  weekdayProfile: number[];
  weekendProfile: number[];
  hourlyProfile?: MeterChartDataPoint[]; // For chart
}

interface ScadaImportProps {
  categories: Category[];
  siteId?: string | null;
}

export function ScadaImport({ categories, siteId }: ScadaImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form fields for the SCADA import
  const [siteName, setSiteName] = useState("");
  const [shopNumber, setShopNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [area, setArea] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setRowCount(content.split('\n').filter(l => l.trim()).length);
      setProcessedData(null);

      // Auto-set site name from file name
      if (!siteName) {
        const suggestedName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setSiteName(suggestedName);
      }

      // Try auto-processing first
      setIsProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke("process-scada-profile", {
          body: {
            csvContent: content,
            action: "process",
            autoDetect: true // Enable auto-detection
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        // Check if we got meaningful results
        if (data.dataPoints > 0) {
          // Transform raw data for chart
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
            hourlyProfile: chartData
          });

          toast.success(`Auto-detected and processed ${data.dataPoints.toLocaleString()} readings`, {
            description: `Date column: "${data.detectedColumns?.headers?.[data.detectedColumns?.dateColumn] || 'Column 1'}", Value column: "${data.detectedColumns?.headers?.[data.detectedColumns?.valueColumn] || 'Column 2'}"`
          });
        } else {
          // No data found, open dialog for manual configuration
          toast.info("Could not auto-detect columns. Please configure manually.");
          setDialogOpen(true);
        }
      } catch (error) {
        console.error("Auto-process failed:", error);
        toast.info("Please configure the CSV columns manually.");
        setDialogOpen(true);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);

    e.target.value = "";
  }, [siteName]);

  const handleProcess = async (config: ParseConfiguration) => {
    if (!csvContent) return;

    setIsProcessing(true);
    setDialogOpen(false); // Close dialog while processing

    try {
      const { data, error } = await supabase.functions.invoke("process-scada-profile", {
        body: {
          csvContent,
          action: "process",
          ...config.columnMapping, // Spread mapping: dateColumn, timeColumn, valueColumn etc.
          separator: config.separator,
          headerRowNumber: config.headerRowNumber
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Transform raw data for chart
      // We want to show the Average Hourly Profile (weekday vs weekend)
      const chartData: MeterChartDataPoint[] = [];

      // Data format from backend: { weekdayProfile: number[], weekendProfile: number[] } (percentages)
      // OR we can calculate from rawData if we want exact values
      // Let's use the profile percentages for shape visualization

      for (let i = 0; i < 24; i++) {
        chartData.push({
          period: `${i}:00`,
          amount: data.weekdayProfile[i], // Using "amount" for the bar
          meterReading: data.weekendProfile[i], // Using "meterReading" for the line (weekend)
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
        hourlyProfile: chartData
      });

      toast.success(`Processed ${data.dataPoints.toLocaleString()} readings`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV");
      setDialogOpen(true); // Re-open dialog on error
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

      const { error } = await supabase.from("scada_imports").insert([
        {
          site_name: siteName,
          site_id: siteId || null,
          shop_name: shopName || null,
          area_sqm: area ? parseFloat(area) : null,
          file_name: fileName,
          raw_data: processedData.rawData, // Save the FULL raw data
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

      toast.success("Meter data imported successfully");

      // Reset state
      setCsvContent(null);
      setFileName("");
      setProcessedData(null);
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
              {csvContent ? (
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{fileName}</span>
                  <Badge variant="secondary">{rowCount.toLocaleString()} lines</Badge>
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

          {/* Metadata fields */}
          {csvContent && (
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

          {/* Step 3: Result Summary & Graph */}
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
                }}>
                  Reset
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CsvParseDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        csvContent={csvContent}
        fileName={fileName}
        onProcess={handleProcess}
        isProcessing={isProcessing}
      />
    </div>
  );
}