import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { GanttChartConfig, GanttFilters, GanttBaseline, GanttTask, GanttMilestone, TASK_COLORS, DEFAULT_FILTERS } from '@/types/gantt';
import { downloadICS } from '@/lib/calendarExport';
import { 
  CalendarDays, 
  CalendarRange, 
  Calendar, 
  Filter, 
  Download, 
  Image, 
  FileText, 
  FileSpreadsheet, 
  X, 
  Save,
  History,
  Trash2,
  Eye,
  EyeOff,
  Link2,
  Flag,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

interface GanttToolbarProps {
  config: GanttChartConfig;
  onConfigChange: (config: GanttChartConfig) => void;
  filters: GanttFilters;
  onFiltersChange: (filters: GanttFilters) => void;
  owners: string[];
  baselines: GanttBaseline[];
  onSaveBaseline: (name: string, description: string) => Promise<void>;
  onDeleteBaseline: (id: string) => void;
  tasks: GanttTask[];
  milestones: GanttMilestone[];
  projectName: string;
}

export function GanttToolbar({
  config,
  onConfigChange,
  filters,
  onFiltersChange,
  owners,
  baselines,
  onSaveBaseline,
  onDeleteBaseline,
  tasks,
  milestones,
  projectName,
}: GanttToolbarProps) {
  const [isBaselineDialogOpen, setIsBaselineDialogOpen] = useState(false);
  const [baselineName, setBaselineName] = useState('');
  const [baselineDescription, setBaselineDescription] = useState('');
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);

  const activeFiltersCount = [
    filters.search,
    filters.status.length > 0,
    filters.owners.length > 0,
    filters.colors.length > 0,
    filters.dateRange.start || filters.dateRange.end,
  ].filter(Boolean).length;

  const handleSaveBaseline = async () => {
    if (!baselineName.trim()) {
      toast.error('Please enter a baseline name');
      return;
    }
    setIsSavingBaseline(true);
    try {
      await onSaveBaseline(baselineName, baselineDescription);
      setIsBaselineDialogOpen(false);
      setBaselineName('');
      setBaselineDescription('');
    } finally {
      setIsSavingBaseline(false);
    }
  };

  const handleExportCalendar = () => {
    downloadICS(tasks, milestones, projectName);
    toast.success('Calendar exported');
  };

  const handleExportImage = async () => {
    toast.info('Image export coming soon');
  };

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/30 rounded-lg border">
      {/* View Mode */}
      <div className="flex items-center border rounded-md bg-background">
        <Button
          variant={config.viewMode === 'day' ? 'secondary' : 'ghost'}
          size="sm"
          className="rounded-r-none"
          onClick={() => onConfigChange({ ...config, viewMode: 'day' })}
        >
          <CalendarDays className="h-4 w-4 mr-1" />
          Day
        </Button>
        <Button
          variant={config.viewMode === 'week' ? 'secondary' : 'ghost'}
          size="sm"
          className="rounded-none border-x"
          onClick={() => onConfigChange({ ...config, viewMode: 'week' })}
        >
          <CalendarRange className="h-4 w-4 mr-1" />
          Week
        </Button>
        <Button
          variant={config.viewMode === 'month' ? 'secondary' : 'ghost'}
          size="sm"
          className="rounded-l-none"
          onClick={() => onConfigChange({ ...config, viewMode: 'month' })}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Month
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="h-8 w-40 text-sm"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8"
            onClick={() => onFiltersChange({ ...filters, search: '' })}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filters Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filters</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>

            {/* Status filter */}
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <div className="flex flex-wrap gap-1">
                {(['not_started', 'in_progress', 'completed'] as const).map((status) => (
                  <Badge
                    key={status}
                    variant={filters.status.includes(status) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const newStatus = filters.status.includes(status)
                        ? filters.status.filter((s) => s !== status)
                        : [...filters.status, status];
                      onFiltersChange({ ...filters, status: newStatus });
                    }}
                  >
                    {status.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Owner filter */}
            {owners.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Owner</Label>
                <div className="flex flex-wrap gap-1">
                  {owners.map((owner) => (
                    <Badge
                      key={owner}
                      variant={filters.owners.includes(owner) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const newOwners = filters.owners.includes(owner)
                          ? filters.owners.filter((o) => o !== owner)
                          : [...filters.owners, owner];
                        onFiltersChange({ ...filters, owners: newOwners });
                      }}
                    >
                      {owner}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Color filter */}
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-1">
                {TASK_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-6 h-6 rounded-full border-2 ${
                      filters.colors.includes(color.value) ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => {
                      const newColors = filters.colors.includes(color.value)
                        ? filters.colors.filter((c) => c !== color.value)
                        : [...filters.colors, color.value];
                      onFiltersChange({ ...filters, colors: newColors });
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-8" />

      {/* Display toggles */}
      <Button
        variant={config.showDependencies ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8"
        onClick={() => onConfigChange({ ...config, showDependencies: !config.showDependencies })}
      >
        <Link2 className="h-4 w-4 mr-1" />
        Dependencies
      </Button>

      <Button
        variant={config.showMilestones ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8"
        onClick={() => onConfigChange({ ...config, showMilestones: !config.showMilestones })}
      >
        <Flag className="h-4 w-4 mr-1" />
        Milestones
      </Button>

      <div className="flex-1" />

      {/* Baselines */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <History className="h-4 w-4 mr-1" />
            Baselines
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsBaselineDialogOpen(true)}>
            <Save className="h-4 w-4 mr-2" />
            Save Current as Baseline
          </DropdownMenuItem>
          {baselines.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {baselines.map((baseline) => (
                <DropdownMenuItem key={baseline.id} className="flex justify-between">
                  <span className="truncate">{baseline.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBaseline(baseline.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Download className="h-4 w-4 mr-1" />
            Export
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportImage}>
            <Image className="h-4 w-4 mr-2" />
            Export as Image
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportCalendar}>
            <CalendarDays className="h-4 w-4 mr-2" />
            Export to Calendar (.ics)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Baseline Dialog */}
      <Dialog open={isBaselineDialogOpen} onOpenChange={setIsBaselineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Baseline</DialogTitle>
            <DialogDescription>
              Create a snapshot of the current schedule for future comparison.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Baseline Name</Label>
              <Input
                value={baselineName}
                onChange={(e) => setBaselineName(e.target.value)}
                placeholder="e.g., Initial Plan, Phase 1 Approved"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={baselineDescription}
                onChange={(e) => setBaselineDescription(e.target.value)}
                placeholder="Notes about this baseline..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBaselineDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBaseline} disabled={isSavingBaseline}>
              {isSavingBaseline ? 'Saving...' : 'Save Baseline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
