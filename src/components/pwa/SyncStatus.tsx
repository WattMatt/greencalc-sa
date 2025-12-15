import { RefreshCw, CloudOff, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export function SyncStatus() {
  const { isOnline, syncState, syncAll } = useOfflineSync();

  if (isOnline && syncState.pendingCount === 0 && !syncState.isSyncing) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {syncState.pendingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30"
              >
                <CloudOff className="h-3 w-3" />
                {syncState.pendingCount} pending
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{syncState.pendingCount} changes waiting to sync</p>
            </TooltipContent>
          </Tooltip>
        )}

        {syncState.syncError && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Sync error
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{syncState.syncError}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {isOnline && syncState.pendingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={syncAll}
            disabled={syncState.isSyncing}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
            <span className="ml-1 text-xs">
              {syncState.isSyncing ? 'Syncing...' : 'Sync now'}
            </span>
          </Button>
        )}

        {syncState.lastSyncAt && !syncState.pendingCount && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30">
                <Check className="h-3 w-3" />
                Synced
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Last synced: {syncState.lastSyncAt.toLocaleTimeString()}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
