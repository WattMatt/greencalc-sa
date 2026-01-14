import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts";
import { Activity, Calendar, Zap, Clock } from "lucide-react";

interface MeterProfilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  meter: {
    id: string;
    site_name: string;
    shop_name: string | null;
    shop_number: string | null;
    meter_label: string | null;
    meter_color: string | null;
    load_profile_weekday: number[] | null;
    load_profile_weekend: number[] | null;
    date_range_start: string | null;
    date_range_end: string | null;
    data_points: number | null;
    weekday_days: number | null;
    weekend_days: number | null;
    processed_at: string | null;
    area_sqm: number | null;
  } | null;
}

// TOU periods for coloring (South African standard)
function getTOUPeriod(hour: number, isWeekend: boolean): 'peak' | 'standard' | 'off-peak' {
  if (isWeekend) {
    if (hour >= 7 && hour < 12) return 'standard';
    if (hour >= 18 && hour < 20) return 'standard';
    return 'off-peak';
  }
  // Weekday
  if ((hour >= 7 && hour < 10) || (hour >= 18 && hour < 20)) return 'peak';
  if ((hour >= 6 && hour < 7) || (hour >= 10 && hour < 18) || (hour >= 20 && hour < 22)) return 'standard';
  return 'off-peak';
}

const TOU_COLORS = {
  'peak': 'hsl(0, 72%, 51%)', // red
  'standard': 'hsl(45, 93%, 47%)', // amber
  'off-peak': 'hsl(142, 71%, 45%)', // green
};

