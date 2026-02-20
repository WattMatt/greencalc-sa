import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, Check, FileUp, AlertTriangle } from "lucide-react";
import { CsvImportWizard, WizardParseConfig } from "./CsvImportWizard";
import { processCSVToLoadProfile } from "./utils/csvToLoadProfile";

interface MeterReimportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  meterId: string;
  meterName: string;
  originalFileName: string | null;
  siteId?: string;
}

export function MeterReimportDialog({
  isOpen,
  onClose,
  meterId,
  meterName,
  originalFileName,
  siteId,
}: MeterReimportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setRowCount(content.split('\n').filter(l => l.trim()).length);
      // Open the parse dialog for manual configuration
      setDialogOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleWizardProcess = useCallback(async (
    config: WizardParseConfig, 
    parsedData: { headers: string[]; rows: string[][] }
  ) => {
    setIsProcessing(true);
    setDialogOpen(false);

    try {
      // Process CSV data into load profiles using our utility
      const profile = processCSVToLoadProfile(parsedData.headers, parsedData.rows, config);
      
      // Build raw data from parsed rows using wizard config indices (not header detection)
      const headers = parsedData.headers.map(h => h.toLowerCase());
      const dateIdx = config.dateColumnIndex ?? headers.findIndex(h => h.includes('date') || h === 'rdate');
      const timeIdx = config.timeColumnIndex ?? headers.findIndex(h => h.includes('time') || h === 'rtime');
      const valueIdx = config.valueColumnIndex ?? headers.findIndex(h => h.includes('kwh') || h.includes('value') || h.includes('active'));
      
      const rawData = parsedData.rows.map(row => ({
        timestamp: `${row[dateIdx] || ''} ${timeIdx >= 0 ? (row[timeIdx] || '') : ''}`.trim(),
        value: parseFloat(row[valueIdx]?.replace(/[^\d.-]/g, '') || '0') || 0
      })).filter(d => d.value !== 0 || d.timestamp);

      // Check if we got meaningful data
      const hasNonZeroValues = rawData.some(d => d.value !== 0);
      
      if (!hasNonZeroValues) {
        toast.warning("All values are zero. Please check you selected the correct value column.", {
          description: "The data was processed but contains only zero values."
        });
      }

      // Update the meter with new raw_data and recalculated profiles
      const { error: updateError } = await supabase
        .from("scada_imports")
        .update({
          raw_data: rawData,
          data_points: profile.dataPoints,
          date_range_start: profile.dateRangeStart,
          date_range_end: profile.dateRangeEnd,
          weekday_days: profile.weekdayDays,
          weekend_days: profile.weekendDays,
          load_profile_weekday: profile.weekdayProfile,
          load_profile_weekend: profile.weekendProfile,
          file_name: fileName,
        })
        .eq("id", meterId);

      if (updateError) throw updateError;

      toast.success(`Re-imported ${meterName} with ${profile.dataPoints.toLocaleString()} readings`, {
        description: hasNonZeroValues 
          ? "Data successfully updated with non-zero values"
          : "Warning: All values are zero"
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["site-meters"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });

      // Close dialog
      onClose();
      setCsvContent(null);
      setFileName("");

    } catch (error) {
      console.error("Re-import failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to re-import CSV");
      setDialogOpen(true); // Re-open for retry
    } finally {
      setIsProcessing(false);
    }
  }, [meterId, meterName, fileName, queryClient, onClose]);

  const handleClose = () => {
    setCsvContent(null);
    setFileName("");
    setDialogOpen(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Re-import Meter Data
            </DialogTitle>
            <DialogDescription>
              Upload a new CSV to replace the incorrectly parsed data for this meter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {meterName}
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    The original import detected wrong columns. Upload the CSV again and manually select the correct value column.
                  </p>
                </div>
              </div>
            </div>

            {originalFileName && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Original file:</span> {originalFileName}
              </div>
            )}

            <div className="space-y-2">
              <Label>Upload CSV File</Label>
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
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileUp className="h-8 w-8" />
                    <span>Click to upload CSV</span>
                    <span className="text-xs">You'll select columns manually</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CsvImportWizard
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setCsvContent(null);
        }}
        csvContent={csvContent}
        fileName={fileName}
        onProcess={handleWizardProcess}
        isProcessing={isProcessing}
      />
    </>
  );
}
