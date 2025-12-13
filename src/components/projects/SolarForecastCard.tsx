import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sun, CloudSun, Thermometer, RefreshCw, MapPin } from 'lucide-react';
import { useSolcastForecast, SolcastDailyForecast } from '@/hooks/useSolcastForecast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';

interface SolarForecastCardProps {
  projectLocation?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
}

export function SolarForecastCard({ 
  projectLocation, 
  defaultLatitude = -33.8688, 
  defaultLongitude = 151.2093 
}: SolarForecastCardProps) {
  const [latitude, setLatitude] = useState(defaultLatitude);
  const [longitude, setLongitude] = useState(defaultLongitude);
  const { data, isLoading, error, fetchForecast } = useSolcastForecast();

  const handleFetch = () => {
    fetchForecast({ latitude, longitude, hours: 168 });
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Chart data
  const chartData = data?.daily.map((d: SolcastDailyForecast) => ({
    date: formatDate(d.date),
    ghi: d.ghi_kwh_m2,
    psh: d.peak_sun_hours,
    temp: d.air_temp_avg,
  })) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              Solar Irradiance Forecast
            </CardTitle>
            <CardDescription>
              7-day radiation and weather forecast from Solcast
            </CardDescription>
          </div>
          {data && (
            <Badge variant="secondary">
              {data.summary.average_peak_sun_hours.toFixed(1)} avg PSH
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location inputs */}
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Latitude</Label>
            <Input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
              placeholder="-33.8688"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Longitude</Label>
            <Input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
              placeholder="151.2093"
            />
          </div>
          <Button onClick={handleFetch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{data ? 'Refresh' : 'Fetch'}</span>
          </Button>
        </div>

        {/* Error display */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Summary stats */}
        {data && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <Sun className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                <div className="text-lg font-semibold">
                  {data.summary.average_daily_ghi_kwh_m2.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">kWh/m²/day</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <CloudSun className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <div className="text-lg font-semibold">
                  {data.summary.average_peak_sun_hours.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Avg PSH</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Thermometer className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <div className="text-lg font-semibold">
                  {data.daily.length > 0 && data.daily[0].air_temp_avg !== null
                    ? `${data.daily[0].air_temp_avg.toFixed(0)}°C`
                    : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Today Temp</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <MapPin className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <div className="text-lg font-semibold">
                  {data.summary.total_forecast_days}
                </div>
                <div className="text-xs text-muted-foreground">Days</div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorGhi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    label={{ value: 'kWh/m²', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'ghi') return [`${value.toFixed(2)} kWh/m²`, 'GHI'];
                      if (name === 'psh') return [`${value.toFixed(1)} hrs`, 'Peak Sun Hours'];
                      if (name === 'temp') return [`${value?.toFixed(1) || '-'}°C`, 'Temperature'];
                      return [value, name];
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ghi" 
                    stroke="hsl(var(--chart-1))" 
                    fillOpacity={1} 
                    fill="url(#colorGhi)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Daily breakdown table */}
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-right">GHI</th>
                    <th className="p-2 text-right">PSH</th>
                    <th className="p-2 text-right">Temp</th>
                    <th className="p-2 text-right">Cloud</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((day) => (
                    <tr key={day.date} className="border-b border-border/50">
                      <td className="p-2">{formatDate(day.date)}</td>
                      <td className="p-2 text-right">{day.ghi_kwh_m2.toFixed(2)}</td>
                      <td className="p-2 text-right">{day.peak_sun_hours.toFixed(1)}</td>
                      <td className="p-2 text-right">
                        {day.air_temp_avg !== null ? `${day.air_temp_avg.toFixed(0)}°C` : '-'}
                      </td>
                      <td className="p-2 text-right">
                        {day.cloud_opacity_avg !== null ? `${(day.cloud_opacity_avg * 100).toFixed(0)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!data && !isLoading && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Sun className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Enter coordinates and click Fetch to get solar forecast data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
