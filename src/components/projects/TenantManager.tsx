import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

import { TenantProfileMatcher } from "./TenantProfileMatcher";

interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  shop_type_id: string | null;
  monthly_kwh_override: number | null;
  shop_types?: { name: string; kwh_per_sqm_month: number } | null;
}

interface ShopType {
  id: string;
  name: string;
  kwh_per_sqm_month: number;
}

interface TenantManagerProps {
  projectId: string;
  tenants: Tenant[];
  shopTypes: ShopType[];
}

export function TenantManager({ projectId, tenants, shopTypes }: TenantManagerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", area_sqm: "", shop_type_id: "" });

  const addTenant = useMutation({
    mutationFn: async (tenant: { name: string; area_sqm: number; shop_type_id: string | null }) => {
      const { error } = await supabase.from("project_tenants").insert({
        project_id: projectId,
        ...tenant,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success("Tenant added");
      setDialogOpen(false);
      setNewTenant({ name: "", area_sqm: "", shop_type_id: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteTenant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success("Tenant removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateTenantShopType = useMutation({
    mutationFn: async ({ tenantId, shopTypeId }: { tenantId: string; shopTypeId: string | null }) => {
      const { error } = await supabase
        .from("project_tenants")
        .update({ shop_type_id: shopTypeId })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const importTenants = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());

      const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("tenant") || h.includes("shop"));
      const areaIdx = headers.findIndex((h) => h.includes("area") || h.includes("sqm") || h.includes("size"));

      if (nameIdx === -1 || areaIdx === -1) {
        throw new Error("CSV must have 'name' and 'area' columns");
      }

      const tenantsToInsert = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
        const name = cols[nameIdx];
        const area = parseFloat(cols[areaIdx]);
        if (name && !isNaN(area) && area > 0) {
          // Try to match shop type by name
          const matchedType = shopTypes.find((st) =>
            name.toLowerCase().includes(st.name.toLowerCase()) ||
            st.name.toLowerCase().includes(name.toLowerCase().split(" ")[0])
          );
          tenantsToInsert.push({
            project_id: projectId,
            name,
            area_sqm: area,
            shop_type_id: matchedType?.id || null,
          });
        }
      }

      if (tenantsToInsert.length === 0) {
        throw new Error("No valid tenants found in file");
      }

      const { error } = await supabase.from("project_tenants").insert(tenantsToInsert);
      if (error) throw error;
      return tenantsToInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success(`Imported ${count} tenants`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importTenants.mutate(file);
    }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const csv = "name,area_sqm\nWoolworths,850\nPick n Pay,1200\nCape Union Mart,320\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tenant_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalArea = tenants.reduce((sum, t) => sum + Number(t.area_sqm), 0);
  const totalMonthlyKwh = tenants.reduce((sum, t) => {
    const kwh = t.monthly_kwh_override || (t.shop_types?.kwh_per_sqm_month || 50) * Number(t.area_sqm);
    return sum + kwh;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tenant Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Import or add tenants to build the load model
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Tenant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input
                    placeholder="e.g., Woolworths"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Area (m²)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 500"
                    value={newTenant.area_sqm}
                    onChange={(e) => setNewTenant({ ...newTenant, area_sqm: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shop Type (optional)</Label>
                  <Select
                    value={newTenant.shop_type_id}
                    onValueChange={(v) => setNewTenant({ ...newTenant, shop_type_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {shopTypes.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name} ({st.kwh_per_sqm_month} kWh/m²/mo)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    addTenant.mutate({
                      name: newTenant.name,
                      area_sqm: parseFloat(newTenant.area_sqm),
                      shop_type_id: newTenant.shop_type_id || null,
                    })
                  }
                  disabled={!newTenant.name || !newTenant.area_sqm}
                >
                  Add Tenant
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tenants</CardDescription>
            <CardTitle className="text-2xl">{tenants.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Area</CardDescription>
            <CardTitle className="text-2xl">{totalArea.toLocaleString()} m²</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Est. Monthly Consumption</CardDescription>
            <CardTitle className="text-2xl">{Math.round(totalMonthlyKwh).toLocaleString()} kWh</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {tenants.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant Name</TableHead>
                <TableHead>Area (m²)</TableHead>
                <TableHead>Shop Type</TableHead>
                <TableHead className="text-right">Est. kWh/month</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                const monthlyKwh =
                  tenant.monthly_kwh_override ||
                  (tenant.shop_types?.kwh_per_sqm_month || 50) * Number(tenant.area_sqm);
                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{Number(tenant.area_sqm).toLocaleString()}</TableCell>
                    <TableCell>
                      <Select
                        value={tenant.shop_type_id || ""}
                        onValueChange={(v) =>
                          updateTenantShopType.mutate({
                            tenantId: tenant.id,
                            shopTypeId: v || null,
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {shopTypes.map((st) => (
                            <SelectItem key={st.id} value={st.id}>
                              {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.round(monthlyKwh).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteTenant.mutate(tenant.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No tenants yet. Import a CSV or add tenants manually.
            </p>
          </CardContent>
        </Card>
      )}

      {tenants.length > 0 && (
        <TenantProfileMatcher projectId={projectId} tenants={tenants} />
      )}
    </div>
  );
}
