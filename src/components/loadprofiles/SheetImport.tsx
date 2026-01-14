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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Upload, FileSpreadsheet, Building2, Store, Ruler, Loader2, 
  CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Copy, 
  Shield, ArrowRight, Trash2, ChevronDown, FileWarning, ListChecks
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
  // Validation
  validationErrors?: string[];
  rowNumber?: number;
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

interface OrphanedMeter {
  id: string;
  site_name: string;
  shop_name: string;
  site_id: string | null;
  selected: boolean;
}

interface ParseError {
  rowNumber: number;
  message: string;
  rawData: Record<string, unknown>;
}

interface AuditLog {
  timestamp: Date;
  action: 'parse' | 'validate' | 'import' | 'delete' | 'update' | 'create' | 'error';
  entity: 'site' | 'meter' | 'file' | 'system';
  entityName?: string;
  details: string;
  success: boolean;
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
  
  // Import mode: false = Add/Update Only, true = Full Sync (deletes orphans)
  const [fullSyncMode, setFullSyncMode] = useState(false);
  const [orphanedMeters, setOrphanedMeters] = useState<OrphanedMeter[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLog[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  
  const [duplicateStats, setDuplicateStats] = useState<{
    existingSites: number;
    existingMeters: number;
    duplicatesInFile: number;
    newSites: number;
    newMeters: number;
    orphanedMeters: number;
    parseErrors: number;
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

  // Add entry to audit log
  const addAuditEntry = (entry: Omit<AuditLog, 'timestamp'>) => {
    setAuditLog(prev => [...prev, { ...entry, timestamp: new Date() }]);
  };

  // Validate a single row
  const validateRow = (row: ParsedRow): string[] => {
    const errors: string[] = [];
    
    if (!row.siteName || row.siteName.trim().length === 0) {
      errors.push("Missing site name");
    }
    if (!row.shopName || row.shopName.trim().length === 0) {
      errors.push("Missing shop name");
    }
    if (row.areaSqm !== null && (isNaN(row.areaSqm) || row.areaSqm < 0)) {
      errors.push("Invalid area value");
    }
    if (row.siteName && row.siteName.length > 200) {
      errors.push("Site name too long (max 200 chars)");
    }
    if (row.shopName && row.shopName.length > 200) {
      errors.push("Shop name too long (max 200 chars)");
    }
    
    return errors;
  };

  // Find orphaned meters (exist in DB but not in file)
  const findOrphanedMeters = async (groups: SiteGroup[]): Promise<OrphanedMeter[]> => {
    const { data: allMeters } = await supabase
      .from("scada_imports")
      .select("id, site_name, shop_name, site_id");
    
    if (!allMeters) return [];

    // Build set of all meters in the file
    const fileMeters = new Set<string>();
    for (const group of groups) {
      for (const shop of group.shops) {
        const key = `${normalizeName(group.siteName)}|${normalizeName(shop.shopName)}`;
        fileMeters.add(key);
      }
    }

    // Find meters in DB not in file
    const orphans: OrphanedMeter[] = [];
    for (const meter of allMeters) {
      const key = `${normalizeName(meter.site_name)}|${normalizeName(meter.shop_name || '')}`;
      if (!fileMeters.has(key)) {
        orphans.push({
          id: meter.id,
          site_name: meter.site_name,
          shop_name: meter.shop_name || '',
          site_id: meter.site_id,
          selected: true, // Default to selected for deletion in full sync
        });
      }
    }

    return orphans;
  };

  // Verify parsed data against existing database
  const verifyDuplicates = async (groups: SiteGroup[]): Promise<SiteGroup[]> => {
    setIsVerifying(true);
    addAuditEntry({
      action: 'validate',
      entity: 'system',
      details: `Starting verification of ${groups.length} sites`,
      success: true,
    });
    
    try {
      const existingData = await fetchExistingData();
      
      // Track duplicates within the file itself
      const seenInFile = new Map<string, string>(); // normalized "siteName|shopName" -> original shopName
      
      let existingSites = 0;
      let existingMeters = 0;
      let duplicatesInFile = 0;
      let newSites = 0;
      let newMeters = 0;
      let validationErrorCount = 0;

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
          // Run validation
          const validationErrors = validateRow(shop);
          if (validationErrors.length > 0) {
            validationErrorCount++;
          }

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
              validationErrors,
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
              validationErrors,
            };
          }
          
          if (isExistingSite) {
            newMeters++;
            return {
              ...shop,
              duplicateStatus: 'existing-site' as const,
              existingSiteId: existingSite.id,
              validationErrors,
            };
          }
          
          newMeters++;
          return {
            ...shop,
            duplicateStatus: 'new' as const,
            validationErrors,
          };
        });

        return {
          ...group,
          shops: verifiedShops,
          isExistingSite,
          existingSiteId: existingSite?.id,
        };
      });

      // Find orphaned meters if in full sync mode
      let orphans: OrphanedMeter[] = [];
      if (fullSyncMode) {
        orphans = await findOrphanedMeters(groups);
        setOrphanedMeters(orphans);
      }

      setDuplicateStats({
        existingSites,
        existingMeters,
        duplicatesInFile,
        newSites,
        newMeters,
        orphanedMeters: orphans.length,
        parseErrors: parseErrors.length,
      });

      addAuditEntry({
        action: 'validate',
        entity: 'system',
        details: `Verification complete: ${newSites} new sites, ${newMeters} new meters, ${existingMeters} to update, ${orphans.length} orphaned`,
        success: true,
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
    setParseErrors([]);
    setOrphanedMeters([]);
    setAuditLog([]);
    
    addAuditEntry({
      action: 'parse',
      entity: 'file',
      entityName: file.name,
      details: `Starting parse of ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      success: true,
    });
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      // Parse rows and group by site
      const rows: ParsedRow[] = [];
      const errors: ParseError[] = [];
      let rowNum = 2; // Start at 2 (1 = header row)
      
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

        // Track parse errors for rows missing required fields
        if (!siteName || !shopName) {
          errors.push({
            rowNumber: rowNum,
            message: !siteName && !shopName 
              ? "Missing both site name and shop name" 
              : !siteName 
                ? "Missing site name" 
                : "Missing shop name",
            rawData: row,
          });
          rowNum++;
          continue;
        }

        rows.push({
          siteName,
          shopName,
          breaker: breaker || null,
          areaSqm: isNaN(areaSqm || NaN) ? null : areaSqm,
          dataSource,
          fileName,
          selected: true,
          duplicateStatus: 'new', // Will be verified next
          rowNumber: rowNum,
        });
        rowNum++;
      }

      setParseErrors(errors);
      
      if (errors.length > 0) {
        addAuditEntry({
          action: 'error',
          entity: 'file',
          entityName: file.name,
          details: `${errors.length} rows skipped due to parse errors`,
          success: false,
        });
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

      addAuditEntry({
        action: 'parse',
        entity: 'file',
        entityName: file.name,
        details: `Parsed ${rows.length} valid rows across ${groups.length} sites`,
        success: true,
      });

      // Verify against existing data
      const verifiedGroups = await verifyDuplicates(groups);
      
      setParsedData(verifiedGroups);
      setVerificationComplete(true);
      toast.success(`Parsed ${rows.length} shops across ${groups.length} sites - verification complete`);
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      addAuditEntry({
        action: 'error',
        entity: 'file',
        entityName: file.name,
        details: `Parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      });
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

  const toggleOrphanedMeter = (meterId: string) => {
    setOrphanedMeters(prev => 
      prev.map(m => m.id === meterId ? { ...m, selected: !m.selected } : m)
    );
  };

  const toggleAllOrphanedMeters = (selected: boolean) => {
    setOrphanedMeters(prev => prev.map(m => ({ ...m, selected })));
  };

  const handleImport = async () => {
    const selectedSites = parsedData.filter((s) => s.shops.some((shop) => shop.selected));
    const selectedOrphans = orphanedMeters.filter(m => m.selected);
    
    if (selectedSites.length === 0 && selectedOrphans.length === 0) {
      toast.error("No shops selected for import");
      return;
    }

    setIsImporting(true);
    const totalShops = selectedSites.reduce((acc, s) => acc + s.shops.filter((sh) => sh.selected).length, 0);
    const totalOperations = totalShops + (fullSyncMode ? selectedOrphans.length : 0);
    setImportProgress({ current: 0, total: totalOperations });

    let imported = 0;
    let sitesCreated = 0;
    let metersCreated = 0;
    let metersUpdated = 0;
    let metersDeleted = 0;
    let skipped = 0;
    let errors = 0;

    addAuditEntry({
      action: 'import',
      entity: 'system',
      details: `Starting import: ${totalShops} meters to process${fullSyncMode ? `, ${selectedOrphans.length} orphans to delete` : ''}`,
      success: true,
    });

    try {
      // Delete orphaned meters first if in full sync mode
      if (fullSyncMode && selectedOrphans.length > 0) {
        for (const orphan of selectedOrphans) {
          const { error: deleteError } = await supabase
            .from("scada_imports")
            .delete()
            .eq("id", orphan.id);

          if (deleteError) {
            console.error("Error deleting orphaned meter:", deleteError);
            addAuditEntry({
              action: 'error',
              entity: 'meter',
              entityName: orphan.shop_name,
              details: `Failed to delete: ${deleteError.message}`,
              success: false,
            });
            errors++;
          } else {
            metersDeleted++;
            addAuditEntry({
              action: 'delete',
              entity: 'meter',
              entityName: `${orphan.site_name} / ${orphan.shop_name}`,
              details: 'Orphaned meter deleted (not in import file)',
              success: true,
            });
          }
          imported++;
          setImportProgress({ current: imported, total: totalOperations });
        }
      }

      // Process sites and meters
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

            if (siteError) {
              addAuditEntry({
                action: 'error',
                entity: 'site',
                entityName: siteGroup.siteName,
                details: `Failed to create: ${siteError.message}`,
                success: false,
              });
              throw siteError;
            }
            siteId = newSite.id;
            sitesCreated++;
            addAuditEntry({
              action: 'create',
              entity: 'site',
              entityName: siteGroup.siteName,
              details: 'New site created',
              success: true,
            });
          }
        }

        // Process each shop
        for (const shop of selectedShops) {
          // Skip file duplicates
          if (shop.duplicateStatus === 'duplicate-in-file') {
            skipped++;
            imported++;
            setImportProgress({ current: imported, total: totalOperations });
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
              addAuditEntry({
                action: 'error',
                entity: 'meter',
                entityName: shop.shopName,
                details: `Failed to update: ${updateError.message}`,
                success: false,
              });
              errors++;
            } else {
              metersUpdated++;
              addAuditEntry({
                action: 'update',
                entity: 'meter',
                entityName: `${siteGroup.siteName} / ${shop.shopName}`,
                details: 'Meter updated with new metadata',
                success: true,
              });
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
              addAuditEntry({
                action: 'error',
                entity: 'meter',
                entityName: shop.shopName,
                details: `Failed to create: ${meterError.message}`,
                success: false,
              });
              errors++;
            } else {
              metersCreated++;
              addAuditEntry({
                action: 'create',
                entity: 'meter',
                entityName: `${siteGroup.siteName} / ${shop.shopName}`,
                details: 'New meter created',
                success: true,
              });
            }
          }

          imported++;
          setImportProgress({ current: imported, total: totalOperations });
        }
      }

      const messages = [];
      if (sitesCreated > 0) messages.push(`${sitesCreated} new site(s)`);
      if (metersCreated > 0) messages.push(`${metersCreated} new meter(s)`);
      if (metersUpdated > 0) messages.push(`${metersUpdated} updated`);
      if (metersDeleted > 0) messages.push(`${metersDeleted} deleted`);
      if (skipped > 0) messages.push(`${skipped} skipped`);
      if (errors > 0) messages.push(`${errors} error(s)`);

      addAuditEntry({
        action: 'import',
        entity: 'system',
        details: `Import complete: ${messages.join(', ')}`,
        success: errors === 0,
      });
      
      toast.success(`Import complete: ${messages.join(', ')}`);
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["sites-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      onImportComplete?.();
    } catch (error) {
      console.error("Import error:", error);
      addAuditEntry({
        action: 'error',
        entity: 'system',
        details: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      });
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
        {/* Import Mode Toggle */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="sync-mode" className="text-sm font-medium">
              Import Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              {fullSyncMode 
                ? "Full Sync: Delete meters not in file, add/update all others" 
                : "Add/Update Only: Keep existing meters, only add or update from file"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Add/Update</span>
            <Switch
              id="sync-mode"
              checked={fullSyncMode}
              onCheckedChange={setFullSyncMode}
              disabled={isParsing || isVerifying || isImporting}
            />
            <span className="text-xs text-muted-foreground">Full Sync</span>
          </div>
        </div>

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

        {/* Parse Errors Alert */}
        {parseErrors.length > 0 && (
          <Collapsible>
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <FileWarning className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{parseErrors.length} Rows Skipped (Parse Errors)</span>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </AlertTitle>
              <CollapsibleContent>
                <AlertDescription className="mt-2">
                  <ScrollArea className="h-[100px]">
                    <div className="space-y-1 text-xs">
                      {parseErrors.map((err, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-mono">Row {err.rowNumber}:</span>
                          <span>{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </AlertDescription>
              </CollapsibleContent>
            </Alert>
          </Collapsible>
        )}

        {/* Verification Summary */}
        {verificationComplete && duplicateStats && (
          <Alert className="border-primary/30 bg-primary/5">
            <Shield className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Verification Complete
            </AlertTitle>
            <AlertDescription>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2 text-sm">
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
                {fullSyncMode && duplicateStats.orphanedMeters > 0 && (
                  <div className="flex items-center gap-1">
                    <Trash2 className="h-3 w-3 text-destructive" />
                    <span>{duplicateStats.orphanedMeters} to delete</span>
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

        {/* Orphaned Meters Section (Full Sync Mode) */}
        {fullSyncMode && orphanedMeters.length > 0 && (
          <Collapsible defaultOpen>
            <Alert className="border-destructive/30 bg-destructive/5">
              <Trash2 className="h-4 w-4 text-destructive" />
              <AlertTitle className="flex items-center justify-between">
                <span>{orphanedMeters.filter(m => m.selected).length} of {orphanedMeters.length} Orphaned Meters to Delete</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={() => toggleAllOrphanedMeters(true)}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={() => toggleAllOrphanedMeters(false)}
                  >
                    Deselect All
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </AlertTitle>
              <CollapsibleContent>
                <AlertDescription className="mt-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    These meters exist in the database but are not in your import file. They will be deleted.
                  </p>
                  <ScrollArea className="h-[150px] border rounded-md bg-background/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Site</TableHead>
                          <TableHead>Shop</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orphanedMeters.map((meter) => (
                          <TableRow key={meter.id} className={!meter.selected ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={meter.selected}
                                onCheckedChange={() => toggleOrphanedMeter(meter.id)}
                              />
                            </TableCell>
                            <TableCell className="text-sm">{meter.site_name}</TableCell>
                            <TableCell className="text-sm">{meter.shop_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </AlertDescription>
              </CollapsibleContent>
            </Alert>
          </Collapsible>
        )}

        {/* Parsed Data Preview */}
        {parsedData.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedCount} of {totalCount} shops selected for import
                {fullSyncMode && orphanedMeters.filter(m => m.selected).length > 0 && (
                  <span className="text-destructive ml-2">
                    + {orphanedMeters.filter(m => m.selected).length} to delete
                  </span>
                )}
              </p>
              <Button 
                onClick={handleImport} 
                disabled={isImporting || (selectedCount === 0 && orphanedMeters.filter(m => m.selected).length === 0)}
                variant={fullSyncMode ? "destructive" : "default"}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {fullSyncMode ? "Syncing" : "Importing"} {importProgress?.current}/{importProgress?.total}...
                  </>
                ) : (
                  <>
                    {fullSyncMode ? <RefreshCw className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {fullSyncMode ? "Full Sync" : "Import Selected"} ({selectedCount})
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
                              : shop.validationErrors && shop.validationErrors.length > 0
                                ? "bg-amber-500/5"
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
                              {shop.validationErrors && shop.validationErrors.length > 0 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{shop.validationErrors.join(', ')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
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

        {/* Audit Log */}
        {auditLog.length > 0 && (
          <Collapsible open={showAuditLog} onOpenChange={setShowAuditLog}>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ListChecks className="h-4 w-4" />
                <span>Audit Trail ({auditLog.length} entries)</span>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAuditLog ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <ScrollArea className="h-[200px] mt-2 border rounded-md bg-muted/30">
                <div className="p-2 space-y-1 font-mono text-xs">
                  {auditLog.map((entry, i) => (
                    <div 
                      key={i} 
                      className={`flex gap-2 p-1 rounded ${
                        entry.success ? "" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <span className="text-muted-foreground whitespace-nowrap">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1 ${
                          entry.action === 'error' 
                            ? 'border-destructive text-destructive' 
                            : entry.action === 'create' 
                              ? 'border-green-500 text-green-600' 
                              : entry.action === 'delete' 
                                ? 'border-destructive text-destructive'
                                : entry.action === 'update'
                                  ? 'border-amber-500 text-amber-600'
                                  : ''
                        }`}
                      >
                        {entry.action}
                      </Badge>
                      <span className="text-muted-foreground">[{entry.entity}]</span>
                      {entry.entityName && <span className="font-medium">{entry.entityName}:</span>}
                      <span className="flex-1">{entry.details}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
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
