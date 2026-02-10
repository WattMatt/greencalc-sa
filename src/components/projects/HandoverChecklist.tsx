import { useState } from 'react';
import { Check, Download, Link2, Link2Off, Plus, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  label: string;
  sort_order: number;
  document_id: string | null;
}

interface DocumentItem {
  id: string;
  name: string;
  file_path: string | null;
}

interface HandoverChecklistProps {
  projectId: string;
  checklistItems: ChecklistItem[];
  folderDocuments: DocumentItem[];
  onRefresh: () => void;
  onDownload: (doc: DocumentItem) => void;
}

export function HandoverChecklist({
  projectId,
  checklistItems,
  folderDocuments,
  onRefresh,
  onDownload,
}: HandoverChecklistProps) {
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const assigned = checklistItems.filter(item => item.document_id !== null).length;
  const total = checklistItems.length;
  const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0;

  const handleAssign = async (itemId: string, documentId: string | null) => {
    try {
      const { error } = await supabase
        .from('handover_checklist_items')
        .update({ document_id: documentId })
        .eq('id', itemId);
      if (error) throw error;
      onRefresh();
    } catch {
      toast.error('Failed to update assignment');
    }
  };

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
      onRefresh();
      toast.success('Requirement added');
    } catch {
      toast.error('Failed to add requirement');
    }
  };

  const handleDeleteRequirement = async () => {
    if (!deleteItemId) return;
    try {
      const { error } = await supabase
        .from('handover_checklist_items')
        .delete()
        .eq('id', deleteItemId);
      if (error) throw error;
      setDeleteItemId(null);
      onRefresh();
      toast.success('Requirement removed');
    } catch {
      toast.error('Failed to remove requirement');
    }
  };

  const getDocName = (docId: string | null) => {
    if (!docId) return null;
    return folderDocuments.find(d => d.id === docId);
  };

  return (
    <div className="space-y-3 px-2 pb-2">
      {/* Status summary */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {assigned} of {total} documents provided
            </span>
            <span className="text-xs font-medium">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      </div>

      {/* Checklist table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Required Document</TableHead>
            <TableHead>Assigned File</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checklistItems.map((item) => {
            const assignedDoc = getDocName(item.document_id);
            return (
              <TableRow key={item.id}>
                <TableCell className="p-2">
                  {assignedDoc ? (
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-muted-foreground/30" />
                  )}
                </TableCell>
                <TableCell className="text-sm font-medium">{item.label}</TableCell>
                <TableCell>
                  {assignedDoc ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <button
                        onClick={() => onDownload(assignedDoc)}
                        className="text-sm text-primary hover:underline truncate max-w-[200px]"
                      >
                        {assignedDoc.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => handleAssign(item.id, null)}
                        title="Unassign"
                      >
                        <Link2Off className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value=""
                      onValueChange={(docId) => handleAssign(item.id, docId)}
                    >
                      <SelectTrigger className="h-8 text-xs w-[200px]">
                        <SelectValue placeholder="Assign file..." />
                      </SelectTrigger>
                      <SelectContent>
                        {folderDocuments.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No files uploaded yet
                          </SelectItem>
                        ) : (
                          folderDocuments.map(doc => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="p-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive/70 hover:text-destructive"
                    onClick={() => setDeleteItemId(item.id)}
                    title="Remove requirement"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Add requirement */}
      {isAdding ? (
        <div className="flex items-center gap-2 px-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="e.g. Grid Tie Certificate"
            className="h-8 text-sm"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAddRequirement()}
          />
          <Button size="sm" variant="default" onClick={handleAddRequirement} disabled={!newLabel.trim()} className="h-8">
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewLabel(''); }} className="h-8">
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="ml-2">
          <Plus className="h-4 w-4 mr-1" /> Add Requirement
        </Button>
      )}

      {/* Delete requirement dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Requirement</AlertDialogTitle>
            <AlertDialogDescription>This will remove this requirement from the checklist. This cannot be undone.</AlertDialogDescription>
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
