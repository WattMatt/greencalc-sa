import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Line, ComposedChart } from "recharts";

interface MonthData {
  month: number;
  name: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
}

interface PerformanceChartProps {
  monthlyData: MonthData[];
}

const chartConfig = {
  actual: { label: "Actual kWh", color: "hsl(var(--primary))" },
  guaranteed: { label: "Guaranteed kWh", color: "hsl(var(--destructive))" },
  expected: { label: "Forecasted kWh", color: "hsl(var(--muted-foreground))" },
};

export function PerformanceChart({ monthlyData }: PerformanceChartProps) {
  const chartData = monthlyData.map((m) => ({
    name: m.name,
    actual: m.actual_kwh ?? 0,
    guaranteed: m.guaranteed_kwh ?? 0,
    expected: m.expected_kwh ?? 0,
  }));

  const hasData = monthlyData.some((m) => m.actual_kwh || m.guaranteed_kwh);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Enter generation data above to see the performance chart
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Performance Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="guaranteed"
              stroke="var(--color-guaranteed)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
