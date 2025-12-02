import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, FileText, Search, Building2, CheckCircle2, AlertCircle, Loader2, X, Zap, MapPin, RefreshCw, Trash2, Eye, Pencil, Save } from "lucide-react";

const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

interface Municipality {
  id: string;
  name: string;
  sheetName?: string;
  status: "pending" | "extracting" | "done" | "error";
  tariffCount?: number;
  error?: string;
}

interface AnalysisResult {
  fileType: string;
  sheets?: string[];
  rowCounts?: Record<string, number>;
  analysis: string;
}

interface PreviewData {
  municipality: string;
  sheetTitle: string;
  data: string[][];
  rowCount: number;
}

interface TariffRate {
  id?: string;
  rate_per_kwh: number;
  time_of_use: string;
  block_start_kwh: number | null;
  block_end_kwh: number | null;
}

interface ExtractedTariffPreview {
  id: string;
  name: string;
  tariff_type: string;
  phase_type: string | null;
  amperage_limit: string | null;
  fixed_monthly_charge: number | null;
  demand_charge_per_kva: number | null;
  is_prepaid: boolean | null;
  category: { name: string } | null;
  rates: TariffRate[];
}

export function FileUploadImport() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [province, setProvince] = useState("Western Cape");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtractingMunis, setIsExtractingMunis] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [phase, setPhase] = useState<1 | 2 | 3>(1); // 1=upload, 2=municipalities, 3=tariffs
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [extractedTariffs, setExtractedTariffs] = useState<ExtractedTariffPreview[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [editedTariff, setEditedTariff] = useState<ExtractedTariffPreview | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'pdf') return 'pdf';
    return 'unknown';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileType = getFileType(selectedFile.name);
    if (fileType === 'unknown') {
      toast({
        title: "Invalid File",
        description: "Please upload an Excel (.xlsx, .xls) or PDF file",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setAnalysis(null);
    setMunicipalities([]);
    setUploadedPath(null);
    setPhase(1);

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const filePath = `${timestamp}-${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("tariff-uploads")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      setUploadedPath(filePath);
      toast({ title: "File Uploaded", description: "Ready to analyze" });
    } catch (err) {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload file",
        variant: "destructive",
      });
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedPath || !file) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { 
          filePath: uploadedPath, 
          fileType: getFileType(file.name),
          action: "analyze" 
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAnalysis(data);
      toast({ title: "Analysis Complete", description: "Review the structure, then extract municipalities" });
    } catch (err) {
      console.error("Analysis error:", err);
      toast({
        title: "Analysis Failed",
        description: err instanceof Error ? err.message : "Failed to analyze file",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExtractMunicipalities = async () => {
    if (!uploadedPath || !file) return;

    setIsExtractingMunis(true);

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { 
          filePath: uploadedPath, 
          fileType: getFileType(file.name),
          province: province,
          action: "extract-municipalities" 
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const munis: Municipality[] = data.municipalities.map((m: { id: string; name: string; sheetName?: string }) => ({
        id: m.id,
        name: m.name,
        sheetName: m.sheetName,
        status: "pending" as const
      }));

      setMunicipalities(munis);
      setPhase(2);
      
      toast({ 
        title: "Municipalities Extracted", 
        description: `Found ${munis.length} municipalities in ${province}` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["municipalities"] });
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
    } catch (err) {
      console.error("Municipality extraction error:", err);
      toast({
        title: "Extraction Failed",
        description: err instanceof Error ? err.message : "Failed to extract municipalities",
        variant: "destructive",
      });
    } finally {
      setIsExtractingMunis(false);
    }
  };

  const handleExtractTariffs = async (muniIndex: number) => {
    const muni = municipalities[muniIndex];
    if (!muni || !uploadedPath || !file) return;

    setMunicipalities(prev => prev.map((m, i) => 
      i === muniIndex ? { ...m, status: "extracting" as const } : m
    ));

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { 
          filePath: uploadedPath, 
          fileType: getFileType(file.name),
          province: province,
          municipality: muni.name,
          action: "extract-tariffs" 
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setMunicipalities(prev => prev.map((m, i) => 
        i === muniIndex ? { ...m, status: "done" as const, tariffCount: data.imported } : m
      ));

      toast({ 
        title: `${muni.name} Complete`, 
        description: `Imported ${data.imported} tariffs` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    } catch (err) {
      console.error("Tariff extraction error:", err);
      setMunicipalities(prev => prev.map((m, i) => 
        i === muniIndex ? { ...m, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : m
      ));
      toast({
        title: `${muni.name} Failed`,
        description: err instanceof Error ? err.message : "Failed to extract tariffs",
        variant: "destructive",
      });
    }
  };

  const handleExtractAll = async () => {
    for (let i = 0; i < municipalities.length; i++) {
      if (municipalities[i].status === "pending") {
        await handleExtractTariffs(i);
      }
    }
  };

  const handleReextractTariffs = async (muniIndex: number) => {
    const muni = municipalities[muniIndex];
    if (!muni || !uploadedPath || !file) return;

    // Set to extracting state
    setMunicipalities(prev => prev.map((m, i) => 
      i === muniIndex ? { ...m, status: "extracting" as const } : m
    ));

    try {
      // First, delete existing tariffs for this municipality
      const { data: muniData } = await supabase
        .from("municipalities")
        .select("id")
        .ilike("name", muni.name)
        .maybeSingle();

      if (muniData) {
        // Get tariff IDs for this municipality
        const { data: existingTariffs } = await supabase
          .from("tariffs")
          .select("id")
          .eq("municipality_id", muniData.id);

        if (existingTariffs && existingTariffs.length > 0) {
          const tariffIds = existingTariffs.map(t => t.id);
          
          // Delete related rates first
          await supabase.from("tariff_rates").delete().in("tariff_id", tariffIds);
          await supabase.from("tou_periods").delete().in("tariff_id", tariffIds);
          
          // Then delete the tariffs
          await supabase.from("tariffs").delete().eq("municipality_id", muniData.id);
          
          console.log(`Deleted ${existingTariffs.length} tariffs for ${muni.name}`);
        }
      }

      // Now extract fresh tariffs
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { 
          filePath: uploadedPath, 
          fileType: getFileType(file.name),
          province: province,
          municipality: muni.name,
          action: "extract-tariffs" 
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setMunicipalities(prev => prev.map((m, i) => 
        i === muniIndex ? { ...m, status: "done" as const, tariffCount: data.imported } : m
      ));

      toast({ 
        title: `${muni.name} Re-extracted`, 
        description: `Imported ${data.imported} tariffs (previous data replaced)` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    } catch (err) {
      console.error("Re-extraction error:", err);
      setMunicipalities(prev => prev.map((m, i) => 
        i === muniIndex ? { ...m, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : m
      ));
      toast({
        title: `${muni.name} Re-extraction Failed`,
        description: err instanceof Error ? err.message : "Failed to re-extract tariffs",
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (muniName: string) => {
    if (!uploadedPath || !file) return;
    
    setIsLoadingPreview(true);
    setPreviewData(null);
    setExtractedTariffs([]);
    setPreviewOpen(true);

    try {
      // Fetch raw document data
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { 
          filePath: uploadedPath, 
          fileType: getFileType(file.name),
          municipality: muniName,
          action: "preview" 
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setPreviewData(data);

      // Also fetch extracted tariffs from database
      const { data: muniData } = await supabase
        .from("municipalities")
        .select("id")
        .ilike("name", muniName)
        .maybeSingle();

      if (muniData) {
        const { data: tariffs } = await supabase
          .from("tariffs")
          .select(`
            id,
            name,
            tariff_type,
            phase_type,
            amperage_limit,
            fixed_monthly_charge,
            demand_charge_per_kva,
            is_prepaid,
            category:tariff_categories(name),
            rates:tariff_rates(rate_per_kwh, time_of_use, block_start_kwh, block_end_kwh)
          `)
          .eq("municipality_id", muniData.id)
          .order("name");

        if (tariffs) {
          setExtractedTariffs(tariffs as unknown as ExtractedTariffPreview[]);
        }
      }
    } catch (err) {
      console.error("Preview error:", err);
      toast({
        title: "Preview Failed",
        description: err instanceof Error ? err.message : "Failed to load preview",
        variant: "destructive",
      });
      setPreviewOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setUploadedPath(null);
    setAnalysis(null);
    setMunicipalities([]);
    setPhase(1);
    setPreviewData(null);
    setExtractedTariffs([]);
    setPreviewOpen(false);
    setEditingTariffId(null);
    setEditedTariff(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEditing = (tariff: ExtractedTariffPreview) => {
    setEditingTariffId(tariff.id);
    setEditedTariff({ ...tariff, rates: [...tariff.rates] });
  };

  const cancelEditing = () => {
    setEditingTariffId(null);
    setEditedTariff(null);
  };

  const updateEditedTariff = (field: keyof ExtractedTariffPreview, value: any) => {
    if (!editedTariff) return;
    setEditedTariff({ ...editedTariff, [field]: value });
  };

  const updateEditedRate = (index: number, field: keyof TariffRate, value: any) => {
    if (!editedTariff) return;
    const newRates = [...editedTariff.rates];
    newRates[index] = { ...newRates[index], [field]: value };
    setEditedTariff({ ...editedTariff, rates: newRates });
  };

  const saveEditedTariff = async () => {
    if (!editedTariff) return;
    
    setIsSaving(true);
    try {
      // Update tariff main fields
      const { error: tariffError } = await supabase
        .from("tariffs")
        .update({
          fixed_monthly_charge: editedTariff.fixed_monthly_charge,
          demand_charge_per_kva: editedTariff.demand_charge_per_kva,
          phase_type: editedTariff.phase_type as any,
          amperage_limit: editedTariff.amperage_limit,
        })
        .eq("id", editedTariff.id);

      if (tariffError) throw tariffError;

      // Update rates - delete old and insert new
      await supabase.from("tariff_rates").delete().eq("tariff_id", editedTariff.id);
      
      if (editedTariff.rates.length > 0) {
        const ratesToInsert = editedTariff.rates.map(rate => ({
          tariff_id: editedTariff.id,
          rate_per_kwh: rate.rate_per_kwh,
          time_of_use: rate.time_of_use as any,
          block_start_kwh: rate.block_start_kwh,
          block_end_kwh: rate.block_end_kwh,
        }));
        
        const { error: ratesError } = await supabase.from("tariff_rates").insert(ratesToInsert);
        if (ratesError) throw ratesError;
      }

      // Update local state
      setExtractedTariffs(prev => prev.map(t => 
        t.id === editedTariff.id ? editedTariff : t
      ));

      toast({ title: "Tariff Updated", description: `${editedTariff.name} has been saved.` });
      setEditingTariffId(null);
      setEditedTariff(null);
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    } catch (err) {
      console.error("Save error:", err);
      toast({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const completedCount = municipalities.filter(m => m.status === "done").length;
  const pendingCount = municipalities.filter(m => m.status === "pending").length;
  const totalTariffs = municipalities.reduce((sum, m) => sum + (m.tariffCount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload File
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Phased Tariff Import
          </DialogTitle>
          <DialogDescription>
            Phase 1: Extract municipalities → Phase 2: Extract tariffs per municipality
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={phase >= 1 ? "default" : "outline"}>1. Upload</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant={phase >= 2 ? "default" : "outline"}>2. Municipalities</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant={phase >= 3 ? "default" : "outline"}>3. Tariffs</Badge>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Select File</Label>
            {!file ? (
              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <FileText className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="text-sm font-medium">Click to upload Excel or PDF</p>
                  <p className="text-xs text-muted-foreground">.xlsx, .xls, or .pdf files</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                {getFileType(file.name) === 'pdf' ? (
                  <FileText className="h-5 w-5 text-red-500" />
                ) : (
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                )}
                <span className="flex-1 text-sm font-medium truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetState}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Province Select */}
          <div className="space-y-2">
            <Label htmlFor="file-province">Province</Label>
            <Select value={province} onValueChange={setProvince} disabled={phase > 1}>
              <SelectTrigger id="file-province" className="bg-background">
                <SelectValue placeholder="Select a province" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {SOUTH_AFRICAN_PROVINCES.map((prov) => (
                  <SelectItem key={prov} value={prov}>
                    {prov}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phase 1: Analysis */}
          {uploadedPath && phase === 1 && (
            <div className="space-y-3">
              {!analysis ? (
                <Button 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Analyze File Structure
                    </>
                  )}
                </Button>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Analysis Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.sheets && analysis.sheets.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Sheets/Municipalities Found</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.sheets.slice(0, 10).map((sheet) => (
                            <Badge key={sheet} variant="secondary" className="text-xs">
                              {sheet}
                            </Badge>
                          ))}
                          {analysis.sheets.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{analysis.sheets.length - 10} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <ScrollArea className="h-24">
                      <div className="text-xs whitespace-pre-wrap text-muted-foreground">
                        {analysis.analysis}
                      </div>
                    </ScrollArea>

                    <Button 
                      onClick={handleExtractMunicipalities} 
                      disabled={isExtractingMunis}
                      className="w-full gap-2"
                    >
                      {isExtractingMunis ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Extracting Municipalities...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4" />
                          Extract & Save Municipalities
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Phase 2: Municipality List */}
          {phase >= 2 && municipalities.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Municipalities ({municipalities.length})
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {completedCount}/{municipalities.length} done • {totalTariffs} tariffs
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingCount > 0 && (
                  <Button 
                    onClick={handleExtractAll}
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Extract All Remaining ({pendingCount})
                  </Button>
                )}

                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {municipalities.map((muni, index) => (
                      <div 
                        key={muni.id} 
                        className="flex items-center justify-between p-2 rounded border bg-background"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {muni.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                          {muni.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                          {muni.status === "extracting" && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                          {muni.status === "pending" && <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />}
                          
                          <span className="text-sm truncate">{muni.name}</span>
                          
                          {muni.tariffCount !== undefined && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {muni.tariffCount} tariffs
                            </Badge>
                          )}
                        </div>

                        {muni.status === "pending" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs shrink-0 gap-1"
                              onClick={() => handlePreview(muni.name)}
                              title="Preview raw document data"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs shrink-0"
                              onClick={() => handleExtractTariffs(index)}
                            >
                              Extract
                            </Button>
                          </div>
                        )}
                        
                        {muni.status === "done" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs shrink-0 gap-1"
                              onClick={() => handlePreview(muni.name)}
                              title="Preview raw document data"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs shrink-0 gap-1"
                              onClick={() => handleReextractTariffs(index)}
                              title="Delete existing tariffs and re-extract"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Re-extract
                            </Button>
                          </div>
                        )}
                        
                        {muni.status === "error" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs shrink-0 gap-1"
                              onClick={() => handlePreview(muni.name)}
                              title="Preview raw document data"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs shrink-0"
                              onClick={() => handleExtractTariffs(index)}
                            >
                              Retry
                            </Button>
                          </div>
                        )}
                        
                        {muni.status === "extracting" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs shrink-0 gap-1"
                            onClick={() => handlePreview(muni.name)}
                            title="Preview raw document data"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {completedCount === municipalities.length && municipalities.length > 0 && (
                  <Alert className="border-green-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription>
                      All municipalities extracted! {totalTariffs} total tariffs imported.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>

      {/* Side-by-Side Comparison Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Comparison: {previewData?.sheetTitle || "Loading..."}
            </DialogTitle>
            <DialogDescription>
              Side-by-side comparison of raw document data and extracted tariffs for verification.
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : previewData ? (
            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Left: Raw Document Data */}
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="py-2 px-3 border-b bg-muted/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    Raw Document Data
                    <Badge variant="secondary" className="text-xs">{previewData.rowCount} rows</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-[55vh]">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8 text-xs sticky left-0 bg-background">#</TableHead>
                            {previewData.data[0]?.slice(0, 8).map((_, colIdx) => (
                              <TableHead key={colIdx} className="text-xs min-w-[80px]">
                                {colIdx + 1}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.data.slice(0, 60).map((row, rowIdx) => (
                            <TableRow key={rowIdx} className={rowIdx % 2 === 0 ? "bg-muted/30" : ""}>
                              <TableCell className="text-xs text-muted-foreground font-mono sticky left-0 bg-background">
                                {rowIdx + 1}
                              </TableCell>
                              {row.slice(0, 8).map((cell, cellIdx) => (
                                <TableCell key={cellIdx} className="text-xs whitespace-nowrap p-1">
                                  {cell !== null && cell !== undefined && cell !== "" ? String(cell).slice(0, 30) : "-"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Right: Extracted Tariffs */}
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="py-2 px-3 border-b bg-muted/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Extracted Tariffs
                    <Badge variant="secondary" className="text-xs">{extractedTariffs.length} tariffs</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-[55vh]">
                    {extractedTariffs.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
                        <div className="text-center">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No tariffs extracted yet.</p>
                          <p className="text-xs">Click "Extract" to import tariffs.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 space-y-2">
                        {extractedTariffs.map((tariff) => {
                          const isEditing = editingTariffId === tariff.id;
                          const displayTariff = isEditing && editedTariff ? editedTariff : tariff;
                          
                          return (
                            <Card key={tariff.id} className={`text-xs ${isEditing ? "ring-2 ring-primary" : ""}`}>
                              <CardHeader className="py-2 px-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-medium text-sm">{tariff.name}</div>
                                    <div className="text-muted-foreground">{tariff.category?.name || "Uncategorized"}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[10px]">{tariff.tariff_type}</Badge>
                                    {tariff.is_prepaid && <Badge variant="secondary" className="text-[10px]">Prepaid</Badge>}
                                    {isEditing ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={cancelEditing}
                                          disabled={isSaving}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="default"
                                          size="sm"
                                          className="h-6 px-2 text-xs gap-1"
                                          onClick={saveEditedTariff}
                                          disabled={isSaving}
                                        >
                                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                          Save
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs gap-1"
                                        onClick={() => startEditing(tariff)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 px-3 border-t space-y-2">
                                {isEditing ? (
                                  <>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Basic Charge (R/month)</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          className="h-7 text-xs"
                                          value={displayTariff.fixed_monthly_charge || ""}
                                          onChange={(e) => updateEditedTariff("fixed_monthly_charge", e.target.value ? parseFloat(e.target.value) : null)}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Demand Charge (R/kVA)</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          className="h-7 text-xs"
                                          value={displayTariff.demand_charge_per_kva || ""}
                                          onChange={(e) => updateEditedTariff("demand_charge_per_kva", e.target.value ? parseFloat(e.target.value) : null)}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Phase Type</Label>
                                        <Select
                                          value={displayTariff.phase_type || ""}
                                          onValueChange={(v) => updateEditedTariff("phase_type", v || null)}
                                        >
                                          <SelectTrigger className="h-7 text-xs">
                                            <SelectValue placeholder="Select" />
                                          </SelectTrigger>
                                          <SelectContent className="bg-popover">
                                            <SelectItem value="Single Phase">Single Phase</SelectItem>
                                            <SelectItem value="Three Phase">Three Phase</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Amperage Limit</Label>
                                        <Input
                                          type="text"
                                          className="h-7 text-xs"
                                          value={displayTariff.amperage_limit || ""}
                                          onChange={(e) => updateEditedTariff("amperage_limit", e.target.value || null)}
                                        />
                                      </div>
                                    </div>
                                    {displayTariff.rates && displayTariff.rates.length > 0 && (
                                      <div className="pt-2 border-t">
                                        <Label className="text-[10px] text-muted-foreground">Energy Rates (c/kWh)</Label>
                                        <div className="space-y-1 mt-1">
                                          {displayTariff.rates.map((rate, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-muted/50 p-1 rounded">
                                              <Select
                                                value={rate.time_of_use}
                                                onValueChange={(v) => updateEditedRate(idx, "time_of_use", v)}
                                              >
                                                <SelectTrigger className="h-6 text-xs w-28">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-popover">
                                                  <SelectItem value="Any">Any</SelectItem>
                                                  <SelectItem value="High Demand">High Demand</SelectItem>
                                                  <SelectItem value="Low Demand">Low Demand</SelectItem>
                                                  <SelectItem value="Peak">Peak</SelectItem>
                                                  <SelectItem value="Standard">Standard</SelectItem>
                                                  <SelectItem value="Off-Peak">Off-Peak</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                className="h-6 text-xs w-20"
                                                value={(rate.rate_per_kwh * 100).toFixed(2)}
                                                onChange={(e) => updateEditedRate(idx, "rate_per_kwh", parseFloat(e.target.value) / 100)}
                                              />
                                              <span className="text-[10px] text-muted-foreground">c/kWh</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      {displayTariff.fixed_monthly_charge !== null && displayTariff.fixed_monthly_charge > 0 && (
                                        <div>
                                          <span className="text-muted-foreground">Basic Charge:</span>{" "}
                                          <span className="font-medium text-green-600">R{displayTariff.fixed_monthly_charge.toFixed(2)}/m</span>
                                        </div>
                                      )}
                                      {displayTariff.demand_charge_per_kva !== null && displayTariff.demand_charge_per_kva > 0 && (
                                        <div>
                                          <span className="text-muted-foreground">Demand Charge:</span>{" "}
                                          <span className="font-medium text-green-600">R{displayTariff.demand_charge_per_kva.toFixed(2)}/kVA</span>
                                        </div>
                                      )}
                                      {displayTariff.phase_type && (
                                        <div>
                                          <span className="text-muted-foreground">Phase:</span> {displayTariff.phase_type}
                                        </div>
                                      )}
                                      {displayTariff.amperage_limit && (
                                        <div>
                                          <span className="text-muted-foreground">Amperage:</span> {displayTariff.amperage_limit}
                                        </div>
                                      )}
                                    </div>
                                    {displayTariff.rates && displayTariff.rates.length > 0 && (
                                      <div className="mt-2 pt-2 border-t">
                                        <div className="text-muted-foreground mb-1">Energy Rates:</div>
                                        <div className="space-y-0.5">
                                          {displayTariff.rates.map((rate, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-muted/50 px-2 py-0.5 rounded">
                                              <span className={`font-medium ${
                                                rate.time_of_use === "High Demand" ? "text-orange-600" :
                                                rate.time_of_use === "Low Demand" ? "text-blue-600" :
                                                rate.time_of_use === "Peak" ? "text-red-600" :
                                                rate.time_of_use === "Off-Peak" ? "text-green-600" :
                                                "text-foreground"
                                              }`}>
                                                {rate.time_of_use}
                                                {rate.block_start_kwh !== null && rate.block_end_kwh !== null && (
                                                  <span className="text-muted-foreground ml-1">
                                                    ({rate.block_start_kwh}-{rate.block_end_kwh} kWh)
                                                  </span>
                                                )}
                                              </span>
                                              <span className="font-mono">{(rate.rate_per_kwh * 100).toFixed(2)} c/kWh</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No preview data available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
