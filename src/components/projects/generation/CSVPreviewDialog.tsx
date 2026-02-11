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

export interface CSVReading {
  timestamp: string; // ISO string e.g. "2026-01-15T08:30:00"
  kwh: number;
}

interface CSVPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  csvLines: string[];
  onParsed: (totals: Map<number, number>, dailyTotals: Map<string, number>, readings: CSVReading[]) => void | Promise<void>;
}

function strip(s: string): string {
  return s.trim().replace(/^"|"$/g, "").trim();
}

function extractDateInfo(dateStr: string): { month: number; dateKey: string } {
  const iso = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const y = iso[1], m = iso[2].padStart(2, "0"), d = iso[3].padStart(2, "0");
    return { month: parseInt(iso[2]), dateKey: `${y}-${m}-${d}` };
  }
  const ddmm = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmm) {
    const d = ddmm[1].padStart(2, "0"), m = ddmm[2].padStart(2, "0"), y = ddmm[3];
    return { month: parseInt(ddmm[2]), dateKey: `${y}-${m}-${d}` };
  }
  return { month: 0, dateKey: "" };
}

function extractTimestamp(dateStr: string, timeStr?: string): string {
  const { dateKey } = extractDateInfo(dateStr);
  if (!dateKey) return "";
  // Extract time from dateStr or separate time column
  const timeMatch = (timeStr || dateStr).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const h = timeMatch ? timeMatch[1].padStart(2, "0") : "00";
  const m = timeMatch ? timeMatch[2] : "00";
  const s = timeMatch?.[3] || "00";
  return `${dateKey}T${h}:${m}:${s}`;
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
  const [startRow, setStartRow] = useState(1);
  const [stopRow, setStopRow] = useState<number | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const { dataStartRow, headers, previewRows, totalDataRows } = useMemo(() => {
    if (csvLines.length < 2) return { dataStartRow: 1, headers: [] as string[], previewRows: [] as string[][], totalDataRows: 0 };

    const first = csvLines[0].toLowerCase();
    const isScada = first.includes("pnpscada") || first.includes("scada");
    const hRow = isScada ? 1 : 0;
    const dStart = isScada ? 2 : 1;

    const hdrs = (csvLines[hRow] ?? "").split(",").map(strip);
    const totalData = csvLines.length - dStart;
    const s = Math.max(0, startRow - 1);
    const effectiveStop = stopRow ?? totalData;
    const e = Math.min(totalData, effectiveStop);
    const preview = csvLines.slice(dStart + s, dStart + Math.min(e, s + 100)).map((l) => l.split(",").map(strip));

    return { dataStartRow: dStart, headers: hdrs, previewRows: preview, totalDataRows: totalData };
  }, [csvLines, startRow, stopRow]);

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

  const handleParse = async () => {
    if (dateCol === null || valueCol === null) return;
    setIsParsing(true);

    const totals = new Map<number, number>();
    const dailyTotals = new Map<string, number>();
    const readings: CSVReading[] = [];
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

      const { month, dateKey } = extractDateInfo(dateStr);
      if (month < 1 || month > 12 || !dateKey) continue;

      const kwh = isKw ? rawVal * intervalHours : rawVal;
      totals.set(month, (totals.get(month) ?? 0) + kwh);
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + kwh);

      const timeStr = timeCol !== null ? (cols[timeCol] ?? "") : "";
      const ts = extractTimestamp(dateStr, timeStr);
      if (ts) {
        readings.push({ timestamp: ts, kwh });
      }
    }

    try {
      await onParsed(totals, dailyTotals, readings);
    } finally {
      setIsParsing(false);
      onClose();
    }
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
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Map CSV Columns</DialogTitle>
          <DialogDescription>
            Select a column, then choose what data it represents (Date, Value, or Time).
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

        <div className="flex items-center gap-4 text-sm flex-wrap shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isKw}
              onChange={(e) => setIsKw(e.target.checked)}
              className="rounded"
            />
            Values are in kW (convert to kWh using time interval)
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs">Rows</span>
            <input
              type="number"
              min={1}
              max={totalDataRows}
              value={startRow}
              onChange={(e) => {
                const v = Math.max(1, Math.min(Number(e.target.value) || 1, stopRow));
                setStartRow(v);
              }}
              className="w-16 h-8 text-xs border rounded-md px-2 bg-background text-foreground"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="number"
              min={1}
              max={totalDataRows}
              value={stopRow ?? totalDataRows}
              onChange={(e) => {
                const v = Math.max(startRow, Math.min(Number(e.target.value) || 1, totalDataRows));
                setStopRow(v);
              }}
              className="w-16 h-8 text-xs border rounded-md px-2 bg-background text-foreground"
            />
            <span className="text-muted-foreground text-xs">of {totalDataRows}</span>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleParse} disabled={!canParse || isParsing}>
            {isParsing ? "Saving..." : canParse ? "Parse →" : "Parse (select columns)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
