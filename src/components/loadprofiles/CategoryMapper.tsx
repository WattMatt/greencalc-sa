import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderTree, Plus, ArrowRight, Check } from "lucide-react";

interface ExtractedProfile {
  name: string;
  category: string;
  description?: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
}

interface CategoryMapperProps {
  profiles: ExtractedProfile[];
  existingCategories: { id: string; name: string }[];
  newCategories: string[];
  onUpdateCategory: (profileIndex: number, newCategory: string) => void;
  onBulkUpdateCategory: (fromCategory: string, toCategory: string) => void;
  onAddNewCategory: (name: string) => void;
}

export function CategoryMapper({
  profiles,
  existingCategories,
  newCategories,
  onUpdateCategory,
  onBulkUpdateCategory,
  onAddNewCategory
}: CategoryMapperProps) {
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [bulkFrom, setBulkFrom] = useState<string>("");
  const [bulkTo, setBulkTo] = useState<string>("");

  // Get unique categories from profiles
  const profileCategories = [...new Set(profiles.map(p => p.category))];
  
  // Combine all available categories
  const allCategories = [
    ...existingCategories.map(c => c.name),
    ...newCategories
  ];

  // Group profiles by category
  const categoryGroups = profileCategories.reduce((acc, cat) => {
    acc[cat] = profiles.filter(p => p.category === cat);
    return acc;
  }, {} as Record<string, ExtractedProfile[]>);

  const handleAddCategory = () => {
    if (newCategoryInput.trim() && !allCategories.includes(newCategoryInput.trim())) {
      onAddNewCategory(newCategoryInput.trim());
      setNewCategoryInput("");
    }
  };

  const handleBulkRemap = () => {
    if (bulkFrom && bulkTo && bulkFrom !== bulkTo) {
      onBulkUpdateCategory(bulkFrom, bulkTo);
      setBulkFrom("");
      setBulkTo("");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FolderTree className="h-4 w-4" />
          Category Mapping
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category summary */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Categories in extraction</Label>
          <div className="flex flex-wrap gap-1">
            {profileCategories.map(cat => {
              const isNew = newCategories.includes(cat);
              const count = categoryGroups[cat]?.length || 0;
              return (
                <Badge 
                  key={cat} 
                  variant={isNew ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {cat} ({count})
                  {isNew && <span className="ml-1 text-amber-500">new</span>}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Bulk remap */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <Label className="text-xs">Bulk Category Remap</Label>
          <div className="flex items-center gap-2">
            <Select value={bulkFrom} onValueChange={setBulkFrom}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="From category" />
              </SelectTrigger>
              <SelectContent>
                {profileCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            
            <Select value={bulkTo} onValueChange={setBulkTo}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="To category" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              size="sm" 
              className="h-8"
              onClick={handleBulkRemap}
              disabled={!bulkFrom || !bulkTo || bulkFrom === bulkTo}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Add new category */}
        <div className="space-y-2">
          <Label className="text-xs">Add New Category</Label>
          <div className="flex items-center gap-2">
            <Input
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              placeholder="Category name"
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8"
              onClick={handleAddCategory}
              disabled={!newCategoryInput.trim()}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Existing categories reference */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Available Categories</Label>
          <div className="flex flex-wrap gap-1">
            {existingCategories.map(cat => (
              <Badge key={cat.id} variant="secondary" className="text-xs">
                {cat.name}
              </Badge>
            ))}
            {newCategories.map(cat => (
              <Badge key={cat} variant="outline" className="text-xs text-amber-600">
                {cat} (will be created)
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
