import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// NERSA-compliant interfaces
interface TariffRate {
  id: string;
  tariff_plan_id?: string;
  charge: string;
  season: string;
  tou: string;
  amount: number;
  unit: string | null;
  block_number: number | null;
  block_min_kwh: number | null;
  block_max_kwh: number | null;
  consumption_threshold_kwh: number | null;
  is_above_threshold: boolean | null;
  notes: string | null;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface Tariff {
  id: string;
  name: string;
  municipality_id: string;
  category: string;
  structure: string;
  voltage: string | null;
  phase: string | null;
  scale_code: string | null;
  min_amps: number | null;
  max_amps: number | null;
  min_kva: number | null;
  max_kva: number | null;
  is_redundant: boolean | null;
  is_recommended: boolean | null;
  metering: string | null;
  description: string | null;
  municipality?: { name: string; province_id: string } | null;
  tariff_rates?: TariffRate[];
}

interface TariffEditDialogProps {
  tariff: Tariff | null;
  rates: TariffRate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const structureLabel = (s: string) => {
  switch (s) {
    case 'time_of_use': return 'TOU';
    case 'inclining_block': return 'IBT';
    case 'flat': return 'Flat';
    default: return s;
  }
};

export function TariffEditDialog({ tariff, rates, open, onOpenChange, onSaved }: TariffEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [editedTariff, setEditedTariff] = useState<Tariff | null>(null);
  const [editedRates, setEditedRates] = useState<TariffRate[]>([]);
  
  useEffect(() => {
    if (tariff) {
      setEditedTariff({ ...tariff });
      setEditedRates(rates.map(r => ({ ...r })));
    }
  }, [tariff, rates]);

  if (!editedTariff) return null;

  const handleSave = async () => {
    if (!editedTariff) return;
    setIsSaving(true);
    
    try {
      // 1. Update tariff plan
      const { error: tariffError } = await supabase
        .from("tariff_plans")
        .update({
          name: editedTariff.name,
          category: editedTariff.category as any,
          structure: editedTariff.structure as any,
          voltage: editedTariff.voltage as any,
          phase: editedTariff.phase,
          scale_code: editedTariff.scale_code,
          description: editedTariff.description,
          is_redundant: editedTariff.is_redundant,
          is_recommended: editedTariff.is_recommended,
        })
        .eq("id", editedTariff.id);
      
      if (tariffError) throw tariffError;

      // 2. Delete marked rates
      const ratesToDelete = editedRates.filter(r => r.isDeleted && !r.isNew);
      if (ratesToDelete.length > 0) {
        const { error } = await supabase
          .from("tariff_rates")
          .delete()
          .in("id", ratesToDelete.map(r => r.id));
        if (error) throw error;
      }

      // 3. Update existing rates
      const ratesToUpdate = editedRates.filter(r => !r.isNew && !r.isDeleted);
      for (const rate of ratesToUpdate) {
        const { error } = await supabase
          .from("tariff_rates")
          .update({
            amount: rate.amount,
            season: rate.season as any,
            tou: rate.tou as any,
            charge: rate.charge as any,
            unit: rate.unit,
            block_min_kwh: rate.block_min_kwh,
            block_max_kwh: rate.block_max_kwh,
          })
          .eq("id", rate.id);
        if (error) throw error;
      }

      // 4. Insert new rates
      const ratesToInsert = editedRates.filter(r => r.isNew && !r.isDeleted);
      if (ratesToInsert.length > 0) {
        const { error } = await supabase
          .from("tariff_rates")
          .insert(ratesToInsert.map(r => ({
            tariff_plan_id: editedTariff.id,
            charge: r.charge as any,
            amount: r.amount,
            season: r.season as any,
            tou: r.tou as any,
            block_min_kwh: r.block_min_kwh,
            block_max_kwh: r.block_max_kwh,
            unit: r.unit || 'c/kWh',
          })));
        if (error) throw error;
      }

      toast.success(`${editedTariff.name} updated successfully`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const addRate = () => {
    const newRate: TariffRate = {
      id: `new-${Date.now()}`,
      charge: 'energy',
      season: "all",
      tou: "all",
      amount: 0,
      unit: 'c/kWh',
      block_number: null,
      block_min_kwh: null,
      block_max_kwh: null,
      consumption_threshold_kwh: null,
      is_above_threshold: null,
      notes: null,
      isNew: true,
    };
    setEditedRates([...editedRates, newRate]);
  };

  const updateRate = (index: number, updates: Partial<TariffRate>) => {
    setEditedRates(editedRates.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const deleteRate = (index: number) => {
    const rate = editedRates[index];
    if (rate.isNew) {
      setEditedRates(editedRates.filter((_, i) => i !== index));
    } else {
      updateRate(index, { isDeleted: true });
    }
  };

  const visibleRates = editedRates.filter(r => !r.isDeleted);
  const energyRates = visibleRates.filter(r => r.charge === 'energy');
  const fixedRates = visibleRates.filter(r => r.charge !== 'energy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Edit Tariff
            <Badge variant="outline" className="text-xs">
              {structureLabel(editedTariff.structure)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Edit tariff details, fixed charges, and energy rates.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6 pb-4">
            {/* Tariff Header */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Tariff Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Tariff Name</Label>
                  <Input
                    value={editedTariff.name}
                    onChange={(e) => setEditedTariff({ ...editedTariff, name: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer Category</Label>
                  <Select
                    value={editedTariff.category}
                    onValueChange={(v) => setEditedTariff({ ...editedTariff, category: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="domestic">Domestic</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                      <SelectItem value="agriculture">Agriculture</SelectItem>
                      <SelectItem value="street_lighting">Street Lighting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Structure</Label>
                  <Select
                    value={editedTariff.structure}
                    onValueChange={(v) => setEditedTariff({ ...editedTariff, structure: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="time_of_use">Time of Use (TOU)</SelectItem>
                      <SelectItem value="inclining_block">Inclining Block (IBT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Voltage</Label>
                  <Select
                    value={editedTariff.voltage || ""}
                    onValueChange={(v) => setEditedTariff({ ...editedTariff, voltage: v || null })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="LV">LV</SelectItem>
                      <SelectItem value="MV">MV</SelectItem>
                      <SelectItem value="HV">HV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phase</Label>
                  <Select
                    value={editedTariff.phase || ""}
                    onValueChange={(v) => setEditedTariff({ ...editedTariff, phase: v || null })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="Single Phase">Single Phase</SelectItem>
                      <SelectItem value="Three Phase">Three Phase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Fixed Charges (derived from rates with charge != 'energy') */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Fixed & Other Charges</h4>
              </div>
              {fixedRates.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs py-2">Charge Type</TableHead>
                        <TableHead className="text-xs py-2">Amount</TableHead>
                        <TableHead className="text-xs py-2">Unit</TableHead>
                        <TableHead className="text-xs py-2 w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editedRates.map((rate, idx) => {
                        if (rate.isDeleted || rate.charge === 'energy') return null;
                        return (
                          <TableRow key={rate.id}>
                            <TableCell className="py-1.5 text-xs capitalize">{rate.charge}</TableCell>
                            <TableCell className="py-1.5">
                              <Input
                                type="number"
                                step="0.01"
                                className="h-7 text-xs w-[90px]"
                                value={rate.amount}
                                onChange={(e) => updateRate(idx, { amount: e.target.value ? parseFloat(e.target.value) : 0 })}
                              />
                            </TableCell>
                            <TableCell className="py-1.5 text-xs">{rate.unit || 'R/month'}</TableCell>
                            <TableCell className="py-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteRate(idx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No fixed charges configured.</p>
              )}
            </div>

            <Separator />

            {/* Energy Rates */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Energy Rates</h4>
                <Button variant="outline" size="sm" onClick={addRate} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Add Rate
                </Button>
              </div>
              
              {energyRates.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-md bg-muted/20">
                  No energy rates configured. Click "Add Rate" to add one.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs py-2">Season</TableHead>
                        <TableHead className="text-xs py-2">Time of Use</TableHead>
                        {editedTariff.structure === "inclining_block" && (
                          <>
                            <TableHead className="text-xs py-2">From kWh</TableHead>
                            <TableHead className="text-xs py-2">To kWh</TableHead>
                          </>
                        )}
                        <TableHead className="text-xs py-2">Amount</TableHead>
                        <TableHead className="text-xs py-2">Unit</TableHead>
                        <TableHead className="text-xs py-2 w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editedRates.map((rate, idx) => {
                        if (rate.isDeleted || rate.charge !== 'energy') return null;
                        return (
                          <TableRow key={rate.id} className={rate.isNew ? "bg-green-500/5" : ""}>
                            <TableCell className="py-1.5">
                              <Select
                                value={rate.season}
                                onValueChange={(v) => updateRate(idx, { season: v })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover">
                                  <SelectItem value="all">All Year</SelectItem>
                                  <SelectItem value="high">High/Winter</SelectItem>
                                  <SelectItem value="low">Low/Summer</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Select
                                value={rate.tou}
                                onValueChange={(v) => updateRate(idx, { tou: v })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover">
                                  <SelectItem value="all">Any</SelectItem>
                                  <SelectItem value="peak">Peak</SelectItem>
                                  <SelectItem value="standard">Standard</SelectItem>
                                  <SelectItem value="off_peak">Off-Peak</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            {editedTariff.structure === "inclining_block" && (
                              <>
                                <TableCell className="py-1.5">
                                  <Input
                                    type="number"
                                    className="h-7 text-xs w-[70px]"
                                    value={rate.block_min_kwh ?? ""}
                                    onChange={(e) => updateRate(idx, { 
                                      block_min_kwh: e.target.value ? parseInt(e.target.value) : null 
                                    })}
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input
                                    type="number"
                                    className="h-7 text-xs w-[70px]"
                                    value={rate.block_max_kwh ?? ""}
                                    onChange={(e) => updateRate(idx, { 
                                      block_max_kwh: e.target.value ? parseInt(e.target.value) : null 
                                    })}
                                    placeholder="∞"
                                  />
                                </TableCell>
                              </>
                            )}
                            <TableCell className="py-1.5">
                              <Input
                                type="number"
                                step="0.01"
                                className="h-7 text-xs w-[90px]"
                                value={rate.amount}
                                onChange={(e) => updateRate(idx, { 
                                  amount: e.target.value ? parseFloat(e.target.value) : 0 
                                })}
                              />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Select
                                value={rate.unit || 'c/kWh'}
                                onValueChange={(v) => updateRate(idx, { unit: v })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[80px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover">
                                  <SelectItem value="c/kWh">c/kWh</SelectItem>
                                  <SelectItem value="R/kWh">R/kWh</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteRate(idx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save All Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
