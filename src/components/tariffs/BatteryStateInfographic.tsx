import { useState } from "react";
import { cn } from "@/lib/utils";
import { Battery, BatteryCharging, Zap, Sun, Home } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BatteryScale = "residential" | "commercial";

interface BatteryStateInfographicProps {
  className?: string;
}

// Simulated 24-hour battery data
const generateBatteryData = (scale: BatteryScale) => {
  const capacity = scale === "residential" ? 10 : 200; // kWh
  const maxPower = scale === "residential" ? 5 : 100; // kW
  
  // Typical daily pattern: charge from solar (9-15), discharge during peak (17-21)
  const hours = [];
  for (let h = 0; h < 24; h++) {
    let soc: number;
    let power: number; // positive = charging, negative = discharging
    let mode: "charging" | "discharging" | "idle";
    
    if (h >= 0 && h < 6) {
      // Night: idle or slight discharge
      soc = 30 - (h * 2);
      power = -0.5 * maxPower * 0.1;
      mode = "idle";
    } else if (h >= 6 && h < 9) {
      // Early morning: solar starts, light charging
      soc = 20 + ((h - 6) * 5);
      power = maxPower * 0.3;
      mode = "charging";
    } else if (h >= 9 && h < 15) {
      // Peak solar: heavy charging
      soc = Math.min(95, 35 + ((h - 9) * 10));
      power = maxPower * 0.8;
      mode = "charging";
    } else if (h >= 15 && h < 17) {
      // Afternoon: solar declining, idle
      soc = 95;
      power = 0;
      mode = "idle";
    } else if (h >= 17 && h < 21) {
      // Evening peak: heavy discharge
      soc = 95 - ((h - 17) * 15);
      power = -maxPower * 0.7;
      mode = "discharging";
    } else {
      // Late night: low SoC, idle
      soc = Math.max(15, 35 - ((h - 21) * 5));
      power = 0;
      mode = "idle";
    }
    
    hours.push({ hour: h, soc, power, mode, capacity, maxPower });
  }
  return hours;
};

// TOU periods for SA
const getTOUPeriod = (hour: number, isWeekday: boolean = true): { period: string; color: string } => {
  if (!isWeekday) return { period: "Off-Peak", color: "hsl(var(--chart-3))" };
  
  if ((hour >= 7 && hour < 10) || (hour >= 18 && hour < 20)) {
    return { period: "Peak", color: "hsl(var(--destructive))" };
  } else if ((hour >= 6 && hour < 7) || (hour >= 10 && hour < 18) || (hour >= 20 && hour < 22)) {
    return { period: "Standard", color: "hsl(var(--chart-4))" };
  }
  return { period: "Off-Peak", color: "hsl(var(--chart-3))" };
};

