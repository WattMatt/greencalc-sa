import { useState, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Download, Database, Eye } from "lucide-react";
import { ValidatedSiteData } from "../hooks/useValidatedSiteData";
import { RawDataMap } from "../hooks/useRawScadaData";
import { Tenant } from "../types";

interface DataInspectorProps {
  validatedSiteData: ValidatedSiteData;
  rawDataMap: RawDataMap;
  tenants: Tenant[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ROW_LIMITS = [25, 50, 100, 0] as const; // 0 = All

function formatKw(val: number): string {
  return val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : Math.round(val).toString();
}

/** Interpolate from transparent to primary blue based on value relative to peak */
function heatmapStyle(value: number, peak: number): React.CSSProperties {
  if (peak <= 0 || value <= 0) return {};
  const ratio = Math.min(value / peak, 1);
  return {
    backgroundColor: `hsl(217 91% 60% / ${(ratio * 0.5).toFixed(2)})`,
    color: ratio > 0.6 ? "hsl(0 0% 100%)" : undefined,
  };
}

function exportTableToCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataInspector({ validatedSiteData, rawDataMap, tenants }: DataInspectorProps) {
  const [open, setOpen] = useState(false);
  const [rowLimit, setRowLimit] = useState<number>(25);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [rawDialogOpen, setRawDialogOpen] = useState(false);
  const [rawDialogData, setRawDialogData] = useState<{ tenantName: string; date: string; points: unknown[] }>({
    tenantName: "",
    date: "",
    points: [],
  });

  const {
    siteDataByDate,
    tenantDateMaps,
    tenantKeyMap,
    tenantsWithRawData,
    validatedDateCount,
    scadaCount,
    estimatedCount,
    availableYears,
    outlierCount,
  } = validatedSiteData;

  // Sort dates for site table
  const sortedDates = useMemo(() => Array.from(siteDataByDate.keys()).sort(), [siteDataByDate]);

  // Peak kW across entire site dataset (for heatmap scaling)
  const sitePeak = useMemo(() => {
    let peak = 0;
    siteDataByDate.forEach(hours => {
      for (const v of hours) if (v > peak) peak = v;
    });
    return peak;
  }, [siteDataByDate]);

  // Tenants with raw data for dropdown
  const tenantOptions = useMemo(() => {
    return tenantsWithRawData.map(id => ({
      id,
      label: tenants.find(t => t.id === id)?.name || tenantKeyMap.get(id) || id.slice(0, 8),
    }));
  }, [tenantsWithRawData, tenants, tenantKeyMap]);

  // Per-tenant data
  const tenantDates = useMemo(() => {
    if (!selectedTenantId) return [];
    const map = tenantDateMaps.get(selectedTenantId);
    if (!map) return [];
    return Array.from(map.keys()).sort();
  }, [selectedTenantId, tenantDateMaps]);

  const tenantPeak = useMemo(() => {
    if (!selectedTenantId) return 0;
    const map = tenantDateMaps.get(selectedTenantId);
    if (!map) return 0;
    let peak = 0;
    map.forEach(hours => {
      for (const v of hours) if (v > peak) peak = v;
    });
    return peak;
  }, [selectedTenantId, tenantDateMaps]);

  // Determine format for each SCADA import
  const formatBadges = useMemo(() => {
    const badges: { id: string; label: string; normalised: boolean; count: number }[] = [];
    for (const [id, entry] of Object.entries(rawDataMap)) {
      const points = Array.isArray(entry.raw_data) ? (entry.raw_data as Record<string, unknown>[]) : [];
      const sample = points[0];
      const isNormalised = sample && typeof sample === "object" && "date" in sample && "time" in sample && "value" in sample;
      badges.push({ id, label: id.slice(0, 8), normalised: !!isNormalised, count: points.length });
    }
    return badges;
  }, [rawDataMap]);

  const openRawDialog = useCallback(
    (tenantId: string, date: string) => {
      const tenant = tenants.find(t => t.id === tenantId);
      const scadaId = tenant?.scada_import_id;
      let points: unknown[] = [];
      if (scadaId && rawDataMap[scadaId]) {
        const all = Array.isArray(rawDataMap[scadaId].raw_data)
          ? (rawDataMap[scadaId].raw_data as { date?: string }[])
          : [];
        points = all.filter(p => p.date === date);
      }
      // Also check tenant_meters
      if (points.length === 0 && tenant?.tenant_meters) {
        for (const m of tenant.tenant_meters) {
          if (m.scada_import_id && rawDataMap[m.scada_import_id]) {
            const all = Array.isArray(rawDataMap[m.scada_import_id].raw_data)
              ? (rawDataMap[m.scada_import_id].raw_data as { date?: string }[])
              : [];
            points = [...points, ...all.filter(p => p.date === date)];
          }
        }
      }
      setRawDialogData({ tenantName: tenant?.name || tenantId, date, points });
      setRawDialogOpen(true);
    },
    [tenants, rawDataMap],
  );

  const handleExportSite = useCallback(() => {
    const headers = ["Date", ...HOURS.map(h => `H${String(h).padStart(2, "0")}`)];
    const rows = sortedDates.map(d => {
      const hours = siteDataByDate.get(d)!;
      return [d, ...hours.map(v => formatKw(v))];
    });
    exportTableToCSV(headers, rows, "site-load-data.csv");
  }, [sortedDates, siteDataByDate]);

  const handleExportTenant = useCallback(() => {
    if (!selectedTenantId) return;
    const map = tenantDateMaps.get(selectedTenantId);
    if (!map) return;
    const headers = ["Date", ...HOURS.map(h => `H${String(h).padStart(2, "0")}`)];
    const rows = tenantDates.map(d => {
      const hours = map.get(d)!;
      return [d, ...hours.map(v => formatKw(v))];
    });
    const name = tenants.find(t => t.id === selectedTenantId)?.name || "tenant";
    exportTableToCSV(headers, rows, `${name}-load-data.csv`);
  }, [selectedTenantId, tenantDateMaps, tenantDates, tenants]);

  const limitedSiteDates = rowLimit > 0 ? sortedDates.slice(0, rowLimit) : sortedDates;
  const limitedTenantDates = rowLimit > 0 ? tenantDates.slice(0, rowLimit) : tenantDates;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Database className="h-4 w-4" />
            Data Inspector
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{validatedDateCount} validated dates</Badge>
            <Badge variant="secondary">{scadaCount} SCADA tenants</Badge>
            <Badge variant="secondary">{estimatedCount} estimated</Badge>
            {outlierCount > 0 && <Badge variant="destructive">{outlierCount} outliers removed</Badge>}
            {availableYears.length > 0 && (
              <Badge variant="outline">
                {availableYears[0]}–{availableYears[availableYears.length - 1]}
              </Badge>
            )}
          </div>

          {/* Row limit */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Rows:</span>
            <Select value={String(rowLimit)} onValueChange={v => setRowLimit(Number(v))}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROW_LIMITS.map(l => (
                  <SelectItem key={l} value={String(l)}>
                    {l === 0 ? "All" : l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="site">
            <TabsList>
              <TabsTrigger value="site">Site Data</TabsTrigger>
              <TabsTrigger value="tenant">Per-Tenant</TabsTrigger>
              <TabsTrigger value="format">Format Check</TabsTrigger>
            </TabsList>

            {/* Site-level heatmap table */}
            <TabsContent value="site">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">
                  Showing {limitedSiteDates.length} of {sortedDates.length} dates
                </p>
                <Button variant="ghost" size="sm" onClick={handleExportSite} className="gap-1">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
              <div className="overflow-auto max-h-[500px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">Date</TableHead>
                      {HOURS.map(h => (
                        <TableHead key={h} className="text-center px-1 min-w-[52px]">
                          {String(h).padStart(2, "0")}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {limitedSiteDates.map(date => {
                      const hours = siteDataByDate.get(date)!;
                      return (
                        <TableRow key={date}>
                          <TableCell className="sticky left-0 bg-background z-10 font-mono text-xs">
                            {date}
                          </TableCell>
                          {hours.map((val, h) => (
                            <TableCell
                              key={h}
                              className="text-center px-1 py-1 text-xs font-mono"
                              style={heatmapStyle(val, sitePeak)}
                            >
                              {formatKw(val)}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Per-tenant breakdown */}
            <TabsContent value="tenant">
              <div className="flex items-center gap-3 mb-3">
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="w-64 h-8">
                    <SelectValue placeholder="Select tenant…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantOptions.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTenantId && (
                  <Button variant="ghost" size="sm" onClick={handleExportTenant} className="gap-1">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                )}
              </div>

              {selectedTenantId && tenantDates.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    Showing {limitedTenantDates.length} of {tenantDates.length} dates
                  </p>
                  <div className="overflow-auto max-h-[500px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">Date</TableHead>
                          {HOURS.map(h => (
                            <TableHead key={h} className="text-center px-1 min-w-[52px]">
                              {String(h).padStart(2, "0")}
                            </TableHead>
                          ))}
                          <TableHead className="text-center px-2">Raw</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {limitedTenantDates.map(date => {
                          const map = tenantDateMaps.get(selectedTenantId)!;
                          const hours = map.get(date)!;
                          return (
                            <TableRow key={date}>
                              <TableCell className="sticky left-0 bg-background z-10 font-mono text-xs">
                                {date}
                              </TableCell>
                              {hours.map((val, h) => (
                                <TableCell
                                  key={h}
                                  className="text-center px-1 py-1 text-xs font-mono"
                                  style={heatmapStyle(val, tenantPeak)}
                                >
                                  {formatKw(val)}
                                </TableCell>
                              ))}
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => openRawDialog(selectedTenantId, date)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : selectedTenantId ? (
                <p className="text-sm text-muted-foreground">No validated data for this tenant.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Select a tenant above to view per-date data.</p>
              )}
            </TabsContent>

            {/* Format verification */}
            <TabsContent value="format">
              <div className="space-y-2">
                {formatBadges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No raw data loaded.</p>
                ) : (
                  <div className="overflow-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SCADA Import ID</TableHead>
                          <TableHead>Records</TableHead>
                          <TableHead>Format</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formatBadges.map(b => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">{b.id}</TableCell>
                            <TableCell>{b.count.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={b.normalised ? "default" : "destructive"}>
                                {b.normalised ? "Normalised" : "Legacy"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>

      {/* Raw data sample dialog */}
      <Dialog open={rawDialogOpen} onOpenChange={setRawDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Raw Data — {rawDialogData.tenantName} — {rawDialogData.date}
            </DialogTitle>
            <DialogDescription>
              {rawDialogData.points.length} readings for this date
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rawDialogData.points as { time?: string; value?: number }[]).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{p.time ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.value != null ? formatKw(p.value) : "—"}</TableCell>
                  </TableRow>
                ))}
                {rawDialogData.points.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No raw data found for this tenant/date combination.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
