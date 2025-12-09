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
import { Database, Edit2, Trash2, Tag, Palette, Hash, Store, Ruler } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ScadaImport {
  id: string;
  site_name: string;
  shop_number: string | null;
  shop_name: string | null;
  area_sqm: number | null;
  meter_label: string | null;
  meter_color: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  data_points: number | null;
  created_at: string;
}

const METER_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

export function MeterLibrary() {
  const queryClient = useQueryClient();
  const [editingMeter, setEditingMeter] = useState<ScadaImport | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [editShopNumber, setEditShopNumber] = useState("");
  const [editShopName, setEditShopName] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editSiteName, setEditSiteName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: meters, isLoading } = useQuery({
    queryKey: ["meter-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, site_name, shop_number, shop_name, area_sqm, meter_label, meter_color, date_range_start, date_range_end, data_points, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ScadaImport[];
    },
  });

  const updateMeter = useMutation({
    mutationFn: async (params: { id: string; meter_label: string; meter_color: string; shop_number: string | null; shop_name: string | null; area_sqm: number | null; site_name: string }) => {
      const { error } = await supabase
        .from("scada_imports")
        .update({
          meter_label: params.meter_label || null,
          meter_color: params.meter_color,
          shop_number: params.shop_number || null,
          shop_name: params.shop_name || null,
          area_sqm: params.area_sqm,
          site_name: params.site_name,
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      toast.success("Meter updated");
      setDialogOpen(false);
      setEditingMeter(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scada_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      toast.success("Meter deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const openEditDialog = (meter: ScadaImport) => {
    setEditingMeter(meter);
    setEditLabel(meter.meter_label || "");
    setEditColor(meter.meter_color || "#3b82f6");
    setEditShopNumber(meter.shop_number || "");
    setEditShopName(meter.shop_name || "");
    setEditArea(meter.area_sqm?.toString() || "");
    setEditSiteName(meter.site_name || "");
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
          <div className="animate-pulse text-muted-foreground">Loading meter library...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Meter Library
          </CardTitle>
          <CardDescription>
            Global reference meters - used to build project load profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!meters?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No meters imported yet</p>
              <p className="text-sm">Use the "New SCADA Import" tab to add meters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">Color</TableHead>
                  <TableHead>Meter / Label</TableHead>
                  <TableHead>Area (m²)</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Data Points</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map(meter => (
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
                      {meter.area_sqm ? (
                        <span className="text-sm">{meter.area_sqm.toLocaleString()} m²</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
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
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this meter?")) {
                              deleteMeter.mutate(meter.id);
                            }
                          }}
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
              Update meter details for the reference library
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Site Name
              </Label>
              <Input
                placeholder="e.g., Mall of Africa, Sandton City"
                value={editSiteName}
                onChange={(e) => setEditSiteName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Shop Number
                </Label>
                <Input
                  placeholder="e.g., 101, A12"
                  value={editShopNumber}
                  onChange={(e) => setEditShopNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Shop Name
                </Label>
                <Input
                  placeholder="e.g., Pick n Pay, Woolworths"
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Area (m²)
              </Label>
              <Input
                type="number"
                placeholder="e.g., 250"
                value={editArea}
                onChange={(e) => setEditArea(e.target.value)}
              />
            </div>

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
              <div className="flex gap-2 flex-wrap">
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
                if (editingMeter && editSiteName.trim()) {
                  updateMeter.mutate({
                    id: editingMeter.id,
                    meter_label: editLabel,
                    meter_color: editColor,
                    shop_number: editShopNumber || null,
                    shop_name: editShopName || null,
                    area_sqm: editArea ? parseFloat(editArea) : null,
                    site_name: editSiteName.trim(),
                  });
                }
              }}
              disabled={!editSiteName.trim()}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
