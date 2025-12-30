import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Settings2, Play, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CsvParseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  csvContent: string | null;
  fileName: string;
  onProcess: (config: ParseConfiguration) => void;
  isProcessing: boolean;
}

export interface ParseConfiguration {
  separator: string;
  headerRowNumber: number;
  columnMapping: ColumnMapping;
}

export interface ColumnMapping {
  dateColumn: string;
  timeColumn: string;
  valueColumn: string;
  kvaColumn: string;
  dateFormat: string;
  timeFormat: string;
  dateTimeFormat?: string;
  renamedHeaders?: Record<string, string>;
  columnDataTypes?: Record<string, 'datetime' | 'float' | 'int' | 'string' | 'boolean'>;
}

export function CsvParseDialog({
  isOpen,
  onClose,
  csvContent,
  fileName,
  onProcess,
  isProcessing,
}: CsvParseDialogProps) {
  const [separator, setSeparator] = useState<string>("comma");
  const [headerRowNumber, setHeaderRowNumber] = useState<string>("1");
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    dateColumn: "0",
    timeColumn: "1",
    valueColumn: "2",
    kvaColumn: "-1",
    dateFormat: "auto",
    timeFormat: "auto",
    dateTimeFormat: "YYYY-MM-DD HH:mm:ss",
    renamedHeaders: {},
    columnDataTypes: {}
  });

  // Reset state when opening with new file
  useEffect(() => {
    if (isOpen && csvContent) {
      // Auto-detect separator
      const firstLine = csvContent.split('\n')[0] || "";
      if (firstLine.includes('\t')) setSeparator("tab");
      else if (firstLine.includes(';')) setSeparator("semicolon");
      else setSeparator("comma");
    }
  }, [isOpen, csvContent]);

  const previewData = useMemo(() => {
    if (!csvContent) return null;

    const lines = csvContent.split('\n').filter(l => l.trim()).slice(0, 20);
    const separatorChar = separator === "tab" ? "\t" : 
                          separator === "comma" ? "," : 
                          separator === "semicolon" ? ";" : 
                          separator === "space" ? " " : ",";

    const rows = lines.map(line => {
      if (separatorChar === " ") {
        return line.split(/\s+/);
      }
      return line.split(separatorChar).map(c => c.replace(/^["']|["']$/g, ''));
    });

    const headerIdx = Math.max(0, parseInt(headerRowNumber) - 1);
    const headers = rows[headerIdx] || [];
    const dataRows = rows.slice(headerIdx + 1);

    // Initial column mapping if not set
    if (headers.length > 0 && columnMapping.dateColumn === "0") {
       // Try some smart defaults
       const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('time'));
       const valIdx = headers.findIndex(h => h.toLowerCase().includes('kwh') || h.toLowerCase().includes('value') || h.toLowerCase().includes('active'));
       
       if (dateIdx >= 0) {
         setColumnMapping(prev => ({ ...prev, dateColumn: dateIdx.toString() }));
       }
       if (valIdx >= 0) {
          setColumnMapping(prev => ({ ...prev, valueColumn: valIdx.toString() }));
       }
    }

    return { headers, rows: dataRows };
  }, [csvContent, separator, headerRowNumber]);

  const getColumnName = (idx: number) => {
    return columnMapping.renamedHeaders?.[idx] || previewData?.headers[idx] || `Column ${idx + 1}`;
  };

  const handleProcess = () => {
    onProcess({
      separator,
      headerRowNumber: parseInt(headerRowNumber),
      columnMapping
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Parse CSV Data - {fileName}</DialogTitle>
          <DialogDescription>
            Configure how the CSV data should be parsed and imported
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="parse" className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="parse">Parsing Configuration</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="parse" className="flex-1 overflow-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="space-y-4 p-4">
              
              {/* File Interpretation Section */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    File Interpretation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/20">
                    <div className="space-y-2">
                      <Label>Column Separator</Label>
                      <Select value={separator} onValueChange={setSeparator}>
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="comma">Comma (,)</SelectItem>
                          <SelectItem value="tab">Tab</SelectItem>
                          <SelectItem value="semicolon">Semicolon (;)</SelectItem>
                          <SelectItem value="space">Space</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Header Row Number</Label>
                      <Input
                        type="number"
                        min="1"
                        value={headerRowNumber}
                        onChange={(e) => setHeaderRowNumber(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Column Mapping Section */}
               <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Column Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/20">
                    <div className="space-y-2">
                      <Label>Date/Time Column</Label>
                      <Select 
                        value={columnMapping.dateColumn} 
                        onValueChange={(v) => setColumnMapping({...columnMapping, dateColumn: v})}
                      >
                        <SelectTrigger className="bg-background">
                           <SelectValue placeholder="Select Date Column" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                           {previewData?.headers.map((h, i) => (
                             <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </div>

                     <div className="space-y-2">
                      <Label>Time Column (Optional)</Label>
                      <Select 
                        value={columnMapping.timeColumn} 
                        onValueChange={(v) => setColumnMapping({...columnMapping, timeColumn: v})}
                      >
                        <SelectTrigger className="bg-background">
                           <SelectValue placeholder="Select Time Column (if separate)" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                           <SelectItem value="-1">None (Combined Date/Time)</SelectItem>
                           {previewData?.headers.map((h, i) => (
                             <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Value Column (kWh)</Label>
                      <Select 
                        value={columnMapping.valueColumn} 
                        onValueChange={(v) => setColumnMapping({...columnMapping, valueColumn: v})}
                      >
                        <SelectTrigger className="bg-background">
                           <SelectValue placeholder="Select Value Column" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                           {previewData?.headers.map((h, i) => (
                             <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </div>
                     <div className="space-y-2">
                      <Label>kVA Column (Optional)</Label>
                      <Select 
                        value={columnMapping.kvaColumn} 
                        onValueChange={(v) => setColumnMapping({...columnMapping, kvaColumn: v})}
                      >
                        <SelectTrigger className="bg-background">
                           <SelectValue placeholder="Select kVA Column" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                             <SelectItem value="-1">None</SelectItem>
                           {previewData?.headers.map((h, i) => (
                             <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Column Interpretation Section */}
              {previewData && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="w-4 h-4" />
                      Column Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 border rounded-md bg-muted/20 space-y-4">
                      {/* Individual Column Cards */}
                      {previewData.headers.map((header, idx) => {
                        const displayName = columnMapping.renamedHeaders?.[idx] || header || `Column ${idx + 1}`;
                        const columnId = idx.toString();
                        const currentDataType = columnMapping.columnDataTypes?.[columnId] || 'string';
                        
                        return (
                          <div key={idx} className="p-3 border rounded-md bg-background">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={visibleColumns[columnId] !== false}
                                onCheckedChange={(checked) => {
                                  setVisibleColumns(prev => ({
                                    ...prev,
                                    [columnId]: checked === true
                                  }));
                                }}
                                className="shrink-0 mt-6"
                              />
                              <div className="flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-xs mb-1">Column Name</Label>
                                    <Input
                                      value={displayName}
                                      onChange={(e) => {
                                        setColumnMapping(prev => ({
                                          ...prev,
                                          renamedHeaders: {
                                            ...prev.renamedHeaders,
                                            [idx]: e.target.value
                                          }
                                        }));
                                      }}
                                      className="h-8 text-xs"
                                      placeholder="Column name"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs mb-1">Data Type</Label>
                                    <Select
                                      value={currentDataType}
                                      onValueChange={(type: 'datetime' | 'string' | 'int' | 'float' | 'boolean') => {
                                        setColumnMapping(prev => ({
                                          ...prev,
                                          columnDataTypes: {
                                            ...prev.columnDataTypes,
                                            [columnId]: type
                                          }
                                        }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs bg-background">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-background z-50">
                                        <SelectItem value="datetime">DateTime</SelectItem>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="int">Integer</SelectItem>
                                        <SelectItem value="float">Float</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
              </Card>
            )}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="space-y-4 p-4">
              {!previewData ? (
                <div className="text-center py-8 text-muted-foreground">
                  Load a preview first to see the data
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Data Preview (First 20 rows)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {previewData.headers.map((header, idx) => (
                              <TableHead key={idx} className="whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <span>{getColumnName(idx)}</span>
                                  <Badge variant="outline" className="w-fit text-xs">
                                    {columnMapping.columnDataTypes?.[idx] || 'string'}
                                  </Badge>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.rows.slice(0, 10).map((row, rowIdx) => (
                            <TableRow key={rowIdx}>
                              {row.map((cell, cellIdx) => (
                                <TableCell key={cellIdx} className="font-mono text-xs whitespace-nowrap">
                                  {cell}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
                )}
              </div>
            </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t px-4 pb-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleProcess}
            disabled={!previewData || isProcessing}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            {isProcessing ? "Processing..." : "Process Data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
