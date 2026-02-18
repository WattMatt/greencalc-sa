import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function MunicipalityManager() {
  const [newMunicipality, setNewMunicipality] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [increasePercentage, setIncreasePercentage] = useState("");
  const queryClient = useQueryClient();

  const { data: provinces } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provinces").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: municipalities, isLoading } = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("*, province:provinces(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addMunicipality = useMutation({
    mutationFn: async (data: { name: string; province_id: string; increase_percentage?: number }) => {
      const { error } = await supabase.from("municipalities").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["municipalities"] });
      setNewMunicipality("");
      setSelectedProvince("");
      setIncreasePercentage("");
      toast.success("Municipality added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add municipality: " + error.message);
    },
  });

  const deleteMunicipality = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("municipalities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["municipalities"] });
      toast.success("Municipality deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete municipality: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMunicipality.trim() && selectedProvince) {
      addMunicipality.mutate({
        name: newMunicipality.trim(),
        province_id: selectedProvince,
        increase_percentage: increasePercentage ? parseFloat(increasePercentage) : undefined,
      });
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Add Municipality</CardTitle>
          <CardDescription>Add a new municipality to a province</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="province">Province</Label>
              <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a province" />
                </SelectTrigger>
                <SelectContent>
                  {provinces?.map((province) => (
                    <SelectItem key={province.id} value={province.id}>
                      {province.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="municipality-name">Municipality Name</Label>
              <Input
                id="municipality-name"
                value={newMunicipality}
                onChange={(e) => setNewMunicipality(e.target.value)}
                placeholder="e.g., Amahlathi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="increase">Tariff Increase % (Optional)</Label>
              <Input
                id="increase"
                type="number"
                step="0.01"
                value={increasePercentage}
                onChange={(e) => setIncreasePercentage(e.target.value)}
                placeholder="e.g., 10.76"
              />
            </div>
            <Button type="submit" disabled={addMunicipality.isPending || !selectedProvince}>
              <Plus className="h-4 w-4 mr-2" />
              Add Municipality
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Municipalities</CardTitle>
          <CardDescription>Manage existing municipalities</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : municipalities?.length === 0 ? (
            <p className="text-muted-foreground">No municipalities configured yet.</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Increase %</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {municipalities?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{(m.province as any)?.name}</TableCell>
                      <TableCell>{m.nersa_increase_pct ? `${m.nersa_increase_pct}%` : "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMunicipality.mutate(m.id)}
                          disabled={deleteMunicipality.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
