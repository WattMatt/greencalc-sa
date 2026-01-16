import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ProjectFileBrowser } from "./ProjectFileBrowser";
import { 
  Shield, 
  Code2, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  FileCode,
  Bug,
  Zap,
  TrendingUp,
  FolderOpen,
  FileText
} from "lucide-react";

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  lineNumbers?: number[];
  suggestion: string;
}

interface QualityIssue {
  type: 'code-smell' | 'complexity' | 'best-practice' | 'performance';
  title: string;
  description: string;
  lineNumbers?: number[];
  suggestion: string;
}

interface Improvement {
  title: string;
  description: string;
  before?: string;
  after?: string;
}

interface CodeReviewResult {
  summary: string;
  securityIssues: SecurityIssue[];
  qualityIssues: QualityIssue[];
  improvements: Improvement[];
  overallScore: number;
  metrics: {
    securityScore: number;
    qualityScore: number;
    maintainabilityScore: number;
  };
}

type ReviewType = 'security' | 'quality' | 'suggestions' | 'full';
type InputMode = 'files' | 'paste';

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
];

const severityColors: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
};

const issueTypeIcons: Record<string, React.ReactNode> = {
  'code-smell': <Bug className="h-4 w-4" />,
  'complexity': <TrendingUp className="h-4 w-4" />,
  'best-practice': <CheckCircle2 className="h-4 w-4" />,
  'performance': <Zap className="h-4 w-4" />,
};

// Sample code files for demonstration - in production these would come from GitHub
const SAMPLE_CODE_FILES: Record<string, string> = {
  "src/App.tsx": `import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// ... more code`,
  
  "src/hooks/useAuth.tsx": `import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}`,

  "src/integrations/supabase/client.ts": `import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);`,

  "supabase/functions/abacus-code-review/index.ts": `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ABACUS_API_KEY = Deno.env.get("ABACUS_AI_API_KEY");
    if (!ABACUS_API_KEY) {
      throw new Error("ABACUS_AI_API_KEY is not configured");
    }
    // ... more code
  } catch (error) {
    console.error("Code review error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});`,
};

