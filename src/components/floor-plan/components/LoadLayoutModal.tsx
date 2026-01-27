import { useState, useRef, useEffect, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import html2canvas from 'html2canvas';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, Satellite, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Set PDF.js worker
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
}

interface LoadLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageLoad: (imageBase64: string) => void;
  projectCoordinates: { latitude: number | null; longitude: number | null };
}

export function LoadLayoutModal({
  isOpen,
  onClose,
  onImageLoad,
  projectCoordinates,
}: LoadLayoutModalProps) {
  const [activeTab, setActiveTab] = useState<string>('pdf');
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Failed to fetch Mapbox token:', error);
      }
    };
    if (isOpen) {
      fetchToken();
    }
  }, [isOpen]);

  // Initialize map when tab switches to satellite
  useEffect(() => {
    if (activeTab !== 'satellite' || !mapboxToken || !mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    const lat = projectCoordinates.latitude ?? -26.2041;
    const lng = projectCoordinates.longitude ?? 28.0473;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [lng, lat],
      zoom: 18,
      preserveDrawingBuffer: true, // Required for html2canvas
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add marker for project location
    new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([lng, lat])
      .addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeTab, mapboxToken, projectCoordinates]);

  // Cleanup map on close
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, [isOpen]);

  const convertPdfToImage = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(1);

    const scale = 2; // High resolution
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL('image/png');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }

    setIsLoading(true);
    try {
      const imageBase64 = await convertPdfToImage(file);
      onImageLoad(imageBase64);
      onClose();
      toast.success('PDF loaded and converted successfully');
    } catch (error) {
      console.error('Failed to convert PDF:', error);
      toast.error('Failed to load PDF');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptureMap = useCallback(async () => {
    if (!mapContainerRef.current || !mapRef.current) {
      toast.error('Map not ready');
      return;
    }

    setIsLoading(true);
    try {
      // Wait for map to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        logging: false,
      });

      const imageBase64 = canvas.toDataURL('image/png');
      onImageLoad(imageBase64);
      onClose();
      toast.success('Satellite view captured successfully');
    } catch (error) {
      console.error('Failed to capture map:', error);
      toast.error('Failed to capture satellite view');
    } finally {
      setIsLoading(false);
    }
  }, [onImageLoad, onClose]);

  const hasCoordinates = projectCoordinates.latitude !== null && projectCoordinates.longitude !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load Layout</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pdf" className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger 
              value="satellite" 
              className="flex items-center gap-2"
              disabled={!hasCoordinates}
            >
              <Satellite className="h-4 w-4" />
              Satellite View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <FileUp className="h-12 w-12 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload a PDF floor plan</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The first page will be converted to an image
                    </p>
                  </div>
                  <label>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isLoading}
                    />
                    <Button asChild disabled={isLoading}>
                      <span>
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Converting...
                          </>
                        ) : (
                          'Browse Files'
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="satellite" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {!hasCoordinates ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">No coordinates available</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Set the project location to use satellite view
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      ref={mapContainerRef}
                      className="w-full h-[350px] rounded-lg overflow-hidden"
                    />
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {projectCoordinates.latitude?.toFixed(4)}, {projectCoordinates.longitude?.toFixed(4)}
                      </p>
                      <Button onClick={handleCaptureMap} disabled={isLoading || !mapboxToken}>
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Capturing...
                          </>
                        ) : (
                          'Capture View'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Pan and zoom to the desired view, then click Capture
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
