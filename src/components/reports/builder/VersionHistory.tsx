import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw, Eye, Trash2 } from "lucide-react";

interface Version {
  id: string;
  version: number;
  created_at: string;
  generated_by?: string;
  notes?: string;
}

interface VersionHistoryProps {
  versions: Version[];
  currentVersion?: number;
  onRestore?: (version: Version) => void;
  onView?: (version: Version) => void;
  onDelete?: (version: Version) => void;
  className?: string;
}

export function VersionHistory({ 
  versions, 
  currentVersion,
  onRestore, 
  onView,
  onDelete,
  className 
}: VersionHistoryProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <CardTitle className="text-base">Version History</CardTitle>
          </div>
          <Badge variant="outline">{versions.length} versions</Badge>
        </div>
        <CardDescription>Track and restore previous report versions</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-4 pt-0">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No versions yet</p>
                <p className="text-xs mt-1">Save your report to create a version</p>
              </div>
            ) : (
              versions.map((version) => {
                const isCurrent = currentVersion === version.version;
                
                return (
                  <div
                    key={version.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isCurrent ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">v{version.version}</span>
                        {isCurrent && (
                          <Badge variant="default" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                        {version.generated_by && ` • by ${version.generated_by}`}
                      </div>
                      {version.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{version.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      {onView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onView(version)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {onRestore && !isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onRestore(version)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && !isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(version)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
