import { useRef, useImperativeHandle, forwardRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import html2canvas from "html2canvas";

interface EnergyFlowDonutProps {
  solarGeneration: number;
  gridImport: number;
  gridExport: number;
  primaryColor?: string;
}

export interface EnergyFlowDonutRef {
  captureImage: () => Promise<string | null>;
}

export const EnergyFlowDonut = forwardRef<EnergyFlowDonutRef, EnergyFlowDonutProps>(
  ({ solarGeneration, gridImport, gridExport, primaryColor = "#22c55e" }, ref) => {
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

    const selfConsumption = Math.max(0, solarGeneration - gridExport);
    const totalConsumption = selfConsumption + gridImport;

    const data = [
      { name: "Solar Self-Use", value: selfConsumption, color: primaryColor },
      { name: "Grid Import", value: gridImport, color: "#ef4444" },
      { name: "Grid Export", value: gridExport, color: "#3b82f6" },
    ].filter(d => d.value > 0);

    const solarCoverage = totalConsumption > 0 
      ? ((selfConsumption / totalConsumption) * 100).toFixed(0) 
      : 0;

    return (
      <div ref={chartRef} className="bg-white p-4 rounded-lg">
        <h4 className="text-sm font-semibold mb-3">Annual Energy Flow</h4>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="60%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => 
                  `${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `${value.toLocaleString()} kWh`}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium ml-auto">{item.value.toLocaleString()} kWh</span>
              </div>
            ))}
            <div className="pt-2 border-t mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Solar Coverage</span>
                <span className="font-bold" style={{ color: primaryColor }}>
                  {solarCoverage}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

EnergyFlowDonut.displayName = "EnergyFlowDonut";
