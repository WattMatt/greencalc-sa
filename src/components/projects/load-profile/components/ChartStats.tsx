import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PVStats } from "../types";

interface ChartStatsProps {
  totalDaily: number;
  avgHourly: number;
  loadFactor: number;
  unit: string;
  pvStats: PVStats | null;
  weekdayDailyKwh?: number;
  weekendDailyKwh?: number;
  validatedDateCount?: number;
}

export function ChartStats({ 
  totalDaily, 
  avgHourly, 
  loadFactor, 
  unit, 
  pvStats,
  weekdayDailyKwh,
  weekendDailyKwh,
  validatedDateCount,
}: ChartStatsProps) {
  // Calculate monthly based on actual weekday/weekend breakdown if available
  // Typical month: 22 weekdays + 8 weekend days
  const weekdaysPerMonth = 22;
  const weekendDaysPerMonth = 8;
  
  let monthlyKwh: number;
  let monthlyLabel: string;
  
  if (weekdayDailyKwh !== undefined && weekendDailyKwh !== undefined) {
    monthlyKwh = (weekdayDailyKwh * weekdaysPerMonth) + (weekendDailyKwh * weekendDaysPerMonth);
    monthlyLabel = `(${Math.round(weekdayDailyKwh)}×${weekdaysPerMonth} + ${Math.round(weekendDailyKwh)}×${weekendDaysPerMonth})`;
  } else {
    // Fallback to simple estimate
    monthlyKwh = totalDaily * 30;
    monthlyLabel = `(${Math.round(totalDaily)}/day × 30)`;
  }

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Daily {unit}</p>
        <p className="text-xl font-semibold">{Math.round(totalDaily).toLocaleString()}</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Avg Hourly</p>
        <p className="text-xl font-semibold">
          {avgHourly.toFixed(1)} {unit}
        </p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Load Factor</p>
        <p className="text-xl font-semibold">{loadFactor.toFixed(0)}%</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          Monthly
          <Badge variant="outline" className="text-[9px] h-4 px-1 font-normal">
            calc
          </Badge>
        </p>
        <p className="text-xl font-semibold">
          {monthlyKwh >= 1000 
            ? `${(monthlyKwh / 1000).toFixed(1)}K` 
            : Math.round(monthlyKwh).toLocaleString()
          }
        </p>
        <p className="text-[10px] text-muted-foreground truncate" title={monthlyLabel}>
          {monthlyLabel}
        </p>
      </Card>
      {validatedDateCount !== undefined && (
        <Card className="p-3 border-blue-500/30">
          <p className="text-xs text-muted-foreground">Validated Days</p>
          <p className="text-xl font-semibold text-blue-500">{validatedDateCount}</p>
          <p className="text-[10px] text-muted-foreground">full-coverage dates</p>
        </Card>
      )}
      {pvStats && (
        <>
          <Card className="p-3 border-amber-500/30">
            <p className="text-xs text-muted-foreground">PV Generated</p>
            <p className="text-xl font-semibold text-amber-500">
              {Math.round(pvStats.totalGeneration).toLocaleString()} {unit}
            </p>
          </Card>
          <Card className="p-3 border-green-500/30">
            <p className="text-xs text-muted-foreground">Solar Coverage</p>
            <p className="text-xl font-semibold text-green-600">{pvStats.solarCoverage.toFixed(0)}%</p>
          </Card>
        </>
      )}
    </div>
  );
}
