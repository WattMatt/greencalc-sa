import { useState, useEffect } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TemplateItem {
  id: string;
  label: string;
  category: string;
  sort_order: number;
}

export function ChecklistTemplatesCard() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('checklist_templates')
      .select('id, label, category, sort_order')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Error fetching templates:', error);
    }
    setTemplates(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    try {
      const { error } = await supabase
        .from('checklist_templates')
        .insert({
          label: newLabel.trim(),
          category: 'Solar PV',
          sort_order: templates.length,
        });
      if (error) throw error;
      setNewLabel('');
      await fetchTemplates();
      toast.success('Template item added — will sync to all projects on next visit');
    } catch {
      toast.error('Failed to add template item');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchTemplates();
      toast.success('Template item removed');
    } catch {
      toast.error('Failed to remove template item');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <FileText className="h-5 w-5" />
          Handover Checklist Template
        </CardTitle>
        <CardDescription>
          Manage the global list of required handover documents. Changes automatically sync to all projects when they are opened.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new item */}
        <div className="flex items-center gap-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Add a new requirement, e.g. Grid Tie Certificate"
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={!newLabel.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Template table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Requirement Label</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No template items yet. Add one above.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t, index) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.category}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
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
          <strong>Note:</strong> Removing a template item here does not delete existing requirements already added to projects.
          New items will automatically appear in every project's handover checklist the next time it is opened.
        </p>
      </CardContent>
    </Card>
  );
}
