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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Zap, Database } from "lucide-react";

// Define the extended unit type
type ValueUnit = "kW" | "kWh" | "W" | "Wh" | "MW" | "MWh" | "kVA" | "kVAh" | "A";

interface ColumnSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedColumn: string, unit: ValueUnit, voltageV?: number, powerFactor?: number) => void;
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
    // Skip empty headers
    if (!header.trim()) return;
    
    // Skip ONLY the primary date/time column we detected
    if (dateIdx >= 0 && colIdx === dateIdx) return;
    
    // Skip known non-value columns (be very specific)
    const lowerHeader = header.toLowerCase().trim();
    if (lowerHeader === 'rdate' || lowerHeader === 'rtime' || lowerHeader === 'status') {
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
    
    // Include columns with at least some numeric data (lower threshold)
    if (values.length >= dataLines.length * 0.1) { // At least 10% numeric
      const nonZeroCount = values.filter(v => v !== 0).length;
      const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      
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
  const [selectedUnit, setSelectedUnit] = useState<ValueUnit>("kW");
  const [voltageV, setVoltageV] = useState<number>(400);
  const [powerFactor, setPowerFactor] = useState<number>(0.9);
  
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
    if (selectedColumn && selectedUnit) {
      onConfirm(selectedColumn, selectedUnit, voltageV, powerFactor);
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
            <>
              <ScrollArea className="max-h-[200px]">
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
              
              {/* Unit Selection */}
              <div className="space-y-2">
                <Label className="font-medium text-sm flex items-center gap-2">
                  Value Unit Type
                  <Badge variant="destructive" className="text-[10px]">Required</Badge>
                </Label>
                <Select
                  value={selectedUnit}
                  onValueChange={(v) => setSelectedUnit(v as ValueUnit)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select unit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kWh">kWh (Kilowatt-hours)</SelectItem>
                    <SelectItem value="kW">kW (Kilowatts)</SelectItem>
                    <SelectItem value="Wh">Wh (Watt-hours)</SelectItem>
                    <SelectItem value="W">W (Watts)</SelectItem>
                    <SelectItem value="MWh">MWh (Megawatt-hours)</SelectItem>
                    <SelectItem value="MW">MW (Megawatts)</SelectItem>
                    <SelectItem value="kVAh">kVAh (Kilovolt-amp-hours)</SelectItem>
                    <SelectItem value="kVA">kVA (Kilovolt-amps)</SelectItem>
                    <SelectItem value="A">A (Amps)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Conversion parameters for kVA and Amps */}
              {(selectedUnit === "kVA" || selectedUnit === "kVAh") && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Power Factor:</Label>
                    <Input
                      type="number"
                      min={0.1}
                      max={1.0}
                      step={0.01}
                      value={powerFactor}
                      onChange={(e) => setPowerFactor(parseFloat(e.target.value) || 0.9)}
                      className="w-20 h-8"
                    />
                  </div>
                </div>
              )}
              
              {selectedUnit === "A" && (
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Voltage (V):</Label>
                    <Input
                      type="number"
                      min={1}
                      value={voltageV}
                      onChange={(e) => setVoltageV(parseInt(e.target.value) || 400)}
                      className="w-24 h-8"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Power Factor:</Label>
                    <Input
                      type="number"
                      min={0.1}
                      max={1.0}
                      step={0.01}
                      value={powerFactor}
                      onChange={(e) => setPowerFactor(parseFloat(e.target.value) || 0.9)}
                      className="w-20 h-8"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedColumn || !selectedUnit || isProcessing}
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
