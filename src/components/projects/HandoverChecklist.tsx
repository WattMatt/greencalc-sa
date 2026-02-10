import { useState, useEffect, useCallback } from 'react';
import { Check, Link2Off, Plus, Trash2, FileText, GripVertical, File, Image, FileSpreadsheet, FileArchive, Download, Upload, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ---- Types ----

interface ChecklistItem {
  id: string;
  label: string;
  sort_order: number;
  template_id: string | null;
  linked_documents: LinkedDocument[];
}

interface LinkedDocument {
  link_id: string;
  document_id: string;
  name: string;
  file_path: string | null;
}

interface DocumentItem {
  id: string;
  name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface HandoverChecklistProps {
  projectId: string;
  folderDocuments: DocumentItem[];
  onRefresh: () => void;
  onDownload: (doc: { id: string; name: string; file_path: string | null }) => void;
  onUpload: () => void;
}

// ---- Helpers ----

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Component ----

export function HandoverChecklist({
  projectId,
  folderDocuments,
  onRefresh,
  onDownload,
  onUpload,
}: HandoverChecklistProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add requirement
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Delete requirement
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const navigate = useNavigate();

  // Drag state
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // ---- Fetch checklist items with linked docs ----
  const fetchChecklist = useCallback(async () => {
    setIsLoading(true);
    try {
      // Sync templates first
      await syncTemplates();

      // Fetch checklist items
      const { data: items, error: itemsErr } = await supabase
        .from('handover_checklist_items')
        .select('id, label, sort_order, template_id')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      if (itemsErr) throw itemsErr;

      // Fetch all links for this project's items
      const itemIds = (items || []).map(i => i.id);
      let links: Array<{ id: string; checklist_item_id: string; document_id: string }> = [];
      if (itemIds.length > 0) {
        const { data: linksData, error: linksErr } = await supabase
          .from('checklist_document_links')
          .select('id, checklist_item_id, document_id')
          .in('checklist_item_id', itemIds);
        if (linksErr) throw linksErr;
        links = linksData || [];
      }

      // Build enriched items
      const enriched: ChecklistItem[] = (items || []).map(item => {
        const itemLinks = links.filter(l => l.checklist_item_id === item.id);
        const linked_documents: LinkedDocument[] = itemLinks.map(link => {
          const doc = folderDocuments.find(d => d.id === link.document_id);
          return {
            link_id: link.id,
            document_id: link.document_id,
            name: doc?.name || 'Unknown file',
            file_path: doc?.file_path || null,
          };
        });
        return { ...item, linked_documents };
      });

      setChecklistItems(enriched);
    } catch (err) {
      console.error('Error fetching checklist:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, folderDocuments]);

  // ---- Template sync ----
  const syncTemplates = async () => {
    // Find the handover group (by convention, "Solar PV Handover")
    const { data: groups } = await supabase
      .from('checklist_template_groups')
      .select('id')
      .eq('name', 'Solar PV Handover')
      .limit(1);

    const handoverGroupId = groups?.[0]?.id;
    if (!handoverGroupId) return;

    const { data: allTemplates } = await supabase
      .from('checklist_templates')
      .select('id, label, category, sort_order')
      .eq('group_id', handoverGroupId)
      .order('sort_order', { ascending: true });

    const { data: existingItems } = await supabase
      .from('handover_checklist_items')
      .select('template_id')
      .eq('project_id', projectId);

    const existingTemplateIds = new Set((existingItems || []).map(i => i.template_id).filter(Boolean));
    const missing = (allTemplates || []).filter(t => !existingTemplateIds.has(t.id));

    if (missing.length > 0) {
      await supabase.from('handover_checklist_items').insert(
        missing.map(t => ({
          project_id: projectId,
          label: t.label,
          template_id: t.id,
          sort_order: t.sort_order,
        }))
      );
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  // ---- Assign file (create link) ----
  const handleAssignFile = async (checklistItemId: string, documentId: string) => {
    try {
      const { error } = await supabase
        .from('checklist_document_links')
        .insert({ checklist_item_id: checklistItemId, document_id: documentId });
      if (error) {
        if (error.code === '23505') {
          toast.info('File already assigned to this requirement');
          return;
        }
        throw error;
      }
      await fetchChecklist();
      toast.success('File assigned');
    } catch {
      toast.error('Failed to assign file');
    }
  };

  // ---- Unlink file ----
  const handleUnlink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('checklist_document_links')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
      await fetchChecklist();
    } catch {
      toast.error('Failed to unlink file');
    }
  };

  // ---- Add custom requirement ----
  const handleAddRequirement = async () => {
    if (!newLabel.trim()) return;
    try {
      const { error } = await supabase
        .from('handover_checklist_items')
        .insert({
          project_id: projectId,
          label: newLabel.trim(),
          sort_order: checklistItems.length,
        });
      if (error) throw error;
      setNewLabel('');
      setIsAdding(false);
      await fetchChecklist();
      toast.success('Requirement added');
    } catch {
      toast.error('Failed to add requirement');
    }
  };

  // ---- Delete requirement ----
  const handleDeleteRequirement = async () => {
    if (!deleteItemId) return;
    try {
      const { error } = await supabase
        .from('handover_checklist_items')
        .delete()
        .eq('id', deleteItemId);
      if (error) throw error;
      setDeleteItemId(null);
      await fetchChecklist();
      toast.success('Requirement removed');
    } catch {
      toast.error('Failed to remove requirement');
    }
  };


  // ---- Drag & Drop ----
  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    setDragOverItemId(itemId);
  };

  const handleDragLeave = () => setDragOverItemId(null);

  const handleDrop = async (e: React.DragEvent, checklistItemId: string) => {
    e.preventDefault();
    setDragOverItemId(null);
    const documentId = e.dataTransfer.getData('text/plain');
    if (documentId) {
      await handleAssignFile(checklistItemId, documentId);
    }
  };

  const handleFileDragStart = (e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData('text/plain', docId);
    e.dataTransfer.effectAllowed = 'link';
  };

  // ---- Progress ----
  const assigned = checklistItems.filter(item => item.linked_documents.length > 0).length;
  const total = checklistItems.length;
  const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0;

  return (
    <div className="px-2 pb-2">
      {/* Progress bar */}
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {assigned} of {total} requirements fulfilled
            </span>
            <span className="text-xs font-medium">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      </div>

      {/* Split view */}
      <ResizablePanelGroup direction="horizontal" className="min-h-[400px] rounded-lg border">
        {/* Left Panel — Requirements */}
        <ResizablePanel defaultSize={55} minSize={35}>
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requirements</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigate('/settings?tab=templates')}
                >
                  <Settings className="h-3 w-3 mr-1" /> Manage Template
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className={`px-3 py-2 transition-colors ${
                      dragOverItemId === item.id ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, item.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, item.id)}
                  >
                    <div className="flex items-center gap-2">
                      {item.linked_documents.length > 0 ? (
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive/70 hover:text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0"
                        onClick={() => setDeleteItemId(item.id)}
                        title="Remove requirement"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Linked files */}
                    {item.linked_documents.length > 0 && (
                      <div className="ml-7 mt-1 space-y-0.5">
                        {item.linked_documents.map(doc => (
                          <div key={doc.link_id} className="flex items-center gap-1.5 text-xs text-muted-foreground group/file">
                            <FileText className="h-3 w-3 flex-shrink-0" />
                            <button
                              onClick={() => onDownload({ id: doc.document_id, name: doc.name, file_path: doc.file_path })}
                              className="text-primary hover:underline truncate max-w-[180px]"
                            >
                              {doc.name}
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 flex-shrink-0 opacity-0 group-hover/file:opacity-100"
                              onClick={() => handleUnlink(doc.link_id)}
                              title="Unlink"
                            >
                              <Link2Off className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Drop hint when no files */}
                    {item.linked_documents.length === 0 && (
                      <p className="ml-7 mt-0.5 text-[10px] text-muted-foreground/60 italic">
                        Drag files here to assign
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {/* Add requirement */}
              <div className="p-2">
                {isAdding ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      placeholder="e.g. Grid Tie Certificate"
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAddRequirement()}
                    />
                    <Button size="sm" onClick={handleAddRequirement} disabled={!newLabel.trim()} className="h-8">Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewLabel(''); }} className="h-8">Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Requirement
                  </Button>
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel — Files */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Files</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onUpload}>
                <Upload className="h-3 w-3 mr-1" /> Upload
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {folderDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No files uploaded yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Upload files then drag them to requirements</p>
                </div>
              ) : (
                <div className="divide-y">
                  {folderDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => handleFileDragStart(e, doc.id)}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                      {getFileIcon(doc.mime_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), 'dd MMM yyyy')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => onDownload(doc)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Delete requirement dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Requirement</AlertDialogTitle>
            <AlertDialogDescription>This will remove this requirement and unlink all assigned files. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRequirement} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
