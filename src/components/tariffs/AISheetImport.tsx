import { useState } from "react";
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
import { Sparkles, FileSpreadsheet, Search, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface AnalysisResult {
  title: string;
  tabs: string[];
  rowCounts: Record<string, number>;
  analysis: string;
  sampleData: Record<string, string[][]>;
}

interface ImportResult {
  extracted: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export function AISheetImport() {
  const [open, setOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const extractSheetId = (url: string): string | null => {
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /^([a-zA-Z0-9-_]+)$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleAnalyze = async () => {
    const sheetId = extractSheetId(sheetUrl.trim());
    if (!sheetId) {
      toast({ title: "Invalid URL", description: "Please enter a valid Google Sheets URL", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-import-sheet", {
        body: { sheetId, action: "analyze" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAnalysis(data);
      toast({ title: "Analysis Complete", description: `Found ${data.tabs.length} tabs in the sheet` });
    } catch (err) {
      console.error("Analysis error:", err);
      toast({ 
        title: "Analysis Failed", 
        description: err instanceof Error ? err.message : "Failed to analyze sheet",
        variant: "destructive" 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    const sheetId = extractSheetId(sheetUrl.trim());
    if (!sheetId) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-import-sheet", {
        body: { sheetId, action: "extract" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setImportResult(data);
      
      if (data.imported > 0) {
        toast({ title: "Import Successful", description: `Imported ${data.imported} tariffs` });
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
        variant: "destructive" 
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setAnalysis(null);
    setImportResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Import from Google Sheets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI-Powered Tariff Import
          </DialogTitle>
          <DialogDescription>
            AI will analyze your Google Sheet and automatically extract provinces, municipalities, and tariff structures
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Sheet URL Input */}
          <div className="space-y-2">
            <Label htmlFor="ai-sheet-url">Google Sheet URL or ID</Label>
            <div className="flex gap-2">
              <Input
                id="ai-sheet-url"
                value={sheetUrl}
                onChange={(e) => { setSheetUrl(e.target.value); resetState(); }}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1"
              />
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || !sheetUrl.trim()}
                variant="secondary"
                className="gap-2"
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyze
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The sheet must be publicly shared (Anyone with the link can view)
            </p>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {analysis.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tabs */}
                <div>
                  <Label className="text-xs text-muted-foreground">Tabs Found</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {analysis.tabs.map((tab) => (
                      <span key={tab} className="px-2 py-0.5 bg-muted rounded text-xs">
                        {tab} ({analysis.rowCounts[tab]} rows)
                      </span>
                    ))}
                  </div>
                </div>

                {/* AI Analysis */}
                <div>
                  <Label className="text-xs text-muted-foreground">AI Analysis</Label>
                  <ScrollArea className="h-40 mt-1">
                    <div className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">
                      {analysis.analysis}
                    </div>
                  </ScrollArea>
                </div>

                {/* Import Button */}
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
                  <div className="flex gap-4 text-sm font-medium">
                    <span>AI Extracted: {importResult.extracted}</span>
                    <span className="text-green-600">Imported: {importResult.imported}</span>
                    {importResult.skipped > 0 && (
                      <span className="text-yellow-600">Skipped: {importResult.skipped}</span>
                    )}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="text-xs text-muted-foreground">
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
