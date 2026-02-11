import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Save, Building2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { parseCSVFiles } from "./csvUtils";
import { CSVPreviewDialog } from "./CSVPreviewDialog";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
  source: string | null;
}

interface BuildingLoadCardProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
  onDataChanged: () => void;
}

export function BuildingLoadCard({ projectId, month, year, monthData, onDataChanged }: BuildingLoadCardProps) {
  const [value, setValue] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvDialogLines, setCsvDialogLines] = useState<string[]>([]);
  const [pendingFileCount, setPendingFileCount] = useState(0);

  const displayValue = value !== null ? value : (monthData.building_load_kwh?.toString() ?? "");

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
          building_load_kwh: parseFloat(value),
        }, { onConflict: "project_id,month,year" });
      if (error) throw error;
      toast.success(`Building load saved for ${monthData.fullName}`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const saveCSVTotals = async (totals: Map<number, number>, fileCount: number, dailyTotals?: Map<string, number>) => {
    const months = Array.from(totals.keys());
    const { data: existing } = await supabase
      .from("generation_records")
      .select("month, building_load_kwh")
      .eq("project_id", projectId)
      .eq("year", year)
      .in("month", months);

    const existingMap = new Map((existing ?? []).map((r) => [r.month, r]));
    let totalAdded = 0;

    for (const [m, csvSum] of totals) {
      const prev = existingMap.get(m);
      const newTotal = (prev?.building_load_kwh ?? 0) + csvSum;
      totalAdded += csvSum;

      const { error } = await supabase
        .from("generation_records")
        .upsert({
          project_id: projectId,
          month: m,
          year,
          building_load_kwh: newTotal,
        }, { onConflict: "project_id,month,year" });
      if (error) throw error;
    }

    // Save daily records
    if (dailyTotals && dailyTotals.size > 0) {
      for (const [dateKey, kwh] of dailyTotals) {
        const [y, m] = dateKey.split("-").map(Number);
        const { data: existingDaily } = await supabase
          .from("generation_daily_records")
          .select("building_load_kwh")
          .eq("project_id", projectId)
          .eq("date", dateKey)
          .maybeSingle();

        const newKwh = (existingDaily?.building_load_kwh ?? 0) + kwh;
        const { error } = await supabase
          .from("generation_daily_records")
          .upsert({
            project_id: projectId,
            date: dateKey,
            year: y,
            month: m,
            building_load_kwh: newKwh,
          }, { onConflict: "project_id,date" });
        if (error) throw error;
      }
    }

    toast.success(`Added ${totalAdded.toLocaleString()} kWh from ${fileCount} file(s)`);
    setValue(null);
    onDataChanged();
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const text = await files[0].text();
      const allLines = text.split("\n").filter((l) => l.trim());
      setCsvDialogLines(allLines);
      setPendingFileCount(files.length);
      setCsvDialogOpen(true);
    } catch (err: any) {
      toast.error(err.message || "CSV import failed");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleManualParsed = async (totals: Map<number, number>, dailyTotals: Map<string, number>) => {
    try {
      await saveCSVTotals(totals, pendingFileCount, dailyTotals);
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
          building_load_kwh: null,
        }, { onConflict: "project_id,month,year" });
      if (error) throw error;
      toast.success(`Reset building load for ${monthData.fullName}`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset");
    }
  };

  const hasEdit = value !== null && value !== (monthData.building_load_kwh?.toString() ?? "");

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Building Load (kWh)
            </span>
            <div className="flex gap-1">
              {monthData.building_load_kwh != null && (
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
        </CardContent>
      </Card>
      <CSVPreviewDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        csvLines={csvDialogLines}
        onParsed={handleManualParsed}
      />
    </>
  );
}
