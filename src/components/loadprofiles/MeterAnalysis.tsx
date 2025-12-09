import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Download, Calendar, Database } from "lucide-react";

interface RawDataPoint {
  timestamp: string;
  values: Record<string, number>;
}

interface ScadaImportRow {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  data_points: number | null;
  raw_data: unknown;
}

interface ScadaImport {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  data_points: number;
  raw_data: RawDataPoint[] | null;
}

type AggregationPeriod = "raw" | "hourly" | "daily";
type AggregationOperation = "sum" | "average" | "max" | "min";

const QUANTITY_COLORS: Record<string, string> = {
  "P1 (kWh)": "hsl(var(--primary))",
  "Q1 (kvarh)": "hsl(var(--secondary))",
  "S (kVAh)": "hsl(142, 76%, 36%)",
  "P2 (kWh)": "hsl(38, 92%, 50%)",
  "Q2 (kvarh)": "hsl(280, 65%, 60%)",
  "Q3 (kvarh)": "hsl(199, 89%, 48%)",
  "Q4 (kvarh)": "hsl(340, 82%, 52%)",
  "S (kVA)": "hsl(262, 83%, 58%)",
};

export function MeterAnalysis() {
  const [selectedMeter, setSelectedMeter] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<string>("P1 (kWh)");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [aggregationPeriod, setAggregationPeriod] = useState<AggregationPeriod>("daily");
  const [aggregationOperation, setAggregationOperation] = useState<AggregationOperation>("sum");

  // Fetch all SCADA imports with raw data
  const { data: imports, isLoading } = useQuery({
    queryKey: ["scada-imports-raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_number, shop_name, date_range_start, date_range_end, data_points, raw_data")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Transform raw rows to typed ScadaImport
      return (data as ScadaImportRow[]).map(row => ({
        ...row,
        data_points: row.data_points ?? 0,
        raw_data: Array.isArray(row.raw_data) ? row.raw_data as RawDataPoint[] : null
      })) as ScadaImport[];
    },
  });

  // Get selected meter data
  const selectedImport = useMemo(() => {
    return imports?.find(imp => imp.id === selectedMeter);
  }, [imports, selectedMeter]);

  // Get available quantities from the selected meter's raw data
  const availableQuantities = useMemo(() => {
    if (!selectedImport?.raw_data?.length) return [];
    const firstPoint = selectedImport.raw_data[0];
    return Object.keys(firstPoint.values || {});
  }, [selectedImport]);

  // Process and filter data for the chart
  const chartData = useMemo(() => {
    if (!selectedImport?.raw_data?.length) return [];

    let data = selectedImport.raw_data;

    // Filter by date range
    if (dateFrom) {
      data = data.filter(d => new Date(d.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      data = data.filter(d => new Date(d.timestamp) <= new Date(dateTo + "T23:59:59"));
    }

    // Apply aggregation
    if (aggregationPeriod === "raw") {
      return data.map(d => ({
        timestamp: d.timestamp,
        label: new Date(d.timestamp).toLocaleString(),
        value: d.values[selectedQuantity] ?? 0,
      }));
    }

    // Group by period
    const groups: Record<string, number[]> = {};
    
    data.forEach(d => {
      const date = new Date(d.timestamp);
      let key: string;
      
      if (aggregationPeriod === "hourly") {
        key = `${date.toISOString().split('T')[0]} ${date.getHours().toString().padStart(2, '0')}:00`;
      } else {
        key = date.toISOString().split('T')[0];
      }
      
      if (!groups[key]) groups[key] = [];
      const val = d.values[selectedQuantity];
      if (typeof val === "number" && !isNaN(val)) {
        groups[key].push(val);
      }
    });

    // Apply aggregation operation
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, values]) => {
        let value: number;
        switch (aggregationOperation) {
          case "sum":
            value = values.reduce((a, b) => a + b, 0);
            break;
          case "average":
            value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case "max":
            value = Math.max(...values);
            break;
          case "min":
            value = Math.min(...values);
            break;
          default:
            value = values.reduce((a, b) => a + b, 0);
        }
        return {
          timestamp: key,
          label: key,
          value: Math.round(value * 1000) / 1000,
        };
      });
  }, [selectedImport, dateFrom, dateTo, selectedQuantity, aggregationPeriod, aggregationOperation]);

  // Set date range when meter is selected
  const handleMeterChange = (meterId: string) => {
    setSelectedMeter(meterId);
    const imp = imports?.find(i => i.id === meterId);
    if (imp) {
      if (imp.date_range_start) setDateFrom(imp.date_range_start);
      if (imp.date_range_end) setDateTo(imp.date_range_end);
      // Set first available quantity
      if (imp.raw_data?.length) {
        const quantities = Object.keys(imp.raw_data[0].values || {});
        if (quantities.length > 0 && !quantities.includes(selectedQuantity)) {
          setSelectedQuantity(quantities[0]);
        }
      }
    }
  };

  const handleDownloadCSV = () => {
    if (!chartData.length) return;
    
    const csv = [
      ["Timestamp", selectedQuantity].join(","),
      ...chartData.map(d => [d.timestamp, d.value].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meter-data-${selectedQuantity.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importsWithRawData = imports?.filter(imp => imp.raw_data && (imp.raw_data as RawDataPoint[]).length > 0) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading meter data...</div>
        </CardContent>
      </Card>
    );
  }

  if (importsWithRawData.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No meter data available</h3>
          <p className="text-muted-foreground text-center max-w-sm mt-1">
            Import SCADA data using the "New SCADA Import" tab to enable meter analysis.
            Make sure to import files with complete raw data.
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
            <TrendingUp className="h-5 w-5" />
            Load Profiles
          </CardTitle>
          <CardDescription>
            Analyze meter load patterns using kVA data over selected time periods with precise date and time selection
          </CardDescription>
          {selectedImport && (
            <div className="text-xs text-muted-foreground">
              Earliest: {selectedImport.date_range_start ? new Date(selectedImport.date_range_start).toLocaleString() : 'N/A'} | 
              Latest: {selectedImport.date_range_end ? new Date(selectedImport.date_range_end).toLocaleString() : 'N/A'}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Select Meter */}
            <div className="space-y-2">
              <Label>Select Meter</Label>
              <Select value={selectedMeter} onValueChange={handleMeterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a meter..." />
                </SelectTrigger>
                <SelectContent>
                  {importsWithRawData.map(imp => (
                    <SelectItem key={imp.id} value={imp.id}>
                      {imp.site_name} {imp.shop_name ? `- ${imp.shop_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date & Time From</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date & Time To</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {/* Data updates reactively */}}
                  disabled={!selectedMeter}
                  className="flex-1"
                >
                  Load Data
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDownloadCSV}
                  disabled={!chartData.length}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Second Row - Quantities and Manipulation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quantities to Plot */}
            <div className="space-y-2">
              <Label>Quantities to Plot</Label>
              <RadioGroup 
                value={selectedQuantity} 
                onValueChange={setSelectedQuantity}
                className="space-y-1"
              >
                {availableQuantities.length > 0 ? (
                  availableQuantities.map(q => (
                    <div key={q} className="flex items-center space-x-2">
                      <RadioGroupItem value={q} id={q} />
                      <Label htmlFor={q} className="font-normal cursor-pointer">{q}</Label>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="P1 (kWh)" id="p1" />
                      <Label htmlFor="p1" className="font-normal cursor-pointer">P1 (kWh)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Q1 (kvarh)" id="q1" />
                      <Label htmlFor="q1" className="font-normal cursor-pointer">Q1 (kvarh)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="S (kVAh)" id="s-kvah" />
                      <Label htmlFor="s-kvah" className="font-normal cursor-pointer">S (kVAh)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="S (kVA)" id="s-kva" />
                      <Label htmlFor="s-kva" className="font-normal cursor-pointer">S (kVA)</Label>
                    </div>
                  </>
                )}
              </RadioGroup>
            </div>

            {/* Y-Axis Settings */}
            <div className="space-y-2">
              <Label>Y-Axis Min</Label>
              <Input placeholder="Auto" className="mb-2" disabled />
              <Label>Y-Axis Max</Label>
              <Input placeholder="Auto" disabled />
            </div>

            {/* Data Manipulation */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Operation</Label>
                <Select value={aggregationOperation} onValueChange={(v) => setAggregationOperation(v as AggregationOperation)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="max">Max</SelectItem>
                    <SelectItem value="min">Min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={aggregationPeriod} onValueChange={(v) => setAggregationPeriod(v as AggregationPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw (All readings)</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily (1 day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Chart */}
          {selectedMeter && chartData.length > 0 && (
            <div className="h-80 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    className="text-muted-foreground"
                  />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    name={selectedQuantity}
                    stroke={QUANTITY_COLORS[selectedQuantity] || "hsl(var(--primary))"}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {selectedMeter && chartData.length === 0 && (
            <div className="h-80 flex items-center justify-center border rounded-lg border-dashed">
              <p className="text-muted-foreground">No data available for the selected filters</p>
            </div>
          )}

          {!selectedMeter && (
            <div className="h-80 flex items-center justify-center border rounded-lg border-dashed">
              <p className="text-muted-foreground">Select a meter to view load profile data</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}