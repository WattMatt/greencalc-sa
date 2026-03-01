import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, RotateCcw } from "lucide-react";
import { SourceGuaranteesDialog } from "./SourceGuaranteesDialog";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { MonthData } from "./GenerationTab";

interface GuaranteedGenerationCardProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
  onDataChanged: () => void;
}

export function GuaranteedGenerationCard({ projectId, month, year, monthData, onDataChanged }: GuaranteedGenerationCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      // Delete all source guarantees for this month/year
      const { error: deleteError } = await supabase
        .from("generation_source_guarantees")
        .delete()
        .eq("project_id", projectId)
        .eq("month", month)
        .eq("year", year);
      if (deleteError) throw deleteError;

      // Clear guaranteed_kwh on generation_records
      const { error: updateError } = await supabase
        .from("generation_records")
        .update({ guaranteed_kwh: null })
        .eq("project_id", projectId)
        .eq("month", month)
        .eq("year", year);
      if (updateError) throw updateError;

      toast.success("Guarantee data cleared");
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset guarantees");
    } finally {
      setIsResetting(false);
    }
  };
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Guaranteed Generation (kWh)
            <div className="flex items-center gap-1">
              {monthData.guaranteed_kwh != null && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      disabled={isResetting}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Guarantee Data</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all source guarantee values and associations for {monthData.fullName} {year}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDialogOpen(true)}
              >
                <Settings className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground w-auto">{monthData.fullName} {year}</Label>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {monthData.guaranteed_kwh != null
              ? monthData.guaranteed_kwh.toLocaleString("en-ZA")
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Sum of all source guarantees
          </p>
        </CardContent>
      </Card>
      <SourceGuaranteesDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={projectId}
        month={month}
        year={year}
        onSaved={onDataChanged}
      />
    </>
  );
}
