import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { parseScheduleExcel, ParsedScheduleResult, ParsedScheduleTask } from '@/lib/ganttImport';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ImportScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (tasks: ParsedScheduleTask[], mode: 'append' | 'replace') => Promise<void>;
  existingTaskCount: number;
}

export function ImportScheduleDialog({
  open,
  onOpenChange,
  onImport,
  existingTaskCount,
}: ImportScheduleDialogProps) {
  const [parseResult, setParseResult] = useState<ParsedScheduleResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [fallbackDate, setFallbackDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);
    setParseResult(null);

    try {
      const result = await parseScheduleExcel(file, new Date(fallbackDate));
      setParseResult(result);
      if (result.errors.length > 0) {
        result.errors.forEach(err => toast.warning(err));
      }
    } catch (err) {
      toast.error('Failed to parse file: ' + (err as Error).message);
    } finally {
      setIsParsing(false);
    }
  }, [fallbackDate]);

  const handleReparse = useCallback(async () => {
    if (!fileInputRef.current?.files?.[0]) return;
    setIsParsing(true);
    try {
      const result = await parseScheduleExcel(fileInputRef.current.files[0], new Date(fallbackDate));
      setParseResult(result);
    } catch (err) {
      toast.error('Failed to re-parse file');
    } finally {
      setIsParsing(false);
    }
  }, [fallbackDate]);

  const handleImport = useCallback(async () => {
    if (!parseResult || parseResult.tasks.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(parseResult.tasks, importMode);
      toast.success(`Imported ${parseResult.tasks.length} tasks`);
      onOpenChange(false);
      setParseResult(null);
      setFileName('');
    } catch (err) {
      toast.error('Import failed: ' + (err as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [parseResult, importMode, onImport, onOpenChange]);

  const handleClose = (open: boolean) => {
    if (!open) {
      setParseResult(null);
      setFileName('');
    }
    onOpenChange(open);
  };

  // Group tasks by zone for display
  const tasksByZone = parseResult?.tasks.reduce((acc, task) => {
    if (!acc[task.zone]) acc[task.zone] = [];
    acc[task.zone].push(task);
    return acc;
  }, {} as Record<string, ParsedScheduleTask[]>) ?? {};

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Schedule from Excel
          </DialogTitle>
          <DialogDescription>
            Upload your solar PV project schedule Excel file. Tasks will be grouped by Zone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* File upload */}
          {!parseResult && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Parsing schedule...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload Excel file</p>
                    <p className="text-xs text-muted-foreground">.xlsx format</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="space-y-2">
                <Label className="text-xs">Fallback Start Date (if dates can't be detected)</Label>
                <Input
                  type="date"
                  value={fallbackDate}
                  onChange={(e) => setFallbackDate(e.target.value)}
                  className="w-48"
                />
              </div>
            </div>
          )}

          {/* Parse results */}
          {parseResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {fileName}
                </Badge>
                <Badge variant="secondary">{parseResult.tasks.length} tasks</Badge>
                <Badge variant="secondary">{parseResult.zones.length} zones</Badge>
                <Badge variant="secondary">{parseResult.categories.length} categories</Badge>
                {parseResult.dateColumnsFound ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" /> Dates detected
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Using fallback date
                  </Badge>
                )}
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {parseResult.errors.map((err, i) => <p key={i}>{err}</p>)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Fallback date adjustment */}
              {!parseResult.dateColumnsFound && (
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Project Start Date</Label>
                    <Input
                      type="date"
                      value={fallbackDate}
                      onChange={(e) => setFallbackDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleReparse} disabled={isParsing}>
                    {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Re-parse'}
                  </Button>
                </div>
              )}

              {/* Import mode */}
              {existingTaskCount > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Import Mode</Label>
                  <RadioGroup
                    value={importMode}
                    onValueChange={(v) => setImportMode(v as 'append' | 'replace')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="append" id="append" />
                      <Label htmlFor="append" className="text-sm font-normal">
                        Append to existing ({existingTaskCount} tasks)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="replace" id="replace" />
                      <Label htmlFor="replace" className="text-sm font-normal text-destructive">
                        Replace all existing tasks
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Task preview table */}
              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(tasksByZone).map(([zone, zoneTasks]) => (
                      <>
                        <TableRow key={`zone-${zone}`} className="bg-muted/50">
                          <TableCell colSpan={7} className="py-2 font-semibold text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: zoneTasks[0]?.color }}
                              />
                              {zone} ({zoneTasks.length} tasks)
                            </div>
                          </TableCell>
                        </TableRow>
                        {zoneTasks.map((task, i) => (
                          <TableRow key={`${zone}-${i}`}>
                            <TableCell>
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: task.color }}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm">{task.taskName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{task.category}</TableCell>
                            <TableCell className="text-sm">{task.daysScheduled}</TableCell>
                            <TableCell className="text-xs">{task.startDate}</TableCell>
                            <TableCell className="text-xs">{task.endDate}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs">{task.progress}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Change file */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParseResult(null);
                  setFileName('');
                }}
              >
                Choose different file
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parseResult || parseResult.tasks.length === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>Import {parseResult?.tasks.length ?? 0} Tasks</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
