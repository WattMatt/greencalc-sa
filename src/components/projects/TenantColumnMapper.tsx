import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hash, Store, Ruler, Zap, ChevronDown } from "lucide-react";

export type TenantColumnRole = "shop_number" | "shop_name" | "area" | "rating";

export interface TenantMappedData {
  shop_number: string | null;
  shop_name: string;
  area_sqm: number;
  cb_rating: string | null;
}

interface TenantColumnMapperProps {
  open: boolean;
  onClose: () => void;
  headers: string[];
  rows: string[][];
  onImport: (tenants: TenantMappedData[]) => void;
}

const ROLE_CONFIG: Record<TenantColumnRole, { label: string; icon: typeof Hash; badgeVariant: "default" | "secondary" | "outline" }> = {
  shop_number: { label: "Shop Number", icon: Hash, badgeVariant: "outline" },
  shop_name: { label: "Shop Name", icon: Store, badgeVariant: "default" },
  area: { label: "Area (m²)", icon: Ruler, badgeVariant: "secondary" },
  rating: { label: "Rating", icon: Zap, badgeVariant: "outline" },
};

function autoDetectRoles(headers: string[]): Map<number, TenantColumnRole> {
  const roles = new Map<number, TenantColumnRole>();
  const lower = headers.map(h => h.toLowerCase().trim());

  const shopNumIdx = lower.findIndex(h =>
    h.includes("shop_number") || h.includes("shop number") || h.includes("shop nr") || h.includes("unit") ||
    (h.includes("number") && !h.includes("phone")) || (h === "nr" || h === "no" || h === "no.")
  );
  const shopNameIdx = lower.findIndex(h =>
    h.includes("shop_name") || h.includes("shop name") || h.includes("tenant") ||
    h.includes("name") || h.includes("shop")
  );
  const areaIdx = lower.findIndex(h =>
    h.includes("area") || h.includes("sqm") || h.includes("size") || h.includes("m2") || h.includes("m²")
  );
  const ratingIdx = lower.findIndex(h =>
    h.includes("rating") || h.includes("breaker") || h.includes("cb") || h.includes("amps")
  );

  // Avoid assigning same column to multiple roles
  const used = new Set<number>();
  if (shopNameIdx !== -1) { roles.set(shopNameIdx, "shop_name"); used.add(shopNameIdx); }
  if (areaIdx !== -1 && !used.has(areaIdx)) { roles.set(areaIdx, "area"); used.add(areaIdx); }
  if (shopNumIdx !== -1 && !used.has(shopNumIdx)) { roles.set(shopNumIdx, "shop_number"); used.add(shopNumIdx); }
  if (ratingIdx !== -1 && !used.has(ratingIdx)) { roles.set(ratingIdx, "rating"); used.add(ratingIdx); }

  return roles;
}

