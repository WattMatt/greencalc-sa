import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Database, Edit2, Trash2, Tag, Palette, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ScadaImport {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  meter_label: string | null;
  meter_color: string | null;
  project_id: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  data_points: number | null;
  created_at: string;
}

const METER_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

interface ProjectMeterLibraryProps {
  projectId: string;
}

export function ProjectMeterLibrary({ projectId }: ProjectMeterLibraryProps) {
  const queryClient = useQueryClient();
  const [editingMeter, setEditingMeter] = useState<ScadaImport | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch meters assigned to this project
  const { data: projectMeters, isLoading } = useQuery({
    queryKey: ["project-meters-library", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_number, shop_name, meter_label, meter_color, project_id, date_range_start, date_range_end, data_points, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ScadaImport[];
    },
  });

  // Fetch unassigned meters (for adding to project)
  const { data: unassignedMeters } = useQuery({
    queryKey: ["unassigned-meters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_number, shop_name, meter_label, meter_color, project_id, date_range_start, date_range_end, data_points, created_at")
        .is("project_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ScadaImport[];
    },
  });

  const updateMeter = useMutation({
    mutationFn: async (params: { id: string; meter_label: string; meter_color: string }) => {
      const { error } = await supabase
        .from("scada_imports")
        .update({
          meter_label: params.meter_label || null,
          meter_color: params.meter_color,
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-meters-library", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-meters", projectId] });
      toast.success("Meter updated");
      setDialogOpen(false);
      setEditingMeter(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const assignMeter = useMutation({
    mutationFn: async (meterId: string) => {
      const { error } = await supabase
        .from("scada_imports")
        .update({ project_id: projectId })
        .eq("id", meterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-meters-library", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-meters", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-meters"] });
      toast.success("Meter added to project");
    },
    onError: (error) => toast.error(error.message),
  });

  const unassignMeter = useMutation({
    mutationFn: async (meterId: string) => {
      const { error } = await supabase
        .from("scada_imports")
        .update({ project_id: null })
        .eq("id", meterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-meters-library", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-meters", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-meters"] });
      toast.success("Meter removed from project");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scada_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-meters-library", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-meters", projectId] });
      toast.success("Meter deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const openEditDialog = (meter: ScadaImport) => {
    setEditingMeter(meter);
    setEditLabel(meter.meter_label || "");
    setEditColor(meter.meter_color || "#3b82f6");
    setDialogOpen(true);
  };

  const getMeterDisplayName = (meter: ScadaImport) => {
    if (meter.meter_label) return meter.meter_label;
    if (meter.shop_name) return `${meter.shop_name} - ${meter.site_name}`;
    if (meter.shop_number) return `${meter.shop_number} - ${meter.site_name}`;
    return meter.site_name;
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Project Meters
              </CardTitle>
              <CardDescription>
                Meters assigned to this project for stacking and analysis
              </CardDescription>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Meter
              </Button>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Meters to Project</DialogTitle>
                  <DialogDescription>
                    Select from unassigned meters to add to this project
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {!unassignedMeters?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No unassigned meters available</p>
                      <p className="text-sm">Import SCADA data in the Load Profiles section</p>
                    </div>
                  ) : (
                    unassignedMeters.map(meter => (
                      <div
                        key={meter.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: meter.meter_color || "#3b82f6" }}
                          />
                          <div>
                            <div className="font-medium">{getMeterDisplayName(meter)}</div>
                            <div className="text-xs text-muted-foreground">
                              {meter.data_points?.toLocaleString() || 0} data points
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => assignMeter.mutate(meter.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!projectMeters?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No meters assigned to this project</p>
              <p className="text-sm">Click "Add Meter" to assign meters from the library</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">Color</TableHead>
                  <TableHead>Meter / Label</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Data Points</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectMeters.map(meter => (
                  <TableRow key={meter.id}>
                    <TableCell>
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: meter.meter_color || "#3b82f6" }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getMeterDisplayName(meter)}</div>
                        {meter.meter_label && (
                          <div className="text-xs text-muted-foreground">
                            {meter.shop_name || meter.shop_number || meter.site_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {meter.date_range_start && meter.date_range_end ? (
                        <span className="text-sm">
                          {format(new Date(meter.date_range_start), "MMM d")} - {format(new Date(meter.date_range_end), "MMM d, yyyy")}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {meter.data_points?.toLocaleString() || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(meter)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => unassignMeter.mutate(meter.id)}
                          title="Remove from project"
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this meter permanently?")) {
                              deleteMeter.mutate(meter.id);
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Meter</DialogTitle>
            <DialogDescription>
              Customize the meter label and color
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Custom Label
              </Label>
              <Input
                placeholder="e.g., Main Incomer, Tenant A"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Chart Color
              </Label>
              <div className="flex gap-2">
                {METER_COLORS.map(color => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      editColor === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (editingMeter) {
                  updateMeter.mutate({
                    id: editingMeter.id,
                    meter_label: editLabel,
                    meter_color: editColor,
                  });
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
