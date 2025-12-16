import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EnergyFlowData {
  solar_generation: number;
  grid_import: number;
  self_consumption: number;
  grid_export: number;
  battery_charge: number;
  battery_discharge: number;
  total_consumption: number;
}

interface EnergyFlowSankeyProps {
  data: EnergyFlowData;
  className?: string;
}

export function EnergyFlowSankey({ data, className }: EnergyFlowSankeyProps) {
  const totalInput = data.solar_generation + data.grid_import + data.battery_discharge;
  const maxFlow = Math.max(
    data.solar_generation,
    data.grid_import,
    data.self_consumption,
    data.grid_export,
    data.total_consumption
  );

  const getWidth = (value: number) => Math.max(4, (value / maxFlow) * 80);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Energy Flow Diagram</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-[300px] w-full">
          {/* Sources (Left) */}
          <div className="absolute left-0 top-0 flex h-full flex-col justify-around">
            <FlowNode
              label="Solar"
              value={data.solar_generation}
              color="hsl(var(--chart-1))"
            />
            <FlowNode
              label="Grid Import"
              value={data.grid_import}
              color="hsl(var(--chart-3))"
            />
            {data.battery_discharge > 0 && (
              <FlowNode
                label="Battery"
                value={data.battery_discharge}
                color="hsl(var(--chart-4))"
              />
            )}
          </div>

          {/* Center - Building */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-primary bg-primary/10">
              <span className="text-xs text-muted-foreground">Building</span>
              <span className="text-lg font-bold">
                {data.total_consumption.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">kWh</span>
            </div>
          </div>

          {/* Destinations (Right) */}
          <div className="absolute right-0 top-0 flex h-full flex-col justify-around">
            <FlowNode
              label="Self-consumed"
              value={data.self_consumption}
              color="hsl(var(--chart-1))"
              align="right"
            />
            <FlowNode
              label="Grid Export"
              value={data.grid_export}
              color="hsl(var(--chart-2))"
              align="right"
            />
            {data.battery_charge > 0 && (
              <FlowNode
                label="Battery Charge"
                value={data.battery_charge}
                color="hsl(var(--chart-4))"
                align="right"
              />
            )}
          </div>

          {/* Flow Lines - SVG */}
          <svg className="absolute inset-0 h-full w-full" style={{ zIndex: -1 }}>
            {/* Solar to Building */}
            <FlowPath
              x1={80}
              y1={50}
              x2={200}
              y2={150}
              width={getWidth(data.self_consumption)}
              color="hsl(var(--chart-1))"
            />
            {/* Solar to Export */}
            {data.grid_export > 0 && (
              <FlowPath
                x1={80}
                y1={50}
                x2={320}
                y2={100}
                width={getWidth(data.grid_export)}
                color="hsl(var(--chart-2))"
              />
            )}
            {/* Grid to Building */}
            <FlowPath
              x1={80}
              y1={150}
              x2={200}
              y2={150}
              width={getWidth(data.grid_import)}
              color="hsl(var(--chart-3))"
            />
          </svg>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-chart-1/10 p-2">
            <p className="text-sm font-semibold text-chart-1">
              {((data.self_consumption / data.total_consumption) * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Solar Coverage</p>
          </div>
          <div className="rounded-lg bg-chart-2/10 p-2">
            <p className="text-sm font-semibold text-chart-2">
              {data.grid_export.toLocaleString()} kWh
            </p>
            <p className="text-xs text-muted-foreground">Exported</p>
          </div>
          <div className="rounded-lg bg-chart-3/10 p-2">
            <p className="text-sm font-semibold text-chart-3">
              {data.grid_import.toLocaleString()} kWh
            </p>
            <p className="text-xs text-muted-foreground">Grid Import</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-sm font-semibold">
              {data.total_consumption.toLocaleString()} kWh
            </p>
            <p className="text-xs text-muted-foreground">Total Load</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FlowNode({
  label,
  value,
  color,
  align = "left",
}: {
  label: string;
  value: number;
  color: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <div
        className="mb-1 h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value.toLocaleString()} kWh</span>
    </div>
  );
}

function FlowPath({
  x1,
  y1,
  x2,
  y2,
  width,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
}) {
  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeOpacity={0.4}
    />
  );
}
