import { useState, useCallback } from "react";
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { buildTOUBlocks } from "../utils/touReferenceAreas";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ExternalLink } from "lucide-react";
import { getTOUPeriod, TOU_COLORS } from "../types";
import { StackedMeterPoint } from "../hooks/useStackedMeterData";

interface StackedMeterChartProps {
  data: StackedMeterPoint[];
  tenantKeys: { id: string; label: string; color: string }[];
  showTOU: boolean;
  isWeekend: boolean;
  unit: string;
  onNavigateToTenant?: (tenantId: string) => void;
  month?: number;
  dayOfWeek?: number;
}

export function StackedMeterChart({ data, tenantKeys, showTOU, isWeekend, unit, onNavigateToTenant, month, dayOfWeek }: StackedMeterChartProps) {
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
          <ComposedChart data={[...data, { ...data[data.length - 1], hour: "24:00" }]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} syncId="loadProfileSync">
            <defs>
              {tenantKeys.map((tk) => (
                <linearGradient key={tk.id} id={`stackFill-${tk.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tk.color} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={tk.color} stopOpacity={0.2} />
                </linearGradient>
              ))}
            </defs>

            {showTOU && buildTOUBlocks((h) => getTOUPeriod(h, isWeekend, undefined, month, dayOfWeek)).map((b) => (
              <ReferenceArea key={`tou-${b.startHour}`} x1={b.x1} x2={b.x2} fill={b.fill} fillOpacity={0.18} stroke="none" shapeRendering="crispEdges" />
            ))}

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
                const period = getTOUPeriod(hourNum, isWeekend, undefined, month, dayOfWeek);
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

      {/* Legend – click to toggle, tooltip to navigate */}
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          {tenantKeys.map((tk) => {
            const hidden = hiddenKeys.has(tk.id);
            return (
              <UITooltip key={tk.id}>
                <TooltipTrigger asChild>
                  <button
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
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2 text-xs">
                  <span>{tk.label}</span>
                  {onNavigateToTenant && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onNavigateToTenant(tk.id); }}
                      className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View in Tenants
                    </button>
                  )}
                </TooltipContent>
              </UITooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
