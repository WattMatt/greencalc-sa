import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, Trash2, Edit2, Download } from "lucide-react";
import { toast } from "sonner";
import { CsvImportWizard, WizardParseConfig } from "@/components/loadprofiles/CsvImportWizard";
import { detectCsvType, buildMismatchErrorMessage } from "@/components/loadprofiles/utils/csvTypeDetection";

interface ShopType {
  id: string;
  name: string;
  description: string | null;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
}

interface ShopTypesManagerProps {
  shopTypes: ShopType[];
}

export function ShopTypesManager({ shopTypes }: ShopTypesManagerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ShopType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    kwh_per_sqm_month: "50",
  });
  
  // CSV Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardFile, setWizardFile] = useState<{ name: string; content: string } | null>(null);
  const [isProcessingWizard, setIsProcessingWizard] = useState(false);

  const resetForm = () => {
    setFormData({ name: "", description: "", kwh_per_sqm_month: "50" });
    setEditingType(null);
  };

  const saveShopType = useMutation({
    mutationFn: async (data: { name: string; description: string; kwh_per_sqm_month: number }) => {
      if (editingType) {
        const { error } = await supabase
          .from("shop_types")
          .update(data)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shop_types").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-types"] });
      toast.success(editingType ? "Shop type updated" : "Shop type created");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteShopType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shop_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-types"] });
      toast.success("Shop type deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const processWizardData = useCallback(async (
    config: WizardParseConfig, 
    parsedData: { headers: string[]; rows: string[][] }
  ) => {
    setIsProcessingWizard(true);
    
    try {
      // Early detection - check for wrong data type
      const detection = detectCsvType(parsedData.headers);
      if (detection.detectedType === "scada-meter") {
        const errorMsg = buildMismatchErrorMessage("shop-types", detection, parsedData.headers);
        throw new Error(errorMsg);
      }
      
      const headers = parsedData.headers.map(h => h.toLowerCase().trim());
      
      const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("type"));
      const kwhIdx = headers.findIndex((h) => h.includes("kwh") || h.includes("consumption"));
      const descIdx = headers.findIndex((h) => h.includes("desc"));
      
      // Check for hourly profile columns (h0, h1, ... h23 or 00:00, 01:00, etc.)
      const hourlyIdxs: number[] = [];
      for (let h = 0; h < 24; h++) {
        const idx = headers.findIndex(
          (hdr) => hdr === `h${h}` || hdr === `${h.toString().padStart(2, "0")}:00`
        );
        if (idx !== -1) hourlyIdxs.push(idx);
      }

      if (nameIdx === -1) {
        const detection = detectCsvType(parsedData.headers);
        if (detection.detectedType !== "shop-types" && detection.detectedType !== "unknown") {
          const errorMsg = buildMismatchErrorMessage("shop-types", detection, parsedData.headers);
          throw new Error(errorMsg);
        }
        throw new Error(`Missing 'name' column.\nFound: ${parsedData.headers.join(", ")}\n\nExpected columns: name, kwh_per_sqm_month, description (optional), h0-h23 (optional)`);
      }

      const typesToInsert = [];
      for (const row of parsedData.rows) {
        const name = row[nameIdx]?.trim();
        if (!name) continue;

        const kwh = kwhIdx !== -1 ? parseFloat(row[kwhIdx]) || 50 : 50;
        const desc = descIdx !== -1 ? row[descIdx] : null;

        // Parse hourly profile if present
        let loadProfile: number[] | undefined;
        if (hourlyIdxs.length === 24) {
          loadProfile = hourlyIdxs.map((idx) => parseFloat(row[idx]) || 4.17);
          // Normalize to sum to 100
          const sum = loadProfile.reduce((a, b) => a + b, 0);
          if (sum > 0) {
            loadProfile = loadProfile.map((v) => (v / sum) * 100);
          }
        }

        typesToInsert.push({
          name,
          description: desc,
          kwh_per_sqm_month: kwh,
          ...(loadProfile && {
            load_profile_weekday: loadProfile,
            load_profile_weekend: loadProfile,
          }),
        });
      }

      if (typesToInsert.length === 0) {
        throw new Error("No valid shop types found in file");
      }

      const { error } = await supabase.from("shop_types").insert(typesToInsert);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["shop-types"] });
      toast.success(`Imported ${typesToInsert.length} shop types`);
      
      setWizardOpen(false);
      setWizardFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import shop types";
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
  }, [queryClient]);

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
    const csv = `name,kwh_per_sqm_month,description,h0,h1,h2,h3,h4,h5,h6,h7,h8,h9,h10,h11,h12,h13,h14,h15,h16,h17,h18,h19,h20,h21,h22,h23
Restaurant,120,Food service with kitchen,2,1,1,1,1,2,4,5,6,7,8,10,10,8,6,5,5,6,8,8,6,4,2,2
Supermarket,80,Grocery retail,3,2,2,2,2,3,5,7,8,8,8,8,8,8,7,6,6,7,7,6,5,4,3,3
Clothing Retail,45,Fashion and apparel,1,1,1,1,1,1,2,4,6,7,8,9,9,9,8,7,6,6,7,6,4,3,2,1`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shop_types_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditDialog = (shopType: ShopType) => {
    setEditingType(shopType);
    setFormData({
      name: shopType.name,
      description: shopType.description || "",
      kwh_per_sqm_month: String(shopType.kwh_per_sqm_month),
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Shop Types & Load Profiles</h2>
          <p className="text-sm text-muted-foreground">
            Define shop types with their consumption patterns
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
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingType ? "Edit" : "Add"} Shop Type</DialogTitle>
                <DialogDescription>
                  Define a shop type with its typical energy consumption.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type Name</Label>
                  <Input
                    placeholder="e.g., Restaurant"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>kWh per m² per month</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 50"
                    value={formData.kwh_per_sqm_month}
                    onChange={(e) =>
                      setFormData({ ...formData, kwh_per_sqm_month: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Brief description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    saveShopType.mutate({
                      name: formData.name,
                      description: formData.description,
                      kwh_per_sqm_month: parseFloat(formData.kwh_per_sqm_month) || 50,
                    })
                  }
                  disabled={!formData.name}
                >
                  {editingType ? "Update" : "Create"} Shop Type
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {shopTypes.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">kWh/m²/month</TableHead>
                <TableHead>Load Profile Preview</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shopTypes.map((st) => (
                <TableRow key={st.id}>
                  <TableCell className="font-medium">{st.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {st.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">{st.kwh_per_sqm_month}</TableCell>
                  <TableCell>
                    <div className="flex items-end gap-[1px] h-6 w-32">
                      {(st.load_profile_weekday || []).map((val, i) => {
                        const max = Math.max(...(st.load_profile_weekday || [1]));
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-primary/60 rounded-sm"
                            style={{ height: `${(Number(val) / max) * 100}%` }}
                          />
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(st)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteShopType.mutate(st.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No shop types defined. Import a CSV or add types manually.
            </p>
          </CardContent>
        </Card>
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
    </div>
  );
}
