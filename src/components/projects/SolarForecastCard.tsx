import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Loader2, Sun, Mountain, Thermometer, RefreshCw, Compass } from 'lucide-react';
import { useGlobalSolarAtlas } from '@/hooks/useGlobalSolarAtlas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SolarForecastCardProps {
  projectLocation?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
}

export function SolarForecastCard({
  projectLocation,
  defaultLatitude = -26.2044,
  defaultLongitude = 28.0456,
}: SolarForecastCardProps) {
  const [latitude, setLatitude] = useState(defaultLatitude);
  const [longitude, setLongitude] = useState(defaultLongitude);
  const { data, isLoading, error, fetchData } = useGlobalSolarAtlas();

  useEffect(() => {
    setLatitude(defaultLatitude);
    setLongitude(defaultLongitude);
  }, [defaultLatitude, defaultLongitude]);

  const handleFetch = () => {
    setLatitude(defaultLatitude);
    setLongitude(defaultLongitude);
    fetchData(defaultLatitude, defaultLongitude);
  };

  const annual = data?.annual?.data;
  const monthly = data?.monthly?.data;

  const chartData = monthly
    ? MONTH_LABELS.map((month, i) => ({
        month,
        pvout: monthly.PVOUT_csi?.[i] ?? 0,
        ghi: monthly.GHI?.[i] ?? 0,
      }))
    : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              Global Solar Atlas
            </CardTitle>
            <CardDescription>
              Long-term average irradiation &amp; PV output potential
            </CardDescription>
          </div>
          {annual && (
            <Badge variant="secondary">
              {annual.PVOUT_csi.toFixed(0)} kWh/kWp
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location inputs */}
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Latitude</Label>
            <NumericInput step="0.0001" value={latitude} onChange={setLatitude} placeholder="-26.2044" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Longitude</Label>
            <NumericInput step="0.0001" value={longitude} onChange={setLongitude} placeholder="28.0456" />
          </div>
          <Button onClick={handleFetch} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">{data ? 'Refresh' : 'Fetch'}</span>
          </Button>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}

        {annual && monthly && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <Sun className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                <div className="text-lg font-semibold">{annual.PVOUT_csi.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">kWh/kWp/yr</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Sun className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <div className="text-lg font-semibold">{annual.GHI.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">GHI kWh/m²</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Sun className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                <div className="text-lg font-semibold">{annual.DNI.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">DNI kWh/m²</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Thermometer className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <div className="text-lg font-semibold">{annual.TEMP.toFixed(1)}°C</div>
                <div className="text-xs text-muted-foreground">Avg Temp</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Compass className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <div className="text-lg font-semibold">{annual.OPTA}°</div>
                <div className="text-xs text-muted-foreground">Opt. Tilt</div>
              </div>
            </div>

            {/* Elevation + GTI row */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mountain className="h-4 w-4" /> Elevation: {annual.ELE} m
              </span>
              <span>GTI (opt): {annual.GTI_opta.toFixed(0)} kWh/m²/yr</span>
              <span>DIF: {annual.DIF.toFixed(0)} kWh/m²/yr</span>
            </div>

            {/* Chart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'pvout') return [`${value.toFixed(1)} kWh/kWp`, 'PVOUT'];
                      if (name === 'ghi') return [`${value.toFixed(1)} kWh/m²`, 'GHI'];
                      return [value, name];
                    }}
                  />
                  <Legend
                    formatter={(value) => (value === 'pvout' ? 'PVOUT (kWh/kWp)' : 'GHI (kWh/m²)')}
                  />
                  <Bar dataKey="pvout" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ghi" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly table */}
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Month</th>
                    <th className="p-2 text-right">PVOUT</th>
                    <th className="p-2 text-right">GHI</th>
                    <th className="p-2 text-right">DNI</th>
                    <th className="p-2 text-right">DIF</th>
                    <th className="p-2 text-right">GTI</th>
                    <th className="p-2 text-right">Temp</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTH_LABELS.map((month, i) => (
                    <tr key={month} className="border-b border-border/50">
                      <td className="p-2">{month}</td>
                      <td className="p-2 text-right">{monthly.PVOUT_csi?.[i]?.toFixed(1) ?? '-'}</td>
                      <td className="p-2 text-right">{monthly.GHI?.[i]?.toFixed(1) ?? '-'}</td>
                      <td className="p-2 text-right">{monthly.DNI?.[i]?.toFixed(1) ?? '-'}</td>
                      <td className="p-2 text-right">{monthly.DIF?.[i]?.toFixed(1) ?? '-'}</td>
                      <td className="p-2 text-right">{monthly.GTI_opta?.[i]?.toFixed(1) ?? '-'}</td>
                      <td className="p-2 text-right">{monthly.TEMP?.[i]?.toFixed(1) ?? '-'}°C</td>
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
            <p>Enter coordinates and click Fetch to get Global Solar Atlas data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
