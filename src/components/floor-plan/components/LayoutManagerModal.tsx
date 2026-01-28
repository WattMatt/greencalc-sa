import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Loader2, FileText, Check, Pencil, Copy, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface LayoutMetadata {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface LayoutManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentLayoutId: string | null;
  hasUnsavedChanges: boolean;
  onLoadLayout: (layoutId: string) => Promise<void>;
  onCreateLayout: (name: string, copyFromId?: string) => Promise<void>;
  onRenameLayout: (id: string, newName: string) => Promise<void>;
  onDeleteLayout: (id: string) => Promise<void>;
}

export function LayoutManagerModal({
  isOpen,
  onClose,
  projectId,
  currentLayoutId,
  hasUnsavedChanges,
  onLoadLayout,
  onCreateLayout,
  onRenameLayout,
  onDeleteLayout,
}: LayoutManagerModalProps) {
  const [layouts, setLayouts] = useState<LayoutMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New layout dialog state
  const [isNewLayoutDialogOpen, setIsNewLayoutDialogOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newLayoutSource, setNewLayoutSource] = useState<'blank' | 'copy'>('copy');
  const [isCreating, setIsCreating] = useState(false);
  
  // Rename dialog state
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameLayoutId, setRenameLayoutId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteLayoutId, setDeleteLayoutId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Unsaved changes warning state
  const [pendingLoadId, setPendingLoadId] = useState<string | null>(null);
  const [isUnsavedWarningOpen, setIsUnsavedWarningOpen] = useState(false);

  // Fetch layouts when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLayouts();
    }
  }, [isOpen, projectId]);

  const fetchLayouts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pv_layouts')
        .select('id, name, created_at, updated_at')
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

  const filteredLayouts = layouts.filter(layout =>
    layout.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLoadLayout = async (layoutId: string) => {
    if (layoutId === currentLayoutId) return;
    
    if (hasUnsavedChanges) {
      setPendingLoadId(layoutId);
      setIsUnsavedWarningOpen(true);
      return;
    }
    
    await performLoad(layoutId);
  };

  const performLoad = async (layoutId: string) => {
    try {
      await onLoadLayout(layoutId);
      onClose();
      toast.success('Layout loaded');
    } catch (error) {
      console.error('Error loading layout:', error);
      toast.error('Failed to load layout');
    }
  };

  const handleCreateLayout = async () => {
    if (!newLayoutName.trim()) {
      toast.error('Please enter a layout name');
      return;
    }

    setIsCreating(true);
    try {
      const copyFromId = newLayoutSource === 'copy' ? currentLayoutId || undefined : undefined;
      await onCreateLayout(newLayoutName.trim(), copyFromId);
      setIsNewLayoutDialogOpen(false);
      setNewLayoutName('');
      await fetchLayouts();
      onClose();
      toast.success('Layout created');
    } catch (error) {
      console.error('Error creating layout:', error);
      toast.error('Failed to create layout');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameLayout = async () => {
    if (!renameLayoutId || !renameValue.trim()) return;

    setIsRenaming(true);
    try {
      await onRenameLayout(renameLayoutId, renameValue.trim());
      setIsRenameDialogOpen(false);
      setRenameLayoutId(null);
      setRenameValue('');
      await fetchLayouts();
      toast.success('Layout renamed');
    } catch (error) {
      console.error('Error renaming layout:', error);
      toast.error('Failed to rename layout');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDuplicateLayout = async (layout: LayoutMetadata) => {
    try {
      await onCreateLayout(`${layout.name} (Copy)`, layout.id);
      await fetchLayouts();
      toast.success('Layout duplicated');
    } catch (error) {
      console.error('Error duplicating layout:', error);
      toast.error('Failed to duplicate layout');
    }
  };

  const handleDeleteLayout = async () => {
    if (!deleteLayoutId) return;

    setIsDeleting(true);
    try {
      await onDeleteLayout(deleteLayoutId);
      setIsDeleteDialogOpen(false);
      setDeleteLayoutId(null);
      await fetchLayouts();
      toast.success('Layout deleted');
    } catch (error) {
      console.error('Error deleting layout:', error);
      toast.error('Failed to delete layout');
    } finally {
      setIsDeleting(false);
    }
  };

  const openRenameDialog = (layout: LayoutMetadata) => {
    setRenameLayoutId(layout.id);
    setRenameValue(layout.name);
    setIsRenameDialogOpen(true);
  };

  const openDeleteDialog = (layout: LayoutMetadata) => {
    setDeleteLayoutId(layout.id);
    setIsDeleteDialogOpen(true);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Layouts</DialogTitle>
            <DialogDescription>
              Manage your PV layout designs for this project
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4">
            <Button onClick={() => setIsNewLayoutDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Layout
            </Button>
            <Input
              placeholder="Search layouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-muted text-xs font-medium text-muted-foreground">
              <div>Name</div>
              <div>Modified</div>
              <div>Actions</div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLayouts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No layouts match your search' : 'No layouts yet'}
                </div>
              ) : (
                filteredLayouts.map((layout) => (
                  <div
                    key={layout.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 border-t items-center hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate font-medium">
                        {layout.id === currentLayoutId && (
                          <Check className="h-3 w-3 inline mr-1 text-primary" />
                        )}
                        {layout.name}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(layout.updated_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      {layout.id !== currentLayoutId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadLayout(layout.id)}
                        >
                          Load
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border">
                          <DropdownMenuItem onClick={() => openRenameDialog(layout)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateLayout(layout)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => openDeleteDialog(layout)}
                            className="text-destructive focus:text-destructive"
                            disabled={layouts.length === 1}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {layouts.length === 1 && (
            <p className="text-xs text-muted-foreground text-center">
              Cannot delete the only layout. Create another one first.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* New Layout Dialog */}
      <Dialog open={isNewLayoutDialogOpen} onOpenChange={setIsNewLayoutDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Layout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="layout-name">Name</Label>
              <Input
                id="layout-name"
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                placeholder="Enter layout name"
              />
            </div>
            <div className="space-y-2">
              <Label>Start from</Label>
              <RadioGroup value={newLayoutSource} onValueChange={(v) => setNewLayoutSource(v as 'blank' | 'copy')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="blank" id="blank" />
                  <Label htmlFor="blank" className="font-normal cursor-pointer">Blank layout</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="copy" id="copy" disabled={!currentLayoutId} />
                  <Label htmlFor="copy" className={`font-normal cursor-pointer ${!currentLayoutId ? 'text-muted-foreground' : ''}`}>
                    Copy current layout
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewLayoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLayout} disabled={isCreating || !newLayoutName.trim()}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Layout</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameLayout} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The layout and all its data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLayout}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Warning */}
      <AlertDialog open={isUnsavedWarningOpen} onOpenChange={setIsUnsavedWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the current layout. Loading a different layout will discard these changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingLoadId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingLoadId) {
                  performLoad(pendingLoadId);
                  setPendingLoadId(null);
                }
                setIsUnsavedWarningOpen(false);
              }}
            >
              Discard & Load
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
