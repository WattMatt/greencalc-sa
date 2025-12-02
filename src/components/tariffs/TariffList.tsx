import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function TariffList() {
  const queryClient = useQueryClient();
  const [expandedTariffs, setExpandedTariffs] = useState<Set<string>>(new Set());

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ["tariffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select(`
          *,
          municipality:municipalities(name),
          category:tariff_categories(name),
          rates:tariff_rates(*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteTariff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tariffs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      toast.success("Tariff deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete tariff: " + error.message);
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedTariffs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return `R ${value.toFixed(2)}`;
  };

  const formatRate = (value: number) => {
    return `${value.toFixed(2)} c/kWh`;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground">All Tariffs</CardTitle>
        <CardDescription>View and manage configured electricity tariffs</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading tariffs...</p>
        ) : tariffs?.length === 0 ? (
          <p className="text-muted-foreground">No tariffs configured yet. Use the Tariff Builder to add one.</p>
        ) : (
          <div className="space-y-4">
            {tariffs?.map((tariff) => (
              <Collapsible key={tariff.id} open={expandedTariffs.has(tariff.id)}>
                <div className="border rounded-lg bg-accent/30">
                  <div className="flex items-center justify-between p-4">
                    <CollapsibleTrigger
                      className="flex items-center gap-3 hover:opacity-80"
                      onClick={() => toggleExpanded(tariff.id)}
                    >
                      {expandedTariffs.has(tariff.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div className="text-left">
                        <div className="font-medium text-foreground">{tariff.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {(tariff.municipality as any)?.name} • {(tariff.category as any)?.name}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-3">
                      <Badge variant={tariff.tariff_type === "IBT" ? "default" : tariff.tariff_type === "TOU" ? "secondary" : "outline"}>
                        {tariff.tariff_type}
                      </Badge>
                      {tariff.is_prepaid && <Badge variant="outline">Prepaid</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTariff.mutate(tariff.id)}
                        disabled={deleteTariff.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 border-t space-y-4">
                      {/* Fixed Charges */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Basic Charge</div>
                          <div className="font-medium">{formatCurrency(tariff.fixed_monthly_charge)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Demand Charge</div>
                          <div className="font-medium">{formatCurrency(tariff.demand_charge_per_kva)}/kVA</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Phase</div>
                          <div className="font-medium">{tariff.phase_type}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Amperage</div>
                          <div className="font-medium">{tariff.amperage_limit || "-"}</div>
                        </div>
                      </div>

                      {/* Rates */}
                      {(tariff.rates as any[])?.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2 text-foreground">Energy Rates</div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {tariff.has_seasonal_rates && <TableHead>Season</TableHead>}
                                {tariff.tariff_type === "TOU" && <TableHead>Time of Use</TableHead>}
                                {tariff.tariff_type === "IBT" && (
                                  <>
                                    <TableHead>From (kWh)</TableHead>
                                    <TableHead>To (kWh)</TableHead>
                                  </>
                                )}
                                <TableHead>Rate</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(tariff.rates as any[])?.map((rate) => (
                                <TableRow key={rate.id}>
                                  {tariff.has_seasonal_rates && <TableCell>{rate.season}</TableCell>}
                                  {tariff.tariff_type === "TOU" && <TableCell>{rate.time_of_use}</TableCell>}
                                  {tariff.tariff_type === "IBT" && (
                                    <>
                                      <TableCell>{rate.block_start_kwh}</TableCell>
                                      <TableCell>{rate.block_end_kwh ?? "∞"}</TableCell>
                                    </>
                                  )}
                                  <TableCell className="font-medium">{formatRate(rate.rate_per_kwh)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
