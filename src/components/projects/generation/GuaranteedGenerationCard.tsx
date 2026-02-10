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
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  source: string | null;
}

interface GuaranteedGenerationCardProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
  onDataChanged: () => void;
}

export function GuaranteedGenerationCard({ projectId, month, year, monthData, onDataChanged }: GuaranteedGenerationCardProps) {
  const [value, setValue] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayValue = value !== null ? value : (monthData.guaranteed_kwh?.toString() ?? "");

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
          guaranteed_kwh: parseFloat(value),
        }, { onConflict: "project_id,month,year" });
      if (error) throw error;
      toast.success(`Guaranteed generation saved for ${monthData.fullName}`);
      setValue(null);
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const hasEdit = value !== null && value !== (monthData.guaranteed_kwh?.toString() ?? "");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          Guaranteed Generation (kWh)
          {hasEdit && (
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          )}
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
  );
}
