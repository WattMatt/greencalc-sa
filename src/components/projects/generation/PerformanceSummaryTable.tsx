import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MonthData {
  month: number;
  name: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
}

interface PerformanceSummaryTableProps {
  monthlyData: MonthData[];
}

export function PerformanceSummaryTable({ monthlyData }: PerformanceSummaryTableProps) {
  const totals = monthlyData.reduce(
    (acc, m) => ({
      actual: acc.actual + (m.actual_kwh ?? 0),
      guaranteed: acc.guaranteed + (m.guaranteed_kwh ?? 0),
      expected: acc.expected + (m.expected_kwh ?? 0),
    }),
    { actual: 0, guaranteed: 0, expected: 0 }
  );

  const formatRatio = (actual: number | null, target: number | null) => {
    if (!actual || !target || target === 0) return null;
    return ((actual / target) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Monthly Performance Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Month</TableHead>
              <TableHead className="text-right">Actual kWh</TableHead>
              <TableHead className="text-right">Guaranteed kWh</TableHead>
              <TableHead className="text-right text-muted-foreground/50">Forecasted kWh</TableHead>
              <TableHead className="text-right">vs Guaranteed</TableHead>
              <TableHead className="text-right text-muted-foreground/50">vs Forecasted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyData.map((m) => {
              const vsGuaranteed = formatRatio(m.actual_kwh, m.guaranteed_kwh);
              const vsExpected = formatRatio(m.actual_kwh, m.expected_kwh);
              return (
                <TableRow key={m.month}>
                  <TableCell className="font-medium text-xs">{m.name}</TableCell>
                  <TableCell className="text-right text-xs">
                    {m.actual_kwh != null ? m.actual_kwh.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {m.guaranteed_kwh != null ? m.guaranteed_kwh.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground/40">—</TableCell>
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
                  <TableCell className="text-right text-xs text-muted-foreground/40">—</TableCell>
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow className="font-medium border-t-2">
              <TableCell className="text-xs">Total</TableCell>
              <TableCell className="text-right text-xs">
                {totals.actual > 0 ? totals.actual.toLocaleString() : "—"}
              </TableCell>
              <TableCell className="text-right text-xs">
                {totals.guaranteed > 0 ? totals.guaranteed.toLocaleString() : "—"}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground/40">—</TableCell>
              <TableCell className="text-right">
                {totals.actual > 0 && totals.guaranteed > 0 ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      (totals.actual / totals.guaranteed) * 100 >= 100
                        ? "border-green-500/30 text-green-600"
                        : "border-destructive/30 text-destructive"
                    )}
                  >
                    {((totals.actual / totals.guaranteed) * 100).toFixed(1)}%
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground/40">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
