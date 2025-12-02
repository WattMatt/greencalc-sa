import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Info } from "lucide-react";

interface ImportResult {
  imported: number;
  skipped: number;
  tabsProcessed: number;
  tabs: string[];
  errors: string[];
}

export function GoogleSheetsImport() {
  const [open, setOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [province, setProvince] = useState("South Africa");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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

  const handleImport = async () => {
    const sheetId = extractSheetId(sheetUrl.trim());
    
    if (!sheetId) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Google Sheets URL or ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("import-google-sheet", {
        body: { sheetId, province: province.trim() || "South Africa" },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Import Failed",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setResult({
          imported: data.imported,
          skipped: data.skipped,
          tabsProcessed: data.tabsProcessed || 0,
          tabs: data.tabs || [],
          errors: data.errors || [],
        });
        
        if (data.imported > 0) {
          toast({
            title: "Import Successful",
            description: `Imported ${data.imported} tariffs from ${data.tabsProcessed} municipalities`,
          });
          queryClient.invalidateQueries({ queryKey: ["tariffs"] });
          queryClient.invalidateQueries({ queryKey: ["municipalities"] });
          queryClient.invalidateQueries({ queryKey: ["tariff-categories"] });
          queryClient.invalidateQueries({ queryKey: ["provinces"] });
        }
      }
    } catch (err) {
      console.error("Import error:", err);
      toast({
        title: "Import Failed",
        description: err instanceof Error ? err.message : "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Import from Google Sheets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Tariffs from Google Sheets
          </DialogTitle>
          <DialogDescription>
            Import tariff data from a Google Sheet shared with the service account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Each tab = one municipality.</strong> Tab names become municipality names.
              <br />
              <strong>Required columns:</strong> category, tariff_name (or name), tariff_type
              <br />
              <strong>Optional:</strong> phase_type, fixed_monthly_charge, rate_per_kwh, block_start_kwh, block_end_kwh, season, time_of_use
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="sheet-url">Google Sheet URL or ID</Label>
            <Input
              id="sheet-url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
            <p className="text-xs text-muted-foreground">
              The sheet must be shared with the service account email
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Input
              id="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="South Africa"
            />
            <p className="text-xs text-muted-foreground">
              All municipalities will be assigned to this province
            </p>
          </div>

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {result.imported} tariffs imported
                </span>
                <span className="text-muted-foreground">
                  from {result.tabsProcessed} municipalities
                </span>
                {result.skipped > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    {result.skipped} skipped
                  </span>
                )}
              </div>
              {result.tabs.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Municipalities: {result.tabs.slice(0, 5).join(", ")}
                  {result.tabs.length > 5 && ` +${result.tabs.length - 5} more`}
                </p>
              )}
              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {result.errors.slice(0, 3).map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                    {result.errors.length > 3 && (
                      <div>...and {result.errors.length - 3} more errors</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={isLoading || !sheetUrl.trim()}
            className="w-full gap-2"
          >
            {isLoading ? (
              <>Importing...</>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import All Tabs
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
