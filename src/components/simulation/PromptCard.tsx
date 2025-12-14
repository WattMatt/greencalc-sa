import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PromptCardProps {
  title: string;
  description: string;
  prompt: string;
}

export function PromptCard({ title, description, prompt }: PromptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4 max-h-64 overflow-y-auto">
          <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
            {prompt}
          </pre>
        </div>
        <Button onClick={handleCopy} variant="outline" className="w-full">
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" /> Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" /> Copy Prompt to Clipboard
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
