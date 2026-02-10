import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { parseCSVFiles } from "./csvUtils";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  source: string | null;
}

interface ActualGenerationCardProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
  onDataChanged: () => void;
}

export function ActualGenerationCard({ projectId, month, year, monthData, onDataChanged }: ActualGenerationCardProps) {
  const [value, setValue] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayValue = value !== null ? value : (monthData.actual_kwh?.toString() ?? "");

  const handleSave = async () => {
    if (value === null || value === "") return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("generation_records")
        .upsert({
          project_id: projectId,
          month,
          year,
          actual_kwh: parseFloat(value),
          source: "manual",
        }, { onConflict: "project_id,month,year" });
      if (error) throw error;
      toast.success(`Actual generation saved for ${monthData.fullName}`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const totals = await parseCSVFiles(files, /kwh|energy|generation|actual/i);

      if (totals.size === 0) {
        toast.error("No valid month/kWh data found in CSV(s)");
        return;
      }

      // Fetch existing records for all months in one query
      const months = Array.from(totals.keys());
      const { data: existing } = await supabase
        .from("generation_records")
        .select("month, actual_kwh, source")
        .eq("project_id", projectId)
        .eq("year", year)
        .in("month", months);

      const existingMap = new Map(
        (existing ?? []).map((r) => [r.month, r])
      );

      let totalAdded = 0;

      for (const [m, csvSum] of totals) {
        const prev = existingMap.get(m);
        const newTotal = (prev?.actual_kwh ?? 0) + csvSum;
        totalAdded += csvSum;

        // Track CSV count in source field
        const prevSource = prev?.source ?? "";
        const prevCount = prevSource.startsWith("csv:") ? parseInt(prevSource.split(":")[1]) || 0 : prevSource === "csv" ? 1 : 0;
        const newCount = prevCount + files.length;

        const { error } = await supabase
          .from("generation_records")
          .upsert({
            project_id: projectId,
            month: m,
            year,
            actual_kwh: newTotal,
            source: `csv:${newCount}`,
          }, { onConflict: "project_id,month,year" });
        if (error) throw error;
      }

      toast.success(`Added ${totalAdded.toLocaleString()} kWh from ${files.length} file(s)`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "CSV import failed");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = async () => {
    try {
      const { error } = await supabase
        .from("generation_records")
        .upsert({
          project_id: projectId,
          month,
          year,
          actual_kwh: null,
          source: null,
        }, { onConflict: "project_id,month,year" });
      if (error) throw error;
      toast.success(`Reset actual generation for ${monthData.fullName}`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset");
    }
  };

  const hasEdit = value !== null && value !== (monthData.actual_kwh?.toString() ?? "");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          Actual Generation (kWh)
          <div className="flex gap-1">
            {monthData.actual_kwh != null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleReset}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3 mr-1" /> CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={handleCSVUpload}
            />
            {hasEdit && (
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}>
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground w-auto">{monthData.fullName} {year}</Label>
        </div>
        <Input
          type="number"
          className="text-sm"
          placeholder="Enter kWh"
          value={displayValue}
          onChange={(e) => setValue(e.target.value)}
        />
        {monthData.source && (
          <p className="text-xs text-muted-foreground">
            Source: {monthData.source}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
