import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface QuickMeterDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  position: { x: number; y: number };
  schematicId: string;
  onMeterPlaced: () => void;
}

export const QuickMeterDialog = ({
  open, onClose, projectId, position, schematicId, onMeterPlaced,
}: QuickMeterDialogProps) => {
  const [meters, setMeters] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) fetchMeters();
  }, [open, projectId]);

  const fetchMeters = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("scada_imports")
      .select("*")
      .eq("project_id", projectId)
      .order("site_name");
    setMeters(data || []);
    setIsLoading(false);
  };

  const filteredMeters = meters.filter(
    (m) =>
      m.site_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.shop_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.meter_label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.shop_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectMeter = async (meterId: string) => {
    setIsSaving(true);
    try {
      const meter = meters.find((m) => m.id === meterId);

      const { data: existingPos } = await supabase
        .from("project_schematic_meter_positions")
        .select("id")
        .eq("schematic_id", schematicId)
        .eq("meter_id", meterId)
        .single();

      if (existingPos) {
        const { error } = await supabase
          .from("project_schematic_meter_positions")
          .update({ x_position: position.x, y_position: position.y })
          .eq("id", existingPos.id);
        if (error) throw error;
        toast.success("Meter position updated");
      } else {
        const { error } = await supabase
          .from("project_schematic_meter_positions")
          .insert({
            schematic_id: schematicId,
            meter_id: meterId,
            x_position: position.x,
            y_position: position.y,
            label: meter?.meter_label || meter?.shop_name || meter?.site_name,
          });
        if (error) throw error;
        toast.success("Meter placed on schematic");
      }

      onMeterPlaced();
      handleClose();
    } catch (error) {
      console.error("Error placing meter:", error);
      toast.error("Failed to place meter");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Place Meter at ({position.x.toFixed(1)}%, {position.y.toFixed(1)}%)</DialogTitle>
          <DialogDescription>Select a SCADA meter to place on the schematic at this position.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[400px] rounded-md border p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredMeters.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? "No meters found" : "No meters available. Import SCADA data first."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMeters.map((meter) => (
                <Button
                  key={meter.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleSelectMeter(meter.id)}
                  disabled={isSaving}
                >
                  <div className="text-left space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold">{meter.meter_label || meter.site_name}</span>
                      {meter.shop_name && (
                        <Badge variant="outline" className="text-xs">{meter.shop_name}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {meter.shop_number && `#${meter.shop_number} • `}
                      {meter.file_name || "No file"}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
