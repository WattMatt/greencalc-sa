import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  GitCompare,
  Plus,
  X,
  Download,
  Calendar as CalendarIcon,
  Building2,
  Tag,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useCrossSiteComparison,
  type AggregationType,
  type DayTypeFilter,
  type MeterWithSite,
} from "./hooks/useCrossSiteComparison";

const MAX_METERS = 6;

export function CrossSiteComparison() {
  const [selectedMeterIds, setSelectedMeterIds] = useState<string[]>([]);
  const [aggregation, setAggregation] = useState<AggregationType>("daily");
  const [dayTypeFilter, setDayTypeFilter] = useState<DayTypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [meterSelectorOpen, setMeterSelectorOpen] = useState(false);

  const {
    allMeters,
    sites,
    categories,
    chartData,
    meterStats,
    getMeterColor,
    isLoading,
  } = useCrossSiteComparison(
    selectedMeterIds,
    aggregation,
    dayTypeFilter,
    dateFrom,
    dateTo
  );

  // Filter meters for selection dropdown
  const filteredMeters = useMemo(() => {
    return allMeters.filter(m => {
      if (categoryFilter !== "all" && m.category_id !== categoryFilter) return false;
      if (siteFilter !== "all" && m.site_id !== siteFilter) return false;
      return true;
    });
  }, [allMeters, categoryFilter, siteFilter]);

  // Get selected meters with their details
  const selectedMeters = useMemo(() => {
    return selectedMeterIds
      .map(id => allMeters.find(m => m.id === id))
      .filter((m): m is MeterWithSite => m !== undefined);
  }, [selectedMeterIds, allMeters]);

  const handleAddMeter = (meterId: string) => {
    if (selectedMeterIds.length < MAX_METERS && !selectedMeterIds.includes(meterId)) {
      setSelectedMeterIds([...selectedMeterIds, meterId]);
    }
    setMeterSelectorOpen(false);
  };

  const handleRemoveMeter = (meterId: string) => {
    setSelectedMeterIds(selectedMeterIds.filter(id => id !== meterId));
  };

  const handleExportCSV = () => {
    if (chartData.length === 0 || selectedMeters.length === 0) return;

    const headers = ["Period", ...selectedMeters.map(m => `${m.shop_name || m.shop_number} (${m.siteName})`)];
    const rows = chartData.map(point => {
      const values = selectedMeters.map(m => {
        const val = point[m.id];
        return typeof val === "number" ? val.toFixed(2) : "0";
      });
      return [point.label, ...values];
    });

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cross-site-comparison-${aggregation}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getYAxisLabel = () => {
    switch (aggregation) {
      case "daily":
        return "Average kW";
      case "weekly":
        return "Daily kWh";
      case "monthly":
        return "Monthly kWh";
      default:
        return "kWh";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Cross-Site Meter Comparison</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={chartData.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters Row */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Site Filter */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "End Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meter Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Selected Meters ({selectedMeterIds.length}/{MAX_METERS})
            </CardTitle>
            <Popover open={meterSelectorOpen} onOpenChange={setMeterSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedMeterIds.length >= MAX_METERS}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Meter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Select a meter to compare</p>
                  <p className="text-xs text-muted-foreground">
                    {filteredMeters.length} meters available
                  </p>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="p-2 space-y-1">
                    {filteredMeters
                      .filter(m => !selectedMeterIds.includes(m.id))
                      .map(meter => (
                        <button
                          key={meter.id}
                          onClick={() => handleAddMeter(meter.id)}
                          className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="font-medium text-sm">
                            {meter.shop_name || meter.shop_number || "Unknown Meter"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{meter.siteName}</span>
                            {meter.categoryName && (
                              <>
                                <span>•</span>
                                <span>{meter.categoryName}</span>
                              </>
                            )}
                            {meter.area_sqm && (
                              <>
                                <span>•</span>
                                <span>{meter.area_sqm} m²</span>
                              </>
                            )}
                          </div>
                        </button>
                      ))}
                    {filteredMeters.filter(m => !selectedMeterIds.includes(m.id)).length === 0 && (
                      <p className="text-sm text-muted-foreground p-4 text-center">
                        No meters available
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {selectedMeters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select meters to start comparing</p>
              <p className="text-sm">Click "Add Meter" to select up to {MAX_METERS} meters</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedMeters.map(meter => (
                <Badge
                  key={meter.id}
                  variant="secondary"
                  className="pl-2 pr-1 py-1.5 gap-2"
                  style={{ borderLeftColor: getMeterColor(meter.id), borderLeftWidth: 3 }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {meter.shop_name || meter.shop_number || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">{meter.siteName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-destructive/10"
                    onClick={() => handleRemoveMeter(meter.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aggregation Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Aggregation:</span>
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as AggregationType[]).map(agg => (
                  <Button
                    key={agg}
                    variant={aggregation === agg ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAggregation(agg)}
                  >
                    {agg.charAt(0).toUpperCase() + agg.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Day Type:</span>
              <div className="flex gap-2">
                {(["all", "weekday", "weekend"] as DayTypeFilter[]).map(dt => (
                  <Button
                    key={dt}
                    variant={dayTypeFilter === dt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDayTypeFilter(dt)}
                  >
                    {dt === "all" ? "All Days" : dt.charAt(0).toUpperCase() + dt.slice(1) + "s"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {selectedMeterIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Comparison Chart</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[400px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                No data available for the selected meters and filters
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    label={{
                      value: getYAxisLabel(),
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle" },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    formatter={(value: number, name: string) => {
                      const meter = selectedMeters.find(m => m.id === name);
                      const meterName = meter
                        ? `${meter.shop_name || meter.shop_number} (${meter.siteName})`
                        : name;
                      return [value.toFixed(2), meterName];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const meter = selectedMeters.find(m => m.id === value);
                      return meter
                        ? `${meter.shop_name || meter.shop_number} (${meter.siteName})`
                        : value;
                    }}
                  />
                  {selectedMeters.map(meter => (
                    <Line
                      key={meter.id}
                      type="monotone"
                      dataKey={meter.id}
                      stroke={getMeterColor(meter.id)}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Table */}
      {meterStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meter</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">Avg {getYAxisLabel()}</TableHead>
                  <TableHead className="text-right">Peak</TableHead>
                  <TableHead className="text-right">Total kWh</TableHead>
                  <TableHead className="text-right">vs Group Avg</TableHead>
                  {meterStats.some(s => s.energyIntensity !== null) && (
                    <TableHead className="text-right">kWh/m²</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {meterStats.map(stat => (
                  <TableRow key={stat.meterId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getMeterColor(stat.meterId) }}
                        />
                        {stat.meterName}
                      </div>
                    </TableCell>
                    <TableCell>{stat.siteName}</TableCell>
                    <TableCell className="text-right">{stat.avgValue.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{stat.peakValue.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{stat.totalKwh.toFixed(0)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          stat.vsGroupAvg > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {stat.vsGroupAvg > 0 ? "+" : ""}
                        {stat.vsGroupAvg.toFixed(1)}%
                      </span>
                    </TableCell>
                    {meterStats.some(s => s.energyIntensity !== null) && (
                      <TableCell className="text-right">
                        {stat.energyIntensity !== null ? stat.energyIntensity.toFixed(1) : "-"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
