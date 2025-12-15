import { useState, useEffect } from "react";
import { WifiOff, Wifi, CloudOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      toast.success("You're back online!", {
        description: "Your data will sync automatically",
        icon: <Wifi className="h-4 w-4" />
      });
      // Hide banner after 3 seconds
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      toast.warning("You're offline", {
        description: "Changes will be saved locally",
        icon: <WifiOff className="h-4 w-4" />
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Show banner if starting offline
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div 
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        showBanner ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      <div 
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
          isOnline 
            ? 'bg-green-500/10 border border-green-500/30 text-green-600' 
            : 'bg-amber-500/10 border border-amber-500/30 text-amber-600'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Offline mode</span>
          </>
        )}
      </div>
    </div>
  );
}

export function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
      <CloudOff className="h-3 w-3" />
      Offline
    </Badge>
  );
}
