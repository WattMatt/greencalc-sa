import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from "recharts";
import { LayoutDashboard, Zap, TrendingUp, Clock, Download, Eye } from "lucide-react";
import { format, isWeekend } from "date-fns";
import { toast } from "sonner";

interface RawDataPoint {
  timestamp: string;
  values: Record<string, number>;
}

interface ScadaImport {
  id: string;
  site_name: string;
  shop_name: string | null;
  shop_number: string | null;
  meter_label: string | null;
  meter_color: string | null;
  data_points: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  load_profile_weekday: number[] | null;
  load_profile_weekend: number[] | null;
  raw_data: RawDataPoint[] | null;
}

interface SiteMeterOverviewProps {
  siteId: string;
  siteName: string;
  onMeterPreview?: (meterId: string) => void;
}

const DEFAULT_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

export function SiteMeterOverview({ siteId, siteName, onMeterPreview }: SiteMeterOverviewProps) {
  const { data: meters, isLoading } = useQuery({
    queryKey: ["site-meters-overview", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_name, shop_number, meter_label, meter_color, data_points, date_range_start, date_range_end, load_profile_weekday, load_profile_weekend, raw_data")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map(row => ({
        ...row,
        raw_data: Array.isArray(row.raw_data) ? row.raw_data : null
      })) as ScadaImport[];
    },
    enabled: !!siteId,
  });

  const getMeterDisplayName = (meter: ScadaImport) => {
    return meter.meter_label || meter.shop_name || meter.site_name;
  };

  const getMeterColor = (meter: ScadaImport, index: number) => {
    return meter.meter_color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  // Aggregate hourly profile from all meters
  const aggregatedProfile = useMemo(() => {
    if (!meters?.length) return [];

    const hourlyTotals: Record<number, { weekday: number[]; weekend: number[] }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyTotals[h] = { weekday: [], weekend: [] };
    }

    meters.forEach(meter => {
      // Use pre-computed profiles if available
      if (meter.load_profile_weekday?.length === 24) {
        meter.load_profile_weekday.forEach((val, h) => {
          hourlyTotals[h].weekday.push(val);
        });
      }
      if (meter.load_profile_weekend?.length === 24) {
        meter.load_profile_weekend.forEach((val, h) => {
          hourlyTotals[h].weekend.push(val);
        });
      }
    });

    return Array.from({ length: 24 }, (_, hour) => {
      const weekdaySum = hourlyTotals[hour].weekday.reduce((a, b) => a + b, 0);
      const weekendSum = hourlyTotals[hour].weekend.reduce((a, b) => a + b, 0);
      
      return {
        hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
        weekday: Math.round(weekdaySum * 100) / 100,
        weekend: Math.round(weekendSum * 100) / 100,
        total: Math.round((weekdaySum + weekendSum) / 2 * 100) / 100,
      };
    });
  }, [meters]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!meters?.length) return null;

    const metersWithData = meters.filter(m => (m.data_points || 0) > 0);
    const metersWithProfiles = meters.filter(m => m.load_profile_weekday?.length === 24);
    
    // Total daily kWh (sum all meters' daily consumption)
    let totalDailyKwh = 0;
    let peakKw = 0;
    let peakHour = 0;

    aggregatedProfile.forEach(point => {
      totalDailyKwh += point.weekday;
      if (point.weekday > peakKw) {
        peakKw = point.weekday;
        peakHour = point.hour;
      }
    });

    // Calculate monthly estimate (assuming weekday pattern for simplicity)
    const monthlyKwh = totalDailyKwh * 30;

    return {
      totalMeters: meters.length,
      metersWithData: metersWithData.length,
      metersWithProfiles: metersWithProfiles.length,
      totalDailyKwh: Math.round(totalDailyKwh),
      monthlyKwh: Math.round(monthlyKwh),
      peakKw: Math.round(peakKw * 10) / 10,
      peakHour,
    };
  }, [meters, aggregatedProfile]);

  // Top consumers by daily consumption
  const topConsumers = useMemo(() => {
    if (!meters?.length) return [];

    return meters
      .filter(m => m.load_profile_weekday?.length === 24)
      .map(meter => {
        const dailyKwh = meter.load_profile_weekday!.reduce((a, b) => a + b, 0);
        return {
          id: meter.id,
          name: getMeterDisplayName(meter),
          shopName: meter.shop_name,
          shopNumber: meter.shop_number,
          dailyKwh: Math.round(dailyKwh),
          color: getMeterColor(meter, meters.indexOf(meter)),
        };
      })
      .sort((a, b) => b.dailyKwh - a.dailyKwh)
      .slice(0, 5);
  }, [meters]);

  const handleExportCSV = () => {
    if (aggregatedProfile.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Hour", "Weekday (kWh)", "Weekend (kWh)", "Average (kWh)"];
    const rows = aggregatedProfile.map(d => 
      [d.label, d.weekday, d.weekend, d.total].join(",")
    );
    
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${siteName.replace(/\s+/g, "-")}-site-profile-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Site profile exported");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading site overview...</div>
        </CardContent>
      </Card>
    );
  }

  if (!meters?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No meters in this site</h3>
          <p className="text-muted-foreground text-center max-w-sm mt-1">
            Add meters to this site to see an aggregated overview.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Meters</CardDescription>
              <CardTitle className="text-2xl">{summaryStats.totalMeters}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {summaryStats.metersWithProfiles} with profiles
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Daily Consumption</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                {summaryStats.totalDailyKwh.toLocaleString()} kWh
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                ~{summaryStats.monthlyKwh.toLocaleString()} kWh/month
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Peak Demand</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-500" />
                {summaryStats.peakKw} kW
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                at {summaryStats.peakHour.toString().padStart(2, "0")}:00
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Data Status</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                {summaryStats.metersWithData}/{summaryStats.totalMeters}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                meters with raw data
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aggregated Site Profile Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                Site Load Profile
              </CardTitle>
              <CardDescription>
                Aggregated hourly consumption across all site meters
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aggregatedProfile.some(d => d.weekday > 0 || d.weekend > 0) ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aggregatedProfile}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <div className="font-medium mb-2">{label}</div>
                          <div className="space-y-1 text-sm">
                            {payload.map((entry: any) => (
                              <div key={entry.name} className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: entry.color }} 
                                />
                                <span>{entry.name}:</span>
                                <span className="font-medium">{entry.value} kWh</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="weekday"
                    name="Weekday"
                    fill="#3b82f6"
                    stroke="#3b82f6"
                    fillOpacity={0.6}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="weekend"
                    name="Weekend"
                    fill="#22c55e"
                    stroke="#22c55e"
                    fillOpacity={0.4}
                    stackId="2"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <LayoutDashboard className="h-12 w-12 mb-4 opacity-50" />
              <p>No processed profiles available yet</p>
              <p className="text-sm">Process meters to see aggregated load profile</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Consumers */}
      {topConsumers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Consumers
            </CardTitle>
            <CardDescription>
              Meters ranked by daily consumption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topConsumers.map((consumer, idx) => {
                const maxKwh = topConsumers[0]?.dailyKwh || 1;
                const percentage = (consumer.dailyKwh / maxKwh) * 100;
                
                return (
                  <div key={consumer.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            {consumer.shopNumber && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {consumer.shopNumber}
                              </Badge>
                            )}
                            <span className="font-medium truncate max-w-[180px]">
                              {consumer.shopName || consumer.name}
                            </span>
                          </div>
                          {consumer.shopName && consumer.name !== consumer.shopName && (
                            <span className="text-xs text-muted-foreground truncate">
                              {consumer.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{consumer.dailyKwh.toLocaleString()} kWh/day</span>
                        {onMeterPreview && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => onMeterPreview(consumer.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: consumer.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
