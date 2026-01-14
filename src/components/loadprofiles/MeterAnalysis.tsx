import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Download, Database, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RawDataPoint {
  timestamp: string;
  values: Record<string, number>;
}

interface RawDataWrapper {
  csvContent?: string;
  avgDailyKwh?: number;
  avgKw?: number;
  peakKw?: number;
  totalKwh?: number;
  dataPoints?: number;
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

// Parse CSV content into RawDataPoint array
function parseCsvToDataPoints(csvContent: string): RawDataPoint[] {
  const lines = csvContent.split('\n').filter(line => line.trim() && !line.startsWith('sep='));
  if (lines.length < 2) return [];
  
  // Parse header to get column names
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim());
  console.log('[MeterAnalysis] CSV headers:', headers);
  
  // Find date column index
  const dateColIndex = headers.findIndex(h => 
    h.toLowerCase() === 'date' || 
    h.toLowerCase() === 'timestamp' ||
    h.toLowerCase() === 'datetime'
  );
  
  // All columns except date are value columns
  const valueColumns: { name: string; index: number }[] = [];
  headers.forEach((header, index) => {
    if (index !== dateColIndex && header) {
      valueColumns.push({ name: header, index });
    }
  });
  console.log('[MeterAnalysis] Value columns:', valueColumns.map(v => v.name));
  
  const dataPoints: RawDataPoint[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    const dateStr = dateColIndex >= 0 ? values[dateColIndex]?.trim() : values[0]?.trim();
    
    if (!dateStr) continue;
    
    // Parse date (format: DD/MM/YYYY HH:mm:ss)
    let timestamp: Date | null = null;
    const dateMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?/);
    if (dateMatch) {
      const [, day, month, year, hour, min, sec] = dateMatch;
      timestamp = new Date(
        parseInt(year), 
        parseInt(month) - 1, 
        parseInt(day), 
        parseInt(hour), 
        parseInt(min), 
        parseInt(sec || '0')
      );
    } else {
      // Try ISO format
      timestamp = new Date(dateStr);
    }
    
    if (!timestamp || isNaN(timestamp.getTime())) continue;
    
    const point: RawDataPoint = {
      timestamp: timestamp.toISOString(),
      values: {}
    };
    
    // Extract values for each value column using the correct index
    valueColumns.forEach(({ name, index }) => {
      const val = parseFloat(values[index]);
      if (!isNaN(val)) {
        point.values[name] = val;
      }
    });
    
    if (Object.keys(point.values).length > 0) {
      dataPoints.push(point);
    }
  }
  
  console.log('[MeterAnalysis] Parsed', dataPoints.length, 'points, first point values:', dataPoints[0]?.values);
  return dataPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Extract RawDataPoint[] from raw_data (handles both formats)
function extractDataPoints(rawData: unknown): RawDataPoint[] | null {
  console.log('[MeterAnalysis] extractDataPoints called with:', typeof rawData, rawData ? 'has data' : 'null');
  
  if (!rawData) return null;
  
  // If it's already an array of data points
  if (Array.isArray(rawData)) {
    console.log('[MeterAnalysis] rawData is array with length:', rawData.length);
    
    // Check if it's the wrapper format [{csvContent: "..."}]
    if (rawData.length > 0 && typeof rawData[0] === 'object') {
      const first = rawData[0] as RawDataWrapper;
      console.log('[MeterAnalysis] First element keys:', Object.keys(first));
      
      if (first.csvContent && typeof first.csvContent === 'string') {
        console.log('[MeterAnalysis] Found csvContent, length:', first.csvContent.length);
        const parsed = parseCsvToDataPoints(first.csvContent);
        console.log('[MeterAnalysis] Parsed data points:', parsed.length, 'first:', parsed[0]);
        return parsed;
      }
      // Already in RawDataPoint format
      if ('timestamp' in first && 'values' in first) {
        console.log('[MeterAnalysis] Already in RawDataPoint format');
        return rawData as RawDataPoint[];
      }
    }
  }
  
  console.log('[MeterAnalysis] Could not extract data points');
  return null;
}

type AggregationPeriod = "raw" | "hourly" | "daily";
type AggregationOperation = "sum" | "average" | "max" | "min";

const QUANTITY_COLORS: Record<string, string> = {
  "P1 (kWh)": "#2563eb",
  "Q1 (kvarh)": "#16a34a",
  "S (kVAh)": "#eab308",
  "P2 (kWh)": "#f97316",
  "Q2 (kvarh)": "#8b5cf6",
  "Q3 (kvarh)": "#06b6d4",
  "Q4 (kvarh)": "#ec4899",
  "S (kVA)": "#3b82f6",
  "Status": "#ef4444",
};

