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
import { TOUPeriodBuilder, TOUPeriod } from "./TOUPeriodBuilder";
import type { Database } from "@/integrations/supabase/types";

type TariffType = string; // was Database["public"]["Enums"]["tariff_type"] - removed
type PhaseType = string; // was Database["public"]["Enums"]["phase_type"] - removed
type SeasonType = Database["public"]["Enums"]["season_type"];
type TimeOfUseType = string; // was Database["public"]["Enums"]["time_of_use_type"] - removed
type VoltageLevel = "LV" | "MV" | "HV";
type TransmissionZone = "Zone 0-300km" | "Zone 300-600km" | "Zone 600-900km" | "Zone >900km";

const CUSTOMER_CATEGORIES = ["Domestic", "Commercial", "Industrial", "Agriculture", "Street Lighting"] as const;
const TARIFF_FAMILIES = [
  "Megaflex", "Miniflex", "Homepower", "Homeflex", "Homelight",
  "Nightsave Urban Large", "Nightsave Urban Small", "Ruraflex", "Landrate",
  "Nightsave Rural", "Landlight", "Municflex", "Municrate", "Transit", "Gen-wheeling"
] as const;

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
  const [touPeriods, setTouPeriods] = useState<TOUPeriod[]>([]);
  // NERSA-compliant fields
  const [voltageLevel, setVoltageLevel] = useState<VoltageLevel>("LV");
  const [reactiveEnergyCharge, setReactiveEnergyCharge] = useState("");
  const [capacityKva, setCapacityKva] = useState("");
  const [customerCategory, setCustomerCategory] = useState("");
  // Critical Peak Pricing
  const [criticalPeakRate, setCriticalPeakRate] = useState("");
  const [criticalPeakHours, setCriticalPeakHours] = useState("");
  // Unbundled Eskom charges (2025-2026)
  const [isUnbundled, setIsUnbundled] = useState(false);
  const [tariffFamily, setTariffFamily] = useState("");
  const [transmissionZone, setTransmissionZone] = useState<TransmissionZone | "">("");
  const [generationCapacityCharge, setGenerationCapacityCharge] = useState("");
  const [legacyChargePerKwh, setLegacyChargePerKwh] = useState("");
  const [serviceChargePerDay, setServiceChargePerDay] = useState("");
  const [administrationChargePerDay, setAdministrationChargePerDay] = useState("");

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
      // tariff_categories table removed - use customer_category enum values
      return CUSTOMER_CATEGORIES.map((name, i) => ({ id: name.toLowerCase(), name }));
    },
  });

  const addTariff = useMutation({
    mutationFn: async () => {
      // Insert the tariff plan first
      const { data: tariff, error: tariffError } = await (supabase as any)
        .from("tariff_plans")
        .insert({
          municipality_id: municipalityId,
          name: tariffName,
          category: customerCategory || 'commercial',
          structure: tariffType === 'TOU' ? 'time_of_use' : tariffType === 'IBT' ? 'inclining_block' : 'flat',
          phase: phaseType,
          voltage: voltageLevel || null,
          is_redundant: false,
          is_recommended: false,
        })
        .select()
        .single();

      if (tariffError) throw tariffError;

      // Insert rate rows mapped to new schema
      if (rateRows.length > 0) {
        const rates = rateRows.map((row: any) => ({
          tariff_plan_id: tariff.id,
          charge: 'energy' as const,
          season: row.season === 'High/Winter' ? 'high' : row.season === 'Low/Summer' ? 'low' : 'all',
          tou: row.time_of_use === 'Peak' ? 'peak' : row.time_of_use === 'Standard' ? 'standard' : row.time_of_use === 'Off-Peak' ? 'off_peak' : 'all',
          block_number: row.block_number || null,
          block_min_kwh: row.block_start_kwh || null,
          block_max_kwh: row.block_end_kwh || null,
          amount: row.rate_per_kwh || 0,
          unit: 'c/kWh',
        }));

        const { error: ratesError } = await (supabase as any).from("tariff_rates").insert(rates);
        if (ratesError) throw ratesError;
      }

      // Insert basic/fixed charge if provided
      if (fixedCharge && parseFloat(fixedCharge) > 0) {
        await (supabase as any).from("tariff_rates").insert({
          tariff_plan_id: tariff.id,
          charge: 'basic',
          season: 'all',
          tou: 'all',
          amount: parseFloat(fixedCharge),
          unit: 'R/month',
        });
      }

      // Insert demand charge if provided
      if (demandCharge && parseFloat(demandCharge) > 0) {
        await (supabase as any).from("tariff_rates").insert({
          tariff_plan_id: tariff.id,
          charge: 'demand',
          season: 'all',
          tou: 'all',
          amount: parseFloat(demandCharge),
          unit: 'R/kVA',
        });
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
    setTouPeriods([]);
    // Reset NERSA fields
    setVoltageLevel("LV");
    setReactiveEnergyCharge("");
    setCapacityKva("");
    setCustomerCategory("");
    // Reset Critical Peak fields
    setCriticalPeakRate("");
    setCriticalPeakHours("");
    // Reset unbundled fields
    setIsUnbundled(false);
    setTariffFamily("");
    setTransmissionZone("");
    setGenerationCapacityCharge("");
    setLegacyChargePerKwh("");
    setServiceChargePerDay("");
    setAdministrationChargePerDay("");
  };

  const addRateRow = () => {
    const newRow: RateRow = {
      id: crypto.randomUUID(),
      season: hasSeasonalRates ? "High/Winter" as any : "All Year" as any,
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
    if (tariffType === "TOU" && hasSeasonalRates && touPeriods.length === 0) {
      toast.error("Please add at least one TOU period");
      return;
    }
    addTariff.mutate();
  };

  // When switching tariff type or seasonal toggle, reset appropriate data
  const handleTariffTypeChange = (value: TariffType) => {
    setTariffType(value);
    setRateRows([]);
    setTouPeriods([]);
  };

  const handleSeasonalChange = (checked: boolean) => {
    setHasSeasonalRates(checked);
    if (tariffType === "TOU") {
      setRateRows([]);
      setTouPeriods([]);
    }
  };

  const showTOUPeriodBuilder = tariffType === "TOU" && hasSeasonalRates;
  const showSimpleRates = tariffType !== "TOU" || !hasSeasonalRates;

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
                  {(categories as any)?.map((c: any) => (
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
              <Select value={tariffType} onValueChange={handleTariffTypeChange}>
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

            {/* NERSA Fields */}
            <div className="space-y-2">
              <Label>Voltage Level (NERSA)</Label>
              <Select value={voltageLevel} onValueChange={(v) => setVoltageLevel(v as VoltageLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LV">LV (Low Voltage ≤400V)</SelectItem>
                  <SelectItem value="MV">MV (Medium Voltage 11kV/22kV)</SelectItem>
                  <SelectItem value="HV">HV (High Voltage ≥44kV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer Category (NERSA)</Label>
              <Select value={customerCategory} onValueChange={setCustomerCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Capacity (kVA)</Label>
              <Input
                type="number"
                step="0.1"
                value={capacityKva}
                onChange={(e) => setCapacityKva(e.target.value)}
                placeholder="e.g., 100"
              />
            </div>
          </div>

          {/* Fixed Charges */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Fixed Charges</h3>
            <div className="grid gap-4 md:grid-cols-4">
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
              <div className="space-y-2">
                <Label>Reactive Energy (R/kVArh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={reactiveEnergyCharge}
                  onChange={(e) => setReactiveEnergyCharge(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-8">
            <div className="flex items-center space-x-2">
              <Switch
                id="seasonal"
                checked={hasSeasonalRates}
                onCheckedChange={handleSeasonalChange}
              />
              <Label htmlFor="seasonal">Seasonal Rates (High/Low Demand)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="prepaid"
                checked={isPrepaid}
                onCheckedChange={setIsPrepaid}
              />
              <Label htmlFor="prepaid">Prepaid Tariff</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="unbundled"
                checked={isUnbundled}
                onCheckedChange={setIsUnbundled}
              />
              <Label htmlFor="unbundled">Unbundled Tariff (Eskom 2025-26)</Label>
            </div>
          </div>

          {/* Unbundled Eskom Charges (2025-2026) */}
          {isUnbundled && (
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Unbundled Charges (Eskom 2025-26)
                <span className="text-xs font-normal text-muted-foreground">Separate cost components</span>
              </h3>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tariff Family</Label>
                  <Select value={tariffFamily} onValueChange={setTariffFamily}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select family" />
                    </SelectTrigger>
                    <SelectContent>
                      {TARIFF_FAMILIES.map((family) => (
                        <SelectItem key={family} value={family}>{family}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Transmission Zone</Label>
                  <Select value={transmissionZone} onValueChange={(v) => setTransmissionZone(v as TransmissionZone)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Distance from JHB" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Zone 0-300km">Zone 0-300km</SelectItem>
                      <SelectItem value="Zone 300-600km">Zone 300-600km</SelectItem>
                      <SelectItem value="Zone 600-900km">Zone 600-900km</SelectItem>
                      <SelectItem value="Zone >900km">Zone &gt;900km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Generation Capacity Charge (R/kVA/month)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={generationCapacityCharge}
                    onChange={(e) => setGenerationCapacityCharge(e.target.value)}
                    placeholder="GCC - new Eskom capacity charge"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Legacy Charge (c/kWh)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={legacyChargePerKwh}
                    onChange={(e) => setLegacyChargePerKwh(e.target.value)}
                    placeholder="Government energy programs"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Service Charge (R/day)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={serviceChargePerDay}
                    onChange={(e) => setServiceChargePerDay(e.target.value)}
                    placeholder="Daily service fee"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Administration Charge (R/day)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={administrationChargePerDay}
                    onChange={(e) => setAdministrationChargePerDay(e.target.value)}
                    placeholder="Daily admin fee"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                The 2025-26 Eskom tariffs are fully unbundled: GCC covers generation capacity, Legacy covers IPP procurement costs, 
                and Network/Retail charges are separated. Transmission zones affect network costs based on distance from Johannesburg.
              </p>
            </div>
          )}

          {/* Critical Peak Pricing (TOU only) */}
          {tariffType === "TOU" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Critical Peak Pricing (CPP)
                <span className="text-xs font-normal text-muted-foreground">Optional - for grid emergencies</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Critical Peak Rate (c/kWh)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={criticalPeakRate}
                    onChange={(e) => setCriticalPeakRate(e.target.value)}
                    placeholder="e.g., 1500 (during load shedding)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected CPP Hours/Month</Label>
                  <Input
                    type="number"
                    value={criticalPeakHours}
                    onChange={(e) => setCriticalPeakHours(e.target.value)}
                    placeholder="e.g., 20"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Critical Peak Pricing applies during system emergencies or load shedding. Rates are typically 5-10x higher than normal Peak rates.
              </p>
            </div>
          )}

          {/* TOU Period Builder for TOU + Seasonal */}
          {showTOUPeriodBuilder && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Time of Use Periods</h3>
              <p className="text-sm text-muted-foreground">
                Define specific time periods for Peak, Standard, and Off-Peak rates for each season and day type.
              </p>
              <TOUPeriodBuilder periods={touPeriods} onChange={setTouPeriods} />
            </div>
          )}

          {/* Simple Energy Rates (for IBT, Fixed, or non-seasonal TOU) */}
          {showSimpleRates && (
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
                  {tariffType === "IBT" 
                    ? "Click 'Add Rate Row' to add inclining block tariff ranges (e.g., 0-50kWh, 51-350kWh)."
                    : "Click 'Add Rate Row' to add energy charge rates."}
                </p>
              ) : (
                <div className="space-y-3">
                  {rateRows.map((row) => (
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

                      {tariffType === "TOU" && (
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
          )}

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
