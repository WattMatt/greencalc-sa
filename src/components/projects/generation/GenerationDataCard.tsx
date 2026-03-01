import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Save, Building2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CSVPreviewDialog, type CSVReading } from "./CSVPreviewDialog";
import type { MonthData } from "./GenerationTab";

interface GenerationDataCardProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
  onDataChanged: () => void;
  /** "solar" writes to actual_kwh; "council" writes to building_load_kwh */
  dataType: "solar" | "council";
}

export function GenerationDataCard({ projectId, month, year, monthData, onDataChanged, dataType }: GenerationDataCardProps) {
  const isSolar = dataType === "solar";
  const kwhField = isSolar ? "actual_kwh" : "building_load_kwh";
  const otherField = isSolar ? "building_load_kwh" : "actual_kwh";
  const cardTitle = isSolar ? "Actual Generation (kWh)" : "Council Demand (kWh)";
  const currentValue = isSolar ? monthData.actual_kwh : monthData.building_load_kwh;
  const meterType = isSolar ? "solar" : "council";

  const [value, setValue] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvDialogLines, setCsvDialogLines] = useState<string[]>([]);
  const [pendingFileCount, setPendingFileCount] = useState(0);
  const [pendingFileName, setPendingFileName] = useState("");

  const handleSave = async () => {
    if (value === null || value === "") return;
    setIsSaving(true);
    try {
      const upsertData = {
        project_id: projectId,
        month,
        year,
        ...(isSolar
          ? { actual_kwh: parseFloat(value), source: "manual" as const }
          : { building_load_kwh: parseFloat(value) }),
      };

      const { error } = await supabase
        .from("generation_records")
        .upsert(upsertData, { onConflict: "project_id,month,year" });
      if (error) throw error;
      toast.success(`${isSolar ? "Actual generation" : "Building load"} saved for ${monthData.fullName}`);
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
      .select(`month, ${kwhField}, source`)
      .eq("project_id", projectId)
      .eq("year", year)
      .in("month", months);

    const existingMap = new Map((existing ?? []).map((r: any) => [r.month, r]));
    let totalAdded = 0;

    // Batch monthly upserts
    const monthlyBatch: Record<string, any>[] = [];
    for (const [m, csvSum] of totals) {
      const prev = existingMap.get(m);
      const newTotal = (prev?.[kwhField] ?? 0) + csvSum;
      totalAdded += csvSum;

      const upsertData: Record<string, any> = {
        project_id: projectId,
        month: m,
        year,
        [kwhField]: newTotal,
      };

      if (isSolar) {
        const prevSource = prev?.source ?? "";
        const prevCount = prevSource.startsWith("csv:") ? parseInt(prevSource.split(":")[1]) || 0 : prevSource === "csv" ? 1 : 0;
        upsertData.source = `csv:${prevCount + fileCount}`;
      }

      monthlyBatch.push(upsertData);
    }

    if (monthlyBatch.length > 0) {
      const { error } = await supabase
        .from("generation_records")
        .upsert(monthlyBatch as any, { onConflict: "project_id,month,year" });
      if (error) throw error;
    }

    // Batch daily records
    if (dailyTotals && dailyTotals.size > 0) {
      const dateKeys = Array.from(dailyTotals.keys());
      // Fetch existing daily records in batch
      const { data: existingDailies } = await supabase
        .from("generation_daily_records")
        .select(`date, ${kwhField}`)
        .eq("project_id", projectId)
        .in("date", dateKeys);

      const existingDailyMap = new Map((existingDailies ?? []).map((r: any) => [r.date, r[kwhField]]));
      const dailyBatch: Record<string, any>[] = [];

      for (const [dateKey, kwh] of dailyTotals) {
        const [y, m] = dateKey.split("-").map(Number);
        const newKwh = (existingDailyMap.get(dateKey) ?? 0) + kwh;
        dailyBatch.push({
          project_id: projectId,
          date: dateKey,
          year: y,
          month: m,
          [kwhField]: newKwh,
          source: "csv",
        });
      }

      if (dailyBatch.length > 0) {
        const { error } = await supabase
          .from("generation_daily_records")
          .upsert(dailyBatch as any, { onConflict: "project_id,date" });
        if (error) throw error;
      }
    }

    // Save raw readings
    if (readings && readings.length > 0) {
      const sourceLabel = pendingFileName.replace(/\.csv$/i, "").trim() || "csv";
      const batchSize = 500;

      if (isSolar) {
        // Solar: simple upsert
        for (let i = 0; i < readings.length; i += batchSize) {
          const batch = readings.slice(i, i + batchSize);
          const upsertBatch = batch.map((r) => ({
            project_id: projectId,
            timestamp: r.timestamp,
            actual_kwh: r.kwh,
            building_load_kwh: null,
            source: sourceLabel,
          }));
          const { error } = await supabase
            .from("generation_readings")
            .upsert(upsertBatch, { onConflict: "project_id,timestamp,source" });
          if (error) throw error;
        }
      } else {
        // Council: preserve existing actual_kwh, add to building_load_kwh
        const normalizeTs = (ts: string): string =>
          ts.replace(/\.\d+/, '').replace(/Z$/, '').replace(/[+-]\d{2}(:\d{2})?$/, '').replace(' ', 'T');

        for (let i = 0; i < readings.length; i += batchSize) {
          const batch = readings.slice(i, i + batchSize);
          const timestamps = batch.map((r) => r.timestamp);

          const { data: existingReadings } = await supabase
            .from("generation_readings")
            .select("timestamp, actual_kwh, building_load_kwh")
            .eq("project_id", projectId)
            .in("timestamp", timestamps);

          const existingReadingsMap = new Map(
            (existingReadings ?? []).map((r) => [normalizeTs(r.timestamp), r])
          );

          const upsertBatch = batch.map((r) => {
            const existing = existingReadingsMap.get(normalizeTs(r.timestamp));
            return {
              project_id: projectId,
              timestamp: r.timestamp,
              actual_kwh: existing?.actual_kwh ?? null,
              building_load_kwh: (existing?.building_load_kwh ?? 0) + r.kwh,
              source: sourceLabel,
            };
          });

          const { error } = await supabase
            .from("generation_readings")
            .upsert(upsertBatch, { onConflict: "project_id,timestamp,source" });
          if (error) throw error;
        }
      }
    }

    // Auto-create source guarantee entry
    const sanitizedName = pendingFileName.replace(/\.csv$/i, "").trim();
    const guaranteeLabel = sanitizedName || (isSolar ? "csv" : "Council Supply");
    if (guaranteeLabel) {
      const affectedMonths = Array.from(totals.keys());
      for (const m of affectedMonths) {
        const { data: existingGuarantee } = await supabase
          .from("generation_source_guarantees")
          .select("id")
          .eq("project_id", projectId)
          .eq("month", m)
          .eq("year", year)
          .eq("source_label", guaranteeLabel)
          .maybeSingle();

        if (!existingGuarantee) {
          await supabase
            .from("generation_source_guarantees")
            .insert({
              project_id: projectId,
              month: m,
              year,
              source_label: guaranteeLabel,
              guaranteed_kwh: 0,
              meter_type: meterType,
            });
        }
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
      setPendingFileName(files[0].name);
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
          [kwhField]: null,
          ...(isSolar ? { source: null } : {}),
        }, { onConflict: "project_id,month,year" });
      if (error) throw error;

      // Clear daily records
      const { error: dailyError } = await supabase
        .from("generation_daily_records")
        .update({ [kwhField]: null })
        .eq("project_id", projectId)
        .eq("year", year)
        .eq("month", month);
      if (dailyError) throw dailyError;

      // Clear raw readings
      const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}T23:59:59`;
      const { error: readingsError } = await supabase
        .from("generation_readings")
        .update({ [kwhField]: null })
        .eq("project_id", projectId)
        .gte("timestamp", startDate)
        .lte("timestamp", endDate);
      if (readingsError) throw readingsError;

      toast.success(`Reset ${isSolar ? "actual generation" : "building load"} for ${monthData.fullName}`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset");
    }
  };

  const hasEdit = value !== null && value !== (currentValue?.toString() ?? "");

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              {!isSolar && <Building2 className="h-4 w-4" />}
              {cardTitle}
            </span>
            <div className="flex gap-1">
              {currentValue != null && (
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
          <p className="text-2xl font-semibold tabular-nums">
            {currentValue != null
              ? currentValue.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "—"}
          </p>
          {isSolar && monthData.source && (
            <p className="text-xs text-muted-foreground">
              Source: {monthData.source}
            </p>
          )}
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
