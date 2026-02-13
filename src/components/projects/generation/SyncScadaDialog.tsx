import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Download, Loader2 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface MeterInfo {
  entityId: string;
  serial: string;
  name: string;
  classId: string;
}

interface SyncScadaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onDataSynced: () => void;
}

export function SyncScadaDialog({ open, onOpenChange, projectId, onDataSynced }: SyncScadaDialogProps) {
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [metersLoaded, setMetersLoaded] = useState(false);

  const lastMonth = subMonths(new Date(), 1);
  const [startDate, setStartDate] = useState(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(lastMonth), "yyyy-MM-dd"));

  const loadMeters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-pnpscada", {
        body: { action: "list-meters" },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to list meters");

      setMeters(data.meters || []);
      setMetersLoaded(true);
      toast.success(`Found ${data.meters?.length || 0} meters`);
    } catch (err: any) {
      toast.error(err.message || "Failed to load meters");
    } finally {
      setLoading(false);
    }
  };

  const toggleMeter = (serial: string) => {
    setSelectedSerials(prev => {
      const next = new Set(prev);
      if (next.has(serial)) next.delete(serial);
      else next.add(serial);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedSerials.size === meters.length) {
      setSelectedSerials(new Set());
    } else {
      setSelectedSerials(new Set(meters.map(m => m.serial)));
    }
  };

  const downloadSelected = async () => {
    if (selectedSerials.size === 0) {
      toast.error("Select at least one meter");
      return;
    }

    setDownloading(true);
    try {
      const serials = Array.from(selectedSerials);
      const { data, error } = await supabase.functions.invoke("fetch-pnpscada", {
        body: { action: "download-all", serials, startDate, endDate },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Download failed");

      const results = data.results || [];
      let successCount = 0;
      let errorCount = 0;

      // Process each CSV through the existing ingestion pipeline
      for (const result of results) {
        if (result.error || !result.csvData) {
          errorCount++;
          continue;
        }

        try {
          const meterInfo = meters.find(m => m.serial === result.serial);
          const { data: processData, error: processError } = await supabase.functions.invoke("process-scada-profile", {
            body: {
              csvContent: result.csvData,
              projectId,
              source: `scada-${meterInfo?.name || result.serial}`,
              mode: "generation",
            },
          });

          if (processError) throw processError;
          successCount++;
        } catch (processErr) {
          console.error(`Failed to process meter ${result.serial}:`, processErr);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Synced ${successCount} meter(s) successfully`);
        onDataSynced();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} meter(s) failed to process`);
      }
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync SCADA Data</DialogTitle>
          <DialogDescription>
            Download meter profile data from PNP SCADA and import into generation readings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">End Date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Load meters button */}
          {!metersLoaded && (
            <Button onClick={loadMeters} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {loading ? "Loading meters..." : "Load Available Meters"}
            </Button>
          )}

          {/* Meter list */}
          {metersLoaded && meters.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{meters.length} meters found</span>
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedSerials.size === meters.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
                {meters.map(meter => (
                  <label
                    key={meter.serial}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedSerials.has(meter.serial)}
                      onCheckedChange={() => toggleMeter(meter.serial)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{meter.name}</div>
                      <div className="text-xs text-muted-foreground">Serial: {meter.serial}</div>
                    </div>
                  </label>
                ))}
              </div>

              <Button
                onClick={downloadSelected}
                disabled={downloading || selectedSerials.size === 0}
                className="w-full"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {downloading
                  ? "Downloading & Processing..."
                  : `Download ${selectedSerials.size} Meter(s)`}
              </Button>
            </>
          )}

          {metersLoaded && meters.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No meters found. Try the debug action to inspect the overview page.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
