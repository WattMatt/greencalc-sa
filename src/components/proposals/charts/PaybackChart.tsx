import { useRef, useImperativeHandle, forwardRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import html2canvas from "html2canvas";

interface PaybackChartProps {
  projection: Array<{
    year: number;
    cumulative: number;
    roi: number;
  }>;
  systemCost: number;
  primaryColor?: string;
}

export interface PaybackChartRef {
  captureImage: () => Promise<string | null>;
}

export const PaybackChart = forwardRef<PaybackChartRef, PaybackChartProps>(
  ({ projection, systemCost, primaryColor = "#22c55e" }, ref) => {
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

    const paybackYear = projection.find(p => p.cumulative >= systemCost)?.year || 0;

    return (
      <div ref={chartRef} className="bg-white p-4 rounded-lg">
        <h4 className="text-sm font-semibold mb-3">Cumulative Savings vs Investment</h4>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={projection}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              label={{ value: "Year", position: "bottom", fontSize: 10 }}
            />
            <YAxis
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={(v) => `R${(v / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              formatter={(value: number) => [`R${value.toLocaleString()}`, "Cumulative Savings"]}
              labelFormatter={(label) => `Year ${label}`}
            />
            <ReferenceLine
              y={systemCost}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: "Investment", position: "right", fontSize: 10, fill: "#ef4444" }}
            />
            {paybackYear > 0 && (
              <ReferenceLine
                x={paybackYear}
                stroke={primaryColor}
                strokeWidth={2}
                label={{ value: `Payback: Year ${paybackYear}`, position: "top", fontSize: 10, fill: primaryColor }}
              />
            )}
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={primaryColor}
              fill={primaryColor}
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
);

PaybackChart.displayName = "PaybackChart";
