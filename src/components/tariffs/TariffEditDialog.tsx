import { useState, useEffect } from "react";
import { format, parseISO, isAfter, isBefore, isWithinInterval } from "date-fns";
import { CalendarIcon, Plus, Trash2, Loader2, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TariffRate {
  id: string;
  season: string;
  time_of_use: string;
  block_start_kwh: number | null;
  block_end_kwh: number | null;
  rate_per_kwh: number;
  demand_charge_per_kva: number | null;
  network_charge_per_kwh: number | null;
  ancillary_charge_per_kwh: number | null;
  energy_charge_per_kwh: number | null;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface Tariff {
  id: string;
  name: string;
  tariff_type: string;
  tariff_family: string | null;
  voltage_level: string | null;
  transmission_zone: string | null;
  customer_category: string | null;
  is_prepaid: boolean | null;
  fixed_monthly_charge: number | null;
  demand_charge_per_kva: number | null;
  network_access_charge: number | null;
  service_charge_per_day: number | null;
  administration_charge_per_day: number | null;
  generation_capacity_charge: number | null;
  legacy_charge_per_kwh: number | null;
  reactive_energy_charge: number | null;
  phase_type: string | null;
  amperage_limit: string | null;
  has_seasonal_rates: boolean | null;
  effective_from: string | null;
  effective_to: string | null;
  municipality_id: string;
  municipality?: { name: string; province_id: string } | null;
  category?: { name: string } | null;
  rates?: TariffRate[];
}

interface TariffEditDialogProps {
  tariff: Tariff | null;
  rates: TariffRate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function TariffEditDialog({ tariff, rates, open, onOpenChange, onSaved }: TariffEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [editedTariff, setEditedTariff] = useState<Tariff | null>(null);
  const [editedRates, setEditedRates] = useState<TariffRate[]>([]);
  
  // Initialize form when tariff changes
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
      // 1. Update tariff record
      const { error: tariffError } = await supabase
        .from("tariffs")
        .update({
          name: editedTariff.name,
          customer_category: editedTariff.customer_category,
          tariff_type: editedTariff.tariff_type as any,
          fixed_monthly_charge: editedTariff.fixed_monthly_charge,
          demand_charge_per_kva: editedTariff.demand_charge_per_kva,
          network_access_charge: editedTariff.network_access_charge,
          service_charge_per_day: editedTariff.service_charge_per_day,
          administration_charge_per_day: editedTariff.administration_charge_per_day,
          reactive_energy_charge: editedTariff.reactive_energy_charge,
          generation_capacity_charge: editedTariff.generation_capacity_charge,
          phase_type: editedTariff.phase_type as any,
          amperage_limit: editedTariff.amperage_limit,
          effective_from: editedTariff.effective_from,
          effective_to: editedTariff.effective_to,
        })
        .eq("id", editedTariff.id);
      
      if (tariffError) throw tariffError;

      // 2. Handle rates - delete marked for deletion
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
            rate_per_kwh: rate.rate_per_kwh,
            season: rate.season as any,
            time_of_use: rate.time_of_use as any,
            block_start_kwh: rate.block_start_kwh,
            block_end_kwh: rate.block_end_kwh,
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
            tariff_id: editedTariff.id,
            rate_per_kwh: r.rate_per_kwh,
            season: r.season as any,
            time_of_use: r.time_of_use as any,
            block_start_kwh: r.block_start_kwh,
            block_end_kwh: r.block_end_kwh,
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
      season: "All Year",
      time_of_use: "Any",
      block_start_kwh: null,
      block_end_kwh: null,
      rate_per_kwh: 0,
      demand_charge_per_kva: null,
      network_charge_per_kwh: null,
      ancillary_charge_per_kwh: null,
      energy_charge_per_kwh: null,
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
      // Remove from list if it's a new rate
      setEditedRates(editedRates.filter((_, i) => i !== index));
    } else {
      // Mark for deletion if it's an existing rate
      updateRate(index, { isDeleted: true });
    }
  };

  const visibleRates = editedRates.filter(r => !r.isDeleted);

  // Validity status calculation
  const getValidityStatus = () => {
    if (!editedTariff.effective_from || !editedTariff.effective_to) return null;
    
    const today = new Date();
    const from = parseISO(editedTariff.effective_from);
    const to = parseISO(editedTariff.effective_to);
    
    if (isWithinInterval(today, { start: from, end: to })) {
      return { status: "current", label: "Current", className: "bg-green-500/10 text-green-600 border-green-500/20" };
    }
    if (isBefore(today, from)) {
      return { status: "upcoming", label: "Upcoming", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
    }
    return { status: "expired", label: "Expired", className: "bg-red-500/10 text-red-600 border-red-500/20" };
  };

  const validityStatus = getValidityStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Edit Tariff
            {validityStatus && (
              <Badge variant="outline" className={cn("text-xs", validityStatus.className)}>
                {validityStatus.label}
              </Badge>
            )}
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
                  <Input
                    value={editedTariff.customer_category || ""}
                    onChange={(e) => setEditedTariff({ ...editedTariff, customer_category: e.target.value || null })}
                    className="h-9"
                    placeholder="e.g., Commercial, Residential"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tariff Type</Label>
                  <Select
                    value={editedTariff.tariff_type}
                    onValueChange={(v) => setEditedTariff({ ...editedTariff, tariff_type: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="Fixed">Fixed</SelectItem>
                      <SelectItem value="TOU">Time of Use (TOU)</SelectItem>
                      <SelectItem value="IBT">Inclining Block (IBT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Validity Period */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Validity Period</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Effective From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !editedTariff.effective_from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editedTariff.effective_from
                          ? format(parseISO(editedTariff.effective_from), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editedTariff.effective_from ? parseISO(editedTariff.effective_from) : undefined}
                        onSelect={(date) => setEditedTariff({ 
                          ...editedTariff, 
                          effective_from: date ? format(date, "yyyy-MM-dd") : null 
                        })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Effective To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !editedTariff.effective_to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editedTariff.effective_to
                          ? format(parseISO(editedTariff.effective_to), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editedTariff.effective_to ? parseISO(editedTariff.effective_to) : undefined}
                        onSelect={(date) => setEditedTariff({ 
                          ...editedTariff, 
                          effective_to: date ? format(date, "yyyy-MM-dd") : null 
                        })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <Separator />

            {/* Fixed Charges */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Fixed Charges</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Basic Charge (R/month)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={editedTariff.fixed_monthly_charge ?? ""}
                    onChange={(e) => setEditedTariff({ 
                      ...editedTariff, 
                      fixed_monthly_charge: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Demand Charge (R/kVA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={editedTariff.demand_charge_per_kva ?? ""}
                    onChange={(e) => setEditedTariff({ 
                      ...editedTariff, 
                      demand_charge_per_kva: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Network Access (R/month)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={editedTariff.network_access_charge ?? ""}
                    onChange={(e) => setEditedTariff({ 
                      ...editedTariff, 
                      network_access_charge: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Service (R/day)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={editedTariff.service_charge_per_day ?? ""}
                    onChange={(e) => setEditedTariff({ 
                      ...editedTariff, 
                      service_charge_per_day: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Admin (R/day)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={editedTariff.administration_charge_per_day ?? ""}
                    onChange={(e) => setEditedTariff({ 
                      ...editedTariff, 
                      administration_charge_per_day: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Reactive Energy (R/kVArh)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    className="h-9"
                    value={editedTariff.reactive_energy_charge ?? ""}
                    onChange={(e) => setEditedTariff({ 
                      ...editedTariff, 
                      reactive_energy_charge: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phase Type</Label>
                  <Select
                    value={editedTariff.phase_type || ""}
                    onValueChange={(v) => setEditedTariff({ ...editedTariff, phase_type: v || null })}
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
                <div>
                  <Label className="text-xs text-muted-foreground">Amperage Limit</Label>
                  <Input
                    className="h-9"
                    value={editedTariff.amperage_limit ?? ""}
                    onChange={(e) => setEditedTariff({ 
                      ...editedTariff, 
                      amperage_limit: e.target.value || null 
                    })}
                    placeholder="e.g., >100A, ≤60A"
                  />
                </div>
              </div>
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
              
              {visibleRates.length === 0 ? (
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
                        {editedTariff.tariff_type === "IBT" && (
                          <>
                            <TableHead className="text-xs py-2">From kWh</TableHead>
                            <TableHead className="text-xs py-2">To kWh</TableHead>
                          </>
                        )}
                        <TableHead className="text-xs py-2">Rate (R/kWh)</TableHead>
                        <TableHead className="text-xs py-2 w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editedRates.map((rate, idx) => {
                        if (rate.isDeleted) return null;
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
                                  <SelectItem value="All Year">All Year</SelectItem>
                                  <SelectItem value="High/Winter">High/Winter</SelectItem>
                                  <SelectItem value="Low/Summer">Low/Summer</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Select
                                value={rate.time_of_use}
                                onValueChange={(v) => updateRate(idx, { time_of_use: v })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover">
                                  <SelectItem value="Any">Any</SelectItem>
                                  <SelectItem value="Peak">Peak</SelectItem>
                                  <SelectItem value="Standard">Standard</SelectItem>
                                  <SelectItem value="Off-Peak">Off-Peak</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            {editedTariff.tariff_type === "IBT" && (
                              <>
                                <TableCell className="py-1.5">
                                  <Input
                                    type="number"
                                    className="h-7 text-xs w-[70px]"
                                    value={rate.block_start_kwh ?? ""}
                                    onChange={(e) => updateRate(idx, { 
                                      block_start_kwh: e.target.value ? parseInt(e.target.value) : null 
                                    })}
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input
                                    type="number"
                                    className="h-7 text-xs w-[70px]"
                                    value={rate.block_end_kwh ?? ""}
                                    onChange={(e) => updateRate(idx, { 
                                      block_end_kwh: e.target.value ? parseInt(e.target.value) : null 
                                    })}
                                    placeholder="∞"
                                  />
                                </TableCell>
                              </>
                            )}
                            <TableCell className="py-1.5">
                              <Input
                                type="number"
                                step="0.0001"
                                className="h-7 text-xs w-[90px]"
                                value={rate.rate_per_kwh}
                                onChange={(e) => updateRate(idx, { 
                                  rate_per_kwh: e.target.value ? parseFloat(e.target.value) : 0 
                                })}
                              />
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

// Helper component to display validity badge
export function TariffValidityBadge({ effectiveFrom, effectiveTo }: { effectiveFrom: string | null; effectiveTo: string | null }) {
  if (!effectiveFrom || !effectiveTo) return null;
  
  const today = new Date();
  const from = parseISO(effectiveFrom);
  const to = parseISO(effectiveTo);
  
  let status: { label: string; className: string };
  
  if (isWithinInterval(today, { start: from, end: to })) {
    status = { label: "Current", className: "bg-green-500/10 text-green-600 border-green-500/20" };
  } else if (isBefore(today, from)) {
    status = { label: "Upcoming", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
  } else {
    status = { label: "Expired", className: "bg-red-500/10 text-red-600 border-red-500/20" };
  }

  const dateRange = `${format(from, "MMM yyyy")} - ${format(to, "MMM yyyy")}`;

  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", status.className)}>
      {dateRange} · {status.label}
    </Badge>
  );
}
