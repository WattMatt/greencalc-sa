import { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TemplateGroup {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
}

interface TemplateItem {
  id: string;
  label: string;
  category: string;
  sort_order: number;
}

export function ChecklistTemplatesCard() {
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add new group
  const [newGroupName, setNewGroupName] = useState('');

  // Add new item
  const [newLabel, setNewLabel] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'group' | 'item'; id: string; name: string } | null>(null);

  // ---- Fetch groups with item counts ----
  const fetchGroups = async () => {
    setIsLoading(true);
    const { data: groupsData, error: groupsErr } = await supabase
      .from('checklist_template_groups')
      .select('id, name, description')
      .order('created_at', { ascending: true });
    if (groupsErr) {
      console.error('Error fetching groups:', groupsErr);
      setIsLoading(false);
      return;
    }

    // Get item counts per group
    const { data: itemsData } = await supabase
      .from('checklist_templates')
      .select('group_id');

    const counts: Record<string, number> = {};
    (itemsData || []).forEach(item => {
      counts[item.group_id] = (counts[item.group_id] || 0) + 1;
    });

    setGroups((groupsData || []).map(g => ({
      ...g,
      item_count: counts[g.id] || 0,
    })));
    setIsLoading(false);
  };

  // ---- Fetch items for a group ----
  const fetchItems = async (groupId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('checklist_templates')
      .select('id, label, category, sort_order')
      .eq('group_id', groupId)
      .order('sort_order', { ascending: true });
    if (error) console.error('Error fetching items:', error);
    setItems(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) fetchItems(selectedGroupId);
  }, [selectedGroupId]);

  // ---- Create group ----
  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const { error } = await supabase
        .from('checklist_template_groups')
        .insert({ name: newGroupName.trim() });
      if (error) throw error;
      setNewGroupName('');
      await fetchGroups();
      toast.success('Template created');
    } catch {
      toast.error('Failed to create template');
    }
  };

  // ---- Delete group ----
  const handleDeleteGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from('checklist_template_groups')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchGroups();
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  // ---- Add item ----
  const handleAddItem = async () => {
    if (!newLabel.trim() || !selectedGroupId) return;
    try {
      const { error } = await supabase
        .from('checklist_templates')
        .insert({
          label: newLabel.trim(),
          category: 'Solar PV',
          sort_order: items.length,
          group_id: selectedGroupId,
        });
      if (error) throw error;
      setNewLabel('');
      await fetchItems(selectedGroupId);
      toast.success('Item added');
    } catch {
      toast.error('Failed to add item');
    }
  };

  // ---- Delete item ----
  const handleDeleteItem = async (id: string) => {
    if (!selectedGroupId) return;
    try {
      const { error } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchItems(selectedGroupId);
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  // ---- Handle confirmed delete ----
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'group') {
      await handleDeleteGroup(deleteTarget.id);
    } else {
      await handleDeleteItem(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  // ---- Select group ----
  const openGroup = (group: TemplateGroup) => {
    setSelectedGroupId(group.id);
    setSelectedGroupName(group.name);
  };

  const goBack = () => {
    setSelectedGroupId(null);
    setSelectedGroupName('');
    setItems([]);
    fetchGroups();
  };

  // ================ RENDER ================

  // Level 2: Items within a group
  if (selectedGroupId) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <FileText className="h-5 w-5" />
                {selectedGroupName}
              </CardTitle>
              <CardDescription>
                Manage the checklist items for this template. Changes sync to all projects.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new item */}
          <div className="flex items-center gap-2">
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Add a new requirement, e.g. Grid Tie Certificate"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
            />
            <Button onClick={handleAddItem} disabled={!newLabel.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Items table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Requirement Label</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No items yet. Add one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((t, index) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{t.label}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive/70 hover:text-destructive"
                          onClick={() => setDeleteTarget({ type: 'item', id: t.id, name: t.label })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Removing an item here does not delete existing requirements already added to projects.
            New items will automatically appear in projects the next time they are opened.
          </p>

          {/* Delete confirmation */}
          <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove this item from the template. Existing project checklists are not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // Level 1: Group list
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <FileText className="h-5 w-5" />
          Checklist Templates
        </CardTitle>
        <CardDescription>
          Manage reusable checklist templates. Each template contains a set of requirements that sync to projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new group */}
        <div className="flex items-center gap-2">
          <Input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="New template name, e.g. Battery Installation Checklist"
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
          />
          <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Groups table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead className="w-24">Items</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No templates yet. Create one above.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow
                    key={group.id}
                    className="cursor-pointer"
                    onClick={() => openGroup(group)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-muted-foreground">{group.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.item_count} {group.item_count === 1 ? 'item' : 'items'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ type: 'group', id: group.id, name: group.name });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.type === 'group'
                  ? 'This will delete the template and all its items. Existing project checklists are not affected.'
                  : 'This will remove this item from the template. Existing project checklists are not affected.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
