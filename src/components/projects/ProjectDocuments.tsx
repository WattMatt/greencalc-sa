import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Folder, ChevronDown, FileUp, Download, MoreVertical,
  Plus, FolderOpen, Settings2, Check, X, FolderPlus,
  Pencil, Trash2, Move, FileText, File, Image, FileSpreadsheet,
  FileArchive, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DocumentItem {
  id: string;
  name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentFolder {
  id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
}

interface ProjectDocumentsProps {
  projectId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed'))
    return <FileArchive className="h-4 w-4 text-amber-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function ProjectDocuments({ projectId }: ProjectDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Folder management
  const [isManageFoldersMode, setIsManageFoldersMode] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename folder
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');

  // Delete folder
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  // Move dialog (batch)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('uncategorized');

  // Rename document
  const [renameDocDialogOpen, setRenameDocDialogOpen] = useState(false);
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [renameDocValue, setRenameDocValue] = useState('');

  // Delete document
  const [deleteDocDialogOpen, setDeleteDocDialogOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  // Drag and drop
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Collapsible state for folders
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['uncategorized']));

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [docsRes, foldersRes] = await Promise.all([
        supabase
          .from('project_documents')
          .select('id, name, file_path, file_size, mime_type, folder_id, created_at, updated_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_document_folders')
          .select('id, name, color, sort_order')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
      ]);
      if (docsRes.error) throw docsRes.error;
      if (foldersRes.error) throw foldersRes.error;
      setDocuments(docsRes.data || []);
      setFolders(foldersRes.data || []);
      // Auto-open all folders
      const ids = new Set(['uncategorized', ...(foldersRes.data || []).map(f => f.id)]);
      setOpenFolders(ids);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Upload ----
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        // 1. Insert metadata row
        const { data: doc, error: insertErr } = await supabase
          .from('project_documents')
          .insert({ project_id: projectId, name: file.name })
          .select('id')
          .single();
        if (insertErr || !doc) throw insertErr;

        // 2. Upload to storage
        const storagePath = `${projectId}/${doc.id}/${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('project-documents')
          .upload(storagePath, file);
        if (uploadErr) throw uploadErr;

        // 3. Update metadata with file info
        await supabase
          .from('project_documents')
          .update({
            file_path: storagePath,
            file_size: file.size,
            mime_type: file.type || null,
          })
          .eq('id', doc.id);
      }
      await fetchData();
      toast.success(`Uploaded ${files.length} file(s)`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---- Download ----
  const handleDownload = async (doc: DocumentItem) => {
    if (!doc.file_path) return;
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  // ---- Folder CRUD ----
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const { error } = await supabase
        .from('project_document_folders')
        .insert({ project_id: projectId, name: newFolderName.trim(), sort_order: folders.length });
      if (error) throw error;
      await fetchData();
      toast.success('Folder created');
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    } catch (error) {
      toast.error('Failed to create folder');
    }
  };

  const handleRenameFolder = async () => {
    if (!renameFolderId || !renameFolderValue.trim()) return;
    try {
      const { error } = await supabase
        .from('project_document_folders')
        .update({ name: renameFolderValue.trim() })
        .eq('id', renameFolderId);
      if (error) throw error;
      await fetchData();
      toast.success('Folder renamed');
      setRenameFolderDialogOpen(false);
    } catch (error) {
      toast.error('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;
    try {
      await supabase
        .from('project_documents')
        .update({ folder_id: null })
        .eq('folder_id', deleteFolderId);
      const { error } = await supabase
        .from('project_document_folders')
        .delete()
        .eq('id', deleteFolderId);
      if (error) throw error;
      await fetchData();
      toast.success('Folder deleted');
      setDeleteFolderDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete folder');
    }
  };

  // ---- Document CRUD ----
  const handleRenameDoc = async () => {
    if (!renameDocId || !renameDocValue.trim()) return;
    try {
      const { error } = await supabase
        .from('project_documents')
        .update({ name: renameDocValue.trim() })
        .eq('id', renameDocId);
      if (error) throw error;
      await fetchData();
      toast.success('Document renamed');
      setRenameDocDialogOpen(false);
    } catch (error) {
      toast.error('Failed to rename document');
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    const doc = documents.find(d => d.id === deleteDocId);
    try {
      // Delete from storage first
      if (doc?.file_path) {
        await supabase.storage.from('project-documents').remove([doc.file_path]);
      }
      const { error } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', deleteDocId);
      if (error) throw error;
      await fetchData();
      toast.success('Document deleted');
      setDeleteDocDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // ---- Move ----
  const handleMoveDocToFolder = async (docId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('project_documents')
        .update({ folder_id: folderId })
        .eq('id', docId);
      if (error) throw error;
      await fetchData();
      toast.success('Document moved');
    } catch (error) {
      toast.error('Failed to move document');
    }
  };

  const handleBatchMove = async () => {
    if (selectedIds.size === 0) return;
    const targetId = moveTargetFolderId === 'uncategorized' ? null : moveTargetFolderId;
    try {
      const { error } = await supabase
        .from('project_documents')
        .update({ folder_id: targetId })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      await fetchData();
      toast.success(`Moved ${selectedIds.size} document(s)`);
      setMoveDialogOpen(false);
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      toast.error('Failed to move documents');
    }
  };

  // ---- Drag & Drop ----
  const handleDragStart = (docId: string) => setDraggedDocId(docId);
  const handleDragEnd = () => { setDraggedDocId(null); setDragOverFolderId(null); };
  const handleDragOver = (e: React.DragEvent, folderId: string | null) => { e.preventDefault(); setDragOverFolderId(folderId); };
  const handleDragLeave = () => setDragOverFolderId(null);
  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    if (!draggedDocId) return;
    await handleMoveDocToFolder(draggedDocId, folderId);
    setDraggedDocId(null);
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleFolder = (id: string) => {
    const next = new Set(openFolders);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenFolders(next);
  };

  // Group documents
  const uncategorized = documents.filter(d => !d.folder_id);
  const folderGroups = folders.map(f => ({
    folder: f,
    docs: documents.filter(d => d.folder_id === f.id),
  }));

  // Render a document row
  const renderDocRow = (doc: DocumentItem) => (
    <div
      key={doc.id}
      className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 group transition-colors ${
        draggedDocId === doc.id ? 'opacity-40' : ''
      }`}
      draggable
      onDragStart={() => handleDragStart(doc.id)}
      onDragEnd={handleDragEnd}
    >
      {isMultiSelectMode && (
        <Checkbox
          checked={selectedIds.has(doc.id)}
          onCheckedChange={() => toggleSelection(doc.id)}
        />
      )}
      {getFileIcon(doc.mime_type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), 'dd MMM yyyy')}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleDownload(doc)}>
            <Download className="h-4 w-4 mr-2" /> Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            setRenameDocId(doc.id);
            setRenameDocValue(doc.name);
            setRenameDocDialogOpen(true);
          }}>
            <Pencil className="h-4 w-4 mr-2" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Move className="h-4 w-4 mr-2" /> Move to Folder
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() => handleMoveDocToFolder(doc.id, null)}
                  disabled={doc.folder_id === null}
                >
                  Uncategorized
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {folders.map(f => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => handleMoveDocToFolder(doc.id, f.id)}
                    disabled={doc.folder_id === f.id}
                  >
                    <span className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: f.color || '#3b82f6' }} />
                    {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => { setDeleteDocId(doc.id); setDeleteDocDialogOpen(true); }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Render a folder section
  const renderFolderSection = (folderId: string, folderName: string, folderColor: string | null, docs: DocumentItem[], folderObj?: DocumentFolder) => {
    const isOpen = openFolders.has(folderId);
    const isDragTarget = dragOverFolderId === folderId;

    return (
      <div
        key={folderId}
        className={`rounded-lg border transition-colors ${isDragTarget ? 'border-primary bg-primary/5' : 'border-border'}`}
        onDragOver={(e) => handleDragOver(e, folderId === 'uncategorized' ? null : folderId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, folderId === 'uncategorized' ? null : folderId)}
      >
        <button
          onClick={() => toggleFolder(folderId)}
          className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-muted/50 rounded-t-lg"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          {folderColor && (
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: folderColor }} />
          )}
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm flex-1">{folderName}</span>
          <Badge variant="secondary" className="text-xs">{docs.length}</Badge>
          {isManageFoldersMode && folderObj && (
            <span className="flex gap-1">
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameFolderId(folderObj.id);
                  setRenameFolderValue(folderObj.name);
                  setRenameFolderDialogOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteFolderId(folderObj.id);
                  setDeleteFolderDialogOpen(true);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </span>
          )}
        </button>
        {isOpen && (
          <div className="px-2 pb-2">
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No documents in this folder</p>
            ) : (
              docs.map(renderDocRow)
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {isMultiSelectMode ? (
          <>
            <Button variant="outline" size="sm" onClick={() => { setIsMultiSelectMode(false); setSelectedIds(new Set()); }}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setMoveDialogOpen(true)}
            >
              <Move className="h-4 w-4 mr-1" /> Move ({selectedIds.size})
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
              Upload Files
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNewFolderDialogOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-1" /> New Folder
            </Button>
            <Button
              variant={isManageFoldersMode ? 'secondary' : 'outline'} size="sm"
              onClick={() => setIsManageFoldersMode(!isManageFoldersMode)}
            >
              <Settings2 className="h-4 w-4 mr-1" /> Manage Folders
            </Button>
            {documents.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => setIsMultiSelectMode(true)}>
                <Check className="h-4 w-4 mr-1" /> Select Multiple
              </Button>
            )}
          </>
        )}
      </div>

      {/* Folder sections */}
      <div className="space-y-3">
        {folderGroups.map(({ folder, docs }) =>
          renderFolderSection(folder.id, folder.name, folder.color, docs, folder)
        )}
        {renderFolderSection('uncategorized', 'Uncategorized', null, uncategorized)}
      </div>

      {documents.length === 0 && folders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload files or create folders to organize your project documents</p>
          </CardContent>
        </Card>
      )}

      {/* --- Dialogs --- */}

      {/* New Folder */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Folder Name</Label>
            <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="e.g. Contracts" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder */}
      <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Folder</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Folder Name</Label>
            <Input value={renameFolderValue} onChange={e => setRenameFolderValue(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleRenameFolder()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameFolder} disabled={!renameFolderValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder */}
      <AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>Documents in this folder will be moved to Uncategorized. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Document */}
      <Dialog open={renameDocDialogOpen} onOpenChange={setRenameDocDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Document</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>File Name</Label>
            <Input value={renameDocValue} onChange={e => setRenameDocValue(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleRenameDoc()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDocDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameDoc} disabled={!renameDocValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document */}
      <AlertDialog open={deleteDocDialogOpen} onOpenChange={setDeleteDocDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this document. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoc} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Move */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedIds.size} Document(s)</DialogTitle>
            <DialogDescription>Choose destination folder</DialogDescription>
          </DialogHeader>
          <Select value={moveTargetFolderId} onValueChange={setMoveTargetFolderId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              {folders.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBatchMove}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
