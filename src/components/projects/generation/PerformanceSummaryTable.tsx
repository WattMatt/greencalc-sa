import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
}

interface PerformanceSummaryTableProps {
  monthData: MonthData;
}

export function PerformanceSummaryTable({ monthData }: PerformanceSummaryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">System Summary — {monthData.fullName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
          Coming soon
        </div>
      </CardContent>
    </Card>
  );
}