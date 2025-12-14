import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartDataPoint, Tenant } from "../types";

interface TopContributorsProps {
  tenants: Tenant[];
  chartData: ChartDataPoint[];
}

export function TopContributors({ tenants, chartData }: TopContributorsProps) {
  const contributors = tenants
    .map((t) => {
      const key = t.name.length > 15 ? t.name.slice(0, 15) + "…" : t.name;
      const total = chartData.reduce((sum, h) => sum + (Number(h[key]) || 0), 0);
      return { name: t.name, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs text-muted-foreground">Top Contributors</p>
        <Badge variant="outline" className="text-[10px]">
          {tenants.length} tenants
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {contributors.map((c, i) => (
          <Badge key={i} variant="secondary" className="text-[10px]">
            {c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name}
            <span className="ml-1 opacity-70">{c.total.toFixed(0)}</span>
          </Badge>
        ))}
      </div>
    </Card>
  );
}