export function CodeReviewPanel() {
  const [inputMode, setInputMode] = useState<InputMode>("files");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [reviewType, setReviewType] = useState<ReviewType>("full");
  const [context, setContext] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [reviewedFiles, setReviewedFiles] = useState<string[]>([]);

  const handleReview = async () => {
    let codeToReview = "";
    let filesToReview: string[] = [];

    if (inputMode === "files") {
      if (selectedFiles.length === 0) {
        toast.error("Please select at least one file to review");
        return;
      }
      
      // Combine selected files into a single code block for review
      const codeBlocks: string[] = [];
      for (const filePath of selectedFiles) {
        const fileContent = SAMPLE_CODE_FILES[filePath];
        if (fileContent) {
          codeBlocks.push(`// ===== ${filePath} =====\n${fileContent}`);
        }
      }
      
      if (codeBlocks.length === 0) {
        toast.error("Could not load selected files. Please try different files.");
        return;
      }
      
      codeToReview = codeBlocks.join("\n\n");
      filesToReview = selectedFiles;
    } else {
      if (!code.trim()) {
        toast.error("Please enter some code to review");
        return;
      }
      codeToReview = code;
    }

    setIsReviewing(true);
    setResult(null);
    setReviewedFiles(filesToReview);

    try {
      const { data, error } = await supabase.functions.invoke('abacus-code-review', {
        body: { 
          code: codeToReview, 
          language, 
          reviewType, 
          context: inputMode === "files" 
            ? `Reviewing ${selectedFiles.length} files: ${selectedFiles.join(", ")}. ${context}` 
            : context 
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success(`Code review completed for ${inputMode === "files" ? `${selectedFiles.length} files` : "pasted code"}!`);
    } catch (error) {
      console.error("Code review failed:", error);
      toast.error("Failed to perform code review. Please try again.");
    } finally {
      setIsReviewing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-destructive";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            AI Code Review (Abacus.AI)
          </CardTitle>
          <CardDescription>
            Select files from the codebase or paste code for comprehensive security, quality, and improvement analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Mode Toggle */}
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Select Project Files
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Paste Code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="mt-4">
              <ProjectFileBrowser 
                selectedFiles={selectedFiles}
                onSelectionChange={setSelectedFiles}
              />
            </TabsContent>

            <TabsContent value="paste" className="mt-4">
              <Textarea
                placeholder="Paste your code here for review..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
              />
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={reviewType} onValueChange={(v) => setReviewType(v as ReviewType)}>
              <SelectTrigger>
                <SelectValue placeholder="Review type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Review</SelectItem>
                <SelectItem value="security">Security Only</SelectItem>
                <SelectItem value="quality">Quality Only</SelectItem>
                <SelectItem value="suggestions">Suggestions Only</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={handleReview} 
              disabled={isReviewing || (inputMode === "files" ? selectedFiles.length === 0 : !code.trim())}
            >
              {isReviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing{inputMode === "files" ? ` ${selectedFiles.length} files...` : "..."}
                </>
              ) : (
                <>
                  <FileCode className="mr-2 h-4 w-4" />
                  Review {inputMode === "files" ? `${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}` : "Code"}
                </>
              )}
            </Button>
          </div>

          <Textarea
            placeholder="Optional: Add context about the code (e.g., 'This is a user authentication handler')"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="text-sm"
            rows={2}
          />
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Review Results
                {getScoreIcon(result.overallScore)}
              </span>
              <span className={`text-2xl font-bold ${getScoreColor(result.overallScore)}`}>
                {result.overallScore}/100
              </span>
            </CardTitle>
            <CardDescription>
              {reviewedFiles.length > 0 && (
                <div className="mb-2">
                  <span className="font-medium">Reviewed files: </span>
                  {reviewedFiles.map((f, i) => (
                    <Badge key={f} variant="outline" className="mr-1 text-xs">
                      {f.split('/').pop()}
                    </Badge>
                  ))}
                </div>
              )}
              {result.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Shield className="h-4 w-4" /> Security
                  </span>
                  <span className={getScoreColor(result.metrics.securityScore)}>
                    {result.metrics.securityScore}%
                  </span>
                </div>
                <Progress value={result.metrics.securityScore} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Code2 className="h-4 w-4" /> Quality
                  </span>
                  <span className={getScoreColor(result.metrics.qualityScore)}>
                    {result.metrics.qualityScore}%
                  </span>
                </div>
                <Progress value={result.metrics.qualityScore} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" /> Maintainability
                  </span>
                  <span className={getScoreColor(result.metrics.maintainabilityScore)}>
                    {result.metrics.maintainabilityScore}%
                  </span>
                </div>
                <Progress value={result.metrics.maintainabilityScore} className="h-2" />
              </div>
            </div>

            {/* Detailed Results */}
            <Tabs defaultValue="security" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="security" className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Security
                  {result.securityIssues.length > 0 && (
                    <Badge variant="destructive" className="ml-1 text-xs">
                      {result.securityIssues.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="quality" className="flex items-center gap-1">
                  <Code2 className="h-4 w-4" />
                  Quality
                  {result.qualityIssues.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {result.qualityIssues.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="flex items-center gap-1">
                  <Lightbulb className="h-4 w-4" />
                  Suggestions
                  {result.improvements.length > 0 && (
                    <Badge className="ml-1 text-xs bg-primary">
                      {result.improvements.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="security">
                <ScrollArea className="h-[400px] pr-4">
                  {result.securityIssues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mb-2 text-green-500" />
                      <p>No security issues found</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {result.securityIssues.map((issue, idx) => (
                        <AccordionItem key={idx} value={`security-${idx}`}>
                          <AccordionTrigger className="text-left">
                            <div className="flex items-center gap-2">
                              <Badge className={severityColors[issue.severity]}>
                                {issue.severity.toUpperCase()}
                              </Badge>
                              <span>{issue.title}</span>
                              {issue.lineNumbers && issue.lineNumbers.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Line {issue.lineNumbers.join(', ')}
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <p className="text-muted-foreground">{issue.description}</p>
                            <div className="bg-muted p-3 rounded-md">
                              <p className="text-sm font-medium mb-1">Suggestion:</p>
                              <p className="text-sm">{issue.suggestion}</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="quality">
                <ScrollArea className="h-[400px] pr-4">
                  {result.qualityIssues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mb-2 text-green-500" />
                      <p>No quality issues found</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {result.qualityIssues.map((issue, idx) => (
                        <AccordionItem key={idx} value={`quality-${idx}`}>
                          <AccordionTrigger className="text-left">
                            <div className="flex items-center gap-2">
                              {issueTypeIcons[issue.type]}
                              <Badge variant="secondary">{issue.type}</Badge>
                              <span>{issue.title}</span>
                              {issue.lineNumbers && issue.lineNumbers.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Line {issue.lineNumbers.join(', ')}
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <p className="text-muted-foreground">{issue.description}</p>
                            <div className="bg-muted p-3 rounded-md">
                              <p className="text-sm font-medium mb-1">Suggestion:</p>
                              <p className="text-sm">{issue.suggestion}</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="suggestions">
                <ScrollArea className="h-[400px] pr-4">
                  {result.improvements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Lightbulb className="h-12 w-12 mb-2" />
                      <p>No improvement suggestions</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {result.improvements.map((improvement, idx) => (
                        <Card key={idx}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-primary" />
                              {improvement.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">{improvement.description}</p>
                            {improvement.before && improvement.after && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Before:</p>
                                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                    {improvement.before}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-green-600 mb-1">After:</p>
                                  <pre className="bg-green-50 dark:bg-green-950 p-2 rounded text-xs overflow-x-auto">
                                    {improvement.after}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