export function MeterProfilePreview({ isOpen, onClose, meter }: MeterProfilePreviewProps) {
  if (!meter) return null;

  const displayName = meter.meter_label || meter.shop_name || meter.shop_number || meter.site_name;
  const hasProfile = meter.load_profile_weekday && meter.load_profile_weekday.length > 0;

  // Calculate stats
  const weekdayProfile = meter.load_profile_weekday || Array(24).fill(0);
  const weekendProfile = meter.load_profile_weekend || Array(24).fill(0);
  
  // Check if profiles are normalized (sum ~100) or actual kW values
  const weekdaySum = weekdayProfile.reduce((a, b) => a + b, 0);
  const weekendSum = weekendProfile.reduce((a, b) => a + b, 0);
  const isNormalized = weekdaySum > 90 && weekdaySum < 110; // Normalized profiles sum to ~100
  
  // For display, use actual values if available, otherwise show normalized
  const weekdayTotal = isNormalized ? weekdaySum : weekdaySum; // kWh/day = sum of hourly kW
  const weekendTotal = isNormalized ? weekendSum : weekendSum;
  const weekdayPeak = Math.max(...weekdayProfile);
  const weekendPeak = Math.max(...weekendProfile);
  
  const weekdayPeakHour = weekdayProfile.indexOf(weekdayPeak);
  const weekendPeakHour = weekendProfile.indexOf(weekendPeak);

  // Prepare chart data
  const createChartData = (profile: number[], isWeekend: boolean) => {
    return profile.map((kw, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      kw,
      touPeriod: getTOUPeriod(hour, isWeekend),
      fill: TOU_COLORS[getTOUPeriod(hour, isWeekend)],
    }));
  };

  const weekdayData = createChartData(weekdayProfile, false);
  const weekendData = createChartData(weekendProfile, true);

  // Calculate monthly estimate
  const dailyWeekdayKwh = weekdayTotal;
  const dailyWeekendKwh = weekendTotal;
  const monthlyEstimate = (dailyWeekdayKwh * 22) + (dailyWeekendKwh * 8);

  const renderChart = (data: typeof weekdayData, isWeekend: boolean, peakHour: number) => (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          
          {/* TOU period backgrounds */}
          {data.map((d, i) => (
            <ReferenceArea
              key={i}
              x1={d.hour}
              x2={data[i + 1]?.hour || d.hour}
              y1={0}
              fill={d.fill}
              fillOpacity={0.1}
            />
          ))}
          
          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 10 }}
            interval={1}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis 
            tick={{ fontSize: 11 }}
            label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold">{data.hour}</p>
                    <p className="font-mono">{data.kw.toFixed(2)} kW</p>
                    <Badge 
                      variant="outline" 
                      className="mt-1 text-xs"
                      style={{ 
                        borderColor: TOU_COLORS[data.touPeriod as keyof typeof TOU_COLORS],
                        color: TOU_COLORS[data.touPeriod as keyof typeof TOU_COLORS]
                      }}
                    >
                      {data.touPeriod.charAt(0).toUpperCase() + data.touPeriod.slice(1)}
                    </Badge>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar 
            dataKey="kw" 
            fill={meter.meter_color || 'hsl(var(--primary))'}
            radius={[2, 2, 0, 0]}
            opacity={0.9}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: TOU_COLORS.peak, opacity: 0.3 }} />
          <span>Peak</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: TOU_COLORS.standard, opacity: 0.3 }} />
          <span>Standard</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: TOU_COLORS['off-peak'], opacity: 0.3 }} />
          <span>Off-Peak</span>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Load Profile Preview
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{displayName}</span>
            {meter.site_name !== displayName && (
              <span className="text-muted-foreground"> — {meter.site_name}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!hasProfile ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No profile data available</p>
            <p className="text-sm">This meter needs to be processed first</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Zap className="h-4 w-4" />
                    Monthly Est.
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {monthlyEstimate >= 1000 
                      ? `${(monthlyEstimate / 1000).toFixed(1)}K`
                      : monthlyEstimate.toFixed(0)
                    }
                    <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Activity className="h-4 w-4" />
                    Peak Demand
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {Math.max(weekdayPeak, weekendPeak).toFixed(1)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">kW</span>
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Clock className="h-4 w-4" />
                    Peak Hour
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {weekdayPeakHour.toString().padStart(2, '0')}:00
                    <span className="text-sm font-normal text-muted-foreground ml-1">WD</span>
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="h-4 w-4" />
                    Data Days
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {(meter.weekday_days || 0) + (meter.weekend_days || 0)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Profile tabs */}
            <Tabs defaultValue="weekday" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="weekday" className="gap-2">
                  Weekday
                  <Badge variant="secondary" className="text-xs">
                    {weekdayTotal.toFixed(1)} kWh/day
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="weekend" className="gap-2">
                  Weekend
                  <Badge variant="secondary" className="text-xs">
                    {weekendTotal.toFixed(1)} kWh/day
                  </Badge>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="weekday" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Average Weekday Profile</span>
                      <span className="text-muted-foreground font-normal">
                        Peak: {weekdayPeak.toFixed(2)} kW @ {weekdayPeakHour.toString().padStart(2, '0')}:00
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderChart(weekdayData, false, weekdayPeakHour)}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="weekend" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Average Weekend Profile</span>
                      <span className="text-muted-foreground font-normal">
                        Peak: {weekendPeak.toFixed(2)} kW @ {weekendPeakHour.toString().padStart(2, '0')}:00
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderChart(weekendData, true, weekendPeakHour)}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Data info */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
              {meter.date_range_start && meter.date_range_end && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(meter.date_range_start), 'MMM d, yyyy')} — {format(new Date(meter.date_range_end), 'MMM d, yyyy')}
                </div>
              )}
              {meter.data_points && (
                <div>
                  {meter.data_points.toLocaleString()} data points
                </div>
              )}
              {meter.processed_at && (
                <div>
                  Processed: {format(new Date(meter.processed_at), 'MMM d, yyyy HH:mm')}
                </div>
              )}
              {meter.area_sqm && (
                <div>
                  Area: {meter.area_sqm.toLocaleString()} m² • Intensity: {(monthlyEstimate / meter.area_sqm).toFixed(1)} kWh/m²/mo
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
