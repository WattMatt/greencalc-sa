import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Folder, Calendar, ChevronDown, FileUp, FileText, 
  Download, MoreVertical, Plus, FolderOpen, Settings2,
  Check, X, FolderPlus, Pencil, Trash2, Move
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Layout {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
  folder_id: string | null;
}

interface LayoutFolder {
  id: string;
  name: string;
  color: string;
  sort_order: number;
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
  const [folders, setFolders] = useState<LayoutFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fileActionsOpen, setFileActionsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<Set<string>>(new Set());
  
  // Folder management state
  const [isManageFoldersMode, setIsManageFoldersMode] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Rename folder state
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  
  // Delete folder state
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  
  // Move layouts dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('uncategorized');
  
  // Layout rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameLayoutId, setRenameLayoutId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Layout delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLayoutId, setDeleteLayoutId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [layoutsRes, foldersRes] = await Promise.all([
        supabase
          .from('pv_layouts')
          .select('id, name, updated_at, created_at, folder_id')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('pv_layout_folders')
          .select('id, name, color, sort_order')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
      ]);

      if (layoutsRes.error) throw layoutsRes.error;
      if (foldersRes.error) throw foldersRes.error;
      
      setLayouts(layoutsRes.data || []);
      setFolders(foldersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load layouts');
    } finally {
      setIsLoading(false);
    }
  };

  // Folder CRUD operations
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const { error } = await supabase
        .from('pv_layout_folders')
        .insert({
          project_id: projectId,
          name: newFolderName.trim(),
          sort_order: folders.length
        });
      
      if (error) throw error;
      await fetchData();
      toast.success('Folder created');
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleRenameFolder = async () => {
    if (!renameFolderId || !renameFolderValue.trim()) return;
    try {
      const { error } = await supabase
        .from('pv_layout_folders')
        .update({ name: renameFolderValue.trim() })
        .eq('id', renameFolderId);
      
      if (error) throw error;
      await fetchData();
      toast.success('Folder renamed');
      setRenameFolderDialogOpen(false);
      setRenameFolderId(null);
      setRenameFolderValue('');
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;
    try {
      // First, move all layouts in this folder to uncategorized
      await supabase
        .from('pv_layouts')
        .update({ folder_id: null })
        .eq('folder_id', deleteFolderId);
      
      // Then delete the folder
      const { error } = await supabase
        .from('pv_layout_folders')
        .delete()
        .eq('id', deleteFolderId);
      
      if (error) throw error;
      await fetchData();
      toast.success('Folder deleted');
      setDeleteFolderDialogOpen(false);
      setDeleteFolderId(null);
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  // Move layouts to folder
  const handleMoveLayouts = async () => {
    if (selectedLayoutIds.size === 0) return;
    try {
      const targetId = moveTargetFolderId === 'uncategorized' ? null : moveTargetFolderId;
      const { error } = await supabase
        .from('pv_layouts')
        .update({ folder_id: targetId })
        .in('id', Array.from(selectedLayoutIds));
      
      if (error) throw error;
      await fetchData();
      toast.success(`Moved ${selectedLayoutIds.size} layout(s)`);
      setMoveDialogOpen(false);
      setSelectedLayoutIds(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('Error moving layouts:', error);
      toast.error('Failed to move layouts');
    }
  };

  // Layout operations
  const handleRenameClick = (layout: Layout) => {
    setRenameLayoutId(layout.id);
    setRenameValue(layout.name);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameLayoutId || !renameValue.trim()) return;
    try {
      await onRenameLayout(renameLayoutId, renameValue.trim());
      await fetchData();
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
      await fetchData();
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
      await fetchData();
      toast.success('Layout duplicated');
    } catch (error) {
      toast.error('Failed to duplicate layout');
    }
  };

  const toggleLayoutSelection = (layoutId: string) => {
    const newSelection = new Set(selectedLayoutIds);
    if (newSelection.has(layoutId)) {
      newSelection.delete(layoutId);
    } else {
      newSelection.add(layoutId);
    }
    setSelectedLayoutIds(newSelection);
  };

  const exitMultiSelectMode = () => {
    setIsMultiSelectMode(false);
    setSelectedLayoutIds(new Set());
  };

  // Group layouts by folder
  const uncategorizedLayouts = layouts.filter(l => !l.folder_id);
  const folderLayouts = folders.map(folder => ({
    folder,
    layouts: layouts.filter(l => l.folder_id === folder.id)
  }));

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
            {isMultiSelectMode ? (
              <>
                <Button variant="outline" size="sm" onClick={exitMultiSelectMode}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={selectedLayoutIds.size === 0}
                  onClick={() => setMoveDialogOpen(true)}
                >
                  <Move className="h-4 w-4 mr-1" />
                  Move ({selectedLayoutIds.size})
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsMultiSelectMode(true)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Select Multiple
                </Button>
                <Button 
                  variant={isManageFoldersMode ? "secondary" : "outline"} 
                  size="sm"
                  onClick={() => setIsManageFoldersMode(!isManageFoldersMode)}
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Manage Folders
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setNewFolderDialogOpen(true)}
                >
                  <FolderPlus className="h-4 w-4 mr-1" />
                  New Folder
                </Button>
                <Button size="sm" onClick={onNewDesign}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Design
                </Button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={['uncategorized', ...folders.map(f => f.id)]}>
            {/* Custom folders */}
            {folderLayouts.map(({ folder, layouts: folderLayoutList }) => (
              <AccordionItem key={folder.id} value={folder.id} className="border rounded-lg mb-2">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-2 flex-1">
                    <Folder className="h-4 w-4" style={{ color: folder.color }} />
                    <span>{folder.name} ({folderLayoutList.length} {folderLayoutList.length === 1 ? 'design' : 'designs'})</span>
                    {isManageFoldersMode && (
                      <div className="ml-auto flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setRenameFolderId(folder.id);
                            setRenameFolderValue(folder.name);
                            setRenameFolderDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteFolderId(folder.id);
                            setDeleteFolderDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {folderLayoutList.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No designs in this folder
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {folderLayoutList.map((layout) => (
                        <DesignCard
                          key={layout.id}
                          layout={layout}
                          isMultiSelectMode={isMultiSelectMode}
                          isSelected={selectedLayoutIds.has(layout.id)}
                          onClick={() => isMultiSelectMode ? toggleLayoutSelection(layout.id) : onSelectLayout(layout.id)}
                          onRename={() => handleRenameClick(layout)}
                          onDuplicate={() => handleDuplicate(layout)}
                          onDelete={() => handleDeleteClick(layout.id)}
                        />
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}

            {/* Uncategorized folder */}
            <AccordionItem value="uncategorized" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-primary" />
                  <span>Uncategorized ({uncategorizedLayouts.length} {uncategorizedLayouts.length === 1 ? 'design' : 'designs'})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {uncategorizedLayouts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No designs yet</p>
                    <Button className="mt-4" onClick={onNewDesign}>
                      <Plus className="h-4 w-4 mr-1" />
                      Create your first design
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uncategorizedLayouts.map((layout) => (
                      <DesignCard
                        key={layout.id}
                        layout={layout}
                        isMultiSelectMode={isMultiSelectMode}
                        isSelected={selectedLayoutIds.has(layout.id)}
                        onClick={() => isMultiSelectMode ? toggleLayoutSelection(layout.id) : onSelectLayout(layout.id)}
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

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              id="folderName"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g., Rooftop Options"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="renameFolderName">Folder Name</Label>
            <Input
              id="renameFolderName"
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameFolder}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this folder? All designs inside will be moved to Uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Layouts Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Layouts</DialogTitle>
            <DialogDescription>
              Move {selectedLayoutIds.size} selected layout(s) to a folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Target Folder</Label>
            <Select value={moveTargetFolderId} onValueChange={setMoveTargetFolderId}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMoveLayouts}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Layout Dialog */}
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

      {/* Delete Layout Dialog */}
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
  isMultiSelectMode: boolean;
  isSelected: boolean;
  onClick: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function DesignCard({ layout, isMultiSelectMode, isSelected, onClick, onRename, onDuplicate, onDelete }: DesignCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer bg-background group ${
        isSelected ? 'border-primary bg-primary/5' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isMultiSelectMode && (
            <Checkbox 
              checked={isSelected} 
              onCheckedChange={() => onClick()}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Folder className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium truncate">{layout.name}</span>
        </div>
        {!isMultiSelectMode && (
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
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
        <Calendar className="h-4 w-4" />
        <span>{format(new Date(layout.updated_at), 'yyyy/MM/dd')}</span>
      </div>
    </div>
  );
}
