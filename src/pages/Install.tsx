import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Smartphone, 
  CheckCircle2, 
  WifiOff, 
  Zap, 
  Bell, 
  Share2,
  Apple,
  Chrome
} from "lucide-react";
import { useInstallPrompt } from "@/components/pwa";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Install() {
  const { isInstalled, isInstallable, promptInstall } = useInstallPrompt();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      // Refresh the page to show installed state
      window.location.reload();
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-2xl py-8 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <img 
              src="/icons/icon-192x192.png" 
              alt="Green Energy Platform"
              className="w-16 h-16 rounded-xl"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">Install Green Energy Platform</h1>
          <p className="text-muted-foreground">
            Get the full app experience on your device
          </p>
        </div>

        {isStandalone || isInstalled ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">App Installed!</h2>
              <p className="text-muted-foreground">
                You're using the installed version of Green Energy Platform
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Features */}
            <div className="grid gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Instant Access</h3>
                      <p className="text-sm text-muted-foreground">
                        Launch directly from your home screen without opening a browser
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <WifiOff className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Works Offline</h3>
                      <p className="text-sm text-muted-foreground">
                        Access your projects and simulations even without internet
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Push Notifications</h3>
                      <p className="text-sm text-muted-foreground">
                        Get alerts when simulations complete or proposals are signed
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Install Instructions */}
            {isInstallable ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Chrome className="h-5 w-5" />
                    Install with One Click
                  </CardTitle>
                  <CardDescription>
                    Your browser supports direct installation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleInstall} size="lg" className="w-full">
                    <Download className="h-5 w-5 mr-2" />
                    Install App
                  </Button>
                </CardContent>
              </Card>
            ) : isIOS ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5" />
                    Install on iPhone/iPad
                  </CardTitle>
                  <CardDescription>
                    Follow these steps to add to your home screen
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0">1</Badge>
                    <div>
                      <p className="font-medium">Tap the Share button</p>
                      <p className="text-sm text-muted-foreground">
                        At the bottom of Safari (the square with an arrow pointing up)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0">2</Badge>
                    <div>
                      <p className="font-medium">Scroll down and tap "Add to Home Screen"</p>
                      <p className="text-sm text-muted-foreground">
                        You may need to scroll down in the share sheet
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0">3</Badge>
                    <div>
                      <p className="font-medium">Tap "Add"</p>
                      <p className="text-sm text-muted-foreground">
                        The app icon will appear on your home screen
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : isAndroid ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Install on Android
                  </CardTitle>
                  <CardDescription>
                    Follow these steps to add to your home screen
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0">1</Badge>
                    <div>
                      <p className="font-medium">Tap the menu button</p>
                      <p className="text-sm text-muted-foreground">
                        The three dots in the top-right corner of Chrome
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0">2</Badge>
                    <div>
                      <p className="font-medium">Tap "Add to Home screen"</p>
                      <p className="text-sm text-muted-foreground">
                        Or "Install app" if you see that option
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0">3</Badge>
                    <div>
                      <p className="font-medium">Tap "Add"</p>
                      <p className="text-sm text-muted-foreground">
                        The app icon will appear on your home screen
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    Install Instructions
                  </CardTitle>
                  <CardDescription>
                    Add this app to your device
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Look for the "Install" or "Add to Home Screen" option in your browser's menu to install this app.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
