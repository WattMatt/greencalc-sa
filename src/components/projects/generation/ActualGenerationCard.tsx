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
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  source: string | null;
}

interface ActualGenerationCardProps {
  projectId: string;
  year: number;
  monthlyData: MonthData[];
  onDataChanged: () => void;
}

export function ActualGenerationCard({ projectId, year, monthlyData, onDataChanged }: ActualGenerationCardProps) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getValue = (month: number) => {
    if (values[month] !== undefined) return values[month];
    return monthlyData.find((m) => m.month === month)?.actual_kwh?.toString() ?? "";
  };

  const handleChange = (month: number, val: string) => {
    setValues((prev) => ({ ...prev, [month]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const upserts = Object.entries(values)
        .filter(([, val]) => val !== "")
        .map(([month, val]) => ({
          project_id: projectId,
          month: parseInt(month),
          year,
          actual_kwh: parseFloat(val),
          source: "manual" as const,
        }));

      if (upserts.length === 0) {
        toast.info("No changes to save");
        setIsSaving(false);
        return;
      }

      for (const upsert of upserts) {
        const { error } = await supabase
          .from("generation_records")
          .upsert(upsert, { onConflict: "project_id,month,year" });
        if (error) throw error;
      }

      toast.success("Actual generation saved");
      setValues({});
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
        toast.error("CSV must have 'month' and 'kwh' (or 'energy'/'generation'/'actual') columns");
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
      setValues({});
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "CSV import failed");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const total = monthlyData.reduce((sum, m) => sum + (m.actual_kwh ?? 0), 0);
  const hasEdits = Object.keys(values).length > 0;

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
            {hasEdits && (
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}>
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {monthlyData.map((m) => (
            <div key={m.month} className="flex items-center gap-2">
              <Label className="text-xs w-8 text-muted-foreground">{m.name}</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                placeholder="0"
                value={getValue(m.month)}
                onChange={(e) => handleChange(m.month, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="pt-2 border-t text-xs text-muted-foreground flex justify-between">
          <span>Annual Total</span>
          <span className="font-medium text-foreground">{total.toLocaleString()} kWh</span>
        </div>
      </CardContent>
    </Card>
  );
}
