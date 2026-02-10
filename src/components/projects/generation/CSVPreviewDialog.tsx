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
import { CalendarDays, Hash, Clock, ChevronDown } from "lucide-react";

interface CSVPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  csvLines: string[];
  onParsed: (totals: Map<number, number>) => void;
}

function strip(s: string): string {
  return s.trim().replace(/^"|"$/g, "").trim();
}

function extractMonth(dateStr: string): number {
  const iso = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return parseInt(iso[2]);
  const ddmm = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmm) return parseInt(ddmm[2]);
  return 0;
}

function timeDiffMinutes(t1: string, t2: string): number {
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

type ColumnRole = "date" | "value" | "time";

export function CSVPreviewDialog({ open, onClose, csvLines, onParsed }: CSVPreviewDialogProps) {
  const [columnRoles, setColumnRoles] = useState<Map<number, ColumnRole>>(new Map());
  const [isKw, setIsKw] = useState(true);

  const { dataStartRow, headers, previewRows } = useMemo(() => {
    if (csvLines.length < 2) return { dataStartRow: 1, headers: [] as string[], previewRows: [] as string[][] };

    const first = csvLines[0].toLowerCase();
    const isScada = first.includes("pnpscada") || first.includes("scada");
    const hRow = isScada ? 1 : 0;
    const dStart = isScada ? 2 : 1;

    const hdrs = (csvLines[hRow] ?? "").split(",").map(strip);
    const preview = csvLines.slice(dStart, dStart + 10).map((l) => l.split(",").map(strip));

    return { dataStartRow: dStart, headers: hdrs, previewRows: preview };
  }, [csvLines]);

  const dateCol = useMemo(() => {
    for (const [idx, role] of columnRoles) if (role === "date") return idx;
    return null;
  }, [columnRoles]);

  const valueCol = useMemo(() => {
    for (const [idx, role] of columnRoles) if (role === "value") return idx;
    return null;
  }, [columnRoles]);

  const timeCol = useMemo(() => {
    for (const [idx, role] of columnRoles) if (role === "time") return idx;
    return null;
  }, [columnRoles]);

  const assignRole = (colIdx: number, role: ColumnRole) => {
    setColumnRoles((prev) => {
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
    setColumnRoles((prev) => {
      const next = new Map(prev);
      next.delete(colIdx);
      return next;
    });
  };

  const handleParse = () => {
    if (dateCol === null || valueCol === null) return;

    const totals = new Map<number, number>();
    const dataLines = csvLines.slice(dataStartRow).filter((l) => l.trim());

    let intervalHours = 0.5;
    if (isKw && timeCol !== null && dataLines.length >= 2) {
      const t1 = strip(dataLines[0].split(",")[timeCol] ?? "");
      const t2 = strip(dataLines[1].split(",")[timeCol] ?? "");
      if (t1 && t2) {
        const mins = timeDiffMinutes(t1, t2);
        if (mins > 0) intervalHours = mins / 60;
      }
    }

    for (const line of dataLines) {
      const cols = line.split(",").map(strip);
      const dateStr = cols[dateCol] ?? "";
      const rawVal = parseFloat(cols[valueCol] ?? "");
      if (!dateStr || isNaN(rawVal)) continue;

      const month = extractMonth(dateStr);
      if (month < 1 || month > 12) continue;

      const kwh = isKw ? rawVal * intervalHours : rawVal;
      totals.set(month, (totals.get(month) ?? 0) + kwh);
    }

    onParsed(totals);
    onClose();
  };

  const getRoleBadge = (idx: number) => {
    const role = columnRoles.get(idx);
    if (role === "date") return <Badge variant="default" className="ml-1 text-[10px] px-1 py-0"><CalendarDays className="h-3 w-3 mr-0.5" />Date</Badge>;
    if (role === "value") return <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0"><Hash className="h-3 w-3 mr-0.5" />Value</Badge>;
    if (role === "time") return <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0"><Clock className="h-3 w-3 mr-0.5" />Time</Badge>;
    return null;
  };

  const canParse = dateCol !== null && valueCol !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Map CSV Columns</DialogTitle>
          <DialogDescription>
            Select a column, then choose what data it represents (Date, Value, or Time).
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto border rounded-md">
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
                        <DropdownMenuItem onClick={() => assignRole(i, "date")}>
                          <CalendarDays className="h-4 w-4 mr-2" /> Date
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => assignRole(i, "value")}>
                          <Hash className="h-4 w-4 mr-2" /> Value (kWh / kW)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => assignRole(i, "time")}>
                          <Clock className="h-4 w-4 mr-2" /> Time
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
                    <TableCell
                      key={ci}
                      className={`text-xs whitespace-nowrap ${ci === dateCol ? "bg-primary/10" : ci === valueCol ? "bg-secondary/20" : ci === timeCol ? "bg-muted/40" : ""}`}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isKw}
              onChange={(e) => setIsKw(e.target.checked)}
              className="rounded"
            />
            Values are in kW (convert to kWh using time interval)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleParse} disabled={!canParse}>
            Parse {canParse ? "→" : "(select columns)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
