import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Edit2, Trash2, MapPin, Ruler, Upload, Database } from "lucide-react";
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


export function SitesTab() {
  const queryClient = useQueryClient();
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedSiteForImport, setSelectedSiteForImport] = useState<Site | null>(null);
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

  const openImportDialog = (site: Site) => {
    setSelectedSiteForImport(site);
    setImportDialogOpen(true);
  };

  const handleSubmit = () => {
    saveSite.mutate({
      name: formData.name,
      site_type: formData.site_type || null,
      location: formData.location || null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sites</h2>
          <p className="text-sm text-muted-foreground">
            Manage sites and import meter data for each location
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
              Create a site to start importing meter data
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
              onClick={() => openImportDialog(site)}
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
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openImportDialog(site);
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Meters
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Meters to {selectedSiteForImport?.name}
            </DialogTitle>
            <DialogDescription>
              Upload SCADA data or manually add meters to this site
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <BulkMeterImport 
              siteId={selectedSiteForImport?.id || null}
              onImportComplete={() => {
                setImportDialogOpen(false);
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
