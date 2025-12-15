import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Loader2, 
  Sparkles, 
  HelpCircle, 
  Lightbulb, 
  BookOpen, 
  MessageCircle,
  Send,
  Star,
  Zap,
  Info,
} from "lucide-react";
import { useContentEnhancer, FEATURE_AREAS } from "./useContentEnhancer";
import { cn } from "@/lib/utils";

interface FAQ {
  question: string;
  answer: string;
}

interface Tip {
  title: string;
  description: string;
  icon?: string;
}

interface GlossaryEntry {
  term: string;
  definition: string;
  relatedTerms?: string[];
}

export function ContentEnhancerDemo() {
  const {
    isLoading,
    error,
    generateExplanation,
    generateFAQs,
    generateTips,
    generateGlossary,
    askContextualHelp,
  } = useContentEnhancer();

  const [selectedFeature, setSelectedFeature] = useState<string>(FEATURE_AREAS.QUICK_ESTIMATE);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FAQ[] | null>(null);
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [glossary, setGlossary] = useState<GlossaryEntry[] | null>(null);
  const [userQuestion, setUserQuestion] = useState("");
  const [helpResponse, setHelpResponse] = useState<string | null>(null);

  const featureOptions = Object.entries(FEATURE_AREAS);

  const handleGenerateExplanation = async () => {
    const result = await generateExplanation({ featureArea: selectedFeature });
    setExplanation(result);
  };

  const handleGenerateFAQs = async () => {
    const result = await generateFAQs({ featureArea: selectedFeature });
    setFaqs(result);
  };

  const handleGenerateTips = async () => {
    const result = await generateTips({ featureArea: selectedFeature });
    setTips(result);
  };

  const handleGenerateGlossary = async () => {
    const result = await generateGlossary({ featureArea: selectedFeature });
    setGlossary(result);
  };

  const handleAskHelp = async () => {
    if (!userQuestion.trim()) return;
    const result = await askContextualHelp({ 
      featureArea: selectedFeature, 
      userQuestion 
    });
    setHelpResponse(result);
  };

  const getTipIcon = (iconName?: string) => {
    switch (iconName) {
      case "lightbulb": return Lightbulb;
      case "zap": return Zap;
      case "star": return Star;
      default: return Info;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Content Enhancer
          </CardTitle>
          <CardDescription>
            Generate intelligent help content using Gemini 3 Pro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feature selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Feature Area</label>
            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="w-full p-2 rounded-md border bg-background"
            >
              {featureOptions.map(([key, value]) => (
                <option key={key} value={value}>
                  {value.split(" - ")[0]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {selectedFeature.split(" - ")[1]}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="explanation" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="explanation" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            Explain
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs">
            <HelpCircle className="h-3 w-3 mr-1" />
            FAQs
          </TabsTrigger>
          <TabsTrigger value="tips" className="text-xs">
            <Lightbulb className="h-3 w-3 mr-1" />
            Tips
          </TabsTrigger>
          <TabsTrigger value="glossary" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            Glossary
          </TabsTrigger>
          <TabsTrigger value="help" className="text-xs">
            <MessageCircle className="h-3 w-3 mr-1" />
            Ask AI
          </TabsTrigger>
        </TabsList>

        {/* Explanation Tab */}
        <TabsContent value="explanation">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Enhanced Explanation</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleGenerateExplanation}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {explanation ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm">{explanation}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click Generate to create an enhanced explanation for this feature.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleGenerateFAQs}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {faqs && faqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`faq-${index}`}>
                      <AccordionTrigger className="text-sm text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click Generate to create FAQs for this feature.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tips Tab */}
        <TabsContent value="tips">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Did You Know?</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleGenerateTips}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tips && tips.length > 0 ? (
                <div className="space-y-3">
                  {tips.map((tip, index) => {
                    const TipIcon = getTipIcon(tip.icon);
                    return (
                      <div 
                        key={index} 
                        className="flex gap-3 p-3 rounded-lg bg-accent/50"
                      >
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <TipIcon className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tip.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {tip.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click Generate to create tips for this feature.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Glossary Tab */}
        <TabsContent value="glossary">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Glossary</CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleGenerateGlossary}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {glossary && glossary.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {glossary.map((entry, index) => (
                      <div key={index} className="border-b pb-3 last:border-0">
                        <p className="font-medium text-sm">{entry.term}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.definition}
                        </p>
                        {entry.relatedTerms && entry.relatedTerms.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {entry.relatedTerms.map((term, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {term}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click Generate to create glossary entries for this feature.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ask AI Tab */}
        <TabsContent value="help">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ask AI Assistant</CardTitle>
              <CardDescription>
                Get contextual help about the selected feature
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about this feature..."
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskHelp()}
                />
                <Button 
                  onClick={handleAskHelp}
                  disabled={isLoading || !userQuestion.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {helpResponse && (
                <div className="p-4 rounded-lg bg-accent/50">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-sm">{helpResponse}</div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                Example questions:
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>How do I interpret the payback period results?</li>
                  <li>What is the difference between kWh and kVA?</li>
                  <li>How accurate is the Quick Estimate mode?</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
