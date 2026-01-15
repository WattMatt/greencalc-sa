import { useRef, useImperativeHandle, forwardRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";

interface MonthlyGenerationChartProps {
  annualGeneration: number;
  primaryColor?: string;
}

export interface MonthlyGenerationChartRef {
  captureImage: () => Promise<string | null>;
}

// Monthly generation factors based on typical solar irradiance in South Africa
const MONTHLY_FACTORS = [
  { month: "Jan", factor: 1.15 },
  { month: "Feb", factor: 1.10 },
  { month: "Mar", factor: 1.00 },
  { month: "Apr", factor: 0.85 },
  { month: "May", factor: 0.70 },
  { month: "Jun", factor: 0.65 },
  { month: "Jul", factor: 0.68 },
  { month: "Aug", factor: 0.80 },
  { month: "Sep", factor: 0.90 },
  { month: "Oct", factor: 1.00 },
  { month: "Nov", factor: 1.08 },
  { month: "Dec", factor: 1.12 },
];

export const MonthlyGenerationChart = forwardRef<MonthlyGenerationChartRef, MonthlyGenerationChartProps>(
  ({ annualGeneration, primaryColor = "#22c55e" }, ref) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      captureImage: async () => {
        if (!chartRef.current) return null;
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          const canvas = await html2canvas(chartRef.current, {
            backgroundColor: "#ffffff",
            scale: 2,
            logging: false,
          });
          return canvas.toDataURL("image/png");
        } catch (error) {
          console.error("Failed to capture chart:", error);
          return null;
        }
      },
    }));

    // Calculate monthly values
    const totalFactor = MONTHLY_FACTORS.reduce((sum, m) => sum + m.factor, 0);
    const monthlyData = MONTHLY_FACTORS.map(m => ({
      month: m.month,
      generation: Math.round((annualGeneration * m.factor) / totalFactor),
    }));

    return (
      <div ref={chartRef} className="bg-white p-4 rounded-lg">
        <h4 className="text-sm font-semibold mb-3">Monthly Solar Generation</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="month"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Generation"]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar
              dataKey="generation"
              fill={primaryColor}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Total Annual: {annualGeneration.toLocaleString()} kWh
        </p>
      </div>
    );
  }
);

MonthlyGenerationChart.displayName = "MonthlyGenerationChart";
