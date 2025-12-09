import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import { GitCompare, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { format, isWeekend } from "date-fns";
import { toast } from "sonner";

interface RawDataPoint {
  timestamp: string;
  values: Record<string, number>;
}

interface ScadaImport {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  meter_label: string | null;
  meter_color: string | null;
  raw_data: RawDataPoint[] | null;
}

type DayFilter = "all" | "weekday" | "weekend";

const DEFAULT_COLORS = {
  meterA: "#3b82f6",
  meterB: "#ef4444",
};

export function MeterComparison() {
  const [meterAId, setMeterAId] = useState<string>("");
  const [meterBId, setMeterBId] = useState<string>("");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [showComparison, setShowComparison] = useState(false);

  const { data: meters, isLoading } = useQuery({
    queryKey: ["scada-imports-comparison"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_number, shop_name, meter_label, meter_color, raw_data")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[])
        .filter(row => row.raw_data && Array.isArray(row.raw_data) && row.raw_data.length > 0)
        .map(row => ({
          ...row,
          raw_data: row.raw_data as RawDataPoint[]
        })) as ScadaImport[];
    },
  });

  const getMeterDisplayName = (meter: ScadaImport) => {
    if (meter.meter_label) return meter.meter_label;
    if (meter.shop_name) return meter.shop_name;
    if (meter.shop_number) return meter.shop_number;
    return meter.site_name;
  };

  const meterA = meters?.find(m => m.id === meterAId);
  const meterB = meters?.find(m => m.id === meterBId);

  // Process comparison data
  const comparisonData = useMemo(() => {
    if (!showComparison || !meterA?.raw_data || !meterB?.raw_data) return [];

    const processHourlyData = (rawData: RawDataPoint[]) => {
      const hourlyTotals: Record<number, number[]> = {};
      for (let h = 0; h < 24; h++) hourlyTotals[h] = [];

      rawData.forEach(point => {
        try {
          const date = new Date(point.timestamp);
          
          // Apply day filter
          const weekend = isWeekend(date);
          if (dayFilter === "weekday" && weekend) return;
          if (dayFilter === "weekend" && !weekend) return;

          const hour = date.getHours();
          const primaryKey = Object.keys(point.values).find(k => 
            k.includes("P1") || k.includes("kWh")
          ) || Object.keys(point.values)[0];
          const value = point.values[primaryKey];

          if (typeof value === "number" && !isNaN(value)) {
            hourlyTotals[hour].push(value);
          }
        } catch (e) {}
      });

      return Array.from({ length: 24 }, (_, h) => {
        const values = hourlyTotals[h];
        return values.length > 0 
          ? values.reduce((a, b) => a + b, 0) / values.length 
          : 0;
      });
    };

    const aData = processHourlyData(meterA.raw_data);
    const bData = processHourlyData(meterB.raw_data);

    return aData.map((aVal, hour) => {
      const bVal = bData[hour];
      const diff = aVal - bVal;
      const percentDiff = bVal !== 0 ? ((aVal - bVal) / bVal) * 100 : 0;
      
      return {
        hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
        meterA: Math.round(aVal * 100) / 100,
        meterB: Math.round(bVal * 100) / 100,
        difference: Math.round(diff * 100) / 100,
        percentDiff: Math.round(percentDiff * 10) / 10,
      };
    });
  }, [showComparison, meterA, meterB, dayFilter]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    if (comparisonData.length === 0) return null;

    const totalA = comparisonData.reduce((sum, d) => sum + d.meterA, 0);
    const totalB = comparisonData.reduce((sum, d) => sum + d.meterB, 0);
    const avgDiff = comparisonData.reduce((sum, d) => sum + d.percentDiff, 0) / 24;
    
    const peakA = comparisonData.reduce((max, d) => d.meterA > max.meterA ? d : max);
    const peakB = comparisonData.reduce((max, d) => d.meterB > max.meterB ? d : max);

    return {
      totalA: Math.round(totalA),
      totalB: Math.round(totalB),
      diffPercent: Math.round((totalA - totalB) / totalB * 100 * 10) / 10,
      avgHourlyDiff: Math.round(avgDiff * 10) / 10,
      peakHourA: peakA.hour,
      peakHourB: peakB.hour,
    };
  }, [comparisonData]);

  const handleCompare = () => {
    if (!meterAId || !meterBId) {
      toast.error("Please select both meters");
      return;
    }
    if (meterAId === meterBId) {
      toast.error("Please select different meters");
      return;
    }
    setShowComparison(true);
  };

  const handleExportCSV = () => {
    if (comparisonData.length === 0) return;

    const headers = ["Hour", getMeterDisplayName(meterA!), getMeterDisplayName(meterB!), "Difference (kWh)", "Difference (%)"];
    const rows = comparisonData.map(d => [d.label, d.meterA, d.meterB, d.difference, d.percentDiff].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meter-comparison-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading meters...</div>
        </CardContent>
      </Card>
    );
  }

  if (!meters?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No meter data available</h3>
          <p className="text-muted-foreground text-center max-w-sm mt-1">
            Import SCADA data first to enable meter comparison.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Meter Comparison
          </CardTitle>
          <CardDescription>
            Compare load profiles between two meters side-by-side
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Meter A</Label>
              <Select value={meterAId} onValueChange={setMeterAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select first meter..." />
                </SelectTrigger>
                <SelectContent>
                  {meters.map(m => (
                    <SelectItem key={m.id} value={m.id} disabled={m.id === meterBId}>
                      {getMeterDisplayName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Meter B</Label>
              <Select value={meterBId} onValueChange={setMeterBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select second meter..." />
                </SelectTrigger>
                <SelectContent>
                  {meters.map(m => (
                    <SelectItem key={m.id} value={m.id} disabled={m.id === meterAId}>
                      {getMeterDisplayName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Day Type</Label>
              <Select value={dayFilter} onValueChange={(v) => setDayFilter(v as DayFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  <SelectItem value="weekday">Weekdays Only</SelectItem>
                  <SelectItem value="weekend">Weekends Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleCompare} disabled={!meterAId || !meterBId}>
              <GitCompare className="h-4 w-4 mr-2" />
              Compare Meters
            </Button>
            {showComparison && comparisonData.length > 0 && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showComparison && comparisonData.length > 0 && summaryStats && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEFAULT_COLORS.meterA }} />
                  {getMeterDisplayName(meterA!)}
                </CardDescription>
                <CardTitle className="text-2xl">{summaryStats.totalA.toLocaleString()} kWh</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEFAULT_COLORS.meterB }} />
                  {getMeterDisplayName(meterB!)}
                </CardDescription>
                <CardTitle className="text-2xl">{summaryStats.totalB.toLocaleString()} kWh</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Difference</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {summaryStats.diffPercent > 0 ? (
                    <TrendingUp className="h-5 w-5 text-red-500" />
                  ) : summaryStats.diffPercent < 0 ? (
                    <TrendingDown className="h-5 w-5 text-green-500" />
                  ) : (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                  {summaryStats.diffPercent > 0 ? "+" : ""}{summaryStats.diffPercent}%
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Peak Hours</CardDescription>
                <CardTitle className="text-lg">
                  A: {summaryStats.peakHourA.toString().padStart(2, "0")}:00 / 
                  B: {summaryStats.peakHourB.toString().padStart(2, "0")}:00
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Hourly Comparison</CardTitle>
              <CardDescription>
                Average hourly consumption • {dayFilter === "all" ? "All days" : dayFilter}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0]?.payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <div className="font-medium mb-2">{label}</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEFAULT_COLORS.meterA }} />
                                <span>{getMeterDisplayName(meterA!)}:</span>
                                <span className="font-medium">{data?.meterA} kWh</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEFAULT_COLORS.meterB }} />
                                <span>{getMeterDisplayName(meterB!)}:</span>
                                <span className="font-medium">{data?.meterB} kWh</span>
                              </div>
                              <div className="border-t pt-1 mt-1">
                                <span>Difference: </span>
                                <span className={`font-medium ${data?.difference > 0 ? "text-red-500" : data?.difference < 0 ? "text-green-500" : ""}`}>
                                  {data?.difference > 0 ? "+" : ""}{data?.difference} kWh ({data?.percentDiff > 0 ? "+" : ""}{data?.percentDiff}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="meterA"
                      name={getMeterDisplayName(meterA!)}
                      stroke={DEFAULT_COLORS.meterA}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="meterB"
                      name={getMeterDisplayName(meterB!)}
                      stroke={DEFAULT_COLORS.meterB}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}