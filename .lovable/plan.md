

# Plan: Clean Satellite Capture (Remove Marker and Controls)

## Problem

When capturing the satellite view for the PV Layout, the screenshot includes:
1. **Red location marker pin** in the center
2. **Navigation controls** (zoom buttons, compass) on the right side

These UI elements clutter the final image which should be a clean satellite view for drawing PV arrays.

## Solution

Hide the marker and navigation controls just before capturing, then restore them after capture. This gives users the interactive controls while positioning the view, but produces a clean image for the layout.

## Implementation

### Modify `src/components/floor-plan/components/LoadLayoutModal.tsx`

**Change 1: Store marker reference**

Currently the marker is created but not stored. We need to keep a reference to hide/show it:

```typescript
const markerRef = useRef<mapboxgl.Marker | null>(null);

// In map initialization:
const marker = new mapboxgl.Marker({ color: '#ef4444' })
  .setLngLat([lng, lat])
  .addTo(map);
markerRef.current = marker;
```

**Change 2: Update handleCaptureMap to hide UI elements before capture**

```typescript
const handleCaptureMap = useCallback(async () => {
  if (!mapContainerRef.current || !mapRef.current) {
    toast.error('Map not ready');
    return;
  }

  setIsLoading(true);
  try {
    // Hide marker before capture
    if (markerRef.current) {
      markerRef.current.getElement().style.display = 'none';
    }
    
    // Hide navigation controls before capture
    const controls = mapContainerRef.current.querySelector('.mapboxgl-ctrl-top-right');
    if (controls) {
      (controls as HTMLElement).style.display = 'none';
    }
    
    // Wait for changes to render
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(mapContainerRef.current, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      logging: false,
    });

    // Restore marker after capture
    if (markerRef.current) {
      markerRef.current.getElement().style.display = '';
    }
    
    // Restore navigation controls after capture
    if (controls) {
      (controls as HTMLElement).style.display = '';
    }

    const imageBase64 = canvas.toDataURL('image/png');
    onImageLoad(imageBase64);
    onClose();
    toast.success('Satellite view captured successfully');
  } catch (error) {
    // Restore visibility even on error
    if (markerRef.current) {
      markerRef.current.getElement().style.display = '';
    }
    const controls = mapContainerRef.current?.querySelector('.mapboxgl-ctrl-top-right');
    if (controls) {
      (controls as HTMLElement).style.display = '';
    }
    
    console.error('Failed to capture map:', error);
    toast.error('Failed to capture satellite view');
  } finally {
    setIsLoading(false);
  }
}, [onImageLoad, onClose]);
```

**Change 3: Clean up marker reference on modal close**

```typescript
// In cleanup effect:
useEffect(() => {
  if (!isOpen) {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setMapReady(false);
    setActiveTab('pdf');
  }
}, [isOpen]);
```

## Summary of Changes

| Element | Before Capture | After Capture |
|---------|---------------|---------------|
| Red marker pin | Hidden | Restored |
| Navigation controls | Hidden | Restored |

## User Experience

1. User opens satellite view - sees map with marker and controls for navigation
2. User pans, zooms, and rotates to desired view using the controls
3. User clicks "Capture View"
4. System hides marker and controls momentarily
5. Screenshot is taken (clean satellite image)
6. Controls are restored (in case of error/retry)
7. Clean image is loaded into the PV Layout canvas

## Files Modified

- `src/components/floor-plan/components/LoadLayoutModal.tsx`

