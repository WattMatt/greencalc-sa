import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, Legend, Line } from "recharts";
import { Activity, Calendar, Zap, Clock, Loader2, ChevronLeft, ChevronRight, Scale, TrendingUp } from "lucide-react";
import { useMonthlyConsumption } from "@/components/loadprofiles/hooks/useMonthlyConsumption";
import { useDailyConsumption } from "@/components/loadprofiles/hooks/useDailyConsumption";
import { useMemo, useState } from "react";

interface ScaledMeterPreviewProps {
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
  // Tenant context for scaling
  tenantName: string;
  tenantArea: number;
  shopTypeIntensity?: number; // kWh/m²/month for the shop type
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

export function ScaledMeterPreview({ 
  isOpen, 
  onClose, 
  meter, 
  tenantName, 
  tenantArea,
  shopTypeIntensity = 50 // Default intensity
}: ScaledMeterPreviewProps) {
  const [showScaled, setShowScaled] = useState(true);
  
  const { 
    isLoading: isLoadingMonthly, 
    selectedMonth, 
    setSelectedMonth, 
    selectedMonthData,
    availableMonths 
  } = useMonthlyConsumption(isOpen ? meter?.id || null : null);

  const {
    isLoading: isLoadingDaily,
    selectedDayData,
    navigateDay,
    currentIndex,
    totalDays,
    setSelectedDate,
    days
  } = useDailyConsumption(isOpen ? meter?.id || null : null);

  // Calculate the scale factor
  const scalingInfo = useMemo(() => {
    if (!meter) return null;
    
    const meterArea = meter.area_sqm || 0;
    const meterDailyKwh = meter.load_profile_weekday?.reduce((sum, val) => sum + (val || 0), 0) || 0;
    const meterMonthlyKwh = meterDailyKwh * 30;
    const meterIntensity = meterArea > 0 ? meterMonthlyKwh / meterArea : 0;
    
    // Area scale factor
    const areaScaleFactor = meterArea > 0 ? tenantArea / meterArea : 1;
    
    // Daily kWh for tenant (scaled)
    const tenantDailyKwh = meterDailyKwh * areaScaleFactor;
    const tenantMonthlyKwh = tenantDailyKwh * 30;
    
    return {
      meterArea,
      tenantArea,
      areaScaleFactor,
      meterDailyKwh,
      meterMonthlyKwh,
      meterIntensity,
      tenantDailyKwh,
      tenantMonthlyKwh,
    };
  }, [meter, tenantArea]);

  if (!meter) return null;

  const displayName = meter.meter_label || meter.shop_name || meter.shop_number || meter.site_name;
  const hasData = meter.data_points && meter.data_points > 0;
  const scaleFactor = scalingInfo?.areaScaleFactor || 1;

  // Prepare chart data with scaling
  const createChartData = (profile: number[], isWeekend: boolean, applyScale: boolean) => {
    const factor = applyScale ? scaleFactor : 1;
    return profile.map((kw, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      kw: kw * factor,
      rawKw: kw,
      touPeriod: getTOUPeriod(hour, isWeekend),
      fill: TOU_COLORS[getTOUPeriod(hour, isWeekend)],
    }));
  };

  // Calculate scaled daily stats
  const getScaledDayData = (dayData: typeof selectedDayData) => {
    if (!dayData) return null;
    return {
      ...dayData,
      totalKwh: showScaled ? dayData.totalKwh * scaleFactor : dayData.totalKwh,
      peakKw: showScaled ? dayData.peakKw * scaleFactor : dayData.peakKw,
      hourlyProfile: dayData.hourlyProfile.map(v => showScaled ? v * scaleFactor : v),
    };
  };

  const scaledDayData = getScaledDayData(selectedDayData);
  const monthlyKwh = selectedMonthData?.totalKwh ?? null;
  const scaledMonthlyKwh = monthlyKwh !== null ? (showScaled ? monthlyKwh * scaleFactor : monthlyKwh) : null;
  const monthlyPeak = selectedMonthData?.peakKw ?? null;
  const scaledMonthlyPeak = monthlyPeak !== null ? (showScaled ? monthlyPeak * scaleFactor : monthlyPeak) : null;

