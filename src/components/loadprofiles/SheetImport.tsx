import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Upload, FileSpreadsheet, Building2, Store, Ruler, Loader2, 
  CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Copy, 
  Shield, ArrowRight 
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ParsedRow {
  siteName: string;
  shopName: string;
  breaker: string | null;
  areaSqm: number | null;
  dataSource: string | null;
  fileName: string | null;
  selected: boolean;
  // Duplicate detection fields
  duplicateStatus: 'new' | 'existing-site' | 'existing-meter' | 'duplicate-in-file';
  existingMeterId?: string;
  existingSiteId?: string;
  duplicateOf?: string; // For duplicates within the file itself
}

interface SiteGroup {
  siteName: string;
  shops: ParsedRow[];
  selected: boolean;
  isExistingSite: boolean;
  existingSiteId?: string;
}

interface SheetImportProps {
  onImportComplete?: () => void;
}

interface ExistingData {
  sites: Map<string, { id: string; name: string }>;
  meters: Map<string, { id: string; site_id: string; shop_name: string; site_name: string }[]>;
}

// Normalize names for comparison
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

// Check if two names are similar enough to be considered duplicates
function isSimilarName(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

export function SheetImport({ onImportComplete }: SheetImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<SiteGroup[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [duplicateStats, setDuplicateStats] = useState<{
    existingSites: number;
    existingMeters: number;
    duplicatesInFile: number;
    newSites: number;
    newMeters: number;
  } | null>(null);

  // Fetch existing sites and meters from database
  const fetchExistingData = async (): Promise<ExistingData> => {
    const [sitesResult, metersResult] = await Promise.all([
      supabase.from("sites").select("id, name"),
      supabase.from("scada_imports").select("id, site_id, shop_name, site_name")
    ]);

    const sites = new Map<string, { id: string; name: string }>();
    const meters = new Map<string, { id: string; site_id: string; shop_name: string; site_name: string }[]>();

    // Index sites by normalized name
    for (const site of sitesResult.data || []) {
      sites.set(normalizeName(site.name), { id: site.id, name: site.name });
    }

    // Index meters by normalized site name for quick lookup
    for (const meter of metersResult.data || []) {
      const key = normalizeName(meter.site_name);
      if (!meters.has(key)) {
        meters.set(key, []);
      }
      meters.get(key)!.push(meter);
    }

    return { sites, meters };
  };

  // Verify parsed data against existing database
  const verifyDuplicates = async (groups: SiteGroup[]): Promise<SiteGroup[]> => {
    setIsVerifying(true);
    
    try {
      const existingData = await fetchExistingData();
      
      // Track duplicates within the file itself
      const seenInFile = new Map<string, string>(); // normalized "siteName|shopName" -> original shopName
      
      let existingSites = 0;
      let existingMeters = 0;
      let duplicatesInFile = 0;
      let newSites = 0;
      let newMeters = 0;

      const verifiedGroups = groups.map(group => {
        const normalizedSiteName = normalizeName(group.siteName);
        const existingSite = existingData.sites.get(normalizedSiteName);
        const existingMetersForSite = existingData.meters.get(normalizedSiteName) || [];
        
        const isExistingSite = !!existingSite;
        if (isExistingSite) {
          existingSites++;
        } else {
          newSites++;
        }

        const verifiedShops = group.shops.map(shop => {
          const normalizedShopName = normalizeName(shop.shopName);
          const fileKey = `${normalizedSiteName}|${normalizedShopName}`;
          
          // Check if this is a duplicate within the file itself
          if (seenInFile.has(fileKey)) {
            duplicatesInFile++;
            return {
              ...shop,
              duplicateStatus: 'duplicate-in-file' as const,
              duplicateOf: seenInFile.get(fileKey),
              selected: false, // Auto-deselect duplicates
            };
          }
          
          // Mark as seen in file
          seenInFile.set(fileKey, shop.shopName);
          
          // Check if meter already exists in database
          const existingMeter = existingMetersForSite.find(m => 
            isSimilarName(m.shop_name || '', shop.shopName)
          );
          
          if (existingMeter) {
            existingMeters++;
            return {
              ...shop,
              duplicateStatus: 'existing-meter' as const,
              existingMeterId: existingMeter.id,
              existingSiteId: existingMeter.site_id,
            };
          }
          
          if (isExistingSite) {
            newMeters++;
            return {
              ...shop,
              duplicateStatus: 'existing-site' as const,
              existingSiteId: existingSite.id,
            };
          }
          
          newMeters++;
          return {
            ...shop,
            duplicateStatus: 'new' as const,
          };
        });

        return {
          ...group,
          shops: verifiedShops,
          isExistingSite,
          existingSiteId: existingSite?.id,
        };
      });

      setDuplicateStats({
        existingSites,
        existingMeters,
        duplicatesInFile,
        newSites,
        newMeters,
      });
      
      return verifiedGroups;
    } finally {
      setIsVerifying(false);
    }
  };

  const parseExcelFile = async (file: File) => {
    setIsParsing(true);
    setVerificationComplete(false);
    setDuplicateStats(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      // Parse rows and group by site
      const rows: ParsedRow[] = [];
      for (const row of jsonData) {
        const siteName = String(
          row["Shopping Centre"] || row["Site"] || row["Site Name"] || row["Center"] || ""
        ).trim();
        const shopName = String(
          row["Shop"] || row["Shop Name"] || row["Tenant"] || row["Store"] || ""
        ).trim();
        const breaker = row["Breaker"] ? String(row["Breaker"]).trim() : null;
        const areaValue = row["Square Meters"] || row["Area"] || row["Area (m²)"] || row["SQM"] || row["m²"];
        const areaSqm = areaValue ? parseFloat(String(areaValue)) : null;
        const dataSource = row["Data Source"] ? String(row["Data Source"]).trim() : null;
        const fileName = row["File Name"] ? String(row["File Name"]).trim() : null;

        if (siteName && shopName) {
          rows.push({
            siteName,
            shopName,
            breaker: breaker || null,
            areaSqm: isNaN(areaSqm || NaN) ? null : areaSqm,
            dataSource,
            fileName,
            selected: true,
            duplicateStatus: 'new', // Will be verified next
          });
        }
      }

      // Group by site
      const siteMap = new Map<string, ParsedRow[]>();
      for (const row of rows) {
        if (!siteMap.has(row.siteName)) {
          siteMap.set(row.siteName, []);
        }
        siteMap.get(row.siteName)!.push(row);
      }

      const groups: SiteGroup[] = Array.from(siteMap.entries()).map(([siteName, shops]) => ({
        siteName,
        shops,
        selected: true,
        isExistingSite: false,
      }));

      // Verify against existing data
      const verifiedGroups = await verifyDuplicates(groups);
      
      setParsedData(verifiedGroups);
      setVerificationComplete(true);
      toast.success(`Parsed ${rows.length} shops across ${groups.length} sites - verification complete`);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      toast.error("Failed to parse Excel file");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const toggleSite = (siteIndex: number) => {
    setParsedData((prev) =>
      prev.map((site, i) => {
        if (i === siteIndex) {
          const newSelected = !site.selected;
          return {
            ...site,
            selected: newSelected,
            shops: site.shops.map((s) => ({ 
              ...s, 
              // Don't select file duplicates even when selecting all
              selected: s.duplicateStatus === 'duplicate-in-file' ? false : newSelected 
            })),
          };
        }
        return site;
      })
    );
  };

  const toggleShop = (siteIndex: number, shopIndex: number) => {
    setParsedData((prev) =>
      prev.map((site, si) => {
        if (si === siteIndex) {
          const newShops = site.shops.map((shop, shi) =>
            shi === shopIndex ? { ...shop, selected: !shop.selected } : shop
          );
          const allSelected = newShops.every((s) => s.selected || s.duplicateStatus === 'duplicate-in-file');
          return { ...site, shops: newShops, selected: allSelected };
        }
        return site;
      })
    );
  };

  const handleImport = async () => {
    const selectedSites = parsedData.filter((s) => s.shops.some((shop) => shop.selected));
    if (selectedSites.length === 0) {
      toast.error("No shops selected for import");
      return;
    }

    setIsImporting(true);
    const totalShops = selectedSites.reduce((acc, s) => acc + s.shops.filter((sh) => sh.selected).length, 0);
    setImportProgress({ current: 0, total: totalShops });

    let imported = 0;
    let sitesCreated = 0;
    let metersCreated = 0;
    let metersUpdated = 0;
    let skipped = 0;

    try {
      for (const siteGroup of selectedSites) {
        const selectedShops = siteGroup.shops.filter((s) => s.selected);
        if (selectedShops.length === 0) continue;

        // Use existing site ID if available, otherwise create
        let siteId: string;
        
        if (siteGroup.existingSiteId) {
          siteId = siteGroup.existingSiteId;
        } else {
          // Double-check site doesn't exist (race condition protection)
          const { data: existingSite } = await supabase
            .from("sites")
            .select("id")
            .ilike("name", siteGroup.siteName)
            .single();

          if (existingSite) {
            siteId = existingSite.id;
          } else {
            const totalArea = selectedShops.reduce((acc, s) => acc + (s.areaSqm || 0), 0);
            const { data: newSite, error: siteError } = await supabase
              .from("sites")
              .insert({
                name: siteGroup.siteName,
                site_type: "Shopping Centre",
                total_area_sqm: totalArea > 0 ? totalArea : null,
              })
              .select("id")
              .single();

            if (siteError) throw siteError;
            siteId = newSite.id;
            sitesCreated++;
          }
        }

        // Process each shop
        for (const shop of selectedShops) {
          // Skip file duplicates
          if (shop.duplicateStatus === 'duplicate-in-file') {
            skipped++;
            imported++;
            setImportProgress({ current: imported, total: totalShops });
            continue;
          }

          if (shop.duplicateStatus === 'existing-meter' && shop.existingMeterId) {
            // Update existing meter
            const { error: updateError } = await supabase
              .from("scada_imports")
              .update({
                shop_number: shop.breaker || undefined,
                area_sqm: shop.areaSqm || undefined,
                file_name: shop.fileName || undefined,
              })
              .eq("id", shop.existingMeterId);

            if (updateError) {
              console.error("Error updating meter:", updateError);
            } else {
              metersUpdated++;
            }
          } else {
            // Create new meter entry
            const { error: meterError } = await supabase.from("scada_imports").insert({
              site_id: siteId,
              site_name: siteGroup.siteName,
              shop_name: shop.shopName,
              shop_number: shop.breaker,
              area_sqm: shop.areaSqm,
              file_name: shop.fileName || null,
            });

            if (meterError) {
              console.error("Error creating meter:", meterError);
            } else {
              metersCreated++;
            }
          }

          imported++;
          setImportProgress({ current: imported, total: totalShops });
        }
      }

      const messages = [];
      if (sitesCreated > 0) messages.push(`${sitesCreated} new site(s)`);
      if (metersCreated > 0) messages.push(`${metersCreated} new meter(s)`);
      if (metersUpdated > 0) messages.push(`${metersUpdated} updated`);
      if (skipped > 0) messages.push(`${skipped} skipped`);
      
      toast.success(`Import complete: ${messages.join(', ')}`);
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      onImportComplete?.();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const selectedCount = parsedData.reduce(
    (acc, s) => acc + s.shops.filter((sh) => sh.selected).length,
    0
  );
  const totalCount = parsedData.reduce((acc, s) => acc + s.shops.length, 0);

  // Get status badge for a shop
  const getStatusBadge = (shop: ParsedRow) => {
    switch (shop.duplicateStatus) {
      case 'duplicate-in-file':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="destructive" className="gap-1">
                  <Copy className="h-3 w-3" />
                  Duplicate
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Duplicate of "{shop.duplicateOf}" in this file</p>
                <p className="text-xs text-muted-foreground">Will be skipped</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'existing-meter':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <RefreshCw className="h-3 w-3" />
                  Update
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Meter already exists in database</p>
                <p className="text-xs text-muted-foreground">Will update area/breaker info</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'existing-site':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="gap-1 bg-blue-500/20 text-blue-700 dark:text-blue-400">
                  <ArrowRight className="h-3 w-3" />
                  Add to site
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Site exists, new meter will be added</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'new':
      default:
        return (
          <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400 border-green-500/30">
            <CheckCircle2 className="h-3 w-3" />
            New
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import Sites & Shops from Excel
        </CardTitle>
        <CardDescription>
          Upload an Excel file with site names, shop names, and areas to create meter placeholders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing || isVerifying}
          >
            {isParsing || isVerifying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isParsing ? "Parsing..." : isVerifying ? "Verifying..." : "Select Excel File"}
          </Button>
          {parsedData.length > 0 && (
            <Badge variant="secondary">
              {totalCount} shops in {parsedData.length} sites
            </Badge>
          )}
        </div>

        {/* Verification Summary */}
        {verificationComplete && duplicateStats && (
          <Alert className="border-primary/30 bg-primary/5">
            <Shield className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Duplicate Verification Complete
            </AlertTitle>
            <AlertDescription>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>{duplicateStats.newSites} new sites</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>{duplicateStats.newMeters} new meters</span>
                </div>
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 text-amber-500" />
                  <span>{duplicateStats.existingMeters} to update</span>
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-blue-500" />
                  <span>{duplicateStats.existingSites} existing sites</span>
                </div>
                {duplicateStats.duplicatesInFile > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <span>{duplicateStats.duplicatesInFile} file duplicates</span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Warning for duplicates in file */}
        {duplicateStats && duplicateStats.duplicatesInFile > 0 && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Duplicates Found in File</AlertTitle>
            <AlertDescription>
              {duplicateStats.duplicatesInFile} duplicate entries were found within your Excel file.
              These are automatically deselected and will be skipped during import.
            </AlertDescription>
          </Alert>
        )}

        {/* Parsed Data Preview */}
        {parsedData.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedCount} of {totalCount} shops selected for import
              </p>
              <Button onClick={handleImport} disabled={isImporting || selectedCount === 0}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing {importProgress?.current}/{importProgress?.total}...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Import Selected ({selectedCount})
                  </>
                )}
              </Button>
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Site / Shop</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Breaker</TableHead>
                    <TableHead className="text-right">Area (m²)</TableHead>
                    <TableHead>File Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((site, siteIndex) => (
                    <>
                      {/* Site Header Row */}
                      <TableRow key={`site-${siteIndex}`} className="bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={site.selected}
                            onCheckedChange={() => toggleSite(siteIndex)}
                          />
                        </TableCell>
                        <TableCell colSpan={2}>
                          <div className="flex items-center gap-2 font-medium">
                            <Building2 className="h-4 w-4 text-primary" />
                            {site.siteName}
                            <Badge variant="outline" className="ml-2">
                              {site.shops.length} shops
                            </Badge>
                            {site.isExistingSite && (
                              <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400">
                                Existing Site
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                      {/* Shop Rows */}
                      {site.shops.map((shop, shopIndex) => (
                        <TableRow
                          key={`shop-${siteIndex}-${shopIndex}`}
                          className={
                            shop.duplicateStatus === 'duplicate-in-file' 
                              ? "opacity-50 bg-destructive/5" 
                              : !shop.selected 
                                ? "opacity-50" 
                                : ""
                          }
                        >
                          <TableCell className="pl-8">
                            <Checkbox
                              checked={shop.selected}
                              disabled={shop.duplicateStatus === 'duplicate-in-file'}
                              onCheckedChange={() => toggleShop(siteIndex, shopIndex)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-muted-foreground" />
                              {shop.shopName}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(shop)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {shop.breaker || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {shop.areaSqm ? (
                              <span className="flex items-center justify-end gap-1">
                                <Ruler className="h-3 w-3" />
                                {shop.areaSqm.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground flex items-center justify-end gap-1">
                                <AlertCircle className="h-3 w-3" />
                                -
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {shop.fileName || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        {/* Help Text */}
        {parsedData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">Upload an Excel file with columns:</p>
            <p className="text-sm">
              <strong>Shopping Centre</strong> (site name), <strong>Shop</strong> (meter name),{" "}
              <strong>Square Meters</strong> (area)
            </p>
            <p className="text-sm mt-2">
              Optional: <strong>Breaker</strong>, <strong>Data Source</strong>, <strong>File Name</strong>
            </p>
            <div className="mt-4 p-3 bg-muted/50 rounded-md text-xs inline-block">
              <Shield className="h-4 w-4 inline mr-1" />
              Duplicate detection will verify against existing sites and meters before import
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
