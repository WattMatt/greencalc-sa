import { Card } from "@/components/ui/card";
import { PVStats } from "../types";

interface ChartStatsProps {
  totalDaily: number;
  avgHourly: number;
  loadFactor: number;
  unit: string;
  pvStats: PVStats | null;
}

export function ChartStats({ totalDaily, avgHourly, loadFactor, unit, pvStats }: ChartStatsProps) {
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
        <p className="text-xs text-muted-foreground">Monthly Est.</p>
        <p className="text-xl font-semibold">{Math.round(totalDaily * 30).toLocaleString()}</p>
      </Card>
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
