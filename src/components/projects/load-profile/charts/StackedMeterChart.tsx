import { useState, useCallback } from "react";
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Badge } from "@/components/ui/badge";
import { getTOUPeriod, TOU_COLORS } from "../types";
import { StackedMeterPoint } from "../hooks/useStackedMeterData";

interface StackedMeterChartProps {
  data: StackedMeterPoint[];
  tenantKeys: { id: string; label: string; color: string }[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
}

export function StackedMeterChart({ data, tenantKeys, showTOU, isWeekend, unit }: StackedMeterChartProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = useCallback((id: string) => {
    setHiddenKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const visibleKeys = tenantKeys.filter(tk => !hiddenKeys.has(tk.id));

  if (!data.length || !tenantKeys.length) return null;

  return (
    <div className="space-y-1.5">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} syncId="loadProfileSync">
            <defs>
              {tenantKeys.map((tk) => (
                <linearGradient key={tk.id} id={`stackFill-${tk.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tk.color} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={tk.color} stopOpacity={0.2} />
                </linearGradient>
              ))}
            </defs>

            {showTOU &&
              Array.from({ length: 24 }, (_, h) => {
                const period = getTOUPeriod(h, isWeekend);
                const nextHour = h === 23 ? 23 : h + 1;
                return (
                  <ReferenceArea
                    key={h}
                    x1={`${h.toString().padStart(2, "0")}:00`}
                    x2={`${nextHour.toString().padStart(2, "0")}:00`}
                    fill={TOU_COLORS[period].fill}
                    fillOpacity={0.12}
                    stroke="none"
                  />
                );
              })}

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
                const hourNum = parseInt(label?.toString() || "0");
                const period = getTOUPeriod(hourNum, isWeekend);
                // Sum all tenant values for total
                const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                return (
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg max-h-64 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium">{label}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: TOU_COLORS[period].stroke, color: TOU_COLORS[period].stroke }}
                      >
                        {TOU_COLORS[period].label}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold mb-1">
                      Total: {total.toFixed(1)} {unit}
                    </p>
                    <div className="space-y-0.5">
                      {payload
                        .filter(p => Number(p.value) > 0)
                        .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
                        .map((p) => {
                          const tk = tenantKeys.find(t => t.id === p.dataKey);
                          return (
                            <div key={p.dataKey} className="flex items-center gap-1.5 text-xs">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tk?.color }} />
                              <span className="text-muted-foreground truncate max-w-[120px]">{tk?.label}</span>
                              <span className="font-medium ml-auto">{Number(p.value).toFixed(1)} {unit}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              }}
            />

            {visibleKeys.map((tk) => (
              <Area
                key={tk.id}
                type="monotone"
                dataKey={tk.id}
                stackId="meters"
                stroke={tk.color}
                strokeWidth={1}
                fill={`url(#stackFill-${tk.id})`}
                dot={false}
                activeDot={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend – click to toggle */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
        {tenantKeys.map((tk) => {
          const hidden = hiddenKeys.has(tk.id);
          return (
            <button
              key={tk.id}
              type="button"
              onClick={() => toggleKey(tk.id)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              style={{ opacity: hidden ? 0.35 : 1 }}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: hidden ? "hsl(var(--muted-foreground))" : tk.color }}
              />
              <span className={`truncate max-w-[100px] ${hidden ? "line-through" : ""}`}>{tk.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
