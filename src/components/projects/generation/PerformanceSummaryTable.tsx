import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const formatRatio = (actual: number | null, target: number | null) => {
    if (!actual || !target || target === 0) return null;
    return ((actual / target) * 100).toFixed(1);
  };

  const vsGuaranteed = formatRatio(monthData.actual_kwh, monthData.guaranteed_kwh);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Performance Summary — {monthData.fullName}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-sm">Actual Generation</TableCell>
              <TableCell className="text-right text-sm">
                {monthData.actual_kwh != null ? `${monthData.actual_kwh.toLocaleString()} kWh` : "—"}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Guaranteed Generation</TableCell>
              <TableCell className="text-right text-sm">
                {monthData.guaranteed_kwh != null ? `${monthData.guaranteed_kwh.toLocaleString()} kWh` : "—"}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Building Load</TableCell>
              <TableCell className="text-right text-sm">
                {monthData.building_load_kwh != null ? `${monthData.building_load_kwh.toLocaleString()} kWh` : "—"}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm font-medium">Actual vs Guaranteed</TableCell>
              <TableCell className="text-right">
                {vsGuaranteed ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      parseFloat(vsGuaranteed) >= 100
                        ? "border-green-500/30 text-green-600"
                        : "border-destructive/30 text-destructive"
                    )}
                  >
                    {vsGuaranteed}%
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
