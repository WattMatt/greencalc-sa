import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { SourceGuaranteesDialog } from "./SourceGuaranteesDialog";

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
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Guaranteed Generation (kWh)
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <Settings className="h-3 w-3 mr-1" /> Edit
            </Button>
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
