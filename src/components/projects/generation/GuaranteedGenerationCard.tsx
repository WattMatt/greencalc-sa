import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface MonthData {
  month: number;
  name: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  source: string | null;
}

interface GuaranteedGenerationCardProps {
  projectId: string;
  year: number;
  monthlyData: MonthData[];
  onDataChanged: () => void;
}

export function GuaranteedGenerationCard({ projectId, year, monthlyData, onDataChanged }: GuaranteedGenerationCardProps) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const getValue = (month: number) => {
    if (values[month] !== undefined) return values[month];
    return monthlyData.find((m) => m.month === month)?.guaranteed_kwh?.toString() ?? "";
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
          guaranteed_kwh: parseFloat(val),
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

      toast.success("Guaranteed generation saved");
      setValues({});
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const total = monthlyData.reduce((sum, m) => sum + (m.guaranteed_kwh ?? 0), 0);
  const hasEdits = Object.keys(values).length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          Guaranteed Generation (kWh)
          {hasEdits && (
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          )}
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
