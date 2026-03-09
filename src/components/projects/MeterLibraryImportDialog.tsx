import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { parseMeterLabel } from "@/utils/meterLabelParser";
import { Database, Loader2 } from "lucide-react";

interface MeterLibraryImportDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

interface MeterRow {
  id: string;
  site_name: string;
  shop_name: string | null;
  shop_number: string | null;
  meter_label: string | null;
  meter_color: string | null;
  data_points: number | null;
  area_sqm: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  file_name: string | null;
  value_unit: string | null;
  detected_interval_minutes: number | null;
  weekday_days: number | null;
  weekend_days: number | null;
  csv_file_path: string | null;
}

interface ParsedRow {
  meter: MeterRow;
  shopName: string;
  shopNumber: string | null;
  areaSqm: number;
  prefix: string | null;
  selected: boolean;
}

export function MeterLibraryImportDialog({ open, onClose, projectId }: MeterLibraryImportDialogProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [initialised, setInitialised] = useState(false);

  // Fetch global (unassigned) meters
  const { data: globalMeters, isLoading } = useQuery({
    queryKey: ["global-meters-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_name, shop_number, meter_label, meter_color, data_points, area_sqm, date_range_start, date_range_end, file_name, value_unit, detected_interval_minutes, weekday_days, weekend_days, csv_file_path")
        .is("project_id", null)
        .gt("data_points", 0)
        .order("site_name", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data as MeterRow[];
    },
    enabled: open,
  });

  // Build parsed rows when meters load
  useEffect(() => {
    if (globalMeters && !initialised) {
      setRows(
        globalMeters.map((m) => {
          const parsed = parseMeterLabel(m.meter_label || m.shop_name, m.site_name);
          return {
            meter: m,
            shopName: parsed.shopName,
            shopNumber: parsed.shopNumber || m.shop_number || null,
            areaSqm: parsed.areaSqm || m.area_sqm || 0,
            prefix: parsed.prefix,
            selected: false,
          };
        })
      );
      setInitialised(true);
    }
  }, [globalMeters, initialised]);

  // Reset when dialog closes
  const handleClose = () => {
    setInitialised(false);
    setRows([]);
    onClose();
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const toggleRow = (idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  };

  const updateField = (idx: number, field: "shopName" | "areaSqm", value: string) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (field === "areaSqm") return { ...r, areaSqm: parseFloat(value) || 0 };
        return { ...r, [field]: value };
      })
    );
  };

  const createTenants = useMutation({
    mutationFn: async () => {
      const selected = rows.filter((r) => r.selected);
      if (!selected.length) throw new Error("No meters selected");

      for (const row of selected) {
        const m = row.meter;

        // 1. Fetch raw_data for this meter individually
        const { data: fullMeter, error: fetchErr } = await supabase
          .from("scada_imports")
          .select("raw_data, load_profile_weekday, load_profile_weekend")
          .eq("id", m.id)
          .single();

        if (fetchErr) throw fetchErr;

        // 2. Create a project-local copy of the meter
        const { data: localMeter, error: meterErr } = await supabase
          .from("scada_imports")
          .insert({
            site_name: m.site_name,
            shop_name: row.shopName,
            shop_number: row.shopNumber,
            meter_label: m.meter_label,
            meter_color: m.meter_color,
            project_id: projectId,
            data_points: m.data_points,
            area_sqm: row.areaSqm,
            load_profile_weekday: fullMeter.load_profile_weekday,
            load_profile_weekend: fullMeter.load_profile_weekend,
            date_range_start: m.date_range_start,
            date_range_end: m.date_range_end,
            raw_data: fullMeter.raw_data as any,
            file_name: m.file_name,
            value_unit: m.value_unit,
            detected_interval_minutes: m.detected_interval_minutes,
            weekday_days: m.weekday_days,
            weekend_days: m.weekend_days,
            csv_file_path: m.csv_file_path,
          })
          .select("id")
          .single();

        if (meterErr) throw meterErr;

        // 2. Create the tenant record linked to the local meter
        const { error: tenantErr } = await supabase
          .from("project_tenants")
          .insert({
            project_id: projectId,
            name: row.shopName,
            shop_name: row.shopName,
            shop_number: row.shopNumber,
            area_sqm: row.areaSqm,
            scada_import_id: localMeter.id,
            include_in_load_profile: true,
            is_virtual: false,
          });

        if (tenantErr) throw tenantErr;
      }

      return selected.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["project-meters"] });
      queryClient.invalidateQueries({ queryKey: ["global-meters-for-import"] });
      toast.success(`Created ${count} tenant${count > 1 ? "s" : ""} with meter assignments`);
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import Tenants from Meter Library
          </DialogTitle>
          <DialogDescription>
            Select meters to auto-create tenants. Names and areas are extracted from meter labels — review and edit before confirming.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !rows.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No unassigned meters with data found in the library.</p>
          </div>
        ) : (
          <>
            <div className="overflow-auto flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="w-10">
                       <Checkbox
                         checked={selectedCount === rows.length}
                         onCheckedChange={(c) => toggleAll(!!c)}
                       />
                     </TableHead>
                     <TableHead className="w-16">Prefix</TableHead>
                     <TableHead>Meter Label</TableHead>
                    <TableHead>Tenant Name</TableHead>
                    <TableHead className="w-28">Area (m²)</TableHead>
                    <TableHead className="w-28">Data Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.meter.id} className={row.selected ? "bg-accent/30" : ""}>
                       <TableCell>
                         <Checkbox
                           checked={row.selected}
                           onCheckedChange={() => toggleRow(idx)}
                         />
                       </TableCell>
                       <TableCell>
                         {row.prefix ? (
                           <Badge variant="outline" className="text-xs font-mono">
                             {row.prefix}
                           </Badge>
                         ) : null}
                       </TableCell>
                       <TableCell className="text-xs text-muted-foreground font-mono max-w-48 truncate">
                        {row.meter.meter_label || row.meter.shop_name || row.meter.site_name}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.shopName}
                          onChange={(e) => updateField(idx, "shopName", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.areaSqm || ""}
                          onChange={(e) => updateField(idx, "areaSqm", e.target.value)}
                          className="h-8 text-sm"
                          min={0}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {row.meter.data_points?.toLocaleString() || 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} of {rows.length} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  disabled={!selectedCount || createTenants.isPending}
                  onClick={() => createTenants.mutate()}
                >
                  {createTenants.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Create {selectedCount} Tenant{selectedCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
