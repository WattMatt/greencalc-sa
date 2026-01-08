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
import { Building2, Plus, Edit2, Trash2, MapPin, Ruler, Upload, Database, ArrowLeft, FileText, Calendar } from "lucide-react";
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
}

export function SitesTab() {
  const queryClient = useQueryClient();
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
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
        .select("id, site_name, shop_name, file_name, data_points, date_range_start, date_range_end, created_at")
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
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Uploaded Meters
            </CardTitle>
            <CardDescription>
              {siteMeters?.length || 0} meter{(siteMeters?.length || 0) !== 1 ? "s" : ""} uploaded to this site
            </CardDescription>
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
                    <TableHead>Data Points</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siteMeters.map((meter) => (
                    <TableRow key={meter.id}>
                      <TableCell className="font-medium">
                        {meter.shop_name || meter.site_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {meter.file_name || "-"}
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
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(meter.created_at)}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
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
