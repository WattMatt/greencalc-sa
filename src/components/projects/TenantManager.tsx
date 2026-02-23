import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, Layers, MoreVertical, Eye, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Upload, Trash2, Pencil, RotateCcw, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { processCSVToLoadProfile } from "@/components/loadprofiles/utils/csvToLoadProfile";
import type { WizardParseConfig } from "@/components/loadprofiles/types/csvImportTypes";


import { TenantProfileMatcher } from "./TenantProfileMatcher";
import { MultiMeterSelector } from "./MultiMeterSelector";
import { AccuracyBadge, AccuracySummary, getAccuracyLevel } from "@/components/simulation/AccuracyBadge";
import { ScaledMeterPreview } from "./ScaledMeterPreview";
import { TenantColumnMapper, type TenantMappedData } from "./TenantColumnMapper";
import { ScadaImportWizard, type ParsedFileResult } from "./ScadaImportWizard";

interface Tenant {
  id: string;
  name: string;
  shop_number: string | null;
  shop_name: string | null;
  area_sqm: number;
  shop_type_id: string | null;
  scada_import_id: string | null;
  monthly_kwh_override: number | null;
  include_in_load_profile: boolean;
  is_virtual: boolean;
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
  meter_label?: string | null;
  meter_color?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  weekday_days?: number | null;
  weekend_days?: number | null;
  processed_at?: string | null;
  shop_number?: string | null;
}

