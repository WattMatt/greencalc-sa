import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
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
  Loader2
} from "lucide-react";

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
}

export function ProvinceFilesManager() {
  const [uploadingProvince, setUploadingProvince] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [extractionOpen, setExtractionOpen] = useState(false);
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

  // Build province stats
  const provinceStats: ProvinceStats[] = SOUTH_AFRICAN_PROVINCES.map((provinceName) => {
    const provinceRecord = provincesData?.provinces?.find(p => p.name === provinceName);
    const provinceId = provinceRecord?.id || null;
    
    const provinceMunicipalities = provincesData?.municipalities?.filter(
      m => m.province_id === provinceId
    ) || [];

    const municipalityIds = provinceMunicipalities.map(m => m.id);
    const tariffCount = provincesData?.tariffs?.filter(
      t => municipalityIds.includes(t.municipality_id)
    ).length || 0;

    // Find files for this province (by naming convention)
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

    return {
      province: provinceName,
      provinceId,
      files: provinceFiles,
      municipalityCount: provinceMunicipalities.length,
      tariffCount,
    };
  });

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Province Tariff Files
            </CardTitle>
            <CardDescription>
              Upload and manage tariff files for each South African province
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
      </CardContent>
    </Card>
  );
}
