import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Edit2, Trash2, MapPin, Ruler, Upload, Database, ArrowLeft, FileText, Calendar, Play, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BulkMeterImport } from "@/components/loadprofiles/BulkMeterImport";

interface Site {
  id: string;
  name: string;
  site_type: string | null;
  location: string | null;
  total_area_sqm: number | null;
  created_at: string;
  meter_count?: number;
}

interface Meter {
  id: string;
  site_name: string;
  shop_name: string | null;
  file_name: string | null;
  data_points: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  created_at: string;
  load_profile_weekday: number[] | null;
  load_profile_weekend: number[] | null;
}

export function SitesTab() {
  const queryClient = useQueryClient();
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [processingMeterId, setProcessingMeterId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    site_type: "",
    location: "",
  });

  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data: sitesData, error } = await supabase
        .from("sites")
        .select("*")
        .order("name");
      if (error) throw error;

      const { data: meters } = await supabase
        .from("scada_imports")
        .select("site_id");

      const meterCounts = (meters || []).reduce((acc, m) => {
        if (m.site_id) {
          acc[m.site_id] = (acc[m.site_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return (sitesData || []).map(site => ({
        ...site,
        meter_count: meterCounts[site.id] || 0,
      })) as Site[];
    },
  });

  // Fetch meters for selected site
  const { data: siteMeters, isLoading: isLoadingMeters } = useQuery({
    queryKey: ["site-meters", selectedSite?.id],
    queryFn: async () => {
      if (!selectedSite) return [];
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_name, file_name, data_points, date_range_start, date_range_end, created_at, load_profile_weekday, load_profile_weekend")
        .eq("site_id", selectedSite.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Meter[];
    },
    enabled: !!selectedSite,
  });

  const saveSite = useMutation({
    mutationFn: async (data: {
      name: string;
      site_type: string | null;
      location: string | null;
    }) => {
      if (editingSite) {
        const { error } = await supabase
          .from("sites")
          .update(data)
          .eq("id", editingSite.id);
        if (error) throw error;
      } else {
        const { data: newSite, error } = await supabase
          .from("sites")
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        return newSite;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      toast.success(editingSite ? "Site updated" : "Site created");
      setSiteDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteSite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      toast.success("Site deleted");
      setSelectedSite(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scada_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Meter deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const processMeter = async (meter: Meter) => {
    setProcessingMeterId(meter.id);

    try {
      // Fetch fresh raw_data directly from the database since it might not be included in the list query
      const { data: meterData, error: fetchError } = await supabase
        .from("scada_imports")
        .select("raw_data")
        .eq("id", meter.id)
        .single();

      if (fetchError) throw fetchError;

      if (!meterData?.raw_data) {
        toast.error("No raw data available to process");
        setProcessingMeterId(null);
        return;
      }

      // raw_data is already an array of parsed data points: {date, time, value, timestamp, originalLine}
      const rawDataArray = meterData.raw_data as Array<{
        date?: string;
        time?: string;
        timestamp?: string;
        value?: number;
      }>;

      if (!Array.isArray(rawDataArray) || rawDataArray.length === 0) {
        toast.error("No data points found in raw data");
        setProcessingMeterId(null);
        return;
      }

      // Process the data points to calculate hourly profiles
      const weekdayHours: number[][] = Array.from({ length: 24 }, () => []);
      const weekendHours: number[][] = Array.from({ length: 24 }, () => []);
      const weekdayDates = new Set<string>();
      const weekendDates = new Set<string>();
      let minDate: string | null = null;
      let maxDate: string | null = null;

      for (const point of rawDataArray) {
        const dateStr = point.date || (point.timestamp ? point.timestamp.split("T")[0] : null);
        const timeStr = point.time || (point.timestamp ? point.timestamp.split("T")[1]?.substring(0, 8) : null);
        const value = typeof point.value === "number" ? point.value : parseFloat(String(point.value));

        if (!dateStr || !timeStr || isNaN(value)) continue;

        // Track date range
        if (!minDate || dateStr < minDate) minDate = dateStr;
        if (!maxDate || dateStr > maxDate) maxDate = dateStr;

        // Parse hour from time
        const hour = parseInt(timeStr.split(":")[0], 10);
        if (isNaN(hour) || hour < 0 || hour > 23) continue;

        // Determine day of week
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWeekend) {
          weekendHours[hour].push(value);
          weekendDates.add(dateStr);
        } else {
          weekdayHours[hour].push(value);
          weekdayDates.add(dateStr);
        }
      }

      // Calculate average for each hour and normalize
      const weekdayAvg = weekdayHours.map((vals) =>
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      );
      const weekendAvg = weekendHours.map((vals) =>
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      );

      // Normalize to percentages (sum to 100)
      const weekdaySum = weekdayAvg.reduce((a, b) => a + b, 0);
      const weekendSum = weekendAvg.reduce((a, b) => a + b, 0);

      const weekdayProfile = weekdaySum > 0
        ? weekdayAvg.map((v) => Math.round((v / weekdaySum) * 100 * 100) / 100)
        : weekdayAvg;
      const weekendProfile = weekendSum > 0
        ? weekendAvg.map((v) => Math.round((v / weekendSum) * 100 * 100) / 100)
        : weekendAvg;

      // Update the meter with processed data
      const { error: updateError } = await supabase
        .from("scada_imports")
        .update({
          load_profile_weekday: weekdayProfile,
          load_profile_weekend: weekendProfile,
          date_range_start: minDate,
          date_range_end: maxDate,
          weekday_days: weekdayDates.size,
          weekend_days: weekendDates.size,
          data_points: rawDataArray.length,
        })
        .eq("id", meter.id);

      if (updateError) throw updateError;

      await queryClient.refetchQueries({ queryKey: ["site-meters", selectedSite?.id] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      toast.success(`Processed ${meter.shop_name || meter.site_name} (${rawDataArray.length} readings)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process meter");
    } finally {
      setProcessingMeterId(null);
    }
  };

  const isProcessed = (meter: Meter) => {
    // A meter is processed if it has valid load profiles (not all zeros)
    const weekday = meter.load_profile_weekday || [];
    const weekend = meter.load_profile_weekend || [];
    const hasWeekdayData = weekday.some(v => v > 0);
    const hasWeekendData = weekend.some(v => v > 0);
    return hasWeekdayData || hasWeekendData;
  };

  const resetForm = () => {
    setFormData({ name: "", site_type: "", location: "" });
    setEditingSite(null);
  };

  const openEditDialog = (site: Site, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSite(site);
    setFormData({
      name: site.name,
      site_type: site.site_type || "",
      location: site.location || "",
    });
    setSiteDialogOpen(true);
  };

  const handleSubmit = () => {
    saveSite.mutate({
      name: formData.name,
      site_type: formData.site_type || null,
      location: formData.location || null,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  // Show site meters view when a site is selected
  if (selectedSite) {
    const processedCount = siteMeters?.filter(m => isProcessed(m)).length || 0;
    const unprocessedCount = (siteMeters?.length || 0) - processedCount;

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedSite(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {selectedSite.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedSite.location || "No location"} • {selectedSite.site_type || "No type"}
              </p>
            </div>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Meters
          </Button>
        </div>

        {/* Meters List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Uploaded Meters
                </CardTitle>
                <CardDescription>
                  {siteMeters?.length || 0} meter{(siteMeters?.length || 0) !== 1 ? "s" : ""} uploaded
                  {unprocessedCount > 0 && (
                    <span className="ml-2 text-orange-600">• {unprocessedCount} need processing</span>
                  )}
                </CardDescription>
              </div>
              {unprocessedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const unprocessed = siteMeters?.filter(m => !isProcessed(m)) || [];
                    for (const meter of unprocessed) {
                      await processMeter(meter);
                    }
                  }}
                  disabled={!!processingMeterId}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Process All ({unprocessedCount})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMeters ? (
              <div className="text-center py-8 text-muted-foreground">Loading meters...</div>
            ) : !siteMeters?.length ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No meters uploaded yet</p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Meters
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meter Name</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siteMeters.map((meter) => {
                    const processed = isProcessed(meter);
                    const isProcessing = processingMeterId === meter.id;

                    return (
                      <TableRow key={meter.id}>
                        <TableCell className="font-medium">
                          {meter.shop_name || meter.site_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {meter.file_name || "-"}
                        </TableCell>
                        <TableCell>
                          {processed ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Processed
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {meter.data_points?.toLocaleString() || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(meter.date_range_start)} — {formatDate(meter.date_range_end)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!processed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => processMeter(meter)}
                                disabled={isProcessing}
                                title="Process meter"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 text-primary" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Delete this meter?")) {
                                  deleteMeter.mutate(meter.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Meters to {selectedSite.name}
              </DialogTitle>
              <DialogDescription>
                Upload CSV files containing meter data
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <BulkMeterImport 
                siteId={selectedSite.id}
                onImportComplete={() => {
                  setUploadDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["site-meters", selectedSite.id] });
                  queryClient.invalidateQueries({ queryKey: ["sites"] });
                  queryClient.invalidateQueries({ queryKey: ["meter-library"] });
                  queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sites</h2>
          <p className="text-sm text-muted-foreground">
            Manage sites and upload meter data for each location
          </p>
        </div>
        <Dialog
          open={siteDialogOpen}
          onOpenChange={(open) => {
            setSiteDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSite ? "Edit" : "Add"} Site</DialogTitle>
              <DialogDescription>
                {editingSite ? "Update site details" : "Create a new site to organize meter data"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Site Name *</Label>
                <Input
                  placeholder="e.g., Clearwater Mall, Sandton City"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="e.g., Johannesburg, South Africa"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Site Type</Label>
                <Input
                  placeholder="e.g., Shopping Centre, Office Park, Industrial"
                  value={formData.site_type}
                  onChange={(e) => setFormData({ ...formData, site_type: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!formData.name || saveSite.isPending}
              >
                {editingSite ? "Update" : "Create"} Site
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sites Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading sites...</div>
      ) : !sites?.length ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">No sites yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create a site to start uploading meter data
            </p>
            <Button onClick={() => setSiteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Site
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card 
              key={site.id} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedSite(site)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{site.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => openEditDialog(site, e)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${site.name}"? Meters will be unassigned.`)) {
                          deleteSite.mutate(site.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {site.site_type && (
                  <Badge variant="outline" className="mt-1">{site.site_type}</Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Database className="h-4 w-4" />
                      Meters
                    </span>
                    <Badge variant="secondary">{site.meter_count || 0}</Badge>
                  </div>
                  {site.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {site.location}
                    </div>
                  )}
                  {site.total_area_sqm && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Ruler className="h-4 w-4" />
                      {site.total_area_sqm.toLocaleString()} m²
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
