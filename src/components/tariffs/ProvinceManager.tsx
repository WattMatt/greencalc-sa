import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ProvinceManager() {
  const [newProvince, setNewProvince] = useState("");
  const queryClient = useQueryClient();

  const { data: provinces, isLoading } = useQuery({
    queryKey: ["provinces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provinces")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addProvince = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("provinces").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
      setNewProvince("");
      toast.success("Province added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add province: " + error.message);
    },
  });

  const deleteProvince = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provinces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
      toast.success("Province deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete province: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProvince.trim()) {
      addProvince.mutate(newProvince.trim());
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Add Province</CardTitle>
          <CardDescription>Add a new province to the system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="province-name">Province Name</Label>
              <Input
                id="province-name"
                value={newProvince}
                onChange={(e) => setNewProvince(e.target.value)}
                placeholder="e.g., Western Cape"
              />
            </div>
            <Button type="submit" disabled={addProvince.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Province
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Provinces</CardTitle>
          <CardDescription>Manage existing provinces</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : provinces?.length === 0 ? (
            <p className="text-muted-foreground">No provinces configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provinces?.map((province) => (
                  <TableRow key={province.id}>
                    <TableCell className="font-medium">{province.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteProvince.mutate(province.id)}
                        disabled={deleteProvince.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
