import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Plus, X, Scale, TrendingDown } from "lucide-react";

interface ComparisonTariff {
  id: string;
  provinceId: string;
  municipalityId: string;
  tariffId: string;
  tariffName: string;
  municipalityName: string;
}

interface TariffRate {
  rate_per_kwh: number;
  time_of_use: string;
}

export function TariffComparison() {
  const [consumption, setConsumption] = useState("500");
  const [highDemandPercent, setHighDemandPercent] = useState(40);
  const [comparisons, setComparisons] = useState<ComparisonTariff[]>([]);
  
  // Selection state for adding new comparison
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState("");
  const [selectedTariffId, setSelectedTariffId] = useState("");

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: municipalities } = useQuery({
    queryKey: ["municipalities", selectedProvinceId],
    queryFn: async () => {
      let query = supabase.from("municipalities").select("*").order("name");
      if (selectedProvinceId) query = query.eq("province_id", selectedProvinceId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: tariffs } = useQuery({
    queryKey: ["tariffs-for-comparison", selectedMunicipalityId],
    queryFn: async () => {
      if (!selectedMunicipalityId) return [];
      const { data, error } = await supabase
        .from("tariff_plans")
        .select("*, rates:tariff_rates(*)")
        .eq("municipality_id", selectedMunicipalityId)
        .eq("is_redundant", false)
        .order("name");
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        tariff_type: t.structure,
        fixed_monthly_charge: (t.rates || []).find((r: any) => r.charge === 'basic')?.amount || 0,
      }));
    },
    enabled: !!selectedMunicipalityId,
  });

  // Fetch tariff details for all comparisons
  const { data: comparisonTariffs } = useQuery({
    queryKey: ["comparison-tariffs", comparisons.map(c => c.tariffId)],
    queryFn: async () => {
      if (comparisons.length === 0) return [];
      const { data, error } = await supabase
        .from("tariff_plans")
        .select("*, rates:tariff_rates(*), municipality:municipalities(name)")
        .in("id", comparisons.map(c => c.tariffId));
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        tariff_type: t.structure,
        fixed_monthly_charge: (t.rates || []).find((r: any) => r.charge === 'basic')?.amount || 0,
      }));
    },
    enabled: comparisons.length > 0,
  });

  const addComparison = () => {
    const tariff = tariffs?.find(t => t.id === selectedTariffId);
    const municipality = municipalities?.find(m => m.id === selectedMunicipalityId);
    
    if (tariff && municipality && !comparisons.find(c => c.tariffId === selectedTariffId)) {
      setComparisons([...comparisons, {
        id: `${Date.now()}`,
        provinceId: selectedProvinceId,
        municipalityId: selectedMunicipalityId,
        tariffId: selectedTariffId,
        tariffName: tariff.name,
        municipalityName: municipality.name,
      }]);
      setSelectedTariffId("");
    }
  };

  const removeComparison = (id: string) => {
    setComparisons(comparisons.filter(c => c.id !== id));
  };

  const comparisonResults = useMemo(() => {
    if (!comparisonTariffs || comparisonTariffs.length === 0) return [];
    
    const consumptionValue = parseFloat(consumption) || 0;
    
    return comparisonTariffs.map(tariff => {
      const rates = (tariff.rates as TariffRate[]) || [];
      const hasHighLowDemand = rates.some(r => 
        r.time_of_use === "High Demand" || r.time_of_use === "Low Demand"
      );
      
      let energyCost = 0;
      
      if (hasHighLowDemand) {
        const highDemandKwh = consumptionValue * (highDemandPercent / 100);
        const lowDemandKwh = consumptionValue * ((100 - highDemandPercent) / 100);
        const highRate = rates.find(r => r.time_of_use === "High Demand")?.rate_per_kwh || 0;
        const lowRate = rates.find(r => r.time_of_use === "Low Demand")?.rate_per_kwh || 0;
        energyCost = (highDemandKwh * highRate / 100) + (lowDemandKwh * lowRate / 100);
      } else {
        // Use average or "Any" rate
        const avgRate = rates.find(r => r.time_of_use === "Any")?.rate_per_kwh || 
                       (rates.reduce((sum, r) => sum + r.rate_per_kwh, 0) / rates.length) || 0;
        energyCost = consumptionValue * avgRate / 100;
      }
      
      const fixedCharge = tariff.fixed_monthly_charge || 0;
      const totalCost = energyCost + fixedCharge;
      
      return {
        id: tariff.id,
        name: tariff.name,
        municipality: (tariff.municipality as { name: string })?.name || "",
        tariffType: tariff.tariff_type,
        hasHighLowDemand,
        energyCost,
        fixedCharge,
        totalCost,
        costPerKwh: consumptionValue > 0 ? (totalCost / consumptionValue) * 100 : 0,
      };
    }).sort((a, b) => a.totalCost - b.totalCost);
  }, [comparisonTariffs, consumption, highDemandPercent]);

  const chartData = comparisonResults.map(r => ({
    name: r.municipality.substring(0, 15),
    "Energy Cost": Math.round(r.energyCost),
    "Fixed Charge": Math.round(r.fixedCharge),
    total: Math.round(r.totalCost),
  }));

  const cheapest = comparisonResults[0];
  const mostExpensive = comparisonResults[comparisonResults.length - 1];
  const potentialSavings = mostExpensive && cheapest 
    ? (mostExpensive.totalCost - cheapest.totalCost) * 12 
    : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Tariff Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comparison Parameters */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Monthly Consumption (kWh)</Label>
            <Input
              type="number"
              className="h-9"
              value={consumption}
              onChange={(e) => setConsumption(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">High Demand Usage: {highDemandPercent}%</Label>
            <Input
              type="range"
              min="0"
              max="100"
              value={highDemandPercent}
              onChange={(e) => setHighDemandPercent(parseInt(e.target.value))}
              className="h-9"
            />
          </div>
        </div>

        {/* Add Tariff Selection */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <Label className="text-sm font-medium">Add Tariff to Compare</Label>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={selectedProvinceId} onValueChange={(v) => { 
              setSelectedProvinceId(v); 
              setSelectedMunicipalityId(""); 
              setSelectedTariffId(""); 
            }}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Province" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {provinces?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedMunicipalityId} onValueChange={(v) => { 
              setSelectedMunicipalityId(v); 
              setSelectedTariffId(""); 
            }}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Municipality" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {municipalities?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedTariffId} onValueChange={setSelectedTariffId}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Tariff" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {tariffs?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={addComparison} 
              disabled={!selectedTariffId}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          
          {/* Selected Tariffs */}
          {comparisons.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {comparisons.map((c) => (
                <Badge key={c.id} variant="secondary" className="flex items-center gap-1 pr-1">
                  {c.municipalityName}: {c.tariffName}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-destructive/20"
                    onClick={() => removeComparison(c.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {comparisonResults.length > 0 && (
          <>
            {/* Summary Cards */}
            {cheapest && mostExpensive && comparisonResults.length > 1 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground">Cheapest Option</div>
                    <div className="font-semibold text-green-600">{cheapest.municipality}</div>
                    <div className="text-lg font-bold">R {cheapest.totalCost.toFixed(2)}/month</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-500/10 border-red-500/30">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground">Most Expensive</div>
                    <div className="font-semibold text-red-600">{mostExpensive.municipality}</div>
                    <div className="text-lg font-bold">R {mostExpensive.totalCost.toFixed(2)}/month</div>
                  </CardContent>
                </Card>
                <Card className="bg-primary/10 border-primary/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingDown className="h-3 w-3" />
                      Potential Annual Savings
                    </div>
                    <div className="text-lg font-bold text-primary">R {potentialSavings.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">by switching to cheapest</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `R${v}`} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip 
                    formatter={(value: number) => `R ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="Energy Cost" fill="hsl(var(--primary))" stackId="a" />
                  <Bar dataKey="Fixed Charge" fill="hsl(var(--muted-foreground))" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Municipality</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Energy</TableHead>
                  <TableHead className="text-right">Fixed</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">c/kWh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonResults.map((r, idx) => (
                  <TableRow key={r.id} className={idx === 0 ? "bg-green-500/10" : ""}>
                    <TableCell>
                      {idx === 0 ? (
                        <Badge variant="default" className="bg-green-600">1</Badge>
                      ) : (
                        <Badge variant="outline">{idx + 1}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{r.municipality}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {r.hasHighLowDemand ? "Demand" : r.tariffType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">R {r.energyCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">R {r.fixedCharge.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">R {r.totalCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.costPerKwh.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {comparisons.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Add tariffs above to start comparing costs across municipalities
          </div>
        )}
      </CardContent>
    </Card>
  );
}
