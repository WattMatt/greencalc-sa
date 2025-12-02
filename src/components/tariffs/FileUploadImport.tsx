import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, FileText, Search, Download, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

interface AnalysisResult {
  fileType: string;
  sheets?: string[];
  rowCounts?: Record<string, number>;
  analysis: string;
  sampleText?: string;
}

interface ImportResult {
  extracted: number;
  imported: number;
  skipped: number;
  municipalities: string[];
  errors: string[];
}

export function FileUploadImport() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [province, setProvince] = useState("Western Cape");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
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
    setImportResult(null);
    setUploadedPath(null);

    // Upload file to storage
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
      toast({ title: "Analysis Complete", description: "Review the structure before importing" });
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

  const handleImport = async () => {
    if (!uploadedPath || !file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: { 
          filePath: uploadedPath, 
          fileType: getFileType(file.name),
          province: province.trim(),
          action: "extract" 
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setImportResult(data);
      
      if (data.imported > 0) {
        toast({ 
          title: "Import Successful", 
          description: `Imported ${data.imported} tariffs from ${data.municipalities?.length || 0} municipalities` 
        });
        queryClient.invalidateQueries({ queryKey: ["tariffs"] });
        queryClient.invalidateQueries({ queryKey: ["municipalities"] });
        queryClient.invalidateQueries({ queryKey: ["provinces"] });
        queryClient.invalidateQueries({ queryKey: ["tariff-categories"] });
      }
    } catch (err) {
      console.error("Import error:", err);
      toast({
        title: "Import Failed",
        description: err instanceof Error ? err.message : "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setUploadedPath(null);
    setAnalysis(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearFile = () => {
    resetState();
  };

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
            Upload Tariff File
          </DialogTitle>
          <DialogDescription>
            Upload Excel or PDF files containing tariff data. AI will analyze and extract the tariffs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
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
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFile}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Province Input */}
          <div className="space-y-2">
            <Label htmlFor="file-province">Province Name</Label>
            <Input
              id="file-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="e.g., Western Cape, Gauteng"
            />
            <p className="text-xs text-muted-foreground">
              All municipalities in this file will be assigned to this province
            </p>
          </div>

          {/* Analyze Button */}
          {uploadedPath && !analysis && (
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
          )}

          {/* Analysis Results */}
          {analysis && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {analysis.fileType === 'pdf' ? (
                    <FileText className="h-4 w-4 text-red-500" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  )}
                  File Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.sheets && analysis.sheets.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sheets Found</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.sheets.map((sheet) => (
                        <span key={sheet} className="px-2 py-0.5 bg-muted rounded text-xs">
                          {sheet} ({analysis.rowCounts?.[sheet] || 0} rows)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">AI Analysis</Label>
                  <ScrollArea className="h-40 mt-1">
                    <div className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">
                      {analysis.analysis}
                    </div>
                  </ScrollArea>
                </div>

                <Button 
                  onClick={handleImport} 
                  disabled={isImporting}
                  className="w-full gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Extracting with AI...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Extract & Import Tariffs
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Import Results */}
          {importResult && (
            <Alert className={importResult.imported > 0 ? "border-green-500" : "border-yellow-500"}>
              {importResult.imported > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-4 text-sm font-medium">
                    <span>AI Extracted: {importResult.extracted}</span>
                    <span className="text-green-600">Imported: {importResult.imported}</span>
                    {importResult.skipped > 0 && (
                      <span className="text-yellow-600">Skipped: {importResult.skipped}</span>
                    )}
                  </div>
                  {importResult.municipalities && importResult.municipalities.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Municipalities: {importResult.municipalities.slice(0, 5).join(", ")}
                      {importResult.municipalities.length > 5 && ` +${importResult.municipalities.length - 5} more`}
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {importResult.errors.slice(0, 3).map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                      {importResult.errors.length > 3 && (
                        <div>...and {importResult.errors.length - 3} more issues</div>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
