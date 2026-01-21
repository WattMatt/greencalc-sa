import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingDown } from "lucide-react";
import { generate20YearProjection, type PVsystLossChainConfig } from "@/lib/pvsystLossChain";

interface DegradationProjectionProps {
  dailyGHI: number;
  capacityKwp: number;
  ambientTemp: number;
  config: PVsystLossChainConfig;
  showChart?: boolean;
  className?: string;
}

export function DegradationProjection({
  dailyGHI,
  capacityKwp,
  ambientTemp,
  config,
  showChart = true,
  className,
}: DegradationProjectionProps) {
  const projection = useMemo(() => {
    return generate20YearProjection(dailyGHI, capacityKwp, ambientTemp, config);
  }, [dailyGHI, capacityKwp, ambientTemp, config]);

  const year1Output = projection[0]?.annualEGridKwh ?? 0;
  const year20Output = projection[19]?.annualEGridKwh ?? 0;
  const totalDegradation = projection[19]?.cumulativeDegradation ?? 0;
  const lifetimeProduction = projection.slice(0, 20).reduce((sum, yr) => sum + yr.annualEGridKwh, 0);

  // Format large numbers
  const formatEnergy = (kwh: number) => {
    if (kwh >= 1000000) return `${(kwh / 1000000).toFixed(2)} GWh`;
    if (kwh >= 1000) return `${(kwh / 1000).toFixed(0)} MWh`;
    return `${kwh.toFixed(0)} kWh`;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">20-Year Degradation</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            -{totalDegradation.toFixed(1)}% by Year 20
          </Badge>
        </div>
        <CardDescription className="text-xs">
          LID: {config.array.lidLoss}% + Module Degradation: {config.array.moduleDegradationLoss}%
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">Year 1</div>
            <div className="text-sm font-semibold">{formatEnergy(year1Output)}</div>
            <div className="text-xs text-muted-foreground">PR {projection[0]?.performanceRatio.toFixed(1)}%</div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">Year 20</div>
            <div className="text-sm font-semibold">{formatEnergy(year20Output)}</div>
            <div className="text-xs text-muted-foreground">PR {projection[19]?.performanceRatio.toFixed(1)}%</div>
          </div>
          <div className="text-center p-2 bg-primary/10 rounded-lg">
            <div className="text-xs text-muted-foreground">Lifetime</div>
            <div className="text-sm font-semibold text-primary">{formatEnergy(lifetimeProduction)}</div>
            <div className="text-xs text-muted-foreground">20 years</div>
          </div>
        </div>

        {/* Chart */}
        {showChart && (
          <div className="h-40 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projection} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="energy"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <YAxis 
                  yAxisId="pr"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[50, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "Annual Output") return [formatEnergy(value), name];
                    return [`${value.toFixed(1)}%`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Line
                  yAxisId="energy"
                  type="monotone"
                  dataKey="annualEGridKwh"
                  name="Annual Output"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="pr"
                  type="monotone"
                  dataKey="performanceRatio"
                  name="PR %"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table (scrollable, showing key years) */}
        <ScrollArea className="h-32">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">Year</TableHead>
                <TableHead className="text-xs text-right">Degradation</TableHead>
                <TableHead className="text-xs text-right">PR</TableHead>
                <TableHead className="text-xs text-right">Output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projection
                .filter((_, i) => i === 0 || (i + 1) % 5 === 0 || i === 19)
                .map((yr) => (
                  <TableRow key={yr.year}>
                    <TableCell className="text-xs font-medium py-1.5">
                      {yr.year}
                    </TableCell>
                    <TableCell className="text-xs text-right py-1.5 text-amber-600">
                      -{yr.cumulativeDegradation.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs text-right py-1.5">
                      {yr.performanceRatio.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs text-right py-1.5">
                      {formatEnergy(yr.annualEGridKwh)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
