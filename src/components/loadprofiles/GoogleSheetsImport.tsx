import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, Loader2, Search, Download, Check, AlertCircle, Filter, Grid3X3, List } from "lucide-react";
import { toast } from "sonner";
import { ProfilePreviewCard } from "./ProfilePreviewCard";
import { CategoryMapper } from "./CategoryMapper";

interface Category {
  id: string;
  name: string;
}

interface TradingHours {
  open: number;
  close: number;
}

interface ExtractedProfile {
  name: string;
  category: string;
  description?: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
  trading_hours?: TradingHours;
  confidence?: number;
  source_tab?: string;
  warnings?: string[];
}

interface FormatDetection {
  layout: string;
  hourFormat: string;
  unitType: string;
  unitPeriod: string;
  hasWeekendData: boolean;
  hasSeasonalData: boolean;
}

interface GoogleSheetsImportProps {
  categories: Category[];
}

export function GoogleSheetsImport({ categories }: GoogleSheetsImportProps) {
  const queryClient = useQueryClient();
  const [sheetUrl, setSheetUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [extractedProfiles, setExtractedProfiles] = useState<ExtractedProfile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<number>>(new Set());
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [extractionNotes, setExtractionNotes] = useState<string | null>(null);
  const [formatDetection, setFormatDetection] = useState<FormatDetection | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);

  const extractSheetId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Filter and sort profiles
  const filteredProfiles = useMemo(() => {
    let result = extractedProfiles;
    
    if (filterCategory) {
      result = result.filter(p => p.category === filterCategory);
    }
    
    if (showWarningsOnly) {
      result = result.filter(p => p.warnings && p.warnings.length > 0);
    }
    
    // Sort by confidence (low first so user reviews them)
    return result.sort((a, b) => (a.confidence || 70) - (b.confidence || 70));
  }, [extractedProfiles, filterCategory, showWarningsOnly]);

  // Get unique categories from extracted profiles
  const extractedCategories = useMemo(() => {
    return [...new Set(extractedProfiles.map(p => p.category))];
  }, [extractedProfiles]);

  const handleAnalyze = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast.error("Invalid Google Sheets URL");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setExtractedProfiles([]);
    setSelectedProfileIds(new Set());
    setFormatDetection(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-import-loadprofiles", {
        body: { sheetId, action: "analyze" },
      });

      if (error) throw error;
      setAnalysis(data.analysis);
      if (data.formatDetection) {
        setFormatDetection(data.formatDetection);
      }
      toast.success("Sheet analyzed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze sheet");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExtract = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) return;

    setIsExtracting(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-import-loadprofiles", {
        body: { 
          sheetId, 
          action: "extract",
          existingCategories: categories.map(c => c.name)
        },
      });

      if (error) throw error;
      
      const profiles = data.profiles || [];
      setExtractedProfiles(profiles);
      // Select all profiles by default
      setSelectedProfileIds(new Set(profiles.map((_: ExtractedProfile, i: number) => i)));
      setNewCategories(data.new_categories || []);
      setConfidenceScore(data.confidence_score);
      setExtractionNotes(data.extraction_notes || null);
      if (data.format_detected) {
        setFormatDetection(data.format_detected);
      }
      toast.success(`Extracted ${data.profiles_count} load profiles`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to extract profiles");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleToggleProfile = (index: number) => {
    setSelectedProfileIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedProfileIds.size === extractedProfiles.length) {
      setSelectedProfileIds(new Set());
    } else {
      setSelectedProfileIds(new Set(extractedProfiles.map((_, i) => i)));
    }
  };

  const handleUpdateProfile = (index: number, updates: Partial<ExtractedProfile>) => {
    setExtractedProfiles(prev => prev.map((p, i) => 
      i === index ? { ...p, ...updates } : p
    ));
  };

  const handleBulkUpdateCategory = (fromCategory: string, toCategory: string) => {
    setExtractedProfiles(prev => prev.map(p => 
      p.category === fromCategory ? { ...p, category: toCategory } : p
    ));
    // Remove from newCategories if no longer used
    const stillUsed = extractedProfiles.some(p => p.category === fromCategory && p.category !== toCategory);
    if (!stillUsed && newCategories.includes(fromCategory)) {
      setNewCategories(prev => prev.filter(c => c !== fromCategory));
    }
    // Add to newCategories if not existing
    if (!categories.some(c => c.name === toCategory) && !newCategories.includes(toCategory)) {
      setNewCategories(prev => [...prev, toCategory]);
    }
  };

  const handleAddNewCategory = (name: string) => {
    if (!newCategories.includes(name) && !categories.some(c => c.name === name)) {
      setNewCategories(prev => [...prev, name]);
    }
  };

  const handleSave = async () => {
    const selectedProfiles = extractedProfiles.filter((_, i) => selectedProfileIds.has(i));
    if (selectedProfiles.length === 0) {
      toast.error("Please select at least one profile to save");
      return;
    }

    setIsSaving(true);

    try {
      // Create any new categories first
      const categoryMap: Record<string, string> = {};
      categories.forEach(c => { categoryMap[c.name.toLowerCase()] = c.id; });

      // Get unique new categories from selected profiles
      const usedNewCategories = [...new Set(
        selectedProfiles
          .filter(p => !categoryMap[p.category.toLowerCase()])
          .map(p => p.category)
      )];

      for (const catName of usedNewCategories) {
        if (!categoryMap[catName.toLowerCase()]) {
          const { data, error } = await supabase
            .from("shop_type_categories")
            .insert({ name: catName })
            .select()
            .single();
          
          if (error) throw error;
          categoryMap[catName.toLowerCase()] = data.id;
        }
      }

      // Prepare profiles for insertion
      const profilesToInsert = selectedProfiles.map(p => ({
        name: p.name,
        description: p.description || null,
        kwh_per_sqm_month: p.kwh_per_sqm_month,
        load_profile_weekday: p.load_profile_weekday,
        load_profile_weekend: p.load_profile_weekend,
        category_id: categoryMap[p.category.toLowerCase()] || null
      }));

      const { error } = await supabase.from("shop_types").insert(profilesToInsert);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["shop-types-all"] });
      queryClient.invalidateQueries({ queryKey: ["shop-type-categories"] });
      
      toast.success(`Saved ${profilesToInsert.length} load profiles`);
      
      // Reset state
      setExtractedProfiles([]);
      setSelectedProfileIds(new Set());
      setNewCategories([]);
      setAnalysis(null);
      setConfidenceScore(null);
      setExtractionNotes(null);
      setFormatDetection(null);
      setSheetUrl("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profiles");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = selectedProfileIds.size;
  const warningCount = extractedProfiles.filter(p => p.warnings && p.warnings.length > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import from Google Sheets
        </CardTitle>
        <CardDescription>
          AI-powered import that adapts to your spreadsheet format. Share the sheet with the service account first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Input */}
        <div className="space-y-2">
          <Label>Google Sheets URL</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
            <Button onClick={handleAnalyze} disabled={!sheetUrl || isAnalyzing}>
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analyze
            </Button>
          </div>
        </div>

        {/* Format Detection Display */}
        {formatDetection && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Layout: {formatDetection.layout}</Badge>
            <Badge variant="outline">Hours: {formatDetection.hourFormat}</Badge>
            <Badge variant="outline">Units: {formatDetection.unitType}/{formatDetection.unitPeriod}</Badge>
            {formatDetection.hasWeekendData && <Badge variant="secondary">Weekend data</Badge>}
            {formatDetection.hasSeasonalData && <Badge variant="secondary">Seasonal data</Badge>}
          </div>
        )}

        {/* Analysis Display */}
        {analysis && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[150px]">
                  <p className="text-sm whitespace-pre-wrap">{analysis}</p>
                </ScrollArea>
              </CardContent>
            </Card>

            <Button onClick={handleExtract} disabled={isExtracting} className="w-full">
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting Profiles...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Extract Load Profiles
                </>
              )}
            </Button>
          </div>
        )}

        {/* Extracted Profiles */}
        {extractedProfiles.length > 0 && (
          <div className="space-y-4">
            {/* Header with stats */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={confidenceScore && confidenceScore >= 80 ? "default" : "secondary"}>
                  {confidenceScore}% Confidence
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedCount}/{extractedProfiles.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {warningCount > 0 && (
                  <Button
                    variant={showWarningsOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowWarningsOnly(!showWarningsOnly)}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {warningCount} warnings
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                >
                  {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Extraction notes */}
            {extractionNotes && (
              <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                {extractionNotes}
              </div>
            )}

            {/* Tabs for profiles and category mapping */}
            <Tabs defaultValue="profiles">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profiles">Profiles ({filteredProfiles.length})</TabsTrigger>
                <TabsTrigger value="categories">Categories ({extractedCategories.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profiles" className="space-y-3">
                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedCount === extractedProfiles.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label className="text-xs">Select all</Label>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-auto">
                    <Filter className="h-3 w-3" />
                    <select 
                      className="text-xs border rounded px-2 py-1 bg-background"
                      value={filterCategory || ""}
                      onChange={(e) => setFilterCategory(e.target.value || null)}
                    >
                      <option value="">All categories</option>
                      {extractedCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Profile cards */}
                <ScrollArea className="h-[400px]">
                  <div className={viewMode === "grid" 
                    ? "grid grid-cols-1 md:grid-cols-2 gap-3 pr-4" 
                    : "space-y-2 pr-4"
                  }>
                    {filteredProfiles.map((profile, idx) => {
                      const originalIndex = extractedProfiles.indexOf(profile);
                      return (
                        <ProfilePreviewCard
                          key={originalIndex}
                          profile={profile}
                          isSelected={selectedProfileIds.has(originalIndex)}
                          isNewCategory={newCategories.includes(profile.category)}
                          onToggleSelect={() => handleToggleProfile(originalIndex)}
                          onUpdateProfile={(updates) => handleUpdateProfile(originalIndex, updates)}
                          availableCategories={[...categories.map(c => c.name), ...newCategories]}
                        />
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="categories">
                <CategoryMapper
                  profiles={extractedProfiles}
                  existingCategories={categories}
                  newCategories={newCategories}
                  onUpdateCategory={(idx, cat) => handleUpdateProfile(idx, { category: cat })}
                  onBulkUpdateCategory={handleBulkUpdateCategory}
                  onAddNewCategory={handleAddNewCategory}
                />
              </TabsContent>
            </Tabs>

            {/* Save button */}
            <Button 
              onClick={handleSave} 
              disabled={isSaving || selectedCount === 0} 
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save {selectedCount} Profile{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
