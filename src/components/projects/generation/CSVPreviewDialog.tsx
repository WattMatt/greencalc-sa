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
import { CalendarDays, Hash } from "lucide-react";

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

export function CSVPreviewDialog({ open, onClose, csvLines, onParsed }: CSVPreviewDialogProps) {
  const [dateCol, setDateCol] = useState<number | null>(null);
  const [valueCol, setValueCol] = useState<number | null>(null);
  const [timeCol, setTimeCol] = useState<number | null>(null);
  const [isKw, setIsKw] = useState(true);

  // Detect if first line is metadata (SCADA) and find data start
  const { headerRow, dataStartRow, headers, previewRows } = useMemo(() => {
    if (csvLines.length < 2) return { headerRow: 0, dataStartRow: 1, headers: [] as string[], previewRows: [] as string[][] };

    const first = csvLines[0].toLowerCase();
    const isScada = first.includes("pnpscada") || first.includes("scada");
    const hRow = isScada ? 1 : 0;
    const dStart = isScada ? 2 : 1;

    const hdrs = (csvLines[hRow] ?? "").split(",").map(strip);
    const preview = csvLines.slice(dStart, dStart + 10).map((l) => l.split(",").map(strip));

    return { headerRow: hRow, dataStartRow: dStart, headers: hdrs, previewRows: preview };
  }, [csvLines]);

  const handleColumnClick = (colIdx: number) => {
    if (dateCol === colIdx) {
      setDateCol(null);
    } else if (valueCol === colIdx) {
      setValueCol(null);
    } else if (timeCol === colIdx) {
      setTimeCol(null);
    } else if (dateCol === null) {
      setDateCol(colIdx);
    } else if (valueCol === null) {
      setValueCol(colIdx);
    } else {
      // Replace value col
      setValueCol(colIdx);
    }
  };

  const handleParse = () => {
    if (dateCol === null || valueCol === null) return;

    const totals = new Map<number, number>();
    const dataLines = csvLines.slice(dataStartRow).filter((l) => l.trim());

    // Detect interval for kW → kWh conversion
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

  const getColBadge = (idx: number) => {
    if (idx === dateCol) return <Badge variant="default" className="ml-1 text-[10px] px-1 py-0"><CalendarDays className="h-3 w-3 mr-0.5" />Date</Badge>;
    if (idx === valueCol) return <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0"><Hash className="h-3 w-3 mr-0.5" />Value</Badge>;
    if (idx === timeCol) return <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">Time</Badge>;
    return null;
  };

  const canParse = dateCol !== null && valueCol !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Map CSV Columns</DialogTitle>
          <DialogDescription>
            Auto-detection failed. Click column headers to assign <strong>Date</strong> (1st click) and <strong>Value</strong> (2nd click).
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h, i) => (
                  <TableHead
                    key={i}
                    className="cursor-pointer hover:bg-muted/80 whitespace-nowrap text-xs select-none"
                    onClick={() => handleColumnClick(i)}
                  >
                    <span>{h}</span>
                    {getColBadge(i)}
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
                      className={`text-xs whitespace-nowrap ${ci === dateCol ? "bg-primary/10" : ci === valueCol ? "bg-secondary/20" : ""}`}
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
