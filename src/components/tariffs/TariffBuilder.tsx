import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TariffType = Database["public"]["Enums"]["tariff_type"];
type PhaseType = Database["public"]["Enums"]["phase_type"];
type SeasonType = Database["public"]["Enums"]["season_type"];
type TimeOfUseType = Database["public"]["Enums"]["time_of_use_type"];

interface RateRow {
  id: string;
  season: SeasonType;
  time_of_use: TimeOfUseType;
  block_start_kwh: number;
  block_end_kwh: number | null;
  rate_per_kwh: number;
  demand_charge_per_kva?: number;
}

export function TariffBuilder() {
  const queryClient = useQueryClient();
  const [municipalityId, setMunicipalityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tariffName, setTariffName] = useState("");
  const [tariffType, setTariffType] = useState<TariffType>("Fixed");
  const [phaseType, setPhaseType] = useState<PhaseType>("Single Phase");
  const [amperageLimit, setAmperageLimit] = useState("");
  const [fixedCharge, setFixedCharge] = useState("");
  const [demandCharge, setDemandCharge] = useState("");
  const [networkCharge, setNetworkCharge] = useState("");
  const [hasSeasonalRates, setHasSeasonalRates] = useState(false);
  const [isPrepaid, setIsPrepaid] = useState(false);
  const [rateRows, setRateRows] = useState<RateRow[]>([]);

  const { data: municipalities } = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("municipalities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["tariff-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tariff_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addTariff = useMutation({
    mutationFn: async () => {
      // Insert the tariff first
      const { data: tariff, error: tariffError } = await supabase
        .from("tariffs")
        .insert({
          municipality_id: municipalityId,
          category_id: categoryId,
          name: tariffName,
          tariff_type: tariffType,
          phase_type: phaseType,
          amperage_limit: amperageLimit || null,
          fixed_monthly_charge: fixedCharge ? parseFloat(fixedCharge) : 0,
          demand_charge_per_kva: demandCharge ? parseFloat(demandCharge) : 0,
          network_access_charge: networkCharge ? parseFloat(networkCharge) : 0,
          has_seasonal_rates: hasSeasonalRates,
          is_prepaid: isPrepaid,
        })
        .select()
        .single();

      if (tariffError) throw tariffError;

      // Insert the rate rows
      if (rateRows.length > 0) {
        const rates = rateRows.map((row) => ({
          tariff_id: tariff.id,
          season: row.season,
          time_of_use: row.time_of_use,
          block_start_kwh: row.block_start_kwh,
          block_end_kwh: row.block_end_kwh,
          rate_per_kwh: row.rate_per_kwh,
          demand_charge_per_kva: row.demand_charge_per_kva,
        }));

        const { error: ratesError } = await supabase.from("tariff_rates").insert(rates);
        if (ratesError) throw ratesError;
      }

      return tariff;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      resetForm();
      toast.success("Tariff created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create tariff: " + error.message);
    },
  });

  const resetForm = () => {
    setMunicipalityId("");
    setCategoryId("");
    setTariffName("");
    setTariffType("Fixed");
    setPhaseType("Single Phase");
    setAmperageLimit("");
    setFixedCharge("");
    setDemandCharge("");
    setNetworkCharge("");
    setHasSeasonalRates(false);
    setIsPrepaid(false);
    setRateRows([]);
  };

  const addRateRow = () => {
    const newRow: RateRow = {
      id: crypto.randomUUID(),
      season: hasSeasonalRates ? "High/Winter" : "All Year",
      time_of_use: tariffType === "TOU" ? "Peak" : "Any",
      block_start_kwh: 0,
      block_end_kwh: null,
      rate_per_kwh: 0,
    };
    setRateRows([...rateRows, newRow]);
  };

  const updateRateRow = (id: string, field: keyof RateRow, value: any) => {
    setRateRows(rateRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removeRateRow = (id: string) => {
    setRateRows(rateRows.filter((row) => row.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!municipalityId || !categoryId || !tariffName) {
      toast.error("Please fill in all required fields");
      return;
    }
    addTariff.mutate();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground">Tariff Builder</CardTitle>
        <CardDescription>Create a new electricity tariff with rate blocks and seasonal variations</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Municipality *</Label>
              <Select value={municipalityId} onValueChange={setMunicipalityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select municipality" />
                </SelectTrigger>
                <SelectContent>
                  {municipalities?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tariff Name *</Label>
              <Input
                value={tariffName}
                onChange={(e) => setTariffName(e.target.value)}
                placeholder="e.g., Domestic Prepaid 60A"
              />
            </div>

            <div className="space-y-2">
              <Label>Tariff Type</Label>
              <Select value={tariffType} onValueChange={(v) => setTariffType(v as TariffType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">Fixed Rate</SelectItem>
                  <SelectItem value="IBT">Inclining Block Tariff (IBT)</SelectItem>
                  <SelectItem value="TOU">Time of Use (TOU)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Phase Type</Label>
              <Select value={phaseType} onValueChange={(v) => setPhaseType(v as PhaseType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single Phase">Single Phase</SelectItem>
                  <SelectItem value="Three Phase">Three Phase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amperage Limit</Label>
              <Input
                value={amperageLimit}
                onChange={(e) => setAmperageLimit(e.target.value)}
                placeholder="e.g., 60A"
              />
            </div>
          </div>

          {/* Fixed Charges */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Fixed Charges</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Basic Charge (R/month)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fixedCharge}
                  onChange={(e) => setFixedCharge(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Demand Charge (R/kVA)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={demandCharge}
                  onChange={(e) => setDemandCharge(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Network Access Charge (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={networkCharge}
                  onChange={(e) => setNetworkCharge(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-8">
            <div className="flex items-center space-x-2">
              <Switch
                id="seasonal"
                checked={hasSeasonalRates}
                onCheckedChange={setHasSeasonalRates}
              />
              <Label htmlFor="seasonal">Seasonal Rates</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="prepaid"
                checked={isPrepaid}
                onCheckedChange={setIsPrepaid}
              />
              <Label htmlFor="prepaid">Prepaid Tariff</Label>
            </div>
          </div>

          {/* Energy Rates */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Energy Rates (c/kWh)</h3>
              <Button type="button" variant="outline" size="sm" onClick={addRateRow}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rate Row
              </Button>
            </div>

            {rateRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Click "Add Rate Row" to add energy charge blocks. For IBT tariffs, add multiple rows with different kWh ranges.
              </p>
            ) : (
              <div className="space-y-3">
                {rateRows.map((row, index) => (
                  <div key={row.id} className="flex items-end gap-3 p-4 rounded-lg bg-accent/50">
                    {hasSeasonalRates && (
                      <div className="space-y-1 w-32">
                        <Label className="text-xs">Season</Label>
                        <Select
                          value={row.season}
                          onValueChange={(v) => updateRateRow(row.id, "season", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All Year">All Year</SelectItem>
                            <SelectItem value="High/Winter">High/Winter</SelectItem>
                            <SelectItem value="Low/Summer">Low/Summer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {tariffType === "TOU" && (
                      <div className="space-y-1 w-28">
                        <Label className="text-xs">Time of Use</Label>
                        <Select
                          value={row.time_of_use}
                          onValueChange={(v) => updateRateRow(row.id, "time_of_use", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Any">Any</SelectItem>
                            <SelectItem value="Peak">Peak</SelectItem>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="Off-Peak">Off-Peak</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {tariffType === "IBT" && (
                      <>
                        <div className="space-y-1 w-24">
                          <Label className="text-xs">From (kWh)</Label>
                          <Input
                            type="number"
                            className="h-9"
                            value={row.block_start_kwh}
                            onChange={(e) => updateRateRow(row.id, "block_start_kwh", parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1 w-24">
                          <Label className="text-xs">To (kWh)</Label>
                          <Input
                            type="number"
                            className="h-9"
                            value={row.block_end_kwh ?? ""}
                            onChange={(e) => updateRateRow(row.id, "block_end_kwh", e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="∞"
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-1 w-28">
                      <Label className="text-xs">Rate (c/kWh)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9"
                        value={row.rate_per_kwh}
                        onChange={(e) => updateRateRow(row.id, "rate_per_kwh", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {(tariffType === "TOU" && hasSeasonalRates) && (
                      <div className="space-y-1 w-32">
                        <Label className="text-xs">Demand (R/kVA)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9"
                          value={row.demand_charge_per_kva ?? ""}
                          onChange={(e) => updateRateRow(row.id, "demand_charge_per_kva", e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeRateRow(row.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={addTariff.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Tariff
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
