import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, FileText, AlertCircle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  filePath: string;
}

interface SheetData {
  name: string;
  rows: (string | number | null)[][];
}

export function FilePreviewDialog({ open, onOpenChange, fileName, filePath }: FilePreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const fileType = fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'excel';

  useEffect(() => {
    if (open && filePath) {
      loadFilePreview();
    }
  }, [open, filePath]);

  const loadFilePreview = async () => {
    setLoading(true);
    setError(null);
    setSheets([]);
    setPdfUrl(null);

    try {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("tariff-uploads")
        .download(filePath);

      if (downloadError) throw downloadError;

      if (fileType === 'pdf') {
        // Create blob URL for PDF viewing
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setPdfUrl(blobUrl);
      } else {
        // Parse Excel file
        const arrayBuffer = await fileData.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        
        const parsedSheets: SheetData[] = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, { 
            header: 1,
            raw: false,
            dateNF: "yyyy-mm-dd"
          });
          
          // Limit to first 100 rows for preview
          return {
            name: sheetName,
            rows: jsonData.slice(0, 100)
          };
        });

        setSheets(parsedSheets);
        if (parsedSheets.length > 0) {
          setActiveSheet(parsedSheets[0].name);
        }
      }
    } catch (err) {
      console.error("Error loading file preview:", err);
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from("tariff-uploads")
        .download(filePath);

      if (error) throw error;

      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const activeSheetData = sheets.find(s => s.name === activeSheet);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              {fileType === 'pdf' ? (
                <FileText className="h-5 w-5 text-red-500" />
              ) : (
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              )}
              <DialogTitle className="text-lg">{fileName}</DialogTitle>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
          <DialogDescription>
            {fileType === 'pdf' ? 'PDF document preview' : `Excel workbook with ${sheets.length} sheet${sheets.length !== 1 ? 's' : ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading preview...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-destructive">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={loadFilePreview}>
                Retry
              </Button>
            </div>
          ) : fileType === 'pdf' && pdfUrl ? (
            <iframe 
              src={pdfUrl} 
              className="w-full h-[60vh] border rounded-md"
              title={fileName}
            />
          ) : sheets.length > 0 ? (
            <Tabs value={activeSheet} onValueChange={setActiveSheet} className="h-full flex flex-col">
              <ScrollArea className="w-full">
                <TabsList className="inline-flex h-9 mb-2">
                  {sheets.map((sheet) => (
                    <TabsTrigger 
                      key={sheet.name} 
                      value={sheet.name}
                      className="text-xs px-3"
                    >
                      {sheet.name}
                      <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                        {sheet.rows.length}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>
              
              {sheets.map((sheet) => (
                <TabsContent 
                  key={sheet.name} 
                  value={sheet.name} 
                  className="flex-1 min-h-0 mt-0"
                >
                  <ScrollArea className="h-[55vh] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-xs text-muted-foreground">#</TableHead>
                          {sheet.rows[0]?.map((_, colIndex) => (
                            <TableHead key={colIndex} className="text-xs min-w-[100px]">
                              {String.fromCharCode(65 + (colIndex % 26))}
                              {colIndex >= 26 ? Math.floor(colIndex / 26) : ''}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheet.rows.map((row, rowIndex) => (
                          <TableRow key={rowIndex} className={rowIndex === 0 ? "bg-muted/50 font-medium" : ""}>
                            <TableCell className="text-xs text-muted-foreground">{rowIndex + 1}</TableCell>
                            {row.map((cell, colIndex) => (
                              <TableCell key={colIndex} className="text-xs py-1.5 max-w-[200px] truncate">
                                {cell != null ? String(cell) : ''}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  {sheet.rows.length >= 100 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Showing first 100 rows. Download file to see all data.
                    </p>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No data to preview
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
