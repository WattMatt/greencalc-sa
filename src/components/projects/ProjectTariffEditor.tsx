import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumericInput } from "@/components/ui/numeric-input";
import { toast } from "@/hooks/use-toast";
import { Pencil, RotateCcw, Save } from "lucide-react";

interface ProjectTariffEditorProps {
  projectId: string;
  tariffPlanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RateRow {
  charge: string;
  season: string;
  tou: string;
  amount: number;
  unit: string;
  block_number?: number | null;
  block_min_kwh?: number | null;
  block_max_kwh?: number | null;
}

export function ProjectTariffEditor({ projectId, tariffPlanId, open, onOpenChange }: ProjectTariffEditorProps) {
  const queryClient = useQueryClient();
  const [editedRates, setEditedRates] = useState<RateRow[]>([]);
  const [editedPlanFields, setEditedPlanFields] = useState<Record<string, number>>({});

  // Fetch original rates
  const { data: originalRates } = useQuery({
    queryKey: ["tariff-rates-original", tariffPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_rates")
        .select("*")
        .eq("tariff_plan_id", tariffPlanId);
      if (error) throw error;
      return data as RateRow[];
    },
    enabled: open && !!tariffPlanId,
  });

  // Fetch existing overrides
  const { data: existingOverride } = useQuery({
    queryKey: ["tariff-overrides", projectId, tariffPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tariff_overrides")
        .select("*")
        .eq("project_id", projectId)
        .eq("source_tariff_plan_id", tariffPlanId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!projectId && !!tariffPlanId,
  });

  // Initialise editor state from override or original
  useEffect(() => {
    if (!originalRates) return;
    const overrideRates = existingOverride?.overridden_rates as RateRow[] | null;
    const overridePlan = existingOverride?.overridden_plan_fields as Record<string, number> | null;
    setEditedRates(overrideRates ?? originalRates.map(r => ({ ...r })));
    setEditedPlanFields(overridePlan ?? {});
  }, [originalRates, existingOverride]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_tariff_overrides")
        .upsert(
          {
            project_id: projectId,
            source_tariff_plan_id: tariffPlanId,
            overridden_rates: editedRates as any,
            overridden_plan_fields: editedPlanFields as any,
          },
          { onConflict: "project_id,source_tariff_plan_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariff-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["tariff-rates"] });
      toast({ title: "Tariff overrides saved", description: "Project-specific rates have been applied." });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error saving overrides", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_tariff_overrides")
        .delete()
        .eq("project_id", projectId)
        .eq("source_tariff_plan_id", tariffPlanId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariff-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["tariff-rates"] });
      if (originalRates) setEditedRates(originalRates.map(r => ({ ...r })));
      setEditedPlanFields({});
      toast({ title: "Overrides removed", description: "Rates reset to the original tariff values." });
      onOpenChange(false);
    },
  });

  const updateRate = (index: number, amount: number) => {
    setEditedRates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], amount };
      return next;
    });
  };

  const seasonLabel = (s: string) =>
    s === "high" ? "High (Winter)" : s === "low" ? "Low (Summer)" : "All Year";
  const touLabel = (t: string) =>
    t === "peak" ? "Peak" : t === "standard" ? "Standard" : t === "off_peak" || t === "off_Peak" ? "Off-Peak" : "All";
  const chargeLabel = (c: string) =>
    c === "energy" ? "Energy" : c === "basic" ? "Basic/Fixed" : c === "demand" ? "Demand" : c === "reactive_energy" ? "Reactive" : c;

  // Group rates by charge type
  const energyRates = editedRates
    .map((r, i) => ({ ...r, _idx: i }))
    .filter(r => r.charge === "energy");
  const otherRates = editedRates
    .map((r, i) => ({ ...r, _idx: i }))
    .filter(r => r.charge !== "energy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit Project Tariff Rates
          </DialogTitle>
          <DialogDescription>
            Changes are saved for this project only and won't affect the original tariff database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Energy rates */}
          {energyRates.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Energy Rates (c/kWh)</h4>
              <div className="grid gap-2">
                {energyRates.map(r => (
                  <div key={r._idx} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                    <div className="flex-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{seasonLabel(r.season)}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{touLabel(r.tou)}</Badge>
                    </div>
                    <NumericInput
                      className="w-28 text-right"
                      value={r.amount}
                      onChange={(val) => updateRate(r._idx, val)}
                      fallback={0}
                      min={0}
                      step={0.01}
                    />
                    <span className="text-xs text-muted-foreground w-12">{r.unit || "c/kWh"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other charges */}
          {otherRates.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Other Charges</h4>
              <div className="grid gap-2">
                {otherRates.map(r => (
                  <div key={r._idx} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                    <div className="flex-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{chargeLabel(r.charge)}</Badge>
                      {r.season !== "all" && <Badge variant="secondary" className="text-[10px]">{seasonLabel(r.season)}</Badge>}
                      {r.tou !== "all" && <Badge variant="secondary" className="text-[10px]">{touLabel(r.tou)}</Badge>}
                    </div>
                    <NumericInput
                      className="w-28 text-right"
                      value={r.amount}
                      onChange={(val) => updateRate(r._idx, val)}
                      fallback={0}
                      min={0}
                      step={0.01}
                    />
                    <span className="text-xs text-muted-foreground w-12">{r.unit || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {existingOverride && (
            <Button
              variant="outline"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="mr-auto"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Original
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            Save Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hook to check if a project has active tariff overrides */
export function useProjectTariffOverride(projectId: string, tariffPlanId: string | null) {
  return useQuery({
    queryKey: ["tariff-overrides", projectId, tariffPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tariff_overrides")
        .select("*")
        .eq("project_id", projectId)
        .eq("source_tariff_plan_id", tariffPlanId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !!tariffPlanId,
  });
}