interface TenantManagerProps {
  projectId: string;
  tenants: Tenant[];
  shopTypes: ShopType[];
  highlightTenantId?: string | null;
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

// Types for profile suggestions
type MatchType = 'exact' | 'similar' | 'none';

interface ProfileSuggestion {
  profile: ScadaImport;
  matchType: MatchType;
  score: number;
}

// Match tenant name to profiles and calculate confidence scores
function getProfileSuggestions(tenantName: string, profiles: ScadaImport[]): ProfileSuggestion[] {
  const normalizedTenant = tenantName.toLowerCase().trim();
  if (!normalizedTenant) {
    return profiles.map(profile => ({ profile, matchType: 'none' as const, score: 0 }));
  }
  
  return profiles.map(profile => {
    const shopName = profile.shop_name?.toLowerCase() || '';
    const meterLabel = profile.meter_label?.toLowerCase() || '';
    
    // Exact match
    if (shopName === normalizedTenant || meterLabel === normalizedTenant) {
      return { profile, matchType: 'exact' as const, score: 100 };
    }
    
    // Contains match (either direction)
    if ((shopName && (shopName.includes(normalizedTenant) || normalizedTenant.includes(shopName))) ||
        (meterLabel && (meterLabel.includes(normalizedTenant) || normalizedTenant.includes(meterLabel)))) {
      const matchedLen = shopName.length || meterLabel.length || 1;
      const longerLen = Math.max(matchedLen, normalizedTenant.length);
      const shorterLen = Math.min(matchedLen, normalizedTenant.length);
      return { profile, matchType: 'similar' as const, score: 60 + (shorterLen / longerLen) * 30 };
    }
    
    // No name match
    return { profile, matchType: 'none' as const, score: 0 };
  });
}

// Get sorted profiles with suggestions based on name or area
function getSortedProfilesWithSuggestions(
  tenantName: string, 
  tenantArea: number, 
  profiles: ScadaImport[], 
  sortByArea: boolean
): ProfileSuggestion[] {
  if (sortByArea) {
    // Pure area-based sorting
    return [...profiles]
      .map(p => ({ profile: p, matchType: 'none' as const, score: 0 }))
      .sort((a, b) => getAreaDifference(a.profile.area_sqm, tenantArea) - getAreaDifference(b.profile.area_sqm, tenantArea));
  }
  
  // Name-based with area as tiebreaker
  const suggestions = getProfileSuggestions(tenantName, profiles);
  return suggestions.sort((a, b) => {
    // Primary: match score (highest first)
    if (a.score !== b.score) return b.score - a.score;
    // Secondary: area similarity
    return getAreaDifference(a.profile.area_sqm, tenantArea) - getAreaDifference(b.profile.area_sqm, tenantArea);
  });
}

// Sorting state type
type SortColumn = 'shop_number' | 'shop_name' | 'area' | 'kwh';
type SortDirection = 'asc' | 'desc';

export function TenantManager({ projectId, tenants, shopTypes, highlightTenantId }: TenantManagerProps) {
  const queryClient = useQueryClient();
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast.error("CSV file must have a header row and at least one data row");
        return;
      }
      const headers = lines[0].split(",").map(h => h.trim());
      const rows = lines.slice(1).map(l => l.split(",").map(c => c.trim()));
      setDialogOpen(false);
      setColumnMapperData({ headers, rows });
      setColumnMapperOpen(true);
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }, []);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ shop_number: "", shop_name: "", area_sqm: "", scada_import_id: "" });
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);
  const [addDialogSortByArea, setAddDialogSortByArea] = useState(false);
  
  // Profile scope toggle: global vs local
  const [profileScope, setProfileScope] = useState<'global' | 'local'>('global');
  
  // Scada Import Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  
  // Column mapper state (still used after wizard completes)
  const [columnMapperOpen, setColumnMapperOpen] = useState(false);
  const [columnMapperData, setColumnMapperData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  
  // Multi-meter selector state
  const [multiMeterTenant, setMultiMeterTenant] = useState<{ id: string; name: string; area: number } | null>(null);
  
  // Sort mode toggle per tenant for inline dropdowns
  const [sortByAreaMap, setSortByAreaMap] = useState<Record<string, boolean>>({});
  const [popoverOpenMap, setPopoverOpenMap] = useState<Record<string, boolean>>({});
  
  // Profile preview state
  const [previewContext, setPreviewContext] = useState<{ meter: ScadaImport; tenant: Tenant } | null>(null);
  
  // Edit tenant state
  const [editTenant, setEditTenant] = useState<{ id: string; shop_number: string; shop_name: string; area_sqm: string } | null>(null);
  
  // Table sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [autoMatching, setAutoMatching] = useState(false);

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

  // Fetch SCADA imports for profile assignment (filtered by scope)
  const { data: scadaImports } = useQuery({
    queryKey: ["scada-imports-for-assignment", profileScope, projectId],
    queryFn: async () => {
      let query = supabase
        .from("scada_imports")
        .select("id, shop_name, site_name, area_sqm, data_points, load_profile_weekday, load_profile_weekend, meter_label, meter_color, date_range_start, date_range_end, weekday_days, weekend_days, processed_at, shop_number");
      
      if (profileScope === 'local') {
        query = query.eq('project_id', projectId);
      }
      
      const { data, error } = await query.order("shop_name");
      if (error) throw error;
      return data as ScadaImport[];
    },
  });

  // Fetch assigned SCADA imports (unfiltered) for display purposes
  const assignedScadaIds = tenants
    .map(t => t.scada_import_id)
    .filter(Boolean) as string[];

  const { data: assignedScadaImports } = useQuery({
    queryKey: ["assigned-scada-display", assignedScadaIds],
    queryFn: async () => {
      if (assignedScadaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, shop_name, site_name, area_sqm, data_points, load_profile_weekday, load_profile_weekend, meter_label, meter_color, date_range_start, date_range_end, weekday_days, weekend_days, processed_at, shop_number")
        .in("id", assignedScadaIds);
      if (error) throw error;
      return data as ScadaImport[];
    },
    enabled: assignedScadaIds.length > 0,
  });

  const addTenant = useMutation({
    mutationFn: async (tenant: { shop_number: string | null; shop_name: string; area_sqm: number; scada_import_id: string | null }) => {
      const { error } = await supabase.from("project_tenants").insert({
        project_id: projectId,
        name: tenant.shop_name, // Keep name for backwards compatibility
        shop_number: tenant.shop_number,
        shop_name: tenant.shop_name,
        area_sqm: tenant.area_sqm,
        scada_import_id: tenant.scada_import_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success("Tenant added");
      setDialogOpen(false);
      setNewTenant({ shop_number: "", shop_name: "", area_sqm: "", scada_import_id: "" });
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
      // If assigning a profile, first clear it from any other tenant
      if (scadaImportId) {
        await supabase
          .from("project_tenants")
          .update({ scada_import_id: null })
          .eq("project_id", projectId)
          .eq("scada_import_id", scadaImportId)
          .neq("id", tenantId);
      }
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

  const updateTenant = useMutation({
    mutationFn: async ({ tenantId, shop_number, shop_name, area_sqm }: { tenantId: string; shop_number: string | null; shop_name: string; area_sqm: number }) => {
      const { error } = await supabase
        .from("project_tenants")
        .update({ 
          name: shop_name, // Keep name for backwards compatibility
          shop_number,
          shop_name,
          area_sqm 
        })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success("Tenant updated");
      setEditTenant(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateTenantIncludeInProfile = useMutation({
    mutationFn: async ({ tenantId, include }: { tenantId: string; include: boolean }) => {
      const { error } = await supabase
        .from("project_tenants")
        .update({ include_in_load_profile: include } as any)
        .eq("id", tenantId);
      if (error) throw error;
    },
    onMutate: async ({ tenantId, include }) => {
      await queryClient.cancelQueries({ queryKey: ["project-tenants", projectId] });
      const previous = queryClient.getQueryData(["project-tenants", projectId]);
      queryClient.setQueryData(["project-tenants", projectId], (old: any) =>
        old?.map((t: any) => t.id === tenantId ? { ...t, include_in_load_profile: include } : t)
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(["project-tenants", projectId], context?.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
    },
  });

  // Toggle sort column
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction or clear sort
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Auto-match unassigned tenants to best SCADA profiles
  const autoMatchProfiles = async () => {
    if (!scadaImports || scadaImports.length === 0) {
      toast.error("No profiles available to match");
      return;
    }

    setAutoMatching(true);
    try {
      const unassigned = tenants.filter(t => !t.scada_import_id);
      if (unassigned.length === 0) {
        toast.info("All tenants already have profiles assigned");
        return;
      }

      const availableProfiles = [...scadaImports];
      // One-to-one: track already-assigned profiles across ALL tenants
      const usedProfileIds = new Set<string>();
      for (const t of tenants) {
        if (t.scada_import_id) usedProfileIds.add(t.scada_import_id);
      }

      // Build scored candidates for all unassigned tenants
      type Candidate = { tenantId: string; profileId: string; score: number };
      const allCandidates: Candidate[] = [];

      for (const tenant of unassigned) {
        const tenantName = tenant.shop_name || tenant.name || '';

        for (const profile of availableProfiles) {
          if (usedProfileIds.has(profile.id)) continue;

          let score = 0;

          // Shop number match: parse both as numbers for numeric comparison, fall back to exact string
          if (tenant.shop_number && profile.shop_number) {
            const tenantNum = parseFloat(tenant.shop_number.trim());
            const profileNum = parseFloat(profile.shop_number.trim());
            if (!isNaN(tenantNum) && !isNaN(profileNum) && tenantNum === profileNum) {
              score = 95;
            } else if (tenant.shop_number.trim().toLowerCase() === profile.shop_number.trim().toLowerCase()) {
              score = 95;
            }
          }
          
          // If profile has no shop_number, try extracting a number from the profile name
          // e.g. "AC Shop 2" -> "2", "Shop 23A" -> "23A"
          if (score === 0 && tenant.shop_number) {
            const profileLabel = profile.shop_name || profile.site_name || '';
            const profileTrailingMatch = profileLabel.match(/[\s_\-](\d+[A-Za-z]?)$/);
            if (profileTrailingMatch) {
              const extractedId = profileTrailingMatch[1];
              const tenantShopTrimmed = tenant.shop_number.trim();
              if (extractedId.toLowerCase() === tenantShopTrimmed.toLowerCase()) {
                score = 93;
              } else {
                const extractedNum = parseFloat(extractedId);
                const tenantNum = parseFloat(tenantShopTrimmed);
                if (!isNaN(extractedNum) && !isNaN(tenantNum) && extractedNum === tenantNum) {
                  score = 93;
                }
              }
            }
          }

          if (score === 0) {
            const suggestions = getProfileSuggestions(tenantName, [profile]);
            score = suggestions[0]?.score || 0;
          }

          if (score >= 60) {
            allCandidates.push({ tenantId: tenant.id, profileId: profile.id, score });
          }
        }
      }

      // Sort by score desc for greedy one-to-one assignment
      allCandidates.sort((a, b) => b.score - a.score);

      const assignedTenants = new Set<string>();
      const candidates: Candidate[] = [];
      for (const c of allCandidates) {
        if (assignedTenants.has(c.tenantId) || usedProfileIds.has(c.profileId)) continue;
        candidates.push(c);
        assignedTenants.add(c.tenantId);
        usedProfileIds.add(c.profileId);
      }

      // Execute updates
      let matched = 0;
      for (const { tenantId, profileId } of candidates) {
        const { error } = await supabase
          .from("project_tenants")
          .update({ scada_import_id: profileId })
          .eq("id", tenantId);
        if (!error) matched++;
      }

      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success(`Auto-matched ${matched} of ${unassigned.length} unassigned tenants`);
    } catch (err: any) {
      toast.error(err.message || "Auto-match failed");
    } finally {
      setAutoMatching(false);
    }
  };

  // Clear all profile assignments for all tenants in this project
  const clearAllProfileAssignments = async () => {
    const assigned = tenants.filter(t => t.scada_import_id);
    if (assigned.length === 0) {
      toast.info("No profile assignments to clear");
      return;
    }

    setAutoMatching(true);
    try {
      const { error } = await supabase
        .from("project_tenants")
        .update({ scada_import_id: null })
        .eq("project_id", projectId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
      toast.success(`Cleared profile assignments from ${assigned.length} tenants`);
    } catch (err: any) {
      toast.error(err.message || "Failed to clear assignments");
    } finally {
      setAutoMatching(false);
    }
  };
  
  // Get display name for tenant (shop_name or fallback to name)
  const getTenantDisplayName = (tenant: Tenant): string => {
    return tenant.shop_name || tenant.name || '';
  };

  // Calculate kWh for a tenant (used for sorting)
  const calculateTenantKwh = (tenant: Tenant): number => {
    if (tenant.monthly_kwh_override) return tenant.monthly_kwh_override;
    const tenantArea = Number(tenant.area_sqm) || 0;
    const scadaArea = tenant.scada_imports?.area_sqm || null;
    let scaleFactor: number | null = null;
    if (tenant.scada_import_id && scadaArea && scadaArea > 0) {
      scaleFactor = tenantArea / scadaArea;
    }
    if (tenant.scada_imports?.load_profile_weekday) {
      const dailyKwh = calculateDailyKwh(tenant.scada_imports.load_profile_weekday);
      const scaled = scaleFactor ? dailyKwh * scaleFactor : dailyKwh;
      return scaled * 30;
    }
    return (tenant.shop_types?.kwh_per_sqm_month || 50) * tenantArea;
  };

  // Sort tenants
  const sortedTenants = [...tenants].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let comparison = 0;
    switch (sortColumn) {
      case 'shop_number': {
        const rawA = a.shop_number || '';
        const rawB = b.shop_number || '';
        const parsedA = parseFloat(rawA);
        const parsedB = parseFloat(rawB);
        const isNumA = rawA !== '' && !isNaN(parsedA);
        const isNumB = rawB !== '' && !isNaN(parsedB);
        
        if (isNumA && isNumB) {
          // Both numeric → sort numerically
          comparison = parsedA - parsedB;
        } else if (isNumA) {
          // Numeric before non-numeric
          comparison = -1;
        } else if (isNumB) {
          comparison = 1;
        } else {
          // Both non-numeric → alphabetical
          comparison = rawA.localeCompare(rawB);
        }
        break;
      }
      case 'shop_name':
        comparison = getTenantDisplayName(a).localeCompare(getTenantDisplayName(b));
        break;
      case 'area':
        comparison = (Number(a.area_sqm) || 0) - (Number(b.area_sqm) || 0);
        break;
      case 'kwh':
        comparison = calculateTenantKwh(a) - calculateTenantKwh(b);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleWizardComplete = useCallback(async (results: ParsedFileResult[]) => {
    if (results.length === 0) return;
    
    // Process each file as a meter and insert into scada_imports with project_id
    const defaultConfig: WizardParseConfig = {
      fileType: "delimited",
      startRow: 1,
      delimiters: { tab: false, semicolon: false, comma: true, space: false, other: false, otherChar: "" },
      treatConsecutiveAsOne: false,
      textQualifier: '"',
      columns: [],
      valueUnit: "auto",
    };

    let importedCount = 0;
    let updatedCount = 0;
    for (const result of results) {
      try {
        const processed = processCSVToLoadProfile(result.headers, result.rows, defaultConfig);
        
        if (processed.dataPoints === 0) {
          console.warn(`[handleWizardComplete] No data points for file, skipping`);
          continue;
        }

        const fileName = result.fileName || `Meter ${importedCount + updatedCount + 1}`;
        const shopName = fileName.replace(/\.(csv|xlsx?)$/i, "");

        // Build raw_data from user's column configuration instead of raw CSV
        const dateColIdx = result.columns.findIndex(c =>
          c.dataType === 'DateTime' ||
          c.originalName.toLowerCase().includes('date') ||
          c.originalName.toLowerCase() === 'from' ||
          c.originalName.toLowerCase() === 'time'
        );
        const timeColIdx = result.columns.findIndex((c, i) =>
          i !== dateColIdx && (
            c.originalName.toLowerCase().includes('time') ||
            c.originalName.toLowerCase() === 'to'
          )
        );
        const valueColIdx = result.columns.findIndex(c =>
          c.dataType === 'Float' || c.dataType === 'Int' ||
          c.originalName.toLowerCase().includes('kwh') ||
          c.originalName.toLowerCase().includes('kw')
        );

        const rawData = (dateColIdx >= 0 && valueColIdx >= 0)
          ? result.rows.map(row => ({
              timestamp: `${row[dateColIdx] || ''} ${timeColIdx >= 0 ? (row[timeColIdx] || '') : ''}`.trim(),
              value: parseFloat(row[valueColIdx]?.replace(/[^\d.-]/g, '') || '0') || 0
            })).filter(d => d.timestamp)
          : result.rawContent ? [{ csvContent: result.rawContent }] : null;

        // Look up tenant area_sqm if assigned
        const assignedTenant = result.tenantId
          ? tenants.find((t) => t.id === result.tenantId)
          : null;

        const payload = {
          project_id: projectId,
          site_name: shopName,
          shop_name: shopName,
          load_profile_weekday: processed.weekdayProfile,
          load_profile_weekend: processed.weekendProfile,
          data_points: processed.dataPoints,
          date_range_start: processed.dateRangeStart,
          date_range_end: processed.dateRangeEnd,
          weekday_days: processed.weekdayDays,
          weekend_days: processed.weekendDays,
          detected_interval_minutes: processed.detectedInterval,
          processed_at: new Date().toISOString(),
          file_name: fileName,
          raw_data: rawData,
          area_sqm: assignedTenant?.area_sqm ?? null,
        };

        // Check for existing record with same project_id + file_name
        const { data: existing } = await supabase
          .from("scada_imports")
          .select("id")
          .eq("project_id", projectId)
          .eq("file_name", fileName)
          .maybeSingle();

        if (existing) {
          // Update existing record instead of creating a duplicate
          const { error } = await supabase
            .from("scada_imports")
            .update(payload)
            .eq("id", existing.id);
          if (error) {
            console.error(`[handleWizardComplete] Update error for ${shopName}:`, error);
            continue;
          }
          updatedCount++;
        } else {
          const { error } = await supabase.from("scada_imports").insert(payload);
          if (error) {
            console.error(`[handleWizardComplete] Insert error for ${shopName}:`, error);
            continue;
          }
          importedCount++;
        }
      } catch (err) {
        console.error(`[handleWizardComplete] Processing error:`, err);
      }
    }

    const totalCount = importedCount + updatedCount;
    if (totalCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["scada-imports-for-assignment"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports"] });
      queryClient.invalidateQueries({ queryKey: ["meter-library"] });
      queryClient.invalidateQueries({ queryKey: ["load-profiles-stats"] });
      queryClient.invalidateQueries({ queryKey: ["scada-imports-raw"] });
      const parts: string[] = [];
      if (importedCount > 0) parts.push(`imported ${importedCount}`);
      if (updatedCount > 0) parts.push(`updated ${updatedCount}`);
      toast.success(`Successfully ${parts.join(' and ')} meter profile${totalCount > 1 ? 's' : ''}`);
      setProfileScope('local'); // Auto-switch to local view
    } else {
      toast.error("No meter profiles could be processed from the uploaded files");
    }
  }, [projectId, queryClient, tenants]);

  const handleMappedImport = useCallback(async (mappedTenants: TenantMappedData[]) => {
    if (mappedTenants.length === 0) {
      toast.error("No valid tenants found");
      return;
    }

    const tenantsToInsert = mappedTenants.map(t => ({
      project_id: projectId,
      name: t.shop_name,
      shop_number: t.shop_number,
      shop_name: t.shop_name,
      area_sqm: t.area_sqm,
    }));

    const { error } = await supabase.from("project_tenants").insert(tenantsToInsert);
    if (error) {
      toast.error(error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["project-tenants", projectId] });
    toast.success(`Imported ${tenantsToInsert.length} tenants`);
    setColumnMapperOpen(false);
    setColumnMapperData(null);
  }, [projectId, queryClient]);


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



  return (
    <div className="space-y-6">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvFileSelected}
      />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tenant Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Import or add tenants to build the load model
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center justify-between w-full">
                  <DialogTitle>Add Tenant</DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shop Number</Label>
                    <Input
                      placeholder="e.g., G12"
                      value={newTenant.shop_number}
                      onChange={(e) => setNewTenant({ ...newTenant, shop_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shop Name</Label>
                    <Input
                      placeholder="e.g., Woolworths"
                      value={newTenant.shop_name}
                      onChange={(e) => setNewTenant({ ...newTenant, shop_name: e.target.value })}
                    />
                  </div>
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
                  <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={profilePopoverOpen}
                        className="w-full justify-between"
                      >
                        <span className="truncate">
                          {newTenant.scada_import_id
                            ? formatProfileOption(
                                scadaImports?.find((m) => m.id === newTenant.scada_import_id)!
                              )
                            : "Select profile..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[340px] p-0" align="start">
                      <div className="flex items-center justify-between px-3 py-2 border-b">
                        <span className="text-xs text-muted-foreground">Sort by:</span>
                        <div className="flex gap-1">
                          <Button 
                            variant={addDialogSortByArea ? "ghost" : "secondary"} 
                            size="sm" 
                            className="h-6 text-xs px-2"
                            onClick={() => setAddDialogSortByArea(false)}
                          >
                            Name
                          </Button>
                          <Button 
                            variant={addDialogSortByArea ? "secondary" : "ghost"} 
                            size="sm" 
                            className="h-6 text-xs px-2"
                            onClick={() => setAddDialogSortByArea(true)}
                          >
                            Area
                          </Button>
                        </div>
                      </div>
                      <Command filter={(value, search) => {
                        // Case-insensitive substring match (letter order sensitive)
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                      }}>
                        <CommandInput placeholder="Search profiles..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>No profile found.</CommandEmpty>
                          <CommandGroup>
                            {getSortedProfilesWithSuggestions(
                              newTenant.shop_name,
                              parseFloat(newTenant.area_sqm) || 0,
                              scadaImports || [],
                              addDialogSortByArea
                            ).map(({ profile: meter, matchType }) => (
                              <CommandItem
                                key={meter.id}
                                value={`${meter.shop_name || ""} ${meter.site_name || ""} ${meter.area_sqm || ""}`}
                                onSelect={() => {
                                  setNewTenant({ ...newTenant, scada_import_id: meter.id });
                                  setProfilePopoverOpen(false);
                                }}
                                className="text-sm"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    newTenant.scada_import_id === meter.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="truncate">{formatProfileOption(meter)}</span>
                                  {matchType === 'exact' && (
                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] shrink-0">Suggested</Badge>
                                  )}
                                  {matchType === 'similar' && (
                                    <Badge variant="secondary" className="text-[10px] shrink-0">Similar</Badge>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    addTenant.mutate({
                      shop_number: newTenant.shop_number || null,
                      shop_name: newTenant.shop_name,
                      area_sqm: parseFloat(newTenant.area_sqm),
                      scada_import_id: newTenant.scada_import_id || null,
                    })
                  }
                  disabled={!newTenant.shop_name || !newTenant.area_sqm}
                >
                  Add Tenant
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setWizardOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </Button>
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
                <TableHead className="w-[100px]">
                  <button 
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => handleSort('shop_number')}
                  >
                    Shop #
                    {sortColumn === 'shop_number' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => handleSort('shop_name')}
                  >
                    Shop Name
                    {sortColumn === 'shop_name' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => handleSort('area')}
                  >
                    Area (m²)
                    {sortColumn === 'area' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-3">
                    <span>Load Profile</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex">
                            <Switch
                              checked={profileScope === 'local'}
                              onCheckedChange={(checked) => setProfileScope(checked ? 'local' : 'global')}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{profileScope === 'local' ? "Local data set" : "Global data set"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={autoMatching}
                            onClick={autoMatchProfiles}
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", autoMatching && "animate-spin")} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-match profiles to tenants</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={autoMatching}
                            onClick={clearAllProfileAssignments}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Clear all profile assignments</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableHead>
                <TableHead className="text-center">Scale</TableHead>
                <TableHead className="text-right">
                  <button 
                    className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                    onClick={() => handleSort('kwh')}
                  >
                    Est. kWh/month
                    {sortColumn === 'kwh' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-center w-[80px]">Include</TableHead>
                <TableHead className="text-center">Source</TableHead>
                <TableHead className="text-center w-[80px]">Type</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const assignedProfileIds = new Set(
                  sortedTenants
                    .filter(t => t.scada_import_id)
                    .map(t => t.scada_import_id!)
                );
                return sortedTenants.map((tenant) => {
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

                const assignedProfile = tenant.scada_import_id
                  ? (scadaImports?.find(m => m.id === tenant.scada_import_id)
                     ?? assignedScadaImports?.find(m => m.id === tenant.scada_import_id))
                  : undefined;
                const sortByArea = sortByAreaMap[tenant.id] ?? false;
                const sortedSuggestions = getSortedProfilesWithSuggestions(
                  tenant.name,
                  tenantArea,
                  scadaImports || [],
                  sortByArea
                );

                return (
                  <TableRow
                    key={tenant.id}
                    ref={(el) => {
                      if (highlightTenantId === tenant.id && el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                    className={highlightTenantId === tenant.id ? "bg-primary/10 animate-pulse" : ""}
                  >
                    <TableCell className="text-muted-foreground">{tenant.shop_number || '-'}</TableCell>
                    <TableCell className="font-medium">{getTenantDisplayName(tenant)}</TableCell>
                    <TableCell>{tenantArea.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Popover open={popoverOpenMap[tenant.id] ?? false} onOpenChange={(open) => setPopoverOpenMap(prev => ({ ...prev, [tenant.id]: open }))}>
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
                          <PopoverContent className="w-[340px] p-0" align="start">
                            <div className="flex items-center justify-between px-3 py-2 border-b">
                              <div className="flex items-center gap-1">
                                {assignedProfile && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTenantProfile.mutate({ tenantId: tenant.id, scadaImportId: null });
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                                <span className="text-xs text-muted-foreground">Sort by:</span>
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  variant={sortByArea ? "ghost" : "secondary"} 
                                  size="sm" 
                                  className="h-6 text-xs px-2"
                                  onClick={() => setSortByAreaMap(prev => ({ ...prev, [tenant.id]: false }))}
                                >
                                  Name
                                </Button>
                                <Button 
                                  variant={sortByArea ? "secondary" : "ghost"} 
                                  size="sm" 
                                  className="h-6 text-xs px-2"
                                  onClick={() => setSortByAreaMap(prev => ({ ...prev, [tenant.id]: true }))}
                                >
                                  Area
                                </Button>
                              </div>
                            </div>
                            <Command filter={(value, search) => {
                              // Case-insensitive substring match (letter order sensitive)
                              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                            }}>
                              <CommandInput placeholder="Search profiles..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>No profile found.</CommandEmpty>
                                <CommandGroup>
                                  {sortedSuggestions
                                    .filter(({ profile: meter }) => meter.id === tenant.scada_import_id || !assignedProfileIds.has(meter.id))
                                    .map(({ profile: meter, matchType }) => (
                                    <CommandItem
                                      key={meter.id}
                                      value={`${meter.shop_name || ""} ${meter.site_name || ""} ${meter.area_sqm || ""}`}
                                      onSelect={() => {
                                        updateTenantProfile.mutate({
                                          tenantId: tenant.id,
                                          scadaImportId: meter.id,
                                        });
                                        setPopoverOpenMap(prev => ({ ...prev, [tenant.id]: false }));
                                      }}
                                      className="text-sm"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          tenant.scada_import_id === meter.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="truncate">{formatProfileOption(meter)}</span>
                                        {matchType === 'exact' && (
                                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] shrink-0">Suggested</Badge>
                                        )}
                                        {matchType === 'similar' && (
                                          <Badge variant="secondary" className="text-[10px] shrink-0">Similar</Badge>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {meterCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {meterCount}
                          </Badge>
                        )}
                        {/* Preview button for assigned profile */}
                        {assignedProfile && assignedProfile.data_points && assignedProfile.data_points > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setPreviewContext({ meter: assignedProfile, tenant })}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Preview scaled load profile</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                      <Checkbox
                        checked={tenant.include_in_load_profile !== false}
                        onCheckedChange={(checked) =>
                          updateTenantIncludeInProfile.mutate({ tenantId: tenant.id, include: !!checked })
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
                    <TableCell className="text-center">
                      <Badge variant={tenant.is_virtual ? "outline" : "secondary"} className="text-xs">
                        {tenant.is_virtual ? "Virtual" : "Actual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditTenant({ 
                              id: tenant.id, 
                              shop_number: tenant.shop_number || '', 
                              shop_name: tenant.shop_name || tenant.name || '',
                              area_sqm: String(tenant.area_sqm)
                            })}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Tenant
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setMultiMeterTenant({ 
                              id: tenant.id, 
                              name: tenant.name, 
                              area: tenantArea 
                            })}
                          >
                            <Layers className="h-4 w-4 mr-2" />
                            Manage Assigned Meters
                            {meterCount > 0 && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {meterCount}
                              </Badge>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteTenant.mutate(tenant.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Tenant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
               });
              })()}
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

      <ScadaImportWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        projectId={projectId}
        onComplete={handleWizardComplete}
      />

      {/* Tenant Column Mapper */}
      {columnMapperData && (
        <TenantColumnMapper
          open={columnMapperOpen}
          onClose={() => {
            setColumnMapperOpen(false);
            setColumnMapperData(null);
          }}
          headers={columnMapperData.headers}
          rows={columnMapperData.rows}
          onImport={handleMappedImport}
        />
      )}
      
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
          singleProfileId={tenants.find(t => t.id === multiMeterTenant.id)?.scada_import_id}
          onClearSingleProfile={() => {
            updateTenantProfile.mutate({
              tenantId: multiMeterTenant.id,
              scadaImportId: null,
            });
          }}
        />
      )}
      
      {/* Scaled Meter Profile Preview Dialog */}
      <ScaledMeterPreview
        isOpen={!!previewContext}
        onClose={() => setPreviewContext(null)}
        meter={previewContext?.meter ? {
          id: previewContext.meter.id,
          site_name: previewContext.meter.site_name,
          shop_name: previewContext.meter.shop_name,
          shop_number: previewContext.meter.shop_number || null,
          meter_label: previewContext.meter.meter_label || null,
          meter_color: previewContext.meter.meter_color || null,
          load_profile_weekday: previewContext.meter.load_profile_weekday,
          load_profile_weekend: previewContext.meter.load_profile_weekend,
          date_range_start: previewContext.meter.date_range_start || null,
          date_range_end: previewContext.meter.date_range_end || null,
          data_points: previewContext.meter.data_points,
          weekday_days: previewContext.meter.weekday_days || null,
          weekend_days: previewContext.meter.weekend_days || null,
          processed_at: previewContext.meter.processed_at || null,
          area_sqm: previewContext.meter.area_sqm,
        } : null}
        tenantName={previewContext?.tenant.name || ""}
        tenantArea={Number(previewContext?.tenant.area_sqm) || 0}
        shopTypeIntensity={previewContext?.tenant.shop_types?.kwh_per_sqm_month}
      />
      
      {/* Edit Tenant Dialog */}
      <Dialog open={!!editTenant} onOpenChange={(open) => !open && setEditTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shop Number</Label>
                <Input
                  placeholder="e.g., G12"
                  value={editTenant?.shop_number || ""}
                  onChange={(e) => setEditTenant(prev => prev ? { ...prev, shop_number: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Shop Name</Label>
                <Input
                  placeholder="e.g., Woolworths"
                  value={editTenant?.shop_name || ""}
                  onChange={(e) => setEditTenant(prev => prev ? { ...prev, shop_name: e.target.value } : null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Area (m²)</Label>
              <Input
                type="number"
                placeholder="e.g., 500"
                value={editTenant?.area_sqm || ""}
                onChange={(e) => setEditTenant(prev => prev ? { ...prev, area_sqm: e.target.value } : null)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (editTenant) {
                  updateTenant.mutate({
                    tenantId: editTenant.id,
                    shop_number: editTenant.shop_number || null,
                    shop_name: editTenant.shop_name,
                    area_sqm: parseFloat(editTenant.area_sqm),
                  });
                }
              }}
              disabled={!editTenant?.shop_name || !editTenant?.area_sqm || updateTenant.isPending}
            >
              {updateTenant.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