export function BatteryStateInfographic({ className }: BatteryStateInfographicProps) {
  const [scale, setScale] = useState<BatteryScale>("residential");
  const data = generateBatteryData(scale);
  const capacity = scale === "residential" ? 10 : 200;
  const maxPower = scale === "residential" ? 5 : 100;
  
  // Chart dimensions
  const width = 600;
  const height = 280;
  const padding = { top: 40, right: 60, bottom: 50, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Generate SoC path
  const socPath = data.map((d, i) => {
    const x = padding.left + (i / 23) * chartWidth;
    const y = padding.top + chartHeight - (d.soc / 100) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  
  // Generate fill area path
  const fillPath = `${socPath} L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;
  
  // Calculate stats
  const maxSoC = Math.max(...data.map(d => d.soc));
  const minSoC = Math.min(...data.map(d => d.soc));
  const totalCharged = data.filter(d => d.mode === "charging").reduce((sum, d) => sum + Math.abs(d.power) * (capacity / maxPower) * 0.1, 0);
  const totalDischarged = data.filter(d => d.mode === "discharging").reduce((sum, d) => sum + Math.abs(d.power) * (capacity / maxPower) * 0.1, 0);
  
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Battery className="h-5 w-5 text-emerald-500" />
          <h4 className="font-semibold">Battery State of Charge</h4>
        </div>
        <Tabs value={scale} onValueChange={(v) => setScale(v as BatteryScale)}>
          <TabsList className="h-8">
            <TabsTrigger value="residential" className="text-xs px-2 h-6">
              Residential (10 kWh)
            </TabsTrigger>
            <TabsTrigger value="commercial" className="text-xs px-2 h-6">
              Commercial (200 kWh)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id="socGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="chargeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="dischargeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* TOU Period Background Bands */}
        {data.map((d, i) => {
          const tou = getTOUPeriod(d.hour);
          const x = padding.left + (i / 24) * chartWidth;
          const barWidth = chartWidth / 24;
          return (
            <rect
              key={`tou-${i}`}
              x={x}
              y={padding.top}
              width={barWidth}
              height={chartHeight}
              fill={tou.color}
              opacity={0.1}
            />
          );
        })}
        
        {/* Charge/Discharge zones as background fills */}
        {data.map((d, i) => {
          if (i === 23) return null;
          const x = padding.left + (i / 23) * chartWidth;
          const nextX = padding.left + ((i + 1) / 23) * chartWidth;
          const barWidth = nextX - x;
          
          if (d.mode === "idle") return null;
          
          return (
            <rect
              key={`zone-${i}`}
              x={x}
              y={padding.top}
              width={barWidth}
              height={chartHeight}
              fill={d.mode === "charging" ? "#22c55e" : "#f59e0b"}
              opacity={0.15}
            />
          );
        })}
        
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = padding.top + chartHeight - (pct / 100) * chartHeight;
          return (
            <g key={`grid-${pct}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                className="stroke-muted-foreground/20"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                className="text-[10px] fill-muted-foreground"
                textAnchor="end"
              >
                {pct}%
              </text>
            </g>
          );
        })}
        
        {/* X-axis hour labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(hour => {
          const x = padding.left + (hour / 24) * chartWidth;
          return (
            <text
              key={`hour-${hour}`}
              x={x}
              y={padding.top + chartHeight + 16}
              className="text-[10px] fill-muted-foreground"
              textAnchor="middle"
            >
              {hour.toString().padStart(2, '0')}:00
            </text>
          );
        })}
        
        {/* SoC fill area */}
        <path d={fillPath} fill="url(#socGradient)" />
        
        {/* SoC line */}
        <path
          d={socPath}
          fill="none"
          className="stroke-[hsl(var(--chart-2))]"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points with mode indicators */}
        {data.filter((_, i) => i % 3 === 0).map((d, i) => {
          const x = padding.left + ((i * 3) / 23) * chartWidth;
          const y = padding.top + chartHeight - (d.soc / 100) * chartHeight;
          const color = d.mode === "charging" ? "#22c55e" : d.mode === "discharging" ? "#f59e0b" : "hsl(var(--muted-foreground))";
          
          return (
            <g key={`point-${i}`}>
              <circle cx={x} cy={y} r="5" fill={color} />
              <circle cx={x} cy={y} r="3" className="fill-background" />
              {d.mode !== "idle" && (
                <text
                  x={x}
                  y={y - 10}
                  className="text-[8px] font-medium"
                  fill={color}
                  textAnchor="middle"
                >
                  {d.power > 0 ? '+' : ''}{d.power.toFixed(1)} kW
                </text>
              )}
            </g>
          );
        })}
        
        {/* Axis labels */}
        <text
          x={width / 2}
          y={height - 8}
          className="text-[11px] font-medium fill-foreground"
          textAnchor="middle"
        >
          Hour of Day
        </text>
        <text
          x={14}
          y={height / 2}
          className="text-[11px] font-medium fill-foreground"
          textAnchor="middle"
          transform={`rotate(-90, 14, ${height / 2})`}
        >
          State of Charge (%)
        </text>
        
        {/* Capacity label */}
        <text
          x={padding.left + chartWidth + 8}
          y={padding.top + 10}
          className="text-[9px] fill-muted-foreground"
          textAnchor="start"
        >
          {capacity} kWh
        </text>
        <text
          x={padding.left + chartWidth + 8}
          y={padding.top + 22}
          className="text-[9px] fill-muted-foreground"
          textAnchor="start"
        >
          ±{maxPower} kW
        </text>
      </svg>
      
      {/* Legend and Stats */}
      <div className="mt-3 flex flex-wrap gap-4 justify-between text-xs">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500" />
            <span className="text-muted-foreground">Charging</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500" />
            <span className="text-muted-foreground">Discharging</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/50" />
            <span className="text-muted-foreground">Peak TOU</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[hsl(var(--chart-4))]/20 border border-[hsl(var(--chart-4))]/50" />
            <span className="text-muted-foreground">Standard TOU</span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="text-center">
            <div className="font-semibold text-emerald-600">{maxSoC}%</div>
            <div className="text-muted-foreground text-[10px]">Max SoC</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-amber-600">{minSoC}%</div>
            <div className="text-muted-foreground text-[10px]">Min SoC</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground">{((maxSoC - minSoC) / 100 * capacity).toFixed(1)} kWh</div>
            <div className="text-muted-foreground text-[10px]">Daily Cycle</div>
          </div>
        </div>
      </div>
      
      {/* Power Flow Summary */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          <BatteryCharging className="h-4 w-4 text-emerald-500" />
          <div>
            <div className="text-xs font-medium text-emerald-600">Solar → Battery</div>
            <div className="text-[10px] text-muted-foreground">09:00 - 15:00</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <Zap className="h-4 w-4 text-amber-500" />
          <div>
            <div className="text-xs font-medium text-amber-600">Battery → Load</div>
            <div className="text-[10px] text-muted-foreground">17:00 - 21:00 (Peak)</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
          <Home className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs font-medium">Grid Backup</div>
            <div className="text-[10px] text-muted-foreground">SoC &lt; 20%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
