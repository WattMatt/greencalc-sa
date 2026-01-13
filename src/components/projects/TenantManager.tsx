import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Upload, Trash2, Download, Pencil, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { TenantProfileMatcher } from "./TenantProfileMatcher";
import { MultiMeterSelector } from "./MultiMeterSelector";
import { AccuracyBadge, AccuracySummary, getAccuracyLevel } from "@/components/simulation/AccuracyBadge";
import { CsvImportWizard, WizardParseConfig } from "@/components/loadprofiles/CsvImportWizard";
import { detectCsvType, buildMismatchErrorMessage } from "@/components/loadprofiles/utils/csvTypeDetection";

interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  shop_type_id: string | null;
  scada_import_id: string | null;
  monthly_kwh_override: number | null;
  shop_types?: { name: string; kwh_per_sqm_month: number } | null;
  scada_imports?: { shop_name: string | null; area_sqm: number | null; load_profile_weekday: number[] | null } | null;
  // Multi-meter support
  tenant_meters_count?: number;
}

interface ShopType {
  id: string;
  name: string;
  kwh_per_sqm_month: number;
}

interface ScadaImport {
  id: string;
  shop_name: string | null;
  site_name: string;
  area_sqm: number | null;
  data_points: number | null;
  load_profile_weekday: number[] | null;
  load_profile_weekend: number[] | null;
}

interface TenantManagerProps {
  projectId: string;
  tenants: Tenant[];
  shopTypes: ShopType[];
}

