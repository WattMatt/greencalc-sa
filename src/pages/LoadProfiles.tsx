import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Trash2, Edit2, Download, Activity, FileSpreadsheet, Zap, Database, TrendingUp, Layers, GitCompare, TableIcon } from "lucide-react";
import { toast } from "sonner";
import { GoogleSheetsImport } from "@/components/loadprofiles/GoogleSheetsImport";
import { LoadProfileEditor } from "@/components/loadprofiles/LoadProfileEditor";
import { ScadaImport } from "@/components/loadprofiles/ScadaImport";
import { ScadaImportsList } from "@/components/loadprofiles/ScadaImportsList";
import { MeterAnalysis } from "@/components/loadprofiles/MeterAnalysis";
import { MeterLibrary } from "@/components/loadprofiles/MeterLibrary";
import { ProfileStacking } from "@/components/loadprofiles/ProfileStacking";
import { MeterComparison } from "@/components/loadprofiles/MeterComparison";
import { PivotTable } from "@/components/loadprofiles/PivotTable";

interface ShopType {
  id: string;
  name: string;
  description: string | null;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

const DEFAULT_PROFILE = Array(24).fill(100 / 24);

export default function LoadProfiles() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ShopType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    kwh_per_sqm_month: "50",
    category_id: "",
  });
  const [weekdayProfile, setWeekdayProfile] = useState<number[]>([...DEFAULT_PROFILE]);
  const [weekendProfile, setWeekendProfile] = useState<number[]>([...DEFAULT_PROFILE]);

  const { data: categories } = useQuery({
    queryKey: ["shop-type-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_type_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: shopTypes } = useQuery({
    queryKey: ["shop-types-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_types")
        .select("*, shop_type_categories(name)")
        .order("name");
      if (error) throw error;
      return data as (ShopType & { shop_type_categories: { name: string } | null })[];
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", kwh_per_sqm_month: "50", category_id: "" });
    setWeekdayProfile([...DEFAULT_PROFILE]);
    setWeekendProfile([...DEFAULT_PROFILE]);
    setEditingType(null);
  };

  const saveShopType = useMutation({
    mutationFn: async (data: { 
      name: string; 
      description: string; 
      kwh_per_sqm_month: number;
      category_id: string | null;
      load_profile_weekday: number[];
      load_profile_weekend: number[];
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["shop-types-all"] });
      queryClient.invalidateQueries({ queryKey: ["shop-types"] });
      toast.success(editingType ? "Profile updated" : "Profile created");
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
      queryClient.invalidateQueries({ queryKey: ["shop-types-all"] });
      queryClient.invalidateQueries({ queryKey: ["shop-types"] });
      toast.success("Profile deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const importProfiles = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
      
      // Flexible column detection - adapt to various CSV formats
      const nameIdx = headers.findIndex((h) => 
        h.includes("name") || h.includes("type") || h.includes("tenant") || 
        h.includes("shop") || h.includes("store") || h.includes("unit") || h.includes("profile")
      );
      const kwhIdx = headers.findIndex((h) => 
        h.includes("kwh") || h.includes("consumption") || h.includes("energy") || h.includes("load")
      );
      const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("note"));
      const categoryIdx = headers.findIndex((h) => 
        h.includes("category") || h.includes("sector") || h.includes("group") || h.includes("class")
      );
      
      // Check for hourly profile columns (multiple formats)
      const hourlyIdxs: number[] = [];
      for (let h = 0; h < 24; h++) {
        const idx = headers.findIndex(
          (hdr) => hdr === `h${h}` || hdr === `${h.toString().padStart(2, "0")}:00` || 
                   hdr === `hour${h}` || hdr === `${h}:00` || hdr === String(h)
        );
        if (idx !== -1) hourlyIdxs.push(idx);
      }

      // Fallback: use first text column if no name column found
      const effectiveNameIdx = nameIdx !== -1 ? nameIdx : 0;

      const profilesToInsert = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
        const name = cols[effectiveNameIdx];
        if (!name) continue;

        const kwh = kwhIdx !== -1 ? parseFloat(cols[kwhIdx]) || 50 : 50;
        const desc = descIdx !== -1 ? cols[descIdx] : null;
        
        // Match category by name
        let categoryId: string | null = null;
        if (categoryIdx !== -1 && cols[categoryIdx]) {
          const matchedCategory = categories?.find(
            (c) => c.name.toLowerCase().includes(cols[categoryIdx].toLowerCase()) ||
                   cols[categoryIdx].toLowerCase().includes(c.name.toLowerCase())
          );
          categoryId = matchedCategory?.id || null;
        }

        // Parse hourly profile if present
        let loadProfile: number[] | undefined;
        if (hourlyIdxs.length === 24) {
          loadProfile = hourlyIdxs.map((idx) => parseFloat(cols[idx]) || 4.17);
          const sum = loadProfile.reduce((a, b) => a + b, 0);
          if (sum > 0) {
            loadProfile = loadProfile.map((v) => (v / sum) * 100);
          }
        }

        profilesToInsert.push({
          name,
          description: desc,
          kwh_per_sqm_month: kwh,
          category_id: categoryId,
          ...(loadProfile && {
            load_profile_weekday: loadProfile,
            load_profile_weekend: loadProfile,
          }),
        });
      }

      if (profilesToInsert.length === 0) {
        throw new Error("No valid profiles found in file");
      }

      const { error } = await supabase.from("shop_types").insert(profilesToInsert);
      if (error) throw error;
      return profilesToInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["shop-types-all"] });
      queryClient.invalidateQueries({ queryKey: ["shop-types"] });
      toast.success(`Imported ${count} load profiles`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importProfiles.mutate(file);
    }
    e.target.value = "";
  };


  const openEditDialog = (shopType: ShopType) => {
    setEditingType(shopType);
    setFormData({
      name: shopType.name,
      description: shopType.description || "",
      kwh_per_sqm_month: String(shopType.kwh_per_sqm_month),
      category_id: shopType.category_id || "",
    });
    setWeekdayProfile(shopType.load_profile_weekday?.length === 24 ? [...shopType.load_profile_weekday] : [...DEFAULT_PROFILE]);
    setWeekendProfile(shopType.load_profile_weekend?.length === 24 ? [...shopType.load_profile_weekend] : [...DEFAULT_PROFILE]);
    setDialogOpen(true);
  };

  // Group profiles by category
  const profilesByCategory = categories?.map((cat) => ({
    ...cat,
    profiles: shopTypes?.filter((st) => st.category_id === cat.id) || [],
  })) || [];

  const uncategorizedProfiles = shopTypes?.filter((st) => !st.category_id) || [];
  const totalProfiles = shopTypes?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Load Profiles</h1>
          <p className="text-muted-foreground">
            Reference library of shop type consumption patterns
          </p>
        </div>
        <div className="flex gap-2">
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
                Add Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingType ? "Edit" : "Add"} Load Profile</DialogTitle>
                <DialogDescription>
                  Define a shop type with its typical energy consumption pattern.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Profile Name</Label>
                    <Input
                      placeholder="e.g., Fine Dining Restaurant"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                </div>
                
                <LoadProfileEditor
                  weekdayProfile={weekdayProfile}
                  weekendProfile={weekendProfile}
                  onWeekdayChange={setWeekdayProfile}
                  onWeekendChange={setWeekendProfile}
                />
                
                <Button
                  className="w-full"
                  onClick={() =>
                    saveShopType.mutate({
                      name: formData.name,
                      description: formData.description,
                      kwh_per_sqm_month: parseFloat(formData.kwh_per_sqm_month) || 50,
                      category_id: formData.category_id || null,
                      load_profile_weekday: weekdayProfile,
                      load_profile_weekend: weekendProfile,
                    })
                  }
                  disabled={!formData.name}
                >
                  {editingType ? "Update" : "Create"} Profile
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Profiles</CardDescription>
            <CardTitle className="text-2xl">{totalProfiles}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Categories</CardDescription>
            <CardTitle className="text-2xl">{categories?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Uncategorized</CardDescription>
            <CardTitle className="text-2xl">{uncategorizedProfiles.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. kWh/m²/month</CardDescription>
            <CardTitle className="text-2xl">
              {totalProfiles > 0
                ? Math.round(
                    (shopTypes?.reduce((sum, st) => sum + st.kwh_per_sqm_month, 0) || 0) /
                      totalProfiles
                  )
                : "-"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="meter-analysis" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="meter-analysis">
            <TrendingUp className="h-4 w-4 mr-2" />
            Meter Analysis
          </TabsTrigger>
          <TabsTrigger value="stacking">
            <Layers className="h-4 w-4 mr-2" />
            Profile Stacking
          </TabsTrigger>
          <TabsTrigger value="comparison">
            <GitCompare className="h-4 w-4 mr-2" />
            Comparison
          </TabsTrigger>
          <TabsTrigger value="pivot">
            <TableIcon className="h-4 w-4 mr-2" />
            Pivot Table
          </TabsTrigger>
          <TabsTrigger value="meter-library">
            <Database className="h-4 w-4 mr-2" />
            Meter Library
          </TabsTrigger>
          <TabsTrigger value="library">
            <Activity className="h-4 w-4 mr-2" />
            Profile Library
          </TabsTrigger>
          <TabsTrigger value="scada-imports">
            <Database className="h-4 w-4 mr-2" />
            SCADA Imports
          </TabsTrigger>
          <TabsTrigger value="import">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Google Sheets
          </TabsTrigger>
          <TabsTrigger value="scada">
            <Zap className="h-4 w-4 mr-2" />
            New Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meter-analysis">
          <MeterAnalysis />
        </TabsContent>

        <TabsContent value="stacking">
          <ProfileStacking />
        </TabsContent>

        <TabsContent value="comparison">
          <MeterComparison />
        </TabsContent>

        <TabsContent value="pivot">
          <PivotTable />
        </TabsContent>

        <TabsContent value="meter-library">
          <MeterLibrary />
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          {/* Categorized Profiles */}
          {totalProfiles === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No load profiles yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-1">
                  Import from Google Sheets or add profiles manually.
                </p>
                <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" defaultValue={categories?.map((c) => c.id) || []} className="space-y-2">
          {profilesByCategory.map((cat) => (
            cat.profiles.length > 0 && (
              <AccordionItem key={cat.id} value={cat.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{cat.name}</span>
                    <Badge variant="secondary">{cat.profiles.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Profile Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">kWh/m²/month</TableHead>
                        <TableHead>Load Profile</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cat.profiles.map((st) => (
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
                </AccordionContent>
              </AccordionItem>
            )
          ))}

          {uncategorizedProfiles.length > 0 && (
            <AccordionItem value="uncategorized" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-muted-foreground">Uncategorized</span>
                  <Badge variant="outline">{uncategorizedProfiles.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profile Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">kWh/m²/month</TableHead>
                      <TableHead>Load Profile</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uncategorizedProfiles.map((st) => (
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
              </AccordionContent>
            </AccordionItem>
          )}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="scada-imports">
          <ScadaImportsList />
        </TabsContent>

        <TabsContent value="import">
          <GoogleSheetsImport categories={categories || []} />
        </TabsContent>

        <TabsContent value="scada">
          <ScadaImport categories={categories || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
