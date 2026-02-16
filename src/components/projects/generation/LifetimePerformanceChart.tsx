import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface LifetimePerformanceChartProps {
  projectId: string;
}

export function LifetimePerformanceChart({ projectId }: LifetimePerformanceChartProps) {
  const [yearFilter, setYearFilter] = useState<string>("all");

  const { data: records = [] } = useQuery({
    queryKey: ["generation-lifetime", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_records")
        .select("month, year, actual_kwh, guaranteed_kwh")
        .eq("project_id", projectId)
        .order("year", { ascending: true })
        .order("month", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const yearOptions = useMemo(() => {
    const years = [...new Set(records.map((r) => r.year))].sort();
    return years.map((y) => y.toString());
  }, [records]);

  const chartData = useMemo(() => {
    let filtered = records;
    if (yearFilter !== "all") {
      filtered = records.filter((r) => r.year.toString() === yearFilter);
    }

    let runningActual = 0;
    let runningGuaranteed = 0;

    return filtered.map((r) => {
      const actual = Number(r.actual_kwh) || 0;
      const guaranteed = Number(r.guaranteed_kwh) || 0;
      runningActual += actual;
      runningGuaranteed += guaranteed;
      const monthPct = guaranteed > 0 ? (actual / guaranteed) * 100 : 0;
      const cumPct = runningGuaranteed > 0 ? (runningActual / runningGuaranteed) * 100 : 0;
      const label = `${MONTH_SHORT[r.month - 1]}-${String(r.year).slice(-2)}`;

      return {
        label,
        guaranteed,
        actual,
        monthPct: Math.round(monthPct * 10) / 10,
        cumPct: Math.round(cumPct * 10) / 10,
      };
    });
  }, [records, yearFilter]);

  const formatKwh = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString());

  if (!records.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Lifetime Performance Overview</CardTitle>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="kwh"
                tickFormatter={formatKwh}
                tick={{ fontSize: 11 }}
                width={50}
                label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[0, 120]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11 }}
                width={45}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "cumPct") return [`${value}%`, "Cumulative %"];
                  return [value.toLocaleString() + " kWh", name === "guaranteed" ? "Guaranteed" : "Actual"];
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend
                formatter={(value: string) => {
                  if (value === "guaranteed") return "Guaranteed";
                  if (value === "actual") return "Actual";
                  if (value === "cumPct") return "Cumulative %";
                  return value;
                }}
              />
              <Bar yAxisId="kwh" dataKey="guaranteed" fill="hsl(217, 91%, 60%)" radius={[2, 2, 0, 0]} barSize={16} />
              <Bar yAxisId="kwh" dataKey="actual" fill="hsl(45, 93%, 47%)" radius={[2, 2, 0, 0]} barSize={16} />
              <Line
                yAxisId="pct"
                dataKey="cumPct"
                stroke="hsl(0, 0%, 45%)"
                strokeDasharray="5 3"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Month</TableHead>
                {chartData.map((d) => (
                  <TableHead key={d.label} className="text-xs text-center whitespace-nowrap">{d.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs font-medium">Guarantee</TableCell>
                {chartData.map((d) => (
                  <TableCell key={d.label} className="text-xs text-center">{d.guaranteed.toLocaleString()}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium">Production</TableCell>
                {chartData.map((d) => (
                  <TableCell key={d.label} className="text-xs text-center">{d.actual.toLocaleString()}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium">Monthly %</TableCell>
                {chartData.map((d) => (
                  <TableCell key={d.label} className="text-xs text-center">{d.monthPct}%</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-xs font-medium">Cumulative %</TableCell>
                {chartData.map((d) => (
                  <TableCell key={d.label} className="text-xs text-center">{d.cumPct}%</TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
