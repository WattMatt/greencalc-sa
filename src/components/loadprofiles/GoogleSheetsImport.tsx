import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Loader2, Search, Download, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface ExtractedProfile {
  name: string;
  category: string;
  description?: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
  load_profile_weekend: number[];
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
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

  const extractSheetId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleAnalyze = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast.error("Invalid Google Sheets URL");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setExtractedProfiles([]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-import-loadprofiles", {
        body: { sheetId, action: "analyze" },
      });

      if (error) throw error;
      setAnalysis(data.analysis);
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
      
      setExtractedProfiles(data.profiles || []);
      setNewCategories(data.new_categories || []);
      setConfidenceScore(data.confidence_score);
      toast.success(`Extracted ${data.profiles_count} load profiles`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to extract profiles");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (extractedProfiles.length === 0) return;

    setIsSaving(true);

    try {
      // Create any new categories first
      const categoryMap: Record<string, string> = {};
      categories.forEach(c => { categoryMap[c.name.toLowerCase()] = c.id; });

      for (const catName of newCategories) {
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
      const profilesToInsert = extractedProfiles.map(p => ({
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
      setNewCategories([]);
      setAnalysis(null);
      setConfidenceScore(null);
      setSheetUrl("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profiles");
    } finally {
      setIsSaving(false);
    }
  };

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

        {extractedProfiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={confidenceScore && confidenceScore >= 80 ? "default" : "secondary"}>
                  {confidenceScore}% Confidence
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {extractedProfiles.length} profiles extracted
                </span>
              </div>
              {newCategories.length > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">
                    {newCategories.length} new categories will be created
                  </span>
                </div>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">kWh/m²/mo</TableHead>
                    <TableHead>Load Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedProfiles.map((profile, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell>
                        <Badge variant={newCategories.includes(profile.category) ? "outline" : "secondary"}>
                          {profile.category}
                          {newCategories.includes(profile.category) && " (new)"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{profile.kwh_per_sqm_month}</TableCell>
                      <TableCell>
                        <div className="flex items-end gap-[1px] h-6 w-24">
                          {profile.load_profile_weekday.map((val, i) => {
                            const max = Math.max(...profile.load_profile_weekday);
                            return (
                              <div
                                key={i}
                                className="flex-1 bg-primary/60 rounded-sm"
                                style={{ height: `${(val / max) * 100}%` }}
                              />
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save {extractedProfiles.length} Profiles
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
