import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Folder, Calendar, ChevronDown, FileUp, FileText, 
  Download, MoreVertical, Plus, FolderOpen, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Layout {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
}

interface LayoutBrowserProps {
  projectId: string;
  onSelectLayout: (layoutId: string) => void;
  onNewDesign: () => void;
  onLoadPDF: () => void;
  onRenameLayout: (id: string, newName: string) => Promise<void>;
  onDeleteLayout: (id: string) => Promise<void>;
  onDuplicateLayout: (id: string, name: string) => Promise<void>;
}

export function LayoutBrowser({
  projectId,
  onSelectLayout,
  onNewDesign,
  onLoadPDF,
  onRenameLayout,
  onDeleteLayout,
  onDuplicateLayout,
}: LayoutBrowserProps) {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fileActionsOpen, setFileActionsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameLayoutId, setRenameLayoutId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLayoutId, setDeleteLayoutId] = useState<string | null>(null);

  useEffect(() => {
    fetchLayouts();
  }, [projectId]);

  const fetchLayouts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pv_layouts')
        .select('id, name, updated_at, created_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setLayouts(data || []);
    } catch (error) {
      console.error('Error fetching layouts:', error);
      toast.error('Failed to load layouts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameClick = (layout: Layout) => {
    setRenameLayoutId(layout.id);
    setRenameValue(layout.name);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameLayoutId || !renameValue.trim()) return;
    try {
      await onRenameLayout(renameLayoutId, renameValue.trim());
      await fetchLayouts();
      toast.success('Layout renamed');
    } catch (error) {
      toast.error('Failed to rename layout');
    } finally {
      setRenameDialogOpen(false);
      setRenameLayoutId(null);
      setRenameValue('');
    }
  };

  const handleDeleteClick = (layoutId: string) => {
    setDeleteLayoutId(layoutId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteLayoutId) return;
    try {
      await onDeleteLayout(deleteLayoutId);
      await fetchLayouts();
      toast.success('Layout deleted');
    } catch (error) {
      toast.error('Failed to delete layout');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteLayoutId(null);
    }
  };

  const handleDuplicate = async (layout: Layout) => {
    try {
      await onDuplicateLayout(layout.id, `${layout.name} (Copy)`);
      await fetchLayouts();
      toast.success('Layout duplicated');
    } catch (error) {
      toast.error('Failed to duplicate layout');
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] rounded-lg overflow-hidden border bg-background">
      {/* Left Sidebar */}
      <div className="w-64 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg">Floor Plan Markup</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <Collapsible open={fileActionsOpen} onOpenChange={setFileActionsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-md">
              <span>FILE ACTIONS</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${fileActionsOpen ? '' : '-rotate-90'}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={onLoadPDF}
              >
                <FileUp className="h-4 w-4 mr-2" />
                <span className="text-xs">Load PDF File</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => document.getElementById('designs-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="text-xs">My Saved Designs</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                disabled
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="text-xs">Export as PDF</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                disabled
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="text-xs">View Saved Reports</span>
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-md">
              <span>ADVANCED</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? '' : '-rotate-90'}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                disabled
              >
                <Settings2 className="h-4 w-4 mr-2" />
                <span className="text-xs">Settings</span>
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Center Panel */}
      <div className="flex-1 p-6 overflow-y-auto" id="designs-section">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Project<br />Floor Plan<br />Designs
            </h2>
            <p className="text-muted-foreground mt-2">
              Select a design to continue working or start a new one
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" disabled>
              Select Multiple
            </Button>
            <Button variant="outline" size="sm" disabled>
              Manage Folders
            </Button>
            <Button variant="outline" size="sm" disabled>
              <FolderOpen className="h-4 w-4 mr-1" />
              New Folder
            </Button>
            <Button size="sm" onClick={onNewDesign}>
              <Plus className="h-4 w-4 mr-1" />
              New Design
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={['uncategorized']}>
            <AccordionItem value="uncategorized" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-primary" />
                  <span>Uncategorized ({layouts.length} {layouts.length === 1 ? 'design' : 'designs'})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {layouts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No designs yet</p>
                    <Button className="mt-4" onClick={onNewDesign}>
                      <Plus className="h-4 w-4 mr-1" />
                      Create your first design
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {layouts.map((layout) => (
                      <DesignCard
                        key={layout.id}
                        layout={layout}
                        onClick={() => onSelectLayout(layout.id)}
                        onRename={() => handleRenameClick(layout)}
                        onDuplicate={() => handleDuplicate(layout)}
                        onDelete={() => handleDeleteClick(layout.id)}
                      />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      {/* 
        ============================================
        FUTURE EXPANSION: Project Overview Panel
        ============================================
        This panel is reserved for future functionality such as:
        - Project summary stats (name, location, total kWp)
        - Selected layout thumbnail preview on hover
        - Quick project info (coordinates, tariff, tenant area)
        
        Uncomment and implement when ready.
        ============================================
        
        <div className="w-72 bg-card border-l flex flex-col items-center justify-center p-6 text-center">
          <div className="grid grid-cols-2 gap-1 mb-4">
            <div className="w-8 h-8 border rounded flex items-center justify-center">
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="w-8 h-8 border rounded" />
            <div className="w-8 h-8 border rounded" />
            <div className="w-8 h-8 border rounded" />
          </div>
          <h3 className="font-semibold">Project Overview</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Load a PDF and select design purpose to view project details
          </p>
        </div>
      */}

      {/* Rename Dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for this layout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Layout name"
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameConfirm}>Rename</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this layout? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DesignCardProps {
  layout: Layout;
  onClick: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function DesignCard({ layout, onClick, onRename, onDuplicate, onDelete }: DesignCardProps) {
  return (
    <div
      className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer bg-background group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Folder className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium truncate">{layout.name}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
        <Calendar className="h-4 w-4" />
        <span>{format(new Date(layout.updated_at), 'yyyy/MM/dd')}</span>
      </div>
    </div>
  );
}
