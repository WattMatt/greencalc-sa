import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Zap, Database } from "lucide-react";

interface ColumnSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedColumn: string) => void;
  csvContent: string | null;
  meterName: string;
  isProcessing: boolean;
}

interface ColumnInfo {
  name: string;
  sampleValues: string[];
  nonZeroCount: number;
  avgValue: number;
}

// Parse CSV to extract column info
function parseCSVColumns(csvContent: string): {
  dateColumn: string | null;
  valueColumns: ColumnInfo[];
} {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { dateColumn: null, valueColumns: [] };
  
  // Skip sep= directive
  let headerIndex = 0;
  while (headerIndex < lines.length && lines[headerIndex].toLowerCase().startsWith('sep=')) {
    headerIndex++;
  }
  // Skip empty lines
  while (headerIndex < lines.length && !lines[headerIndex].trim()) {
    headerIndex++;
  }
  
  if (headerIndex >= lines.length) return { dateColumn: null, valueColumns: [] };
  
  // Detect separator
  const headerLine = lines[headerIndex];
  let separator = ',';
  if (headerLine.includes('\t')) separator = '\t';
  else if (headerLine.includes(';') && !headerLine.includes(',')) separator = ';';
  
  const headers = headerLine.split(separator).map(h => h.trim().replace(/['"]/g, ''));
  
  // Find date column
  let dateColumn: string | null = null;
  const dateIdx = headers.findIndex(h => 
    h.toLowerCase().includes('date') || 
    h.toLowerCase().includes('time') ||
    h.toLowerCase() === 'rdate'
  );
  if (dateIdx >= 0) dateColumn = headers[dateIdx];
  
  // Get data rows (sample up to 100 for analysis)
  const dataLines = lines.slice(headerIndex + 1, headerIndex + 101);
  
  // Analyze each potential value column
  const valueColumns: ColumnInfo[] = [];
  
  headers.forEach((header, colIdx) => {
    // Skip the date/time columns
    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes('date') || lowerHeader.includes('time') || 
        lowerHeader === 'rdate' || lowerHeader === 'rtime' ||
        lowerHeader === 'status') {
      return;
    }
    
    const values: number[] = [];
    const sampleValues: string[] = [];
    
    dataLines.forEach((line, lineIdx) => {
      const cols = line.split(separator).map(c => c.trim().replace(/['"]/g, ''));
      const val = cols[colIdx];
      if (lineIdx < 5) sampleValues.push(val || '-');
      
      const numVal = parseFloat(val?.replace(/,/g, '') || '');
      if (!isNaN(numVal)) {
        values.push(numVal);
      }
    });
    
    // Only include columns with numeric data
    if (values.length > 0) {
      const nonZeroCount = values.filter(v => v !== 0).length;
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
      
      valueColumns.push({
        name: header,
        sampleValues,
        nonZeroCount,
        avgValue,
      });
    }
  });
  
  return { dateColumn, valueColumns };
}

export function ColumnSelectionDialog({
  isOpen,
  onClose,
  onConfirm,
  csvContent,
  meterName,
  isProcessing,
}: ColumnSelectionDialogProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  
  const columnInfo = useMemo(() => {
    if (!csvContent) return { dateColumn: null, valueColumns: [] };
    return parseCSVColumns(csvContent);
  }, [csvContent]);
  
  // Auto-select first column with data or recommended column
  useMemo(() => {
    if (columnInfo.valueColumns.length > 0 && !selectedColumn) {
      // Prefer columns with more non-zero values
      const sorted = [...columnInfo.valueColumns].sort((a, b) => b.nonZeroCount - a.nonZeroCount);
      setSelectedColumn(sorted[0].name);
    }
  }, [columnInfo.valueColumns, selectedColumn]);
  
  const handleConfirm = () => {
    if (selectedColumn) {
      onConfirm(selectedColumn);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Select Value Column
          </DialogTitle>
          <DialogDescription>
            Choose which column to use for the load profile of <strong>{meterName}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {columnInfo.dateColumn && (
            <div className="text-sm text-muted-foreground">
              Date column detected: <Badge variant="outline">{columnInfo.dateColumn}</Badge>
            </div>
          )}
          
          {columnInfo.valueColumns.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No value columns detected in the CSV data
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <RadioGroup
                value={selectedColumn}
                onValueChange={setSelectedColumn}
                className="space-y-2"
              >
                {columnInfo.valueColumns.map((col) => (
                  <Card 
                    key={col.name} 
                    className={`cursor-pointer transition-colors ${
                      selectedColumn === col.name ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedColumn(col.name)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={col.name} id={col.name} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Label htmlFor={col.name} className="font-medium cursor-pointer">
                              {col.name}
                            </Label>
                            {col.nonZeroCount > columnInfo.valueColumns.reduce((max, c) => 
                              c.nonZeroCount > max ? c.nonZeroCount : max, 0
                            ) * 0.9 && (
                              <Badge className="text-xs" variant="default">
                                <Zap className="h-3 w-3 mr-1" />
                                Recommended
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>
                              {col.nonZeroCount} non-zero values • Avg: {col.avgValue.toFixed(2)}
                            </div>
                            <div className="font-mono truncate">
                              Sample: {col.sampleValues.slice(0, 3).join(', ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </RadioGroup>
            </ScrollArea>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedColumn || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Process with Selected Column'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
