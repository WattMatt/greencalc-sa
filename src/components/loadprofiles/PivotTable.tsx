import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TableIcon, Download, Calculator } from "lucide-react";
import { format, isWeekend } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export function PivotTable() {
  const [selectedMeters, setSelectedMeters] = useState<Set<string>>(new Set());
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [showPivot, setShowPivot] = useState(false);

  const { data: meters, isLoading } = useQuery({
    queryKey: ["scada-imports-pivot"],
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

  const handleMeterToggle = (meterId: string, checked: boolean) => {
    setSelectedMeters(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(meterId);
      } else {
        newSet.delete(meterId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (meters && selectedMeters.size === meters.length) {
      setSelectedMeters(new Set());
    } else if (meters) {
      setSelectedMeters(new Set(meters.map(m => m.id)));
    }
  };

  // Generate pivot table data
  const pivotData = useMemo(() => {
    if (!showPivot || selectedMeters.size === 0 || !meters) return [];

    const selectedMetersList = meters.filter(m => selectedMeters.has(m.id));
    
    // Create hourly structure
    const hourlyData: Record<number, Record<string, number[]>> = {};
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = {};
      selectedMetersList.forEach(m => {
        hourlyData[h][m.id] = [];
      });
    }

    // Populate data
    selectedMetersList.forEach(meter => {
      if (!meter.raw_data) return;
      
      meter.raw_data.forEach(point => {
        try {
          const date = new Date(point.timestamp);
          
          const weekend = isWeekend(date);
          if (dayFilter === "weekday" && weekend) return;
          if (dayFilter === "weekend" && !weekend) return;
          
          const hour = date.getHours();
          const primaryKey = Object.keys(point.values).find(k => 
            k.includes("P1") || k.includes("kWh")
          ) || Object.keys(point.values)[0];
          const value = point.values[primaryKey];

          if (typeof value === "number" && !isNaN(value)) {
            hourlyData[hour][meter.id].push(value);
          }
        } catch (e) {}
      });
    });

    // Calculate averages
    return Array.from({ length: 24 }, (_, hour) => {
      const row: Record<string, any> = {
        hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
      };

      let rowTotal = 0;
      selectedMetersList.forEach(meter => {
        const values = hourlyData[hour][meter.id];
        const avg = values.length > 0 
          ? values.reduce((a, b) => a + b, 0) / values.length 
          : 0;
        row[meter.id] = Math.round(avg * 100) / 100;
        rowTotal += row[meter.id];
      });

      row.total = Math.round(rowTotal * 100) / 100;
      return row;
    });
  }, [showPivot, selectedMeters, meters, dayFilter]);

  // Calculate column totals
  const columnTotals = useMemo(() => {
    if (pivotData.length === 0 || !meters) return {};
    
    const selectedMetersList = meters.filter(m => selectedMeters.has(m.id));
    const totals: Record<string, number> = {};
    
    selectedMetersList.forEach(meter => {
      totals[meter.id] = pivotData.reduce((sum, row) => sum + (row[meter.id] || 0), 0);
    });
    
    totals.total = pivotData.reduce((sum, row) => sum + (row.total || 0), 0);
    
    return totals;
  }, [pivotData, selectedMeters, meters]);

  const handleExportCSV = () => {
    if (pivotData.length === 0 || !meters) return;

    const selectedMetersList = meters.filter(m => selectedMeters.has(m.id));
    const headers = ["Hour", ...selectedMetersList.map(getMeterDisplayName), "Total"];
    
    const rows = pivotData.map(row => [
      row.label,
      ...selectedMetersList.map(m => row[m.id]),
      row.total
    ].join(","));

    // Add totals row
    rows.push([
      "TOTAL",
      ...selectedMetersList.map(m => Math.round(columnTotals[m.id] * 100) / 100),
      Math.round(columnTotals.total * 100) / 100
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pivot-table-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const handleExportExcel = () => {
    // For Excel, we'll create a more formatted CSV that Excel handles well
    handleExportCSV();
    toast.info("Open the CSV in Excel for full pivot table functionality");
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
          <TableIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No meter data available</h3>
          <p className="text-muted-foreground text-center max-w-sm mt-1">
            Import SCADA data first to generate pivot tables.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedMetersList = meters.filter(m => selectedMeters.has(m.id));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Pivot Table View
          </CardTitle>
          <CardDescription>
            Excel-style pivot table showing hourly totals across selected meters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Meter Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Meters</Label>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedMeters.size === meters.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {meters.map(meter => (
                <div
                  key={meter.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border rounded-full cursor-pointer transition-colors text-sm",
                    selectedMeters.has(meter.id) && "bg-accent border-accent-foreground/20"
                  )}
                  onClick={() => handleMeterToggle(meter.id, !selectedMeters.has(meter.id))}
                >
                  <Checkbox
                    checked={selectedMeters.has(meter.id)}
                    onCheckedChange={(checked) => handleMeterToggle(meter.id, !!checked)}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: meter.meter_color || "#3b82f6" }}
                  />
                  <span>{getMeterDisplayName(meter)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Day Type</Label>
              <Select value={dayFilter} onValueChange={(v) => setDayFilter(v as DayFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  <SelectItem value="weekday">Weekdays</SelectItem>
                  <SelectItem value="weekend">Weekends</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setShowPivot(true)} disabled={selectedMeters.size === 0}>
              <Calculator className="h-4 w-4 mr-2" />
              Generate Pivot Table
            </Button>

            {showPivot && pivotData.length > 0 && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showPivot && pivotData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Hourly Average Consumption</CardTitle>
                <CardDescription>
                  {selectedMeters.size} meters • {dayFilter === "all" ? "All days" : dayFilter}
                </CardDescription>
              </div>
              <Badge variant="secondary">
                Grand Total: {Math.round(columnTotals.total).toLocaleString()} kWh
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 font-bold">Hour</TableHead>
                    {selectedMetersList.map(meter => (
                      <TableHead key={meter.id} className="text-right min-w-24">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: meter.meter_color || "#3b82f6" }}
                          />
                          <span className="truncate max-w-28">{getMeterDisplayName(meter)}</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold bg-muted/50">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivotData.map(row => (
                    <TableRow key={row.hour}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        {row.label}
                      </TableCell>
                      {selectedMetersList.map(meter => (
                        <TableCell key={meter.id} className="text-right tabular-nums">
                          {row[meter.id].toFixed(2)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium bg-muted/50 tabular-nums">
                        {row.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="border-t-2 font-bold bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 z-10">TOTAL</TableCell>
                    {selectedMetersList.map(meter => (
                      <TableCell key={meter.id} className="text-right tabular-nums">
                        {Math.round(columnTotals[meter.id]).toLocaleString()}
                      </TableCell>
                    ))}
                    <TableCell className="text-right bg-muted/50 tabular-nums">
                      {Math.round(columnTotals.total).toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}