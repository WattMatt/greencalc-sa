import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface SourceGuarantee {
  id?: string;
  source_label: string;
  guaranteed_kwh: number;
  isNew?: boolean;
}

interface SourceGuaranteesDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  month: number;
  year: number;
  onSaved: () => void;
}

export function SourceGuaranteesDialog({
  open,
  onClose,
  projectId,
  month,
  year,
  onSaved,
}: SourceGuaranteesDialogProps) {
  const [rows, setRows] = useState<SourceGuarantee[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, projectId, month, year]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("generation_source_guarantees")
        .select("*")
        .eq("project_id", projectId)
        .eq("month", month)
        .eq("year", year)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setRows(
        (data ?? []).map((r: any) => ({
          id: r.id,
          source_label: r.source_label,
          guaranteed_kwh: Number(r.guaranteed_kwh),
        }))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to load guarantees");
    } finally {
      setIsLoading(false);
    }
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { source_label: "", guaranteed_kwh: 0, isNew: true },
    ]);
  };

  const updateRow = (index: number, field: keyof SourceGuarantee, value: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              [field]: field === "guaranteed_kwh" ? (value === "" ? 0 : parseFloat(value)) : value,
            }
          : r
      )
    );
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const total = rows.reduce((sum, r) => sum + (r.guaranteed_kwh || 0), 0);

  const handleSave = async () => {
    // Validate
    for (const r of rows) {
      if (!r.source_label.trim()) {
        toast.error("All source labels must be filled in");
        return;
      }
    }

    setIsSaving(true);
    try {
      // Delete all existing rows for this month and re-insert
      const { error: deleteError } = await supabase
        .from("generation_source_guarantees")
        .delete()
        .eq("project_id", projectId)
        .eq("month", month)
        .eq("year", year);
      if (deleteError) throw deleteError;

      if (rows.length > 0) {
        const inserts = rows.map((r) => ({
          project_id: projectId,
          month,
          year,
          source_label: r.source_label.trim(),
          guaranteed_kwh: r.guaranteed_kwh || 0,
        }));

        const { error: insertError } = await supabase
          .from("generation_source_guarantees")
          .insert(inserts);
        if (insertError) throw insertError;
      }

      // Sync total to generation_records
      const { error: upsertError } = await supabase
        .from("generation_records")
        .upsert(
          {
            project_id: projectId,
            month,
            year,
            guaranteed_kwh: total || null,
          },
          { onConflict: "project_id,month,year" }
        );
      if (upsertError) throw upsertError;

      toast.success("Guaranteed generation saved");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            Guaranteed Generation Sources
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Add a guarantee value for each generation source. The total is used as the system guarantee.
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="text-sm flex-1"
                    placeholder="Source label (e.g. Inverter 1)"
                    value={row.source_label}
                    onChange={(e) => updateRow(i, "source_label", e.target.value)}
                  />
                  <Input
                    type="number"
                    className="text-sm w-32"
                    placeholder="kWh"
                    value={row.guaranteed_kwh || ""}
                    onChange={(e) => updateRow(i, "guaranteed_kwh", e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addRow}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Source
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-medium">
              Total: {total.toLocaleString("en-ZA")} kWh
            </span>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
