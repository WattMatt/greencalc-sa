import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function TestLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <Card className="max-w-2xl w-full">
        <CardContent className="p-12 flex flex-col items-center gap-8">
          <div className="flex items-center gap-3 p-6 bg-primary/10 rounded-2xl">
            <Sparkles className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Hello World</h1>
          </div>
          <p className="text-muted-foreground text-center text-lg">
            Welcome to the new landing page! This is a test infographic component.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