const getQuantityColor = (quantity: string, index: number): string => {
  if (QUANTITY_COLORS[quantity]) return QUANTITY_COLORS[quantity];
  const fallbackColors = ["#2563eb", "#16a34a", "#eab308", "#f97316", "#8b5cf6", "#06b6d4", "#ec4899", "#3b82f6"];
  return fallbackColors[index % fallbackColors.length];
};

interface MeterAnalysisProps {
  siteId?: string | null;
}

export function MeterAnalysis({ siteId }: MeterAnalysisProps) {
  const [selectedMeter, setSelectedMeter] = useState<string>("");
  const [selectedQuantities, setSelectedQuantities] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [timeFrom, setTimeFrom] = useState<string>("00:00");
  const [timeTo, setTimeTo] = useState<string>("23:59");
  const [aggregationPeriod, setAggregationPeriod] = useState<AggregationPeriod>("daily");
  const [aggregationOperation, setAggregationOperation] = useState<AggregationOperation>("sum");
  const [yAxisMin, setYAxisMin] = useState<string>("");
  const [yAxisMax, setYAxisMax] = useState<string>("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [isDateFromOpen, setIsDateFromOpen] = useState(false);
  const [isDateToOpen, setIsDateToOpen] = useState(false);

  // Fetch all SCADA imports with raw data
  const { data: imports, isLoading } = useQuery({
    queryKey: ["scada-imports-raw", siteId],
    queryFn: async () => {
      let query = supabase
        .from("scada_imports")
        .select("id, site_name, site_id, shop_number, shop_name, date_range_start, date_range_end, data_points, raw_data")
        .order("created_at", { ascending: false });
      
      if (siteId) {
        query = query.eq("site_id", siteId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data as ScadaImportRow[]).map(row => ({
        ...row,
        data_points: row.data_points ?? 0,
        raw_data: extractDataPoints(row.raw_data)
      })) as ScadaImport[];
    },
  });
  // Get selected meter data
  const selectedImport = useMemo(() => {
    const imp = imports?.find(imp => imp.id === selectedMeter);
    console.log('[MeterAnalysis] selectedImport:', imp?.id, 'raw_data length:', imp?.raw_data?.length);
    return imp;
  }, [imports, selectedMeter]);

  // Get available quantities from the selected meter's raw data
  const availableQuantities = useMemo(() => {
    if (!selectedImport?.raw_data?.length) {
      console.log('[MeterAnalysis] No raw_data for availableQuantities');
      return [];
    }
    const firstPoint = selectedImport.raw_data[0];
    const quantities = Object.keys(firstPoint.values || {});
    console.log('[MeterAnalysis] availableQuantities:', quantities);
    return quantities;
  }, [selectedImport]);

  // Process and filter data for the chart
  const chartData = useMemo(() => {
    console.log('[MeterAnalysis] chartData memo - showGraph:', showGraph, 'selectedQuantities:', Array.from(selectedQuantities));
    if (!selectedImport?.raw_data?.length || !showGraph || selectedQuantities.size === 0) {
      console.log('[MeterAnalysis] chartData early return - no data or not ready');
      return [];
    }

    let data = selectedImport.raw_data;
    console.log('[MeterAnalysis] Starting with', data.length, 'data points');

    // Filter by date range with time
    if (dateFrom) {
      const [fromHour, fromMin] = timeFrom.split(":").map(Number);
      const fromDateTime = new Date(dateFrom);
      fromDateTime.setHours(fromHour, fromMin, 0, 0);
      data = data.filter(d => new Date(d.timestamp) >= fromDateTime);
    }
    if (dateTo) {
      const [toHour, toMin] = timeTo.split(":").map(Number);
      const toDateTime = new Date(dateTo);
      toDateTime.setHours(toHour, toMin, 59, 999);
      data = data.filter(d => new Date(d.timestamp) <= toDateTime);
    }

    // If no aggregation (raw data)
    if (aggregationPeriod === "raw") {
      return data.map(d => {
        const point: Record<string, any> = {
          timestamp: d.timestamp,
          label: format(new Date(d.timestamp), "MMM d HH:mm"),
        };
        selectedQuantities.forEach(q => {
          point[q] = d.values[q] ?? 0;
        });
        return point;
      });
    }

    // Group by period
    const groups: Record<string, Record<string, number[]>> = {};
    
    data.forEach(d => {
      const date = new Date(d.timestamp);
      let key: string;
      
      if (aggregationPeriod === "hourly") {
        key = format(date, "MMM d HH:00");
      } else {
        key = format(date, "d");
      }
      
      if (!groups[key]) {
        groups[key] = {};
        selectedQuantities.forEach(q => { groups[key][q] = []; });
      }
      
      selectedQuantities.forEach(q => {
        const val = d.values[q];
        if (typeof val === "number" && !isNaN(val)) {
          if (!groups[key][q]) groups[key][q] = [];
          groups[key][q].push(val);
        }
      });
    });

    // Apply aggregation operation
    return Object.entries(groups)
      .sort((a, b) => {
        const numA = parseInt(a[0]);
        const numB = parseInt(b[0]);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a[0].localeCompare(b[0]);
      })
      .map(([key, quantityValues]) => {
        const point: Record<string, any> = {
          label: key,
        };
        
        selectedQuantities.forEach(q => {
          const values = quantityValues[q] || [];
          let value: number;
          
          if (values.length === 0) {
            value = 0;
          } else {
            switch (aggregationOperation) {
              case "sum":
                value = values.reduce((a, b) => a + b, 0);
                break;
              case "average":
                value = values.reduce((a, b) => a + b, 0) / values.length;
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
          }
          point[q] = Math.round(value * 100) / 100;
        });
        
        return point;
      });
  }, [selectedImport, dateFrom, dateTo, timeFrom, timeTo, selectedQuantities, aggregationPeriod, aggregationOperation, showGraph]);

  // Handle meter selection
  const handleMeterChange = useCallback((meterId: string) => {
    setSelectedMeter(meterId);
    setSelectedQuantities(new Set());
    setShowGraph(false);
    setDataLoaded(false);
    
    const imp = imports?.find(i => i.id === meterId);
    if (imp) {
      // Default dates from the import's range
      if (imp.date_range_start) setDateFrom(new Date(imp.date_range_start));
      if (imp.date_range_end) setDateTo(new Date(imp.date_range_end));
    }
  }, [imports]);

  // Handle quantity toggle
  const handleQuantityToggle = (quantity: string, checked: boolean) => {
    setSelectedQuantities(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(quantity);
      } else {
        newSet.delete(quantity);
      }
      return newSet;
    });
  };

  // Load data handler
  const handleLoadData = () => {
    if (!selectedMeter || !dateFrom || !dateTo) {
      toast.error("Please select meter and date range");
      return;
    }
    setDataLoaded(true);
    // Auto-select all quantities if none selected
    if (selectedQuantities.size === 0 && availableQuantities.length > 0) {
      setSelectedQuantities(new Set(availableQuantities));
    }
  };

  // Graph button handler
  const handleGraph = () => {
    if (selectedQuantities.size === 0) {
      toast.error("Please select at least one quantity to plot");
      return;
    }
    setShowGraph(true);
  };

  // Apply manipulation handler
  const handleApplyManipulation = () => {
    if (!dataLoaded) {
      toast.error("Please load data first");
      return;
    }
    if (selectedQuantities.size === 0) {
      toast.error("Please select quantities to plot");
      return;
    }
    setShowGraph(true);
    toast.success(`Applied ${aggregationOperation} operation with ${aggregationPeriod} aggregation`);
  };

  // Download CSV handler
  const handleDownloadCSV = () => {
    if (!chartData.length) {
      toast.error("No data to download");
      return;
    }
    
    const headers = ["Timestamp", ...Array.from(selectedQuantities)].join(",");
    const rows = chartData.map(d => {
      const vals = [d.label, ...Array.from(selectedQuantities).map(q => d[q] ?? 0)];
      return vals.join(",");
    }).join("\n");
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meter-data-${selectedImport?.site_name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  // Y-axis domain
  const yAxisDomain = useMemo((): [number | "auto", number | "auto"] => {
    const min = yAxisMin && !isNaN(parseFloat(yAxisMin)) ? parseFloat(yAxisMin) : "auto";
    const max = yAxisMax && !isNaN(parseFloat(yAxisMax)) ? parseFloat(yAxisMax) : "auto";
    return [min, max];
  }, [yAxisMin, yAxisMax]);

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
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Load Profiles
              </CardTitle>
              <CardDescription>
                Analyze meter load patterns using kVA data over selected time periods with precise date and time selection
              </CardDescription>
            </div>
            {selectedImport && (
              <div className="text-right text-sm text-muted-foreground space-y-0.5">
                {selectedImport.date_range_start && (
                  <div>Earliest: {format(new Date(selectedImport.date_range_start), "MMM d, yyyy")} at {format(new Date(selectedImport.date_range_start), "HH:mm")}</div>
                )}
                {selectedImport.date_range_end && (
                  <div>Latest: {format(new Date(selectedImport.date_range_end), "MMM d, yyyy")} at {format(new Date(selectedImport.date_range_end), "HH:mm")}</div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top Row: Meter, Date From, Date To, Load Data, Download CSV */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Select Meter</Label>
              <Select value={selectedMeter} onValueChange={handleMeterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a meter..." />
                </SelectTrigger>
                <SelectContent>
                  {importsWithRawData.map(imp => (
                    <SelectItem key={imp.id} value={imp.id}>
                      {imp.shop_name || imp.shop_number || imp.site_name} - {imp.site_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date & Time From</Label>
              <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? (
                      <span>{format(dateFrom, "MMM d, yyyy")} at {timeFrom}</span>
                    ) : (
                      <span>Pick start date & time</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="pointer-events-auto">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date);
                        setIsDateFromOpen(false);
                      }}
                      initialFocus
                      className="p-3"
                    />
                    <div className="border-t px-3 py-3">
                      <Input
                        type="time"
                        value={timeFrom}
                        onChange={(e) => setTimeFrom(e.target.value)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date & Time To</Label>
              <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? (
                      <span>{format(dateTo, "MMM d, yyyy")} at {timeTo}</span>
                    ) : (
                      <span>Pick end date & time</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="pointer-events-auto">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => {
                        setDateTo(date);
                        setIsDateToOpen(false);
                      }}
                      initialFocus
                      className="p-3"
                    />
                    <div className="border-t px-3 py-3">
                      <Input
                        type="time"
                        value={timeTo}
                        onChange={(e) => setTimeTo(e.target.value)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Buttons Row */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="default"
              onClick={handleLoadData}
              disabled={!selectedMeter || !dateFrom || !dateTo}
            >
              Load Data
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadCSV}
              disabled={!dataLoaded || chartData.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>

          {/* Second Row: Quantities, Y-Axis, Data Manipulation */}
          {dataLoaded && availableQuantities.length > 0 && (
            <div className="flex gap-6 items-start">
              {/* Quantities to Plot */}
              <div className="w-48 space-y-3">
                <Label className="font-semibold">Quantities to Plot</Label>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 border rounded-md p-3 bg-muted/20">
                  {availableQuantities.map((column) => (
                    <div key={column} className="flex items-center space-x-2">
                      <Checkbox
                        id={`show-${column}`}
                        checked={selectedQuantities.has(column)}
                        onCheckedChange={(checked) => handleQuantityToggle(column, checked === true)}
                      />
                      <label
                        htmlFor={`show-${column}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {column}
                      </label>
                    </div>
                  ))}
                </div>
                <Button
                  variant="default"
                  onClick={handleGraph}
                  className="w-full"
                >
                  Graph
                </Button>
              </div>

              {/* Y-Axis Controls */}
              <div className="w-36 space-y-3">
                <div className="space-y-2">
                  <Label className="font-semibold">Y-Axis Min</Label>
                  <Input
                    type="text"
                    placeholder="Auto"
                    value={yAxisMin}
                    onChange={(e) => setYAxisMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">Y-Axis Max</Label>
                  <Input
                    type="text"
                    placeholder="Auto"
                    value={yAxisMax}
                    onChange={(e) => setYAxisMax(e.target.value)}
                  />
                </div>
              </div>

              {/* Data Manipulation */}
              <div className="flex-1 space-y-3 border-l pl-6">
                <Label className="font-semibold">Data Manipulation</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Operation</Label>
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
                    <Label className="text-sm">Period</Label>
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
                <Button
                  onClick={handleApplyManipulation}
                  className="w-full"
                >
                  Apply Manipulation
                </Button>
              </div>
            </div>
          )}

          {/* Chart */}
          {showGraph && chartData.length > 0 && (
            <div className="h-96 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    angle={0}
                    textAnchor="middle"
                    height={40}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    domain={yAxisDomain}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ paddingBottom: '10px' }}
                  />
                  {Array.from(selectedQuantities).map((quantity, index) => (
                    <Line 
                      key={quantity}
                      type="monotone" 
                      dataKey={quantity} 
                      name={quantity}
                      stroke={getQuantityColor(quantity, index)}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {showGraph && chartData.length === 0 && (
            <div className="h-80 flex items-center justify-center border rounded-lg border-dashed">
              <p className="text-muted-foreground">No data available for the selected time range and quantities</p>
            </div>
          )}

          {dataLoaded && !showGraph && (
            <div className="h-80 flex items-center justify-center border rounded-lg border-dashed">
              <p className="text-muted-foreground">Select quantities and click "Graph" to visualize data</p>
            </div>
          )}

          {!dataLoaded && selectedMeter && (
            <div className="h-80 flex items-center justify-center border rounded-lg border-dashed">
              <p className="text-muted-foreground">Click "Load Data" to load meter readings</p>
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
