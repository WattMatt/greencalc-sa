import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ProjectFileBrowser } from "./ProjectFileBrowser";
import { 
  Code2, 
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  FileCode,
  Info
} from "lucide-react";

export function CodeReviewPanel() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleGeneratePrompt = () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file to review");
      return;
    }

    const prompt = generateDevelopmentPrompt(selectedFiles, additionalContext);
    setGeneratedPrompt(prompt);
    toast.success("Development prompt generated! Copy and paste into your AI platform.");
  };

  const generateDevelopmentPrompt = (files: string[], context: string): string => {
    const filesByFolder: Record<string, string[]> = {};
    
    files.forEach(file => {
      const parts = file.split('/');
      const folder = parts.slice(0, -1).join('/');
      const fileName = parts[parts.length - 1];
      if (!filesByFolder[folder]) {
        filesByFolder[folder] = [];
      }
      filesByFolder[folder].push(fileName);
    });

    const fileListFormatted = Object.entries(filesByFolder)
      .map(([folder, fileNames]) => {
        return `**${folder}/**\n${fileNames.map(f => `  - ${f}`).join('\n')}`;
      })
      .join('\n\n');

    const prompt = `# Code Review & Development Assistance Request

## Project Context
This is a **Solar Energy Management & Tariff Analysis Platform** built with:
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: Zustand + React Query
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Charts**: Recharts

## Files I Need You to Review

I'm going to share the contents of the following ${files.length} file(s) for review:

${fileListFormatted}

${context ? `## Additional Context & Focus Areas\n${context}\n` : ''}
---

## What I Need From You

### 1. **Code Review**
Please analyze the code I'll paste below and provide:

- **Security Issues**: Identify vulnerabilities, unsafe patterns, or potential exploits
- **Code Quality**: Assess structure, readability, DRY principles, and TypeScript usage
- **Performance**: Identify bottlenecks, unnecessary re-renders, or inefficient patterns
- **Best Practices**: Check adherence to React/TypeScript conventions

### 2. **Specific Feedback For Each Issue**
For each issue found:
- **Location**: File name and approximate location
- **Severity**: Critical / High / Medium / Low
- **Issue**: Clear description of the problem
- **Solution**: Specific code fix or recommendation

### 3. **Improvement Suggestions**
Prioritized list of improvements with:
- Before/after code examples where applicable
- Explanation of why the change is beneficial

### 4. **Action Items**
A numbered checklist I can work through to implement the fixes.

---

## File Contents

**IMPORTANT**: Please paste the actual file contents below this line. Copy each file from your project and paste it here with a clear header like:

\`\`\`typescript
// ===== FILE: src/components/example/MyComponent.tsx =====

// [paste file contents here]
\`\`\`

${files.map(f => `\`\`\`typescript
// ===== FILE: ${f} =====

// [PASTE CONTENTS OF ${f} HERE]
\`\`\``).join('\n\n')}

---

## Review Focus Priority

1. 🔒 **Security vulnerabilities** (XSS, injection, auth issues)
2. 🐛 **Bugs or potential runtime errors**
3. ⚡ **Performance issues** (re-renders, memory leaks)
4. 📐 **Architecture & patterns** (component structure, state management)
5. ✨ **Code cleanliness** (naming, organization, readability)

Please provide actionable, specific feedback I can immediately apply to improve this code.`;

    return prompt;
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setIsCopied(true);
      toast.success("Prompt copied! Now paste into Claude, ChatGPT, or your preferred AI.");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy - please select and copy manually");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Code Review Prompt Generator
          </CardTitle>
          <CardDescription>
            Select project files, generate a structured prompt, then paste the files and prompt into your AI development platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>How it works:</strong> Select files below → Generate prompt → Copy the prompt → Paste into Claude/ChatGPT → 
              Then copy the actual file contents from your IDE and paste them into the designated sections.
            </AlertDescription>
          </Alert>

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
              placeholder="What specific aspects do you want reviewed? Any known issues? Areas of concern?&#10;&#10;Examples:&#10;- Focus on authentication security&#10;- Check for performance issues in data loading&#10;- Review state management patterns"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="text-sm"
              rows={4}
            />
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGeneratePrompt} 
            disabled={selectedFiles.length === 0}
            className="w-full"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Development Prompt ({selectedFiles.length} files selected)
          </Button>
        </CardContent>
      </Card>

      {/* Generated Prompt Output */}
      {generatedPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                Your Development Prompt
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePrompt}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopyPrompt}
                >
                  {isCopied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Prompt
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Copy this prompt and paste it into Claude, ChatGPT, GitHub Copilot, or any AI assistant. Then paste your actual file contents in the marked sections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <ScrollArea className="h-[500px] w-full rounded-md border bg-muted/30">
                <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
                  {generatedPrompt}
                </pre>
              </ScrollArea>
              <div className="absolute bottom-4 right-4">
                <Badge variant="secondary" className="text-xs">
                  {generatedPrompt.length.toLocaleString()} characters
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
