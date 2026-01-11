import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, Building2, Store, Ruler, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
}

interface SiteGroup {
  siteName: string;
  shops: ParsedRow[];
  selected: boolean;
}

interface SheetImportProps {
  onImportComplete?: () => void;
}

export function SheetImport({ onImportComplete }: SheetImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<SiteGroup[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const parseExcelFile = async (file: File) => {
    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      // Parse rows and group by site
      const rows: ParsedRow[] = [];
      for (const row of jsonData) {
        // Try to find columns by common header names
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
      }));

      setParsedData(groups);
      toast.success(`Parsed ${rows.length} shops across ${groups.length} sites`);
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
            shops: site.shops.map((s) => ({ ...s, selected: newSelected })),
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
          const allSelected = newShops.every((s) => s.selected);
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

    try {
      for (const siteGroup of selectedSites) {
        const selectedShops = siteGroup.shops.filter((s) => s.selected);
        if (selectedShops.length === 0) continue;

        // Check if site exists or create it
        let siteId: string;
        const { data: existingSite } = await supabase
          .from("sites")
          .select("id")
          .ilike("name", siteGroup.siteName)
          .single();

        if (existingSite) {
          siteId = existingSite.id;
        } else {
          // Calculate total area from shops
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

        // Create or update meter entries for each shop
        for (const shop of selectedShops) {
          // Check if meter already exists for this site with similar shop name
          const { data: existingMeters } = await supabase
            .from("scada_imports")
            .select("id, shop_name")
            .eq("site_id", siteId);
          
          // Try to find an existing meter with matching shop name
          const normalizedShopName = shop.shopName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const existingMeter = existingMeters?.find(m => {
            const existingNormalized = (m.shop_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return existingNormalized === normalizedShopName || 
                   existingNormalized.includes(normalizedShopName) || 
                   normalizedShopName.includes(existingNormalized);
          });

          if (existingMeter) {
            // Update existing meter with new info (area, breaker, etc.)
            const { error: updateError } = await supabase
              .from("scada_imports")
              .update({
                shop_number: shop.breaker || undefined,
                area_sqm: shop.areaSqm || undefined,
                file_name: shop.fileName || undefined,
              })
              .eq("id", existingMeter.id);

            if (updateError) {
              console.error("Error updating meter:", updateError);
            } else {
              metersCreated++; // Count as processed
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

      toast.success(`Imported ${metersCreated} meters across ${sitesCreated} new site(s)`);
      queryClient.invalidateQueries({ queryKey: ["sites"] });
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
            disabled={isParsing}
          >
            {isParsing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isParsing ? "Parsing..." : "Select Excel File"}
          </Button>
          {parsedData.length > 0 && (
            <Badge variant="secondary">
              {totalCount} shops in {parsedData.length} sites
            </Badge>
          )}
        </div>

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
                        <TableCell colSpan={4}>
                          <div className="flex items-center gap-2 font-medium">
                            <Building2 className="h-4 w-4 text-primary" />
                            {site.siteName}
                            <Badge variant="outline" className="ml-2">
                              {site.shops.length} shops
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Shop Rows */}
                      {site.shops.map((shop, shopIndex) => (
                        <TableRow
                          key={`shop-${siteIndex}-${shopIndex}`}
                          className={!shop.selected ? "opacity-50" : ""}
                        >
                          <TableCell className="pl-8">
                            <Checkbox
                              checked={shop.selected}
                              onCheckedChange={() => toggleShop(siteIndex, shopIndex)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-muted-foreground" />
                              {shop.shopName}
                            </div>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