  const renderChart = (data: { hour: string; kw: number; rawKw: number; touPeriod: string; fill: string }[], isWeekend: boolean, peakHour: number) => (
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
                    {showScaled ? (
                      <>
                        <p className="font-mono text-primary">{data.kw.toFixed(2)} kW (scaled)</p>
                        <p className="font-mono text-muted-foreground text-xs">{data.rawKw.toFixed(2)} kW (raw)</p>
                      </>
                    ) : (
                      <p className="font-mono">{data.rawKw.toFixed(2)} kW</p>
                    )}
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
            fill={showScaled ? "hsl(var(--primary))" : (meter.meter_color || 'hsl(var(--muted-foreground))')}
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
            <Scale className="h-5 w-5" />
            Scaled Load Profile for {tenantName}
          </DialogTitle>
          <DialogDescription>
            Profile source: <span className="font-medium text-foreground">{displayName}</span>
            {meter.site_name !== displayName && (
              <span className="text-muted-foreground"> — {meter.site_name}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!hasData ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No data available</p>
            <p className="text-sm">This meter needs to be processed first</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scaling Info Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium">Scaling Adjustment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-scaled" className="text-sm text-muted-foreground">Show Scaled</Label>
                    <Switch 
                      id="show-scaled" 
                      checked={showScaled} 
                      onCheckedChange={setShowScaled}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Meter Area</p>
                    <p className="font-mono font-medium">{scalingInfo?.meterArea?.toLocaleString() || '—'} m²</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Tenant Area</p>
                    <p className="font-mono font-medium text-primary">{tenantArea.toLocaleString()} m²</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Scale Factor</p>
                    <p className={`font-mono font-medium ${
                      scaleFactor > 1.5 || scaleFactor < 0.5 
                        ? "text-amber-600" 
                        : "text-primary"
                    }`}>
                      ×{scaleFactor.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Est. Monthly</p>
                    <p className="font-mono font-medium">
                      {showScaled 
                        ? `${((scalingInfo?.tenantMonthlyKwh || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`
                        : `${((scalingInfo?.meterMonthlyKwh || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Stats summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-muted/30 md:col-span-2">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Zap className="h-4 w-4" />
                      Monthly Consumption
                      {showScaled && <Badge variant="secondary" className="text-xs">Scaled</Badge>}
                    </div>
                    {availableMonths.length > 0 && (
                      <Select value={selectedMonth || ""} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMonths.map(m => (
                            <SelectItem key={m.value} value={m.value} className="text-xs">
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  {isLoadingMonthly ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading monthly data...</span>
                    </div>
                  ) : scaledMonthlyKwh !== null ? (
                    <>
                      <p className="text-2xl font-bold">
                        {scaledMonthlyKwh >= 1000 
                          ? `${(scaledMonthlyKwh / 1000).toFixed(1)}K`
                          : scaledMonthlyKwh.toFixed(0)
                        }
                        <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {showScaled 
                          ? `Scaled for ${tenantName} (${tenantArea}m²)`
                          : `Raw consumption for ${selectedMonthData?.label}`
                        }
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No monthly data available
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Activity className="h-4 w-4" />
                    Peak Demand
                  </div>
                  {scaledMonthlyPeak !== null ? (
                    <>
                      <p className="text-2xl font-bold mt-1">
                        {scaledMonthlyPeak.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">kW</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {showScaled ? "scaled" : "raw"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Select a month</p>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Clock className="h-4 w-4" />
                    Data Points
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {meter.data_points?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">readings</p>
                </CardContent>
              </Card>
            </div>

            {/* Daily View with slider */}
            <div className="space-y-4">
              {isLoadingDaily ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading daily data...</span>
                </div>
              ) : totalDays === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No daily data available. Raw data may not be stored.
                </div>
              ) : (
                <>
                  {/* Day navigation */}
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateDay('prev')}
                          disabled={currentIndex <= 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <div className="text-center flex-1">
                          <div className="text-lg font-semibold">
                            {scaledDayData?.label}
                            {scaledDayData?.isWeekend && (
                              <Badge variant="outline" className="ml-2 text-xs">Weekend</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Day {currentIndex + 1} of {totalDays}
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateDay('next')}
                          disabled={currentIndex >= totalDays - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Slider */}
                      <Slider
                        value={[currentIndex]}
                        min={0}
                        max={Math.max(0, totalDays - 1)}
                        step={1}
                        onValueChange={(value) => {
                          if (days[value[0]]) {
                            setSelectedDate(days[value[0]].date);
                          }
                        }}
                        className="w-full"
                      />
                      
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{days[0]?.label}</span>
                        <span>{days[days.length - 1]?.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Day stats */}
                  {scaledDayData && (
                    <div className="grid grid-cols-3 gap-3">
                      <Card className="bg-muted/30">
                        <CardContent className="pt-3 pb-2">
                          <div className="text-xs text-muted-foreground">Total</div>
                          <div className="text-lg font-bold">
                            {scaledDayData.totalKwh.toFixed(1)}
                            <span className="text-xs font-normal ml-1">kWh</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/30">
                        <CardContent className="pt-3 pb-2">
                          <div className="text-xs text-muted-foreground">Peak</div>
                          <div className="text-lg font-bold">
                            {scaledDayData.peakKw.toFixed(2)}
                            <span className="text-xs font-normal ml-1">kW</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/30">
                        <CardContent className="pt-3 pb-2">
                          <div className="text-xs text-muted-foreground">Peak Hour</div>
                          <div className="text-lg font-bold">
                            {scaledDayData.peakHour.toString().padStart(2, '0')}:00
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  
                  {/* Daily chart */}
                  {scaledDayData && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>
                            {showScaled ? "Scaled" : "Raw"} Profile — {scaledDayData.label}
                            <Badge variant={showScaled ? "default" : "outline"} className="ml-2 text-xs">
                              {showScaled ? `×${scaleFactor.toFixed(2)}` : "Raw"}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground font-normal">
                            {scaledDayData.totalKwh.toFixed(1)} kWh total
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderChart(
                          createChartData(selectedDayData?.hourlyProfile || [], scaledDayData.isWeekend, showScaled),
                          scaledDayData.isWeekend,
                          scaledDayData.peakHour
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>

            {/* Data info */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Data Range</p>
                    <p className="font-mono">
                      {meter.date_range_start && meter.date_range_end
                        ? `${format(new Date(meter.date_range_start), "dd MMM")} - ${format(new Date(meter.date_range_end), "dd MMM yyyy")}`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Weekdays</p>
                    <p className="font-mono">{meter.weekday_days ?? 0} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Weekends</p>
                    <p className="font-mono">{meter.weekend_days ?? 0} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Processed</p>
                    <p className="font-mono">
                      {meter.processed_at 
                        ? format(new Date(meter.processed_at), "dd MMM yyyy")
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
