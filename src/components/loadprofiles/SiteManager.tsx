import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Plus, Edit2, Trash2, MapPin, Ruler, Database } from "lucide-react";
import { toast } from "sonner";

interface Site {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  total_area_sqm: number | null;
  created_at: string;
  meter_count?: number;
}

interface SiteManagerProps {
  selectedSiteId: string | null;
  onSelectSite: (siteId: string | null) => void;
}

export function SiteManager({ selectedSiteId, onSelectSite }: SiteManagerProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    total_area_sqm: "",
  });

  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data: sitesData, error } = await supabase
        .from("sites")
        .select("*")
        .order("name");
      if (error) throw error;

      // Get meter counts per site
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
      description: string | null;
      location: string | null;
      total_area_sqm: number | null;
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
    onSuccess: (newSite) => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success(editingSite ? "Site updated" : "Site created");
      setDialogOpen(false);
      resetForm();
      if (newSite && !editingSite) {
        onSelectSite(newSite.id);
      }
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
      toast.success("Site deleted");
      if (selectedSiteId && sites?.find(s => s.id === selectedSiteId)) {
        onSelectSite(null);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", location: "", total_area_sqm: "" });
    setEditingSite(null);
  };

  const openEditDialog = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      description: site.description || "",
      location: site.location || "",
      total_area_sqm: site.total_area_sqm?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    saveSite.mutate({
      name: formData.name,
      description: formData.description || null,
      location: formData.location || null,
      total_area_sqm: formData.total_area_sqm ? parseFloat(formData.total_area_sqm) : null,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sites
          </CardTitle>
          <CardDescription>
            Manage sites and their meter data
          </CardDescription>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
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
                <Label>Total Area (m²)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 50000"
                  value={formData.total_area_sqm}
                  onChange={(e) => setFormData({ ...formData, total_area_sqm: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Brief description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading sites...</div>
        ) : !sites?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sites yet</p>
            <p className="text-sm">Create a site to start importing meter data</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {/* All Sites option */}
              <div
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedSiteId === null
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => onSelectSite(null)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">All Sites</span>
                  </div>
                  <Badge variant="secondary">
                    {sites.reduce((sum, s) => sum + (s.meter_count || 0), 0)} meters
                  </Badge>
                </div>
              </div>

              {sites.map((site) => (
                <div
                  key={site.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSiteId === site.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => onSelectSite(site.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">{site.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {site.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {site.location}
                          </span>
                        )}
                        {site.total_area_sqm && (
                          <span className="flex items-center gap-1">
                            <Ruler className="h-3 w-3" />
                            {site.total_area_sqm.toLocaleString()} m²
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{site.meter_count || 0} meters</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(site);
                        }}
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
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
