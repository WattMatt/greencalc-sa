import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  MapPin, 
  Building2, 
  Trash2, 
  Play, 
  CheckCircle2, 
  Clock,
  FolderOpen,
  RefreshCw,
  Loader2,
  AlertCircle,
  Zap,
  Plus
} from "lucide-react";

interface Municipality {
  id: string;
  name: string;
  status: "pending" | "extracting" | "done" | "error";
  tariffCount?: number;
  error?: string;
}

const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

interface ProvinceFile {
  name: string;
  path: string;
  province: string;
  uploadedAt: Date;
  size: number;
}

interface ProvinceStats {
  province: string;
  provinceId: string | null;
  files: ProvinceFile[];
  municipalityCount: number;
  tariffCount: number;
  isCustom: boolean;
}

export function ProvinceFilesManager() {
  const [uploadingProvince, setUploadingProvince] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [extractionOpen, setExtractionOpen] = useState(false);
  const [newProvince, setNewProvince] = useState("");
  
  // Extraction workflow state
  const [selectedFile, setSelectedFile] = useState<ProvinceFile | null>(null);
  const [extractionPhase, setExtractionPhase] = useState<"idle" | "analyzing" | "extracting-munis" | "ready" | "extracting">("idle");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<{ sheets?: string[]; analysis?: string } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch provinces and their stats
  const { data: provincesData, isLoading: loadingProvinces } = useQuery({
    queryKey: ["provinces-with-stats"],
    queryFn: async () => {
      const { data: provinces } = await supabase
        .from("provinces")
        .select("id, name")
        .order("name");

      const { data: municipalities } = await supabase
        .from("municipalities")
        .select("id, name, province_id, source_file_path");

      const { data: tariffs } = await supabase
        .from("tariffs")
        .select("id, municipality_id");

      return { provinces, municipalities, tariffs };
    },
  });

  // Add province mutation
  const addProvince = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("provinces").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provinces-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
      setNewProvince("");
      sonnerToast.success("Province added successfully");
    },
    onError: (error) => {
      sonnerToast.error("Failed to add province: " + error.message);
    },
  });

  // Delete province mutation
  const deleteProvince = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provinces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provinces-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
      sonnerToast.success("Province deleted successfully");
    },
    onError: (error) => {
      sonnerToast.error("Failed to delete province: " + error.message);
    },
  });

  // Fetch uploaded files from storage
  const { data: storageFiles, isLoading: loadingFiles, refetch: refetchFiles } = useQuery({
    queryKey: ["tariff-storage-files"],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("tariff-uploads")
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (error) throw error;
      return data || [];
    },
  });

  // Build province stats - include predefined + custom provinces
  const buildProvinceStats = (): ProvinceStats[] => {
    const stats: ProvinceStats[] = [];
    
    // Add predefined provinces
    SOUTH_AFRICAN_PROVINCES.forEach((provinceName) => {
      const provinceRecord = provincesData?.provinces?.find(p => p.name === provinceName);
      const provinceId = provinceRecord?.id || null;
      
      const provinceMunicipalities = provincesData?.municipalities?.filter(
        m => m.province_id === provinceId
      ) || [];

      const municipalityIds = provinceMunicipalities.map(m => m.id);
      const tariffCount = provincesData?.tariffs?.filter(
        t => municipalityIds.includes(t.municipality_id)
      ).length || 0;

      const provinceFiles: ProvinceFile[] = (storageFiles || [])
        .filter(f => {
          const normalizedName = f.name.toLowerCase().replace(/[^a-z]/g, '');
          const normalizedProvince = provinceName.toLowerCase().replace(/[^a-z]/g, '');
          return normalizedName.includes(normalizedProvince);
        })
        .map(f => ({
          name: f.name,
          path: f.name,
          province: provinceName,
          uploadedAt: new Date(f.created_at || Date.now()),
          size: f.metadata?.size || 0,
        }));

      stats.push({
        province: provinceName,
        provinceId,
        files: provinceFiles,
        municipalityCount: provinceMunicipalities.length,
        tariffCount,
        isCustom: false,
      });
    });

    // Add custom provinces (not in predefined list)
    provincesData?.provinces?.forEach(p => {
      if (!SOUTH_AFRICAN_PROVINCES.includes(p.name as typeof SOUTH_AFRICAN_PROVINCES[number])) {
        const provinceMunicipalities = provincesData?.municipalities?.filter(
          m => m.province_id === p.id
        ) || [];

        const municipalityIds = provinceMunicipalities.map(m => m.id);
        const tariffCount = provincesData?.tariffs?.filter(
          t => municipalityIds.includes(t.municipality_id)
        ).length || 0;

        const provinceFiles: ProvinceFile[] = (storageFiles || [])
          .filter(f => {
            const normalizedName = f.name.toLowerCase().replace(/[^a-z]/g, '');
            const normalizedProvince = p.name.toLowerCase().replace(/[^a-z]/g, '');
            return normalizedName.includes(normalizedProvince);
          })
          .map(f => ({
            name: f.name,
            path: f.name,
            province: p.name,
            uploadedAt: new Date(f.created_at || Date.now()),
            size: f.metadata?.size || 0,
          }));

        stats.push({
          province: p.name,
          provinceId: p.id,
          files: provinceFiles,
          municipalityCount: provinceMunicipalities.length,
          tariffCount,
          isCustom: true,
        });
      }
    });

    return stats;
  };

  const provinceStats = buildProvinceStats();

  const handleAddProvince = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProvince.trim()) {
      addProvince.mutate(newProvince.trim());
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, province: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'pdf') {
      toast({
        title: "Invalid File",
        description: "Please upload an Excel (.xlsx, .xls) or PDF file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadingProvince(province);

    try {
      const timestamp = Date.now();
      const sanitizedProvince = province.replace(/\s+/g, '-');
      const filePath = `${timestamp}-${sanitizedProvince}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tariff-uploads")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      toast({ 
        title: "File Uploaded", 
        description: `${file.name} uploaded for ${province}` 
      });

      refetchFiles();
    } catch (err) {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadingProvince(null);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    try {
      const { error } = await supabase.storage
        .from("tariff-uploads")
        .remove([filePath]);

      if (error) throw error;

      toast({ title: "File Deleted" });
      refetchFiles();
    } catch (err) {
      toast({
        title: "Delete Failed",
        description: err instanceof Error ? err.message : "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'pdf') return 'pdf';
    return 'unknown';
  };

  const startExtraction = (file: ProvinceFile, province: string) => {
    setSelectedFile(file);
    setSelectedProvince(province);
    setExtractionPhase("idle");
    setMunicipalities([]);
    setAnalysisInfo(null);
    setExtractionOpen(true);
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    setExtractionPhase("analyzing");

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: {
          filePath: selectedFile.path,
          fileType: getFileType(selectedFile.name),
          action: "analyze"
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAnalysisInfo({ sheets: data.sheets, analysis: data.analysis });
      toast({ title: "Analysis Complete", description: "Ready to extract municipalities" });
    } catch (err) {
      toast({
        title: "Analysis Failed",
        description: err instanceof Error ? err.message : "Failed to analyze file",
        variant: "destructive",
      });
    } finally {
      setExtractionPhase("idle");
    }
  };

  const handleExtractMunicipalities = async () => {
    if (!selectedFile || !selectedProvince) return;
    setExtractionPhase("extracting-munis");

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: {
          filePath: selectedFile.path,
          fileType: getFileType(selectedFile.name),
          province: selectedProvince,
          action: "extract-municipalities"
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const munis: Municipality[] = data.municipalities.map((m: { id: string; name: string }) => ({
        id: m.id,
        name: m.name,
        status: "pending" as const
      }));

      setMunicipalities(munis);
      setExtractionPhase("ready");
      toast({
        title: "Municipalities Extracted",
        description: `Found ${munis.length} municipalities in ${selectedProvince}`
      });

      queryClient.invalidateQueries({ queryKey: ["municipalities"] });
      queryClient.invalidateQueries({ queryKey: ["provinces-with-stats"] });
    } catch (err) {
      toast({
        title: "Extraction Failed",
        description: err instanceof Error ? err.message : "Failed to extract municipalities",
        variant: "destructive",
      });
      setExtractionPhase("idle");
    }
  };

  const handleExtractTariffs = async (muniIndex: number) => {
    const muni = municipalities[muniIndex];
    if (!muni || !selectedFile || !selectedProvince) return;

    setMunicipalities(prev => prev.map((m, i) =>
      i === muniIndex ? { ...m, status: "extracting" as const } : m
    ));

    try {
      const { data, error } = await supabase.functions.invoke("process-tariff-file", {
        body: {
          filePath: selectedFile.path,
          fileType: getFileType(selectedFile.name),
          province: selectedProvince,
          municipality: muni.name,
          action: "extract-tariffs"
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setMunicipalities(prev => prev.map((m, i) =>
        i === muniIndex ? { ...m, status: "done" as const, tariffCount: data.imported } : m
      ));

      toast({
        title: `${muni.name} Complete`,
        description: `Imported ${data.imported} tariffs`
      });

      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      queryClient.invalidateQueries({ queryKey: ["provinces-with-stats"] });
    } catch (err) {
      setMunicipalities(prev => prev.map((m, i) =>
        i === muniIndex ? { ...m, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : m
      ));
      toast({
        title: `${muni.name} Failed`,
        description: err instanceof Error ? err.message : "Failed to extract tariffs",
        variant: "destructive",
      });
    }
  };

  const handleExtractAll = async () => {
    setExtractionPhase("extracting");
    for (let i = 0; i < municipalities.length; i++) {
      if (municipalities[i].status === "pending") {
        await handleExtractTariffs(i);
      }
    }
    setExtractionPhase("ready");
  };

  const getExtractionProgress = () => {
    if (municipalities.length === 0) return 0;
    const done = municipalities.filter(m => m.status === "done").length;
    return Math.round((done / municipalities.length) * 100);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (stats: ProvinceStats) => {
    if (stats.tariffCount > 0) {
      return <Badge variant="default" className="bg-green-600">{stats.tariffCount} tariffs</Badge>;
    }
    if (stats.municipalityCount > 0) {
      return <Badge variant="secondary">{stats.municipalityCount} municipalities</Badge>;
    }
    if (stats.files.length > 0) {
      return <Badge variant="outline">File uploaded</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">No data</Badge>;
  };

  if (loadingProvinces || loadingFiles) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Province Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Province
          </CardTitle>
          <CardDescription>
            Add a custom province to the system (the 9 SA provinces are predefined)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddProvince} className="flex gap-3">
            <Input
              value={newProvince}
              onChange={(e) => setNewProvince(e.target.value)}
              placeholder="e.g., Custom Region"
              className="max-w-xs"
            />
            <Button type="submit" disabled={addProvince.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Province
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Province Files Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Provinces & Tariff Files
              </CardTitle>
              <CardDescription>
                Manage provinces and upload tariff files for extraction
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchFiles()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Province</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Files</TableHead>
              <TableHead>Municipalities</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {provinceStats.map((stats) => (
              <TableRow key={stats.province}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{stats.province}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(stats)}</TableCell>
                <TableCell>
                  {stats.files.length > 0 ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <FileSpreadsheet className="h-4 w-4 mr-1" />
                          {stats.files.length} file{stats.files.length !== 1 ? "s" : ""}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{stats.province} - Uploaded Files</DialogTitle>
                          <DialogDescription>
                            Manage tariff files for this province
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>File Name</TableHead>
                                <TableHead>Uploaded</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {stats.files.map((file) => (
                                <TableRow key={file.path}>
                                  <TableCell className="font-mono text-sm">
                                    {file.name}
                                  </TableCell>
                                  <TableCell>{formatDate(file.uploadedAt)}</TableCell>
                                  <TableCell>{formatFileSize(file.size)}</TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => handleDeleteFile(file.path)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <span className="text-muted-foreground text-sm">No files</span>
                  )}
                </TableCell>
                <TableCell>
                  {stats.municipalityCount > 0 ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {stats.municipalityCount}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {stats.files.length > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8"
                        onClick={() => startExtraction(stats.files[0], stats.province)}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Extract
                      </Button>
                    )}
                    <Label
                      htmlFor={`upload-${stats.province}`}
                      className="cursor-pointer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={isUploading && uploadingProvince === stats.province}
                        asChild
                      >
                        <span>
                          {isUploading && uploadingProvince === stats.province ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-1" />
                              Upload
                            </>
                          )}
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id={`upload-${stats.province}`}
                      type="file"
                      accept=".xlsx,.xls,.pdf"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, stats.province)}
                    />
                    {stats.isCustom && stats.provinceId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteProvince.mutate(stats.provinceId!)}
                        disabled={deleteProvince.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Summary stats */}
        <div className="mt-6 pt-4 border-t flex items-center justify-between text-sm">
          <div className="flex items-center gap-6 text-muted-foreground">
            <span>
              <strong className="text-foreground">
                {storageFiles?.length || 0}
              </strong>{" "}
              files uploaded
            </span>
            <span>
              <strong className="text-foreground">
                {provincesData?.municipalities?.length || 0}
              </strong>{" "}
              municipalities
            </span>
            <span>
              <strong className="text-foreground">
                {provincesData?.tariffs?.length || 0}
              </strong>{" "}
              tariffs
            </span>
          </div>
        </div>

        {/* Extraction Dialog */}
        <Dialog open={extractionOpen} onOpenChange={setExtractionOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Extract Tariffs - {selectedProvince}
              </DialogTitle>
              <DialogDescription>
                {selectedFile?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto space-y-4">
              {/* Step 1: Analyze */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Step 1: Analyze File</h4>
                    <p className="text-sm text-muted-foreground">Review the file structure before extracting</p>
                  </div>
                  <Button
                    onClick={handleAnalyzeFile}
                    disabled={extractionPhase === "analyzing"}
                    variant="outline"
                  >
                    {extractionPhase === "analyzing" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Analyze
                  </Button>
                </div>
                {analysisInfo?.sheets && (
                  <div className="text-sm bg-muted/50 p-3 rounded">
                    <strong>Sheets found:</strong> {analysisInfo.sheets.length}
                    <div className="mt-1 text-muted-foreground">
                      {analysisInfo.sheets.slice(0, 10).join(", ")}
                      {analysisInfo.sheets.length > 10 && "..."}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Extract Municipalities */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Step 2: Extract Municipalities</h4>
                    <p className="text-sm text-muted-foreground">Identify and save municipalities from the file</p>
                  </div>
                  <Button
                    onClick={handleExtractMunicipalities}
                    disabled={extractionPhase === "extracting-munis"}
                  >
                    {extractionPhase === "extracting-munis" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Building2 className="h-4 w-4 mr-1" />
                    )}
                    Extract Municipalities
                  </Button>
                </div>
              </div>

              {/* Step 3: Extract Tariffs */}
              {municipalities.length > 0 && (
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Step 3: Extract Tariffs</h4>
                      <p className="text-sm text-muted-foreground">
                        {municipalities.filter(m => m.status === "done").length} of {municipalities.length} complete
                      </p>
                    </div>
                    <Button
                      onClick={handleExtractAll}
                      disabled={extractionPhase === "extracting" || municipalities.every(m => m.status === "done")}
                    >
                      {extractionPhase === "extracting" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      Extract All Tariffs
                    </Button>
                  </div>

                  <Progress value={getExtractionProgress()} className="h-2" />

                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {municipalities.map((muni, index) => (
                        <div
                          key={muni.id}
                          className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            {muni.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            {muni.status === "extracting" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            {muni.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                            {muni.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
                            <span className={muni.status === "done" ? "text-foreground" : "text-muted-foreground"}>
                              {muni.name}
                            </span>
                            {muni.tariffCount !== undefined && (
                              <Badge variant="secondary" className="ml-2">{muni.tariffCount} tariffs</Badge>
                            )}
                          </div>
                          {muni.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExtractTariffs(index)}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
    </div>
  );
}
