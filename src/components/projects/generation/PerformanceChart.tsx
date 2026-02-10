import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
}

interface PerformanceChartProps {
  monthData: MonthData;
}

const chartConfig = {
  actual: { label: "Actual kWh", color: "hsl(var(--primary))" },
  guaranteed: { label: "Guaranteed kWh", color: "hsl(var(--destructive))" },
};

export function PerformanceChart({ monthData }: PerformanceChartProps) {
  const hasData = monthData.actual_kwh || monthData.guaranteed_kwh;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Performance Comparison — {monthData.fullName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Enter generation data above to see the performance chart
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "Actual", value: monthData.actual_kwh ?? 0, fill: "var(--color-actual)" },
    { name: "Guaranteed", value: monthData.guaranteed_kwh ?? 0, fill: "var(--color-guaranteed)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Performance Comparison — {monthData.fullName}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