// KwhOverrideCell component for inline editing
function KwhOverrideCell({
  tenant,
  calculatedKwh,
  onUpdate,
}: {
  tenant: Tenant;
  calculatedKwh: number;
  onUpdate: (value: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    tenant.monthly_kwh_override?.toString() || Math.round(calculatedKwh).toString()
  );

  const displayKwh = tenant.monthly_kwh_override ?? calculatedKwh;
  const isOverridden = tenant.monthly_kwh_override !== null;

  const handleSave = () => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onUpdate(numValue);
    }
    setOpen(false);
  };

  const handleReset = () => {
    onUpdate(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 hover:text-primary transition-colors group">
          <span className={isOverridden ? "text-primary font-medium" : ""}>
            {Math.round(displayKwh).toLocaleString()}
          </span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">kWh/month override</Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter kWh"
              className="h-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Calculated: {Math.round(calculatedKwh).toLocaleString()} kWh
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="flex-1">
              Save
            </Button>
            {isOverridden && (
              <Button size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Calculate daily kWh from load profile array
function calculateDailyKwh(profile: number[] | null): number {
  if (!profile || profile.length === 0) return 0;
  return profile.reduce((sum, val) => sum + (val || 0), 0);
}

// Format profile option label: "Shop Name (XXX m²)"
function formatProfileOption(meter: ScadaImport): string {
  const name = meter.shop_name || meter.site_name || "Unknown";
  const area = meter.area_sqm ? `${Math.round(meter.area_sqm)} m²` : "No area";
  return `${name} (${area})`;
}

// Find closest area match for sorting
function getAreaDifference(meterArea: number | null, tenantArea: number): number {
  if (!meterArea) return Infinity;
  return Math.abs(meterArea - tenantArea);
}

export function TenantManager({ projectId, tenants, shopTypes }: TenantManagerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", area_sqm: "", scada_import_id: "" });
  
  // CSV Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardFile, setWizardFile] = useState<{ name: string; content: string } | null>(null);
  const [isProcessingWizard, setIsProcessingWizard] = useState(false);
  
  // Multi-meter selector state
  const [multiMeterTenant, setMultiMeterTenant] = useState<{ id: string; name: string; area: number } | null>(null);

  // Fetch multi-meter counts for all tenants
  const { data: tenantMeterCounts = {} } = useQuery({
    queryKey: ["tenant-meter-counts", projectId],
    queryFn: async () => {
      const tenantIds = tenants.map(t => t.id);
      if (tenantIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("project_tenant_meters")
        .select("tenant_id")
        .in("tenant_id", tenantIds);
      
      if (error) throw error;
      
      // Count meters per tenant
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.tenant_id] = (counts[row.tenant_id] || 0) + 1;
      }
      return counts;
    },
    enabled: tenants.length > 0,
  });

  // Fetch SCADA imports for profile assignment
  const { data: scadaImports } = useQuery({
    queryKey: ["scada-imports-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, shop_name, site_name, area_sqm, data_points, load_profile_weekday, load_profile_weekend")
        .order("shop_name");
      if (error) throw error;
      return data as ScadaImport[];
    },
  });

  const addTenant = useMutation({
    mutationFn: async (tenant: { name: string; area_sqm: number; scada_import_id: string | null }) => {
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
      setNewTenant({ name: "", area_sqm: "", scada_import_id: "" });
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

  const updateTenantProfile = useMutation({
    mutationFn: async ({ tenantId, scadaImportId }: { tenantId: string; scadaImportId: string | null }) => {
      const { error } = await supabase
        .from("project_tenants")
        .update({ scada_import_id: scadaImportId })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const updateTenantKwhOverride = useMutation({
    mutationFn: async ({ tenantId, kwhOverride }: { tenantId: string; kwhOverride: number | null }) => {
      const { error } = await supabase
        .from("project_tenants")
        .update({ monthly_kwh_override: kwhOverride })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success("kWh override updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const processWizardData = useCallback(async (
    config: WizardParseConfig, 
    parsedData: { headers: string[]; rows: string[][] }
  ) => {
    setIsProcessingWizard(true);
    
    try {
      const headers = parsedData.headers.map(h => h.toLowerCase().trim());
      
      // Detect CSV type and check for mismatch
      const detection = detectCsvType(parsedData.headers);
      if (detection.detectedType !== "tenant-list" && detection.detectedType !== "unknown") {
        const errorMsg = buildMismatchErrorMessage("tenant-list", detection, parsedData.headers);
        throw new Error(errorMsg);
      }
      
      // Find name and area columns
      const nameIdx = headers.findIndex((h) => 
        h.includes("name") || h.includes("tenant") || h.includes("shop")
      );
      const areaIdx = headers.findIndex((h) => 
        h.includes("area") || h.includes("sqm") || h.includes("size") || h.includes("m2") || h.includes("m²")
      );

      if (nameIdx === -1 || areaIdx === -1) {
        const detection = detectCsvType(parsedData.headers);
        const errorMsg = buildMismatchErrorMessage("tenant-list", detection, parsedData.headers);
        throw new Error(errorMsg || `Missing required columns. Need 'name' and 'area' columns.\nFound: ${parsedData.headers.join(", ")}`);
      }

      const tenantsToInsert = [];
      for (const row of parsedData.rows) {
        const name = row[nameIdx]?.trim();
        const areaStr = row[areaIdx]?.replace(/[^\d.]/g, "");
        const area = parseFloat(areaStr);
        
        if (name && !isNaN(area) && area > 0) {
          tenantsToInsert.push({
            project_id: projectId,
            name,
            area_sqm: area,
          });
        }
      }

      if (tenantsToInsert.length === 0) {
        throw new Error("No valid tenants found in file");
      }

      const { error } = await supabase.from("project_tenants").insert(tenantsToInsert);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success(`Imported ${tenantsToInsert.length} tenants`);
      
      setWizardOpen(false);
      setWizardFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import tenants";
      // Show longer messages with description
      if (message.includes("\n")) {
        const [title, ...rest] = message.split("\n\n");
        toast.error(title, { 
          description: rest.join("\n\n"),
          duration: 10000 
        });
      } else {
        toast.error(message);
      }
    } finally {
      setIsProcessingWizard(false);
    }
  }, [projectId, queryClient]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setWizardFile({ name: file.name, content });
        setWizardOpen(true);
      };
      reader.readAsText(file);
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
    if (t.monthly_kwh_override) return sum + t.monthly_kwh_override;
    // Calculate from SCADA profile if assigned
    if (t.scada_imports?.load_profile_weekday) {
      const dailyKwh = calculateDailyKwh(t.scada_imports.load_profile_weekday);
      return sum + dailyKwh * 30; // Approximate monthly
    }
    // Fallback to shop type or default
    const kwh = (t.shop_types?.kwh_per_sqm_month || 50) * Number(t.area_sqm);
    return sum + kwh;
  }, 0);

  // Sort SCADA imports by similarity to tenant area for better UX
  const getSortedProfiles = (tenantArea: number) => {
    if (!scadaImports) return [];
    return [...scadaImports].sort((a, b) => 
      getAreaDifference(a.area_sqm, tenantArea) - getAreaDifference(b.area_sqm, tenantArea)
    );
  };

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
                  <Label>Load Profile (optional)</Label>
                  <Select
                    value={newTenant.scada_import_id}
                    onValueChange={(v) => setNewTenant({ ...newTenant, scada_import_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scadaImports?.map((meter) => (
                        <SelectItem key={meter.id} value={meter.id}>
                          {formatProfileOption(meter)}
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
                      scada_import_id: newTenant.scada_import_id || null,
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

      {/* Accuracy Summary */}
      {tenants.length > 0 && (
        <AccuracySummary
          actualCount={tenants.filter(t => t.scada_import_id && t.scada_imports?.load_profile_weekday).length}
          estimatedCount={tenants.filter(t => !t.scada_import_id && t.shop_type_id).length}
          missingCount={tenants.filter(t => !t.scada_import_id && !t.shop_type_id).length}
        />
      )}

      {tenants.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant Name</TableHead>
                <TableHead>Area (m²)</TableHead>
                <TableHead>Load Profile</TableHead>
                <TableHead className="text-center">Scale</TableHead>
                <TableHead className="text-right">Est. kWh/month</TableHead>
                <TableHead className="text-center">Source</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                const tenantArea = Number(tenant.area_sqm) || 0;
                const scadaArea = tenant.scada_imports?.area_sqm || null;
                const meterCount = tenantMeterCounts[tenant.id] || 0;
                
                // Calculate scale factor
                let scaleFactor: number | null = null;
                if (tenant.scada_import_id && scadaArea && scadaArea > 0) {
                  scaleFactor = tenantArea / scadaArea;
                }

                // Calculate kWh from SCADA profile (with scaling) or fallback
                let calculatedKwh: number;
                if (tenant.scada_imports?.load_profile_weekday) {
                  const dailyKwh = calculateDailyKwh(tenant.scada_imports.load_profile_weekday);
                  const scaled = scaleFactor ? dailyKwh * scaleFactor : dailyKwh;
                  calculatedKwh = scaled * 30;
                } else {
                  calculatedKwh = (tenant.shop_types?.kwh_per_sqm_month || 50) * tenantArea;
                }

                const assignedProfile = scadaImports?.find(m => m.id === tenant.scada_import_id);
                const sortedProfiles = getSortedProfiles(tenantArea);

                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenantArea.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-[200px] justify-between text-left font-normal"
                            >
                              <span className="truncate">
                                {meterCount > 0 
                                  ? `${meterCount} meters (averaged)`
                                  : assignedProfile
                                    ? formatProfileOption(assignedProfile)
                                    : "Unassigned"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search profiles..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>No profile found.</CommandEmpty>
                                <CommandGroup>
                                  {sortedProfiles.map((meter) => (
                                    <CommandItem
                                      key={meter.id}
                                      value={`${meter.shop_name || ""} ${meter.site_name || ""} ${meter.area_sqm || ""}`}
                                      onSelect={() => {
                                        updateTenantProfile.mutate({
                                          tenantId: tenant.id,
                                          scadaImportId: meter.id,
                                        });
                                      }}
                                      className="text-sm"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          tenant.scada_import_id === meter.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {formatProfileOption(meter)}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Multi-meter assignment"
                          onClick={() => setMultiMeterTenant({ 
                            id: tenant.id, 
                            name: tenant.name, 
                            area: tenantArea 
                          })}
                        >
                          <Layers className={cn(
                            "h-4 w-4",
                            meterCount > 0 ? "text-primary" : "text-muted-foreground"
                          )} />
                        </Button>
                        {meterCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {meterCount}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {scaleFactor !== null ? (
                        <span 
                          className={`text-sm font-mono ${
                            scaleFactor > 1.5 || scaleFactor < 0.5 
                              ? "text-amber-600" 
                              : "text-muted-foreground"
                          }`}
                          title={`Tenant: ${tenantArea}m² / Profile: ${scadaArea}m²`}
                        >
                          ×{scaleFactor.toFixed(2)}
                        </span>
                      ) : meterCount > 0 ? (
                        <span className="text-sm text-primary font-mono">avg</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <KwhOverrideCell
                        tenant={tenant}
                        calculatedKwh={calculatedKwh}
                        onUpdate={(kwhOverride) =>
                          updateTenantKwhOverride.mutate({ tenantId: tenant.id, kwhOverride })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <AccuracyBadge 
                        level={meterCount > 1 
                          ? "actual" 
                          : getAccuracyLevel(
                              !!tenant.scada_imports?.load_profile_weekday,
                              !!tenant.shop_type_id
                            )} 
                        showIcon={true}
                      />
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

      <CsvImportWizard
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setWizardFile(null);
        }}
        csvContent={wizardFile?.content || null}
        fileName={wizardFile?.name || ""}
        onProcess={processWizardData}
        isProcessing={isProcessingWizard}
      />
      
      {/* Multi-Meter Selector Dialog */}
      {multiMeterTenant && (
        <MultiMeterSelector
          tenantId={multiMeterTenant.id}
          tenantName={multiMeterTenant.name}
          tenantArea={multiMeterTenant.area}
          open={!!multiMeterTenant}
          onOpenChange={(open) => {
            if (!open) {
              setMultiMeterTenant(null);
              queryClient.invalidateQueries({ queryKey: ["tenant-meter-counts", projectId] });
            }
          }}
          availableMeters={scadaImports || []}
        />
      )}
    </div>
  );
}
