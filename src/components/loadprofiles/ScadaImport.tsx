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
  Upload, Loader2, Check, AlertCircle, FileUp, Calendar, Database, 
  CheckCircle2, XCircle, Zap 
} from "lucide-react";
import { toast } from "sonner";
import { LoadProfileEditor } from "./LoadProfileEditor";

interface Category {
  id: string;
  name: string;
}

interface ColumnAnalysis {
  timestampColumn: string | null;
  powerColumn: string | null;
  ignoredColumns: string[];
  confidence: number;
  explanation: string;
}

interface ProcessedProfile {
  weekdayProfile: number[];
  weekendProfile: number[];
  dataPoints: number;
  dateRange: { start: string; end: string };
  weekdayDays: number;
  weekendDays: number;
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
  const [processedProfile, setProcessedProfile] = useState<ProcessedProfile | null>(null);
  
  const [profileName, setProfileName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [kwhPerSqm, setKwhPerSqm] = useState("50");
  const [weekdayProfile, setWeekdayProfile] = useState<number[]>([]);
  const [weekendProfile, setWeekendProfile] = useState<number[]>([]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setAnalysis(null);
      setProcessedProfile(null);
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
      toast.success("CSV analyzed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze CSV");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProcess = async () => {
    if (!csvContent || !analysis?.timestampColumn || !analysis?.powerColumn) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("process-scada-profile", {
        body: { 
          csvContent, 
          action: "process",
          timestampColumn: analysis.timestampColumn,
          powerColumn: analysis.powerColumn
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setProcessedProfile(data);
      setWeekdayProfile(data.weekdayProfile);
      setWeekendProfile(data.weekendProfile);
      
      // Suggest profile name from filename
      const suggestedName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setProfileName(suggestedName);
      
      toast.success("Load profile generated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!profileName || weekdayProfile.length !== 24 || weekendProfile.length !== 24) {
      toast.error("Please provide a profile name and ensure the profile is valid");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("shop_types").insert({
        name: profileName,
        description: processedProfile 
          ? `Generated from SCADA data: ${processedProfile.dateRange.start} to ${processedProfile.dateRange.end} (${processedProfile.dataPoints} readings)` 
          : null,
        kwh_per_sqm_month: parseFloat(kwhPerSqm) || 50,
        category_id: categoryId || null,
        load_profile_weekday: weekdayProfile,
        load_profile_weekend: weekendProfile,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["shop-types-all"] });
      queryClient.invalidateQueries({ queryKey: ["shop-types"] });
      
      toast.success("Load profile saved successfully");
      
      // Reset state
      setCsvContent(null);
      setFileName("");
      setAnalysis(null);
      setProcessedProfile(null);
      setProfileName("");
      setCategoryId("");
      setKwhPerSqm("50");
      setWeekdayProfile([]);
      setWeekendProfile([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setCsvContent(null);
    setFileName("");
    setAnalysis(null);
    setProcessedProfile(null);
    setProfileName("");
    setCategoryId("");
    setWeekdayProfile([]);
    setWeekendProfile([]);
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

        {/* Step 2: Column Analysis */}
        {analysis && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Column Detection</span>
                <Badge variant={analysis.confidence >= 80 ? "default" : "secondary"}>
                  {analysis.confidence}% Confidence
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  {analysis.timestampColumn ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-muted-foreground">Timestamp:</span>
                  <Badge variant="outline">{analysis.timestampColumn || "Not found"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {analysis.powerColumn ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-muted-foreground">Power (kWh):</span>
                  <Badge variant="outline">{analysis.powerColumn || "Not found"}</Badge>
                </div>
              </div>
              
              {analysis.ignoredColumns.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Ignored:</span>{" "}
                  {analysis.ignoredColumns.join(", ")}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">{analysis.explanation}</p>

              {analysis.timestampColumn && analysis.powerColumn && !processedProfile && (
                <Button onClick={handleProcess} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing {rowCount} readings...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Generate Load Profile
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Generated Profile */}
        {processedProfile && weekdayProfile.length === 24 && (
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
                        {processedProfile.dateRange.start} — {processedProfile.dateRange.end}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Readings</div>
                    <div className="font-medium">{processedProfile.dataPoints.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Weekdays</div>
                    <div className="font-medium">{processedProfile.weekdayDays} days</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Weekends</div>
                    <div className="font-medium">{processedProfile.weekendDays} days</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profile Name</Label>
                <Input
                  placeholder="e.g., Shopping Centre Main Meter"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
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

            <div className="space-y-2">
              <Label>kWh per m² per month (optional)</Label>
              <Input
                type="number"
                placeholder="50"
                value={kwhPerSqm}
                onChange={(e) => setKwhPerSqm(e.target.value)}
                className="w-32"
              />
            </div>

            <LoadProfileEditor
              weekdayProfile={weekdayProfile}
              weekendProfile={weekendProfile}
              onWeekdayChange={setWeekdayProfile}
              onWeekendChange={setWeekendProfile}
            />

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving || !profileName} className="flex-1">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Load Profile
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}