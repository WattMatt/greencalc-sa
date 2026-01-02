import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TariffSelectorProps {
  projectId: string;
  currentTariffId: string | null;
  onSelect: (tariffId: string) => void;
}

export function TariffSelector({ projectId, currentTariffId, onSelect }: TariffSelectorProps) {
  const [provinceId, setProvinceId] = useState<string>("");
  const [municipalityId, setMunicipalityId] = useState<string>("");

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: municipalities } = useQuery({
    queryKey: ["municipalities", provinceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("*")
        .eq("province_id", provinceId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!provinceId,
  });

  const { data: tariffs } = useQuery({
    queryKey: ["tariffs", municipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          tariff_categories(name),
          tariff_rates(*)
        `)
        .eq("municipality_id", municipalityId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!municipalityId,
  });

  const { data: selectedTariff } = useQuery({
    queryKey: ["selected-tariff", currentTariffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          municipalities(name, provinces(name)),
          tariff_categories(name),
          tariff_rates(*)
        `)
        .eq("id", currentTariffId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTariffId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Select Tariff</h2>
        <p className="text-sm text-muted-foreground">
          Choose the electricity tariff for cost calculations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Province</Label>
          <Select value={provinceId} onValueChange={setProvinceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select province..." />
            </SelectTrigger>
            <SelectContent>
              {provinces?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Municipality</Label>
          <Select
            value={municipalityId}
            onValueChange={setMunicipalityId}
            disabled={!provinceId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select municipality..." />
            </SelectTrigger>
            <SelectContent>
              {municipalities?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tariff</Label>
          <Select
            value={currentTariffId || ""}
            onValueChange={onSelect}
            disabled={!municipalityId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tariff..." />
            </SelectTrigger>
            <SelectContent>
              {tariffs?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.tariff_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedTariff && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{selectedTariff.name}</CardTitle>
                <CardDescription>
                  {(selectedTariff as any).municipalities?.name},{" "}
                  {(selectedTariff as any).municipalities?.provinces?.name}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{selectedTariff.tariff_type}</Badge>
                {selectedTariff.voltage_level && (
                  <Badge variant="outline">{selectedTariff.voltage_level}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Check if this is an Eskom tariff for unbundled display */}
            {(selectedTariff as any).municipalities?.provinces?.name === "Eskom" && (
              <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  2025/2026 Unbundled Tariff Structure
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Energy charges separated from Generation Capacity Charge (GCC) for cost transparency.
                </p>
              </div>
            )}
            
            <div className="grid gap-4 md:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category</span>
                <p className="font-medium">
                  {(selectedTariff as any).tariff_categories?.name || "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {(selectedTariff as any).municipalities?.provinces?.name === "Eskom" 
                    ? "Service Charge" 
                    : "Fixed Charge"}
                </span>
                <p className="font-medium">
                  R{Number(selectedTariff.fixed_monthly_charge || 0).toFixed(2)}/month
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {(selectedTariff as any).municipalities?.provinces?.name === "Eskom" 
                    ? "Network/GCC" 
                    : "Demand Charge"}
                </span>
                <p className="font-medium">
                  R{Number(selectedTariff.demand_charge_per_kva || 0).toFixed(2)}/kVA
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Voltage Level</span>
                <p className="font-medium">{selectedTariff.voltage_level || "-"}</p>
              </div>
            </div>

            {selectedTariff.reactive_energy_charge && Number(selectedTariff.reactive_energy_charge) > 0 && (
              <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                <span className="text-muted-foreground">Reactive Energy: </span>
                <span className="font-medium">R{Number(selectedTariff.reactive_energy_charge).toFixed(4)}/kVArh</span>
                <span className="text-xs text-muted-foreground ml-2">(High-demand season power factor penalty)</span>
              </div>
            )}

            {selectedTariff.tariff_rates && selectedTariff.tariff_rates.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {(selectedTariff as any).municipalities?.provinces?.name === "Eskom" 
                    ? "Legacy Energy Rates (c/kWh)" 
                    : "Energy Rates"}
                </span>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {selectedTariff.tariff_rates.map((rate: any) => (
                    <div
                      key={rate.id}
                      className="p-2 rounded bg-muted/50 text-sm"
                    >
                      <div className="font-medium">
                        R{Number(rate.rate_per_kwh).toFixed(4)}/kWh
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rate.time_of_use} • {rate.season}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
