import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Download, Database, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
type ViewPeriod = "day" | "week" | "month" | "custom";

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
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [timeFrom, setTimeFrom] = useState<string>("00:00");
  const [timeTo, setTimeTo] = useState<string>("23:59");
  const [aggregationPeriod, setAggregationPeriod] = useState<AggregationPeriod>("hourly");
  const [aggregationOperation, setAggregationOperation] = useState<AggregationOperation>("sum");
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("day");

  // Fetch all SCADA imports with raw data
  const { data: imports, isLoading } = useQuery({
    queryKey: ["scada-imports-raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_number, shop_name, date_range_start, date_range_end, data_points, raw_data")
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  // Apply view period to dates
  const applyViewPeriod = useCallback((period: ViewPeriod, baseDate?: Date) => {
    const base = baseDate || dateFrom || new Date();
    
    switch (period) {
      case "day":
        setDateFrom(startOfDay(base));
        setDateTo(endOfDay(base));
        setAggregationPeriod("hourly");
        break;
      case "week":
        setDateFrom(startOfWeek(base, { weekStartsOn: 1 }));
        setDateTo(endOfWeek(base, { weekStartsOn: 1 }));
        setAggregationPeriod("hourly");
        break;
      case "month":
        setDateFrom(startOfMonth(base));
        setDateTo(endOfMonth(base));
        setAggregationPeriod("daily");
        break;
      case "custom":
        // Keep current dates
        break;
    }
    setViewPeriod(period);
  }, [dateFrom]);

  // Navigate to previous/next period
  const navigatePeriod = useCallback((direction: "prev" | "next") => {
    if (!dateFrom) return;
    
    let newBase: Date;
    switch (viewPeriod) {
      case "day":
        newBase = direction === "prev" ? subDays(dateFrom, 1) : addDays(dateFrom, 1);
        break;
      case "week":
        newBase = direction === "prev" ? subWeeks(dateFrom, 1) : addWeeks(dateFrom, 1);
        break;
      case "month":
        newBase = direction === "prev" ? subMonths(dateFrom, 1) : addMonths(dateFrom, 1);
        break;
      default:
        return;
    }
    applyViewPeriod(viewPeriod, newBase);
  }, [dateFrom, viewPeriod, applyViewPeriod]);

  // Format the current period label
  const periodLabel = useMemo(() => {
    if (!dateFrom) return "";
    
    switch (viewPeriod) {
      case "day":
        return format(dateFrom, "EEEE, MMMM d, yyyy");
      case "week":
        return `${format(dateFrom, "MMM d")} - ${dateTo ? format(dateTo, "MMM d, yyyy") : ""}`;
      case "month":
        return format(dateFrom, "MMMM yyyy");
      default:
        return `${format(dateFrom, "MMM d")} - ${dateTo ? format(dateTo, "MMM d, yyyy") : ""}`;
    }
  }, [dateFrom, dateTo, viewPeriod]);

  // Process and filter data for the chart
  const chartData = useMemo(() => {
    if (!selectedImport?.raw_data?.length) return [];

    let data = selectedImport.raw_data;

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

    // Apply aggregation
    if (aggregationPeriod === "raw") {
      return data.map(d => ({
        timestamp: d.timestamp,
        label: format(new Date(d.timestamp), "MMM d HH:mm"),
        value: d.values[selectedQuantity] ?? 0,
      }));
    }

    // Group by period
    const groups: Record<string, number[]> = {};
    
    data.forEach(d => {
      const date = new Date(d.timestamp);
      let key: string;
      
      if (aggregationPeriod === "hourly") {
        key = format(date, "MMM d HH:00");
      } else {
        key = format(date, "MMM d");
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
  }, [selectedImport, dateFrom, dateTo, timeFrom, timeTo, selectedQuantity, aggregationPeriod, aggregationOperation]);

  // Set date range when meter is selected
  const handleMeterChange = (meterId: string) => {
    setSelectedMeter(meterId);
    const imp = imports?.find(i => i.id === meterId);
    if (imp) {
      // Default to showing the last day of data
      const endDate = imp.date_range_end ? new Date(imp.date_range_end) : new Date();
      setDateFrom(startOfDay(endDate));
      setDateTo(endOfDay(endDate));
      setViewPeriod("day");
      setAggregationPeriod("hourly");
      
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
            Analyze meter load patterns using kVA data over selected time periods
          </CardDescription>
          {selectedImport && (
            <div className="text-xs text-muted-foreground">
              Data range: {selectedImport.date_range_start ? format(new Date(selectedImport.date_range_start), "PPP p") : 'N/A'} — 
              {selectedImport.date_range_end ? format(new Date(selectedImport.date_range_end), "PPP p") : 'N/A'}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Meter Selection & Period Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* View Period Selector */}
            <div className="space-y-2">
              <Label>View Period</Label>
              <div className="flex gap-1">
                <Button
                  variant={viewPeriod === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyViewPeriod("day")}
                  className="flex-1"
                >
                  Day
                </Button>
                <Button
                  variant={viewPeriod === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyViewPeriod("week")}
                  className="flex-1"
                >
                  Week
                </Button>
                <Button
                  variant={viewPeriod === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyViewPeriod("month")}
                  className="flex-1"
                >
                  Month
                </Button>
                <Button
                  variant={viewPeriod === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewPeriod("custom")}
                  className="flex-1"
                >
                  Custom
                </Button>
              </div>
            </div>

            {/* Navigation & Current Period */}
            <div className="space-y-2 lg:col-span-2">
              <Label>Navigate</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigatePeriod("prev")}
                  disabled={!dateFrom || viewPeriod === "custom"}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex-1 text-center font-medium text-sm px-3 py-2 bg-muted rounded-md">
                  {periodLabel || "Select a meter"}
                </div>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigatePeriod("next")}
                  disabled={!dateFrom || viewPeriod === "custom"}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleDownloadCSV}
                  disabled={!chartData.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Custom Date Range (shown when custom is selected) */}
          {viewPeriod === "custom" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>From Time</Label>
                <Input 
                  type="time"
                  value={timeFrom}
                  onChange={e => setTimeFrom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Time</Label>
                <Input 
                  type="time"
                  value={timeTo}
                  onChange={e => setTimeTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Quantities and Data Manipulation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quantities to Plot */}
            <div className="space-y-2">
              <Label>Quantities to Plot</Label>
              <RadioGroup 
                value={selectedQuantity} 
                onValueChange={setSelectedQuantity}
                className="space-y-1 max-h-40 overflow-y-auto"
              >
                {availableQuantities.length > 0 ? (
                  availableQuantities.map(q => (
                    <div key={q} className="flex items-center space-x-2">
                      <RadioGroupItem value={q} id={q} />
                      <Label htmlFor={q} className="font-normal cursor-pointer">{q}</Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Select a meter first</p>
                )}
              </RadioGroup>
            </div>

            {/* Aggregation Settings */}
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
                <Label>Aggregation Period</Label>
                <Select value={aggregationPeriod} onValueChange={(v) => setAggregationPeriod(v as AggregationPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw (All readings)</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats Summary */}
            {chartData.length > 0 && (
              <div className="space-y-2">
                <Label>Summary</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground text-xs">Data Points</div>
                    <div className="font-medium">{chartData.length}</div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground text-xs">Total</div>
                    <div className="font-medium">
                      {chartData.reduce((sum, d) => sum + d.value, 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground text-xs">Peak</div>
                    <div className="font-medium">
                      {Math.max(...chartData.map(d => d.value)).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground text-xs">Average</div>
                    <div className="font-medium">
                      {(chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                    interval="preserveStartEnd"
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
              <p className="text-muted-foreground">No data available for the selected time range</p>
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
