import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Save, Building2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { parseCSVFiles } from "./csvUtils";
import { CSVPreviewDialog, type CSVReading } from "./CSVPreviewDialog";

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

  const saveCSVTotals = async (totals: Map<number, number>, fileCount: number, dailyTotals?: Map<string, number>, readings?: CSVReading[]) => {
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

    // Save raw readings - add to existing values
    if (readings && readings.length > 0) {
      const normalizeTs = (ts: string) => new Date(ts).toISOString();
      const batchSize = 500;
      for (let i = 0; i < readings.length; i += batchSize) {
        const batch = readings.slice(i, i + batchSize);
        const timestamps = batch.map((r) => r.timestamp);

        // Fetch existing readings for these timestamps - fetch both columns to preserve
        const { data: existingReadings } = await supabase
          .from("generation_readings")
          .select("timestamp, actual_kwh, building_load_kwh")
          .eq("project_id", projectId)
          .in("timestamp", timestamps);

        const existingMap = new Map(
          (existingReadings ?? []).map((r) => [normalizeTs(r.timestamp), r])
        );

        const upsertBatch = batch.map((r) => {
          const existing = existingMap.get(normalizeTs(r.timestamp));
          return {
            project_id: projectId,
            timestamp: r.timestamp,
            actual_kwh: existing?.actual_kwh ?? null,
            building_load_kwh: (existing?.building_load_kwh ?? 0) + r.kwh,
            source: "csv",
          };
        });

        const { error } = await supabase
          .from("generation_readings")
          .upsert(upsertBatch, { onConflict: "project_id,timestamp" });
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

  const handleManualParsed = async (totals: Map<number, number>, dailyTotals: Map<string, number>, readings: CSVReading[]) => {
    try {
      await saveCSVTotals(totals, pendingFileCount, dailyTotals, readings);
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

      // Clear daily building_load_kwh records for this month
      const { error: dailyError } = await supabase
        .from("generation_daily_records")
        .update({ building_load_kwh: null })
        .eq("project_id", projectId)
        .eq("year", year)
        .eq("month", month);
      if (dailyError) throw dailyError;

      // Clear raw readings for this month
      const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}T23:59:59`;
      const { error: readingsError } = await supabase
        .from("generation_readings")
        .update({ building_load_kwh: null })
        .eq("project_id", projectId)
        .gte("timestamp", startDate)
        .lte("timestamp", endDate);
      if (readingsError) throw readingsError;

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
              Council Demand (kWh)
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
