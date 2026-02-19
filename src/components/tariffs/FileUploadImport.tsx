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
import { Switch } from "@/components/ui/switch";
import { Upload, FileSpreadsheet, FileText, Search, Building2, CheckCircle2, AlertCircle, Loader2, X, Zap, MapPin, RefreshCw, Eye, Pencil, Save } from "lucide-react";

import { SOUTH_AFRICAN_PROVINCES } from "@/lib/constants";

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
  isPdf?: boolean;
  pdfFilePath?: string;
}

interface TariffRate {
  id?: string;
  amount: number;
  charge: string;
  season: string;
  tou: string;
  block_min_kwh: number | null;
  block_max_kwh: number | null;
  unit: string;
}

interface ExtractedTariffPreview {
  id: string;
  name: string;
  category: string;
  structure: string;
  phase: string | null;
  tariff_rates: TariffRate[];
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
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [extractedTariffs, setExtractedTariffs] = useState<ExtractedTariffPreview[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [leftPaneMode, setLeftPaneMode] = useState<"text" | "pdf">("text");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [editedTariff, setEditedTariff] = useState<ExtractedTariffPreview | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') return 'xlsx';
    if (ext === 'pdf') return 'pdf';
    return 'unknown';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileType = getFileType(selectedFile.name);
    if (fileType === 'unknown') {
      toast({ title: "Invalid File", description: "Please upload an Excel (.xlsx, .xls, .xlsm) or PDF file", variant: "destructive" });
      return;
    }

    setFile(selectedFile);
    setAnalysis(null);
    setMunicipalities([]);
    setUploadedPath(null);
    setPhase(1);

    setIsUploading(true);
    try {
      const filePath = `${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from("tariff-uploads").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      setUploadedPath(filePath);
      toast({ title: "File Uploaded", description: "Ready to analyze" });
    } catch (err) {
      toast({ title: "Upload Failed", description: err instanceof Error ? err.message : "Failed to upload file", variant: "destructive" });
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
        body: { filePath: uploadedPath, fileType: getFileType(file.name), action: "analyze" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
      toast({ title: "Analysis Complete", description: "Review the structure, then extract municipalities" });
    } catch (err) {
      toast({ title: "Analysis Failed", description: err instanceof Error ? err.message : "Failed to analyze file", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExtractMunicipalities = async () => {
    if (!uploadedPath || !file) return;
    setIsExtractingMunis(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { filePath: uploadedPath, fileType: getFileType(file.name), province, action: "extract-municipalities" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const munis: Municipality[] = data.municipalities.map((m: { id: string; name: string; sheetName?: string }) => ({
        id: m.id, name: m.name, sheetName: m.sheetName, status: "pending" as const
      }));
      setMunicipalities(munis);
      setPhase(2);
      toast({ title: "Municipalities Extracted", description: `Found ${munis.length} municipalities in ${province}` });
      queryClient.invalidateQueries({ queryKey: ["municipalities"] });
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
    } catch (err) {
      toast({ title: "Extraction Failed", description: err instanceof Error ? err.message : "Failed to extract municipalities", variant: "destructive" });
    } finally {
      setIsExtractingMunis(false);
    }
  };

  const handleExtractTariffs = async (muniIndex: number) => {
    const muni = municipalities[muniIndex];
    if (!muni || !uploadedPath || !file) return;

    setMunicipalities(prev => prev.map((m, i) => i === muniIndex ? { ...m, status: "extracting" as const } : m));

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { filePath: uploadedPath, fileType: getFileType(file.name), province, municipality: muni.name, action: "extract-tariffs" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const totalChanged = (data.inserted || 0) + (data.updated || 0);
      setMunicipalities(prev => prev.map((m, i) => i === muniIndex ? { ...m, status: "done" as const, tariffCount: totalChanged } : m));

      const parts = [];
      if (data.inserted > 0) parts.push(`${data.inserted} new`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      toast({ title: `${muni.name} Complete`, description: parts.length > 0 ? parts.join(", ") : "No changes needed" });
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    } catch (err) {
      setMunicipalities(prev => prev.map((m, i) => i === muniIndex ? { ...m, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : m));
      toast({ title: `${muni.name} Failed`, description: err instanceof Error ? err.message : "Failed to extract tariffs", variant: "destructive" });
    }
  };

  const handleExtractAll = async () => {
    for (let i = 0; i < municipalities.length; i++) {
      if (municipalities[i].status === "pending") await handleExtractTariffs(i);
    }
  };

  const handleReextractTariffs = async (muniIndex: number) => {
    const muni = municipalities[muniIndex];
    if (!muni || !uploadedPath || !file) return;

    setMunicipalities(prev => prev.map((m, i) => i === muniIndex ? { ...m, status: "extracting" as const } : m));

    try {
      const { data: muniData } = await supabase.from("municipalities").select("id").ilike("name", muni.name).maybeSingle();
      if (muniData) {
        const { data: existingPlans } = await supabase.from("tariff_plans").select("id").eq("municipality_id", muniData.id);
        if (existingPlans && existingPlans.length > 0) {
          const planIds = existingPlans.map((t: any) => t.id);
          await supabase.from("tariff_rates").delete().in("tariff_plan_id", planIds);
          await supabase.from("tariff_plans").delete().eq("municipality_id", muniData.id);
        }
      }

      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { filePath: uploadedPath, fileType: getFileType(file.name), province, municipality: muni.name, action: "extract-tariffs" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const totalChanged = (data.inserted || 0) + (data.updated || 0);
      setMunicipalities(prev => prev.map((m, i) => i === muniIndex ? { ...m, status: "done" as const, tariffCount: totalChanged } : m));
      toast({ title: `${muni.name} Re-extracted`, description: `Imported ${totalChanged} tariffs` });
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    } catch (err) {
      setMunicipalities(prev => prev.map((m, i) => i === muniIndex ? { ...m, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : m));
      toast({ title: `${muni.name} Re-extraction Failed`, description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handlePreview = async (muniName: string) => {
    if (!uploadedPath || !file) return;
    setIsLoadingPreview(true);
    setPreviewData(null);
    setExtractedTariffs([]);
    setPreviewOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { filePath: uploadedPath, fileType: getFileType(file.name), municipality: muniName, action: "preview" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPreviewData(data);

      // Fetch extracted tariff_plans from database
      const { data: muniData } = await supabase.from("municipalities").select("id").ilike("name", muniName).maybeSingle();
      if (muniData) {
        const { data: tariffs } = await supabase
          .from("tariff_plans")
          .select(`
            id, name, category, structure, phase,
            tariff_rates(amount, charge, season, tou, block_min_kwh, block_max_kwh, unit)
          `)
          .eq("municipality_id", muniData.id)
          .order("name");

        if (tariffs) {
          setExtractedTariffs(tariffs as unknown as ExtractedTariffPreview[]);
        }
      }
    } catch (err) {
      toast({ title: "Preview Failed", description: err instanceof Error ? err.message : "Failed to load preview", variant: "destructive" });
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
    setLeftPaneMode("text");
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEditing = (tariff: ExtractedTariffPreview) => {
    setEditingTariffId(tariff.id);
    setEditedTariff({ ...tariff, tariff_rates: [...tariff.tariff_rates] });
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
    const newRates = [...editedTariff.tariff_rates];
    newRates[index] = { ...newRates[index], [field]: value };
    setEditedTariff({ ...editedTariff, tariff_rates: newRates });
  };

  const saveEditedTariff = async () => {
    if (!editedTariff) return;
    setIsSaving(true);
    try {
      // Update tariff_plans
      const { error: planError } = await supabase
        .from("tariff_plans")
        .update({
          name: editedTariff.name,
          structure: editedTariff.structure as any,
          phase: editedTariff.phase,
        })
        .eq("id", editedTariff.id);

      if (planError) throw planError;

      // Delete old rates and insert new
      await supabase.from("tariff_rates").delete().eq("tariff_plan_id", editedTariff.id);

      if (editedTariff.tariff_rates.length > 0) {
        const ratesToInsert = editedTariff.tariff_rates.map(rate => ({
          tariff_plan_id: editedTariff.id,
          charge: rate.charge as any,
          amount: rate.amount,
          season: rate.season as any,
          tou: rate.tou as any,
          block_min_kwh: rate.block_min_kwh,
          block_max_kwh: rate.block_max_kwh,
          unit: rate.unit || 'R/kWh',
        }));

        const { error: ratesError } = await supabase.from("tariff_rates").insert(ratesToInsert);
        if (ratesError) throw ratesError;
      }

      setExtractedTariffs(prev => prev.map(t => t.id === editedTariff.id ? editedTariff : t));
      toast({ title: "Tariff Updated", description: `${editedTariff.name} has been saved.` });
      setEditingTariffId(null);
      setEditedTariff(null);
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    } catch (err) {
      toast({ title: "Save Failed", description: err instanceof Error ? err.message : "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const completedCount = municipalities.filter(m => m.status === "done").length;
  const pendingCount = municipalities.filter(m => m.status === "pending").length;
  const totalTariffs = municipalities.reduce((sum, m) => sum + (m.tariffCount || 0), 0);

  // Helper to get energy rates only for display
  const getEnergyRates = (rates: TariffRate[]) => rates.filter(r => r.charge === "energy");
  const getBasicCharge = (rates: TariffRate[]) => rates.find(r => r.charge === "basic");
  const getDemandCharge = (rates: TariffRate[]) => rates.find(r => r.charge === "demand");

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
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors" onClick={() => fileInputRef.current?.click()}>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <FileText className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="text-sm font-medium">Click to upload Excel or PDF</p>
                  <p className="text-xs text-muted-foreground">.xlsx, .xls, or .pdf files</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm,.pdf" onChange={handleFileSelect} className="hidden" />
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                {getFileType(file.name) === 'pdf' ? <FileText className="h-5 w-5 text-red-500" /> : <FileSpreadsheet className="h-5 w-5 text-green-600" />}
                <span className="flex-1 text-sm font-medium truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetState}><X className="h-4 w-4" /></Button>
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
                  <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phase 1: Analysis */}
          {uploadedPath && phase === 1 && (
            <div className="space-y-3">
              {!analysis ? (
                <Button onClick={handleAnalyze} disabled={isAnalyzing} variant="secondary" className="w-full gap-2">
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing...</> : <><Search className="h-4 w-4" />Analyze File Structure</>}
                </Button>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Analysis Result</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.sheets && analysis.sheets.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Sheets/Municipalities Found</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.sheets.slice(0, 10).map((sheet) => <Badge key={sheet} variant="secondary" className="text-xs">{sheet}</Badge>)}
                          {analysis.sheets.length > 10 && <Badge variant="outline" className="text-xs">+{analysis.sheets.length - 10} more</Badge>}
                        </div>
                      </div>
                    )}
                    <ScrollArea className="h-24">
                      <div className="text-xs whitespace-pre-wrap text-muted-foreground">{analysis.analysis}</div>
                    </ScrollArea>
                    <Button onClick={handleExtractMunicipalities} disabled={isExtractingMunis} className="w-full gap-2">
                      {isExtractingMunis ? <><Loader2 className="h-4 w-4 animate-spin" />Extracting...</> : <><MapPin className="h-4 w-4" />Extract & Save Municipalities</>}
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
                  <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Municipalities ({municipalities.length})</CardTitle>
                  <div className="text-xs text-muted-foreground">{completedCount}/{municipalities.length} done • {totalTariffs} tariffs</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingCount > 0 && (
                  <Button onClick={handleExtractAll} variant="default" size="sm" className="w-full gap-2">
                    <Zap className="h-4 w-4" />Extract All Remaining ({pendingCount})
                  </Button>
                )}
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {municipalities.map((muni, index) => (
                      <div key={muni.id} className="flex items-center justify-between p-2 rounded border bg-background">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {muni.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                          {muni.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                          {muni.status === "extracting" && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                          {muni.status === "pending" && <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <span className="text-sm truncate">{muni.name}</span>
                          {muni.tariffCount !== undefined && <Badge variant="secondary" className="text-xs shrink-0">{muni.tariffCount} tariffs</Badge>}
                        </div>

                        {muni.status === "pending" && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 gap-1" onClick={() => handlePreview(muni.name)}><Eye className="h-3 w-3" /></Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => handleExtractTariffs(index)}>Extract</Button>
                          </div>
                        )}
                        {muni.status === "done" && (
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0 gap-1" onClick={() => handlePreview(muni.name)}><Eye className="h-3 w-3" />Preview</Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0 gap-1 text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700" onClick={() => handleReextractTariffs(index)}><RefreshCw className="h-3 w-3" />Re-extract</Button>
                          </div>
                        )}
                        {muni.status === "error" && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 gap-1" onClick={() => handlePreview(muni.name)}><Eye className="h-3 w-3" /></Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => handleExtractTariffs(index)}>Retry</Button>
                          </div>
                        )}
                        {muni.status === "extracting" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 gap-1" onClick={() => handlePreview(muni.name)}><Eye className="h-3 w-3" /></Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {completedCount === municipalities.length && municipalities.length > 0 && (
                  <Alert className="border-green-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription>All municipalities extracted! {totalTariffs} total tariffs imported.</AlertDescription>
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
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Comparison: {previewData?.sheetTitle || "Loading..."}</DialogTitle>
            <DialogDescription>Side-by-side comparison of raw document data and extracted tariffs.</DialogDescription>
          </DialogHeader>

          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : previewData ? (
            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Left: Raw Document Data */}
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="py-2 px-3 border-b bg-muted/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />Raw Document Data
                    <Badge variant="secondary" className="text-xs">{previewData.rowCount} rows</Badge>
                    {previewData.isPdf && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] text-muted-foreground">Text</span>
                        <Switch
                          checked={leftPaneMode === "pdf"}
                          onCheckedChange={(checked) => {
                            const mode = checked ? "pdf" : "text";
                            setLeftPaneMode(mode);
                            if (mode === "pdf" && previewData.pdfFilePath && !pdfBlobUrl) {
                              // Download PDF from storage for inline display
                              supabase.storage.from("tariff-uploads").download(previewData.pdfFilePath).then(({ data }) => {
                                if (data) {
                                  const url = URL.createObjectURL(data);
                                  setPdfBlobUrl(url);
                                }
                              });
                            }
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">PDF</span>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                  {leftPaneMode === "pdf" && pdfBlobUrl ? (
                    <object
                      data={pdfBlobUrl}
                      type="application/pdf"
                      className="w-full h-[55vh]"
                    >
                      <p className="p-4 text-sm text-muted-foreground">PDF preview not supported in this browser.</p>
                    </object>
                  ) : (
                  <ScrollArea className="h-[55vh]">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8 text-xs sticky left-0 bg-background">#</TableHead>
                            {previewData.data[0]?.slice(0, 8).map((_, colIdx) => (
                              <TableHead key={colIdx} className="text-xs min-w-[80px]">{colIdx + 1}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.data.slice(0, 60).map((row, rowIdx) => (
                            <TableRow key={rowIdx} className={rowIdx % 2 === 0 ? "bg-muted/30" : ""}>
                              <TableCell className="text-xs text-muted-foreground font-mono sticky left-0 bg-background">{rowIdx + 1}</TableCell>
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
                  )}
                </CardContent>
              </Card>

              {/* Right: Extracted Tariffs */}
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="py-2 px-3 border-b bg-muted/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />Extracted Tariffs
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
                          const energyRates = getEnergyRates(displayTariff.tariff_rates || []);
                          const basicCharge = getBasicCharge(displayTariff.tariff_rates || []);
                          const demandCharge = getDemandCharge(displayTariff.tariff_rates || []);

                          return (
                            <Card key={tariff.id} className={`text-xs ${isEditing ? "ring-2 ring-primary" : ""}`}>
                              <CardHeader className="py-2 px-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-medium text-sm">{tariff.name}</div>
                                    <div className="text-muted-foreground">{tariff.category}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[10px]">{tariff.structure}</Badge>
                                    {isEditing ? (
                                      <>
                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={cancelEditing} disabled={isSaving}><X className="h-3 w-3" /></Button>
                                        <Button variant="default" size="sm" className="h-6 px-2 text-xs gap-1" onClick={saveEditedTariff} disabled={isSaving}>
                                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
                                        </Button>
                                      </>
                                    ) : (
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => startEditing(tariff)}><Pencil className="h-3 w-3" />Edit</Button>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 px-3 border-t space-y-2">
                                {isEditing ? (
                                  <>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Phase</Label>
                                        <Select value={displayTariff.phase || ""} onValueChange={(v) => updateEditedTariff("phase", v || null)}>
                                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                          <SelectContent className="bg-popover">
                                            <SelectItem value="Single Phase">Single Phase</SelectItem>
                                            <SelectItem value="Three Phase">Three Phase</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-[10px] text-muted-foreground">Structure</Label>
                                        <Select value={displayTariff.structure} onValueChange={(v) => updateEditedTariff("structure", v)}>
                                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                          <SelectContent className="bg-popover">
                                            <SelectItem value="flat">Flat</SelectItem>
                                            <SelectItem value="inclining_block">IBT</SelectItem>
                                            <SelectItem value="time_of_use">TOU</SelectItem>
                                            <SelectItem value="demand">Demand</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    {energyRates.length > 0 && (
                                      <div className="pt-2 border-t">
                                        <Label className="text-[10px] text-muted-foreground">Energy Rates</Label>
                                        <div className="space-y-1 mt-1">
                                          {displayTariff.tariff_rates.map((rate, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-muted/50 p-1 rounded">
                                              <Badge variant="outline" className="text-[9px] w-14 justify-center">{rate.charge}</Badge>
                                              <Input
                                                type="number" step="0.01" className="h-6 text-xs w-20"
                                                value={rate.amount}
                                                onChange={(e) => updateEditedRate(idx, "amount", parseFloat(e.target.value) || 0)}
                                              />
                                              <span className="text-[10px] text-muted-foreground">{rate.unit}</span>
                                              {rate.tou !== "all" && <Badge variant="secondary" className="text-[9px]">{rate.tou}</Badge>}
                                              {rate.season !== "all" && <Badge variant="secondary" className="text-[9px]">{rate.season}</Badge>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      {basicCharge && (
                                        <div>
                                          <span className="text-muted-foreground">Basic Charge:</span>{" "}
                                          <span className="font-medium text-green-600">R{basicCharge.amount.toFixed(2)}/m</span>
                                        </div>
                                      )}
                                      {demandCharge && (
                                        <div>
                                          <span className="text-muted-foreground">Demand Charge:</span>{" "}
                                          <span className="font-medium text-green-600">R{demandCharge.amount.toFixed(2)}/kVA</span>
                                        </div>
                                      )}
                                      {displayTariff.phase && (
                                        <div><span className="text-muted-foreground">Phase:</span> {displayTariff.phase}</div>
                                      )}
                                    </div>
                                    {energyRates.length > 0 && (
                                      <div className="mt-2 pt-2 border-t">
                                        <div className="text-muted-foreground mb-1">Energy Rates:</div>
                                        <div className="space-y-0.5">
                                          {energyRates.map((rate, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-muted/50 px-2 py-0.5 rounded">
                                              <span className={`font-medium ${
                                                rate.tou === "peak" ? "text-red-600" :
                                                rate.tou === "standard" ? "text-foreground" :
                                                rate.tou === "off_peak" ? "text-green-600" :
                                                "text-foreground"
                                              }`}>
                                                {rate.tou !== "all" ? rate.tou : "Flat"}
                                                {rate.season !== "all" && ` (${rate.season})`}
                                                {rate.block_min_kwh !== null && rate.block_max_kwh !== null && (
                                                  <span className="text-muted-foreground ml-1">({rate.block_min_kwh}-{rate.block_max_kwh} kWh)</span>
                                                )}
                                                {rate.block_min_kwh !== null && rate.block_max_kwh === null && (
                                                  <span className="text-muted-foreground ml-1">({'>'}{rate.block_min_kwh} kWh)</span>
                                                )}
                                              </span>
                                              <span className="font-mono">
                                                {rate.unit === "R/kWh" ? `${(rate.amount * 100).toFixed(2)} c/kWh` : `${rate.amount.toFixed(2)} ${rate.unit}`}
                                              </span>
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
            <div className="text-center py-8 text-muted-foreground">No preview data available</div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
