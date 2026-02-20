import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, GitBranch, ArrowRight } from "lucide-react";

interface MeterData {
  id: string;
  site_name: string;
  shop_name: string | null;
  meter_label: string | null;
}

interface Connection {
  id?: string;
  parent_meter_id: string;
  child_meter_id: string;
}

interface MeterConnectionsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  schematicId: string;
  onConnectionsChanged?: () => void;
}

export function MeterConnectionsManager({ open, onOpenChange, projectId, schematicId, onConnectionsChanged }: MeterConnectionsManagerProps) {
  const [meters, setMeters] = useState<MeterData[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [newConnection, setNewConnection] = useState<Partial<Connection>>({});

  useEffect(() => {
    if (open) { fetchMeters(); fetchConnections(); }
  }, [open, projectId]);

  const fetchMeters = async () => {
    const { data } = await supabase
      .from('scada_imports')
      .select('id, site_name, shop_name, meter_label')
      .eq('project_id', projectId)
      .order('site_name');
    setMeters(data || []);
  };

  const fetchConnections = async () => {
    const { data } = await supabase
      .from('project_meter_connections')
      .select('*')
      .eq('project_id', projectId);
    setConnections(data || []);
  };

  const handleAddConnection = async () => {
    if (!newConnection.parent_meter_id || !newConnection.child_meter_id) {
      toast.error('Select both parent and child meters');
      return;
    }
    if (newConnection.parent_meter_id === newConnection.child_meter_id) {
      toast.error('A meter cannot connect to itself');
      return;
    }
    const dup = connections.find(c => c.parent_meter_id === newConnection.parent_meter_id && c.child_meter_id === newConnection.child_meter_id);
    if (dup) { toast.error('Connection already exists'); return; }

    setLoading(true);
    const { error } = await supabase.from('project_meter_connections').insert({
      parent_meter_id: newConnection.parent_meter_id,
      child_meter_id: newConnection.child_meter_id,
      project_id: projectId,
    });

    if (error) { toast.error('Failed to create connection'); }
    else { toast.success('Connection created'); setNewConnection({}); fetchConnections(); onConnectionsChanged?.(); }
    setLoading(false);
  };

  const handleDeleteConnection = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    // Delete associated schematic lines
    const { data: allLines } = await supabase
      .from('project_schematic_lines').select('*').eq('schematic_id', schematicId).eq('line_type', 'connection');
    const matching = allLines?.filter((l: any) =>
      l.metadata?.parent_meter_id === connection.parent_meter_id && l.metadata?.child_meter_id === connection.child_meter_id
    ) || [];
    for (const line of matching) {
      await supabase.from('project_schematic_lines').delete().eq('id', line.id);
    }

    await supabase.from('project_meter_connections').delete().eq('id', connectionId);
    toast.success('Connection deleted');
    fetchConnections();
    onConnectionsChanged?.();
  };

  const getMeterLabel = (meterId: string) => {
    const m = meters.find(x => x.id === meterId);
    return m ? (m.meter_label || m.shop_name || m.site_name) : 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Manage Meter Connections
          </DialogTitle>
          <DialogDescription>Define the electrical hierarchy between meters</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4 border-r pr-6">
            <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add Connection</h3>
            <div className="space-y-3">
              <div>
                <Label>Parent Meter (Upstream)</Label>
                <Select value={newConnection.parent_meter_id} onValueChange={(v) => setNewConnection({ ...newConnection, parent_meter_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select parent..." /></SelectTrigger>
                  <SelectContent>
                    {meters.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.meter_label || m.shop_name || m.site_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
              <div>
                <Label>Child Meter (Downstream)</Label>
                <Select value={newConnection.child_meter_id} onValueChange={(v) => setNewConnection({ ...newConnection, child_meter_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select child..." /></SelectTrigger>
                  <SelectContent>
                    {meters.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.meter_label || m.shop_name || m.site_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddConnection} disabled={loading || !newConnection.parent_meter_id || !newConnection.child_meter_id} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Connection
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Existing Connections ({connections.length})</h3>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2">
                {connections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No connections yet</div>
                ) : connections.map(c => (
                  <div key={c.id} className="p-3 border rounded-lg space-y-2 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Parent</Badge>
                          <span className="text-sm font-medium">{getMeterLabel(c.parent_meter_id)}</span>
                        </div>
                        <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Child</Badge>
                          <span className="text-sm">{getMeterLabel(c.child_meter_id)}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => c.id && handleDeleteConnection(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
