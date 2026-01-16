import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  FileCode,
  ListChecks,
  Lightbulb,
  Shield,
  Zap,
  Code2,
  Bug
} from "lucide-react";
import type { CodeReviewResponse, ReviewIssue } from "./CodeReviewPanel";

interface CodeReviewResultsProps {
  result: CodeReviewResponse;
}

function getSeverityColor(severity: ReviewIssue["severity"]) {
  switch (severity) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "secondary";
    case "low": return "outline";
    default: return "secondary";
  }
}

function getSeverityIcon(severity: ReviewIssue["severity"]) {
  switch (severity) {
    case "critical": return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "high": return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "medium": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "low": return <Info className="h-4 w-4 text-muted-foreground" />;
    default: return <Info className="h-4 w-4" />;
  }
}

function getCategoryIcon(category: string) {
  switch (category.toLowerCase()) {
    case "security": return <Shield className="h-4 w-4" />;
    case "performance": return <Zap className="h-4 w-4" />;
    case "bug": return <Bug className="h-4 w-4" />;
    case "quality": return <Code2 className="h-4 w-4" />;
    default: return <FileCode className="h-4 w-4" />;
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Fair";
  if (score >= 60) return "Needs Work";
  return "Poor";
}

export function CodeReviewResults({ result }: CodeReviewResultsProps) {
  const criticalCount = result.issues.filter(i => i.severity === "critical").length;
  const highCount = result.issues.filter(i => i.severity === "high").length;
  const mediumCount = result.issues.filter(i => i.severity === "medium").length;
  const lowCount = result.issues.filter(i => i.severity === "low").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Review Results
            </CardTitle>
            <CardDescription className="mt-1">
              {result.summary}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(result.overallScore)}`}>
              {result.overallScore}
            </div>
            <div className="text-sm text-muted-foreground">
              {getScoreLabel(result.overallScore)}
            </div>
          </div>
        </div>

        {/* Issue Summary */}
        <div className="flex gap-4 mt-4">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {criticalCount} Critical
            </Badge>
          )}
          {highCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {highCount} High
            </Badge>
          )}
          {mediumCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {mediumCount} Medium
            </Badge>
          )}
          {lowCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Info className="h-3 w-3" />
              {lowCount} Low
            </Badge>
          )}
          {result.issues.length === 0 && (
            <Badge variant="default" className="gap-1 bg-green-500">
              <CheckCircle2 className="h-3 w-3" />
              No Issues Found
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="issues" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="issues" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Issues ({result.issues.length})
            </TabsTrigger>
            <TabsTrigger value="improvements" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Improvements
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Action Items
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="mt-4">
            {result.issues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>No issues found! Your code looks good.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Accordion type="multiple" className="space-y-2">
                  {result.issues.map((issue, index) => (
                    <AccordionItem 
                      key={index} 
                      value={`issue-${index}`}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getSeverityColor(issue.severity)} className="text-xs">
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs gap-1">
                                {getCategoryIcon(issue.category)}
                                {issue.category}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {issue.file}
                              </span>
                            </div>
                            <p className="text-sm mt-1 font-normal">{issue.issue}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Location</p>
                            <p className="text-sm">{issue.location}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Suggestion</p>
                            <p className="text-sm">{issue.suggestion}</p>
                          </div>
                          {issue.codeSnippet && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Code</p>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                <code>{issue.codeSnippet}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="improvements" className="mt-4">
            <ScrollArea className="h-[400px]">
              <ul className="space-y-3">
                {result.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                    <Lightbulb className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{improvement}</span>
                  </li>
                ))}
                {result.improvements.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No additional improvements suggested.</p>
                  </div>
                )}
              </ul>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            <ScrollArea className="h-[400px]">
              <ol className="space-y-3">
                {result.actionItems.map((action, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                      {index + 1}
                    </div>
                    <span className="text-sm">{action}</span>
                  </li>
                ))}
                {result.actionItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No action items identified.</p>
                  </div>
                )}
              </ol>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
