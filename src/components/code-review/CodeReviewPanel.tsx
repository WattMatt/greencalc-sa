import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProjectFileBrowser, PROJECT_FILES, getAllFilePaths } from "./ProjectFileBrowser";
import { CodeReviewResults } from "./CodeReviewResults";
import { 
  Code2, 
  Loader2,
  Shield,
  Zap,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Settings2
} from "lucide-react";

export interface ReviewIssue {
  file: string;
  location: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  issue: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface CodeReviewResponse {
  summary: string;
  overallScore: number;
  issues: ReviewIssue[];
  improvements: string[];
  actionItems: string[];
}

type ReviewType = "security" | "performance" | "quality" | "full";

// Mock file contents for demo (in production, these would come from GitHub API)
const MOCK_FILE_CONTENTS: Record<string, string> = {
  "src/hooks/useAuth.tsx": `import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

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
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}`,
  "src/pages/Auth.tsx": `import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Check your email for verification link");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Logged in successfully");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold mb-4">{isSignUp ? "Sign Up" : "Login"}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Login"}
          </Button>
        </form>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-4 text-sm text-primary hover:underline"
        >
          {isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
        </button>
      </Card>
    </div>
  );
}`,
};

export function CodeReviewPanel() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [reviewType, setReviewType] = useState<ReviewType>("full");
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [reviewResult, setReviewResult] = useState<CodeReviewResponse | null>(null);
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);

  const handleRunReview = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file to review");
      return;
    }

    setIsReviewing(true);
    setReviewProgress(10);
    setReviewResult(null);

    try {
      // For demo purposes, use mock content for known files
      // In production, this would fetch from GitHub
      const files = selectedFiles.map(path => ({
        path,
        content: MOCK_FILE_CONTENTS[path] || `// File content for ${path}\n// (Connect GitHub to fetch actual content)`
      }));

      setReviewProgress(30);

      // Call the code review edge function
      const { data, error } = await supabase.functions.invoke('code-review', {
        body: {
          files,
          context: additionalContext,
          reviewType
        }
      });

      setReviewProgress(90);

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setReviewResult(data);
      setReviewProgress(100);
      toast.success(`Review complete! Found ${data.issues?.length || 0} issues.`);

    } catch (error) {
      console.error("Review error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to run code review");
    } finally {
      setIsReviewing(false);
    }
  };

  const getReviewTypeIcon = (type: ReviewType) => {
    switch (type) {
      case "security": return <Shield className="h-4 w-4" />;
      case "performance": return <Zap className="h-4 w-4" />;
      case "quality": return <Sparkles className="h-4 w-4" />;
      case "full": return <CheckCircle className="h-4 w-4" />;
    }
  };

  const reviewTypes: { value: ReviewType; label: string; description: string }[] = [
    { value: "full", label: "Full Review", description: "Complete analysis of security, performance, and quality" },
    { value: "security", label: "Security", description: "Focus on vulnerabilities and unsafe patterns" },
    { value: "performance", label: "Performance", description: "Focus on optimization and efficiency" },
    { value: "quality", label: "Code Quality", description: "Focus on readability and best practices" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            AI Code Review
          </CardTitle>
          <CardDescription>
            Select files and run an AI-powered code review directly in the app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Review Type Selection */}
          <div>
            <label className="text-sm font-medium mb-3 block">Review Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {reviewTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setReviewType(type.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    reviewType === type.value 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getReviewTypeIcon(type.value)}
                    <span className="font-medium text-sm">{type.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* File Browser */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Select Files to Review
            </label>
            <ProjectFileBrowser 
              selectedFiles={selectedFiles}
              onSelectionChange={setSelectedFiles}
            />
          </div>

          {/* Additional Context */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Additional Context (Optional)
            </label>
            <Textarea
              placeholder="Any specific areas of concern? Known issues? What are you trying to achieve?"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="text-sm"
              rows={3}
            />
          </div>

          {/* Review Progress */}
          {isReviewing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing {selectedFiles.length} file(s)...</span>
              </div>
              <Progress value={reviewProgress} className="h-2" />
            </div>
          )}

          {/* Run Review Button */}
          <Button 
            onClick={handleRunReview} 
            disabled={selectedFiles.length === 0 || isReviewing}
            className="w-full"
            size="lg"
          >
            {isReviewing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run AI Code Review ({selectedFiles.length} files)
              </>
            )}
          </Button>

          {/* Note about GitHub */}
          <Alert>
            <Settings2 className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Demo Mode:</strong> Currently using sample file contents. 
              To review your actual code, connect GitHub by adding <code className="bg-muted px-1 rounded">GITHUB_TOKEN</code>, <code className="bg-muted px-1 rounded">GITHUB_OWNER</code>, and <code className="bg-muted px-1 rounded">GITHUB_REPO</code> secrets.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Review Results */}
      {reviewResult && (
        <CodeReviewResults result={reviewResult} />
      )}
    </div>
  );
}
