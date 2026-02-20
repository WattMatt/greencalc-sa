import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnvelopePoint } from "../hooks/useEnvelopeData";

interface EnvelopeChartProps {
  envelopeData: EnvelopePoint[];
  availableYears: number[];
  yearFrom: number;
  yearTo: number;
  setYearFrom: (y: number | null) => void;
  setYearTo: (y: number | null) => void;
  unit: string;
}

export function EnvelopeChart({
  envelopeData,
  availableYears,
  yearFrom,
  yearTo,
  setYearFrom,
  setYearTo,
  unit,
}: EnvelopeChartProps) {
  if (!envelopeData.length) return null;

  // Transform data for the stacked area trick:
  // "base" = min value (rendered transparent), "band" = max - min (rendered with fill)
  const chartData = envelopeData.map((d) => ({
    hour: d.hour,
    base: d.min,
    band: d.max - d.min,
    avg: d.avg,
    min: d.min,
    max: d.max,
  }));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">Min / Max / Average Envelope</p>
        <div className="flex items-center gap-1.5 ml-auto">
          <Select
            value={String(yearFrom)}
            onValueChange={(v) => setYearFrom(Number(v))}
          >
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)} disabled={y > yearTo}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">to</span>
          <Select
            value={String(yearTo)}
            onValueChange={(v) => setYearTo(Number(v))}
          >
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)} disabled={y < yearFrom}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="envelopeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={2}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())}
              width={45}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                if (!d) return null;
                return (
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs font-medium mb-1">{label}</p>
                    <div className="space-y-0.5 text-sm">
                      <p>
                        <span className="text-muted-foreground">Max:</span>{" "}
                        <span className="font-semibold">{d.max.toFixed(1)} {unit}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Avg:</span>{" "}
                        <span className="font-semibold">{d.avg.toFixed(1)} {unit}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Min:</span>{" "}
                        <span className="font-semibold">{d.min.toFixed(1)} {unit}</span>
                      </p>
                    </div>
                  </div>
                );
              }}
            />

            {/* Transparent base area (min) */}
            <Area
              type="monotone"
              dataKey="base"
              stackId="envelope"
              stroke="none"
              fill="transparent"
              dot={false}
              activeDot={false}
            />
            {/* Visible band between min and max */}
            <Area
              type="monotone"
              dataKey="band"
              stackId="envelope"
              stroke="none"
              fill="url(#envelopeFill)"
              dot={false}
              activeDot={false}
            />

            {/* Max line */}
            <Line
              type="monotone"
              dataKey="max"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
            />
            {/* Min line */}
            <Line
              type="monotone"
              dataKey="min"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
            />
            {/* Average dotted line */}
            <Line
              type="monotone"
              dataKey="avg"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4, stroke: "hsl(var(--muted-foreground))", strokeWidth: 2, fill: "hsl(var(--background))" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
