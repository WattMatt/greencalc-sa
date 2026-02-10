import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudSun } from "lucide-react";

export function ExpectedGenerationCard() {
  return (
    <Card className="opacity-60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CloudSun className="h-4 w-4" />
          Forecasted Generation (kWh)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CloudSun className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Coming Soon</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
            Weather-based expected generation will be available in a future update.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
