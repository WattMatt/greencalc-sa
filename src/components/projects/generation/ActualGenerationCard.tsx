import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Save } from "lucide-react";
import { toast } from "sonner";

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
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("CSV must have a header row and data rows");
        return;
      }

      const header = lines[0].toLowerCase();
      const monthCol = header.split(",").findIndex((h) => h.trim().match(/month/i));
      const kwhCol = header.split(",").findIndex((h) => h.trim().match(/kwh|energy|generation|actual/i));

      if (monthCol === -1 || kwhCol === -1) {
        toast.error("CSV must have 'month' and 'kwh' columns");
        return;
      }

      const parsed: { month: number; kwh: number }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        const monthVal = parseInt(cols[monthCol]?.trim());
        const kwhVal = parseFloat(cols[kwhCol]?.trim());
        if (monthVal >= 1 && monthVal <= 12 && !isNaN(kwhVal)) {
          parsed.push({ month: monthVal, kwh: kwhVal });
        }
      }

      if (parsed.length === 0) {
        toast.error("No valid month/kWh data found in CSV");
        return;
      }

      for (const row of parsed) {
        const { error } = await supabase
          .from("generation_records")
          .upsert({
            project_id: projectId,
            month: row.month,
            year,
            actual_kwh: row.kwh,
            source: "csv",
          }, { onConflict: "project_id,month,year" });
        if (error) throw error;
      }

      toast.success(`Imported ${parsed.length} months from CSV`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "CSV import failed");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasEdit = value !== null && value !== (monthData.actual_kwh?.toString() ?? "");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          Actual Generation (kWh)
          <div className="flex gap-1">
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