export function TenantColumnMapper({ open, onClose, headers, rows, onImport }: TenantColumnMapperProps) {
  const [columnRoles, setColumnRoles] = useState<Map<number, TenantColumnRole>>(() => autoDetectRoles(headers));
  const [isImporting, setIsImporting] = useState(false);

  const previewRows = useMemo(() => rows.slice(0, 50), [rows]);

  const roleColumns = useMemo(() => {
    const result: Record<TenantColumnRole, number | null> = { shop_number: null, shop_name: null, area: null, rating: null };
    for (const [idx, role] of columnRoles) {
      result[role] = idx;
    }
    return result;
  }, [columnRoles]);

  const canImport = roleColumns.shop_name !== null;

  const assignRole = (colIdx: number, role: TenantColumnRole) => {
    setColumnRoles(prev => {
      const next = new Map(prev);
      // Remove any other column with this role
      for (const [k, v] of next) {
        if (v === role) next.delete(k);
      }
      next.set(colIdx, role);
      return next;
    });
  };

  const clearRole = (colIdx: number) => {
    setColumnRoles(prev => {
      const next = new Map(prev);
      next.delete(colIdx);
      return next;
    });
  };

  const getCellHighlight = (colIdx: number): string => {
    const role = columnRoles.get(colIdx);
    if (role === "shop_name") return "bg-primary/10";
    if (role === "area") return "bg-secondary/20";
    if (role === "shop_number") return "bg-muted/40";
    if (role === "rating") return "bg-accent/20";
    return "";
  };

  const getRoleBadge = (idx: number) => {
    const role = columnRoles.get(idx);
    if (!role) return null;
    const config = ROLE_CONFIG[role];
    const Icon = config.icon;
    return (
      <Badge variant={config.badgeVariant} className="ml-1 text-[10px] px-1 py-0">
        <Icon className="h-3 w-3 mr-0.5" />{config.label}
      </Badge>
    );
  };

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true);

    const nameIdx = roleColumns.shop_name!;
    const areaIdx = roleColumns.area;
    const numIdx = roleColumns.shop_number;
    const ratingIdx = roleColumns.rating;

    const tenants: TenantMappedData[] = [];
    for (const row of rows) {
      const shopName = row[nameIdx]?.trim();
      let area = 0;
      if (areaIdx !== null) {
        const areaStr = row[areaIdx]?.replace(/[^\d.]/g, "") || "";
        const parsed = parseFloat(areaStr);
        if (!isNaN(parsed) && parsed > 0) area = parsed;
      }
      const shopNumber = numIdx !== null ? row[numIdx]?.trim() || null : null;
      const cbRating = ratingIdx !== null ? row[ratingIdx]?.trim() || null : null;

      if (shopName) {
        tenants.push({ shop_number: shopNumber, shop_name: shopName, area_sqm: area, cb_rating: cbRating });
      }
    }

    onImport(tenants);
    setIsImporting(false);
  };

  // Count valid rows for summary
  const validCount = useMemo(() => {
    if (!canImport) return 0;
    const nameIdx = roleColumns.shop_name!;
    let count = 0;
    for (const row of rows) {
      const name = row[nameIdx]?.trim();
      if (name) count++;
    }
    return count;
  }, [rows, roleColumns, canImport]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Map Tenant Columns</DialogTitle>
          <DialogDescription>
            Click a column header to assign it as Shop Number, Shop Name, or Area. Shop Name is required. Area is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto border rounded-md flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h, i) => (
                  <TableHead key={i} className="whitespace-nowrap text-xs p-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 w-full px-3 py-2 hover:bg-muted/80 text-left select-none">
                          <span className="truncate">{h}</span>
                          {getRoleBadge(i) || <ChevronDown className="h-3 w-3 ml-auto opacity-40" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => assignRole(i, "shop_number")}>
                          <Hash className="h-4 w-4 mr-2" /> Shop Number
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => assignRole(i, "shop_name")}>
                          <Store className="h-4 w-4 mr-2" /> Shop Name
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => assignRole(i, "area")}>
                          <Ruler className="h-4 w-4 mr-2" /> Area (m²)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => assignRole(i, "rating")}>
                          <Zap className="h-4 w-4 mr-2" /> Rating (CB)
                        </DropdownMenuItem>
                        {columnRoles.has(i) && (
                          <DropdownMenuItem onClick={() => clearRole(i)} className="text-destructive">
                            Clear
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, ri) => (
                <TableRow key={ri}>
                  {row.map((cell, ci) => (
                    <TableCell key={ci} className={`text-xs whitespace-nowrap ${getCellHighlight(ci)}`}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-sm shrink-0">
          <span className="text-muted-foreground text-xs">
            {rows.length} total rows{canImport ? ` · ${validCount} valid tenants` : ""}
          </span>
          <div className="flex gap-2">
            {!canImport && (
              <span className="text-xs text-muted-foreground self-center">
                Assign Shop Name to continue
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!canImport || isImporting || validCount === 0}>
            {isImporting ? "Importing..." : `Import ${validCount} Tenants`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
