import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend } from "recharts";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
}

interface PerformanceChartProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const chartConfig = {
  actual: { label: "Solar Generation", color: "hsl(var(--primary))" },
  building_load: { label: "Building Load", color: "hsl(var(--accent-foreground))" },
};

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function PerformanceChart({ projectId, month, year, monthData }: PerformanceChartProps) {
  const { data: dailyRecords } = useQuery({
    queryKey: ["generation-daily", projectId, year, month],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-${daysInMonth(month, year)}`;
      const { data, error } = await supabase
        .from("generation_daily_records")
        .select("date, actual_kwh, building_load_kwh")
        .eq("project_id", projectId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = daysInMonth(month, year);
  const dailyGuarantee = monthData.guaranteed_kwh ? monthData.guaranteed_kwh / days : null;

  const hasData = dailyRecords && dailyRecords.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daily Performance — {monthData.fullName} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Upload CSV data to see the daily performance chart
          </div>
        </CardContent>
      </Card>
    );
  }

  const dailyMap = new Map(
    (dailyRecords ?? []).map((r) => [parseInt(r.date.split("-")[2]), r])
  );

  const monthShort = MONTH_SHORT[month - 1];
  const chartData = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const rec = dailyMap.get(day);
    return {
      name: `${day}-${monthShort}`,
      actual: rec?.actual_kwh ?? 0,
      building_load: rec?.building_load_kwh ?? 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Daily Performance — {monthData.fullName} {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} />
            <YAxis fontSize={12} label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar dataKey="actual" name="Solar Generation" fill="var(--color-actual)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="building_load" name="Building Load" fill="var(--color-building_load)" radius={[2, 2, 0, 0]} />
            {dailyGuarantee && (
              <ReferenceLine
                y={dailyGuarantee}
                stroke="hsl(var(--destructive))"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{ value: `Guarantee (${dailyGuarantee.toFixed(0)} kWh/day)`, position: "top", fontSize: 11, fill: "hsl(var(--destructive))" }}
              />
            )}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
