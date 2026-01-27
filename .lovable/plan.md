

# Plan: Unified Image Format for Layout Backgrounds

## Overview

Convert both PDF uploads and Google Maps captures to a unified **base64 image format**. This means:
- When a user uploads a PDF, we render the first page to a canvas and convert it to a base64 PNG image
- When a user captures a Google Maps view, it's already captured as a base64 PNG image
- The Canvas component only needs to handle image backgrounds (simpler code)

## Architecture

```text
User Action
     |
     +-- Upload PDF ---------> Render page 1 to canvas --> Export as base64 PNG
     |                                                           |
     +-- Capture Google Maps --> html2canvas capture ----------->+
                                                                 |
                                                                 v
                                                    backgroundImage (base64 string)
                                                                 |
                                                                 v
                                                          Canvas.tsx
                                                    (renders image background)
```

## File Changes

### 1. Create `src/components/floor-plan/components/LoadLayoutModal.tsx` (NEW)

A dialog with two tabs/options:
- **Upload PDF Tab**: File picker, renders PDF page 1 to image, returns base64
- **Google Maps Tab**: Mapbox satellite view centered on project coordinates, capture button

Key features:
- Uses `pdfjs-dist` to render PDF to canvas, then exports as PNG
- Uses `html2canvas` to capture the Mapbox map div
- Both return a base64 image string to the parent component

### 2. Modify `src/components/floor-plan/components/Canvas.tsx`

**Before**: Accepts `pdfDoc: PDFDocumentProxy | null`

**After**: Accepts `backgroundImage: string | null` (base64 image data URL)

Changes:
- Remove `pdfjs-dist` import and PDF rendering logic
- Add simple image loading and rendering to canvas
- Keep all drawing, pan/zoom, and interaction logic the same

### 3. Modify `src/components/floor-plan/FloorPlanMarkup.tsx`

Changes:
- Remove `pdfDoc` state, replace with `backgroundImage` state
- Add `isLoadLayoutModalOpen` state
- Fetch project coordinates from Supabase for the map
- Handle `onImageLoad` callback from LoadLayoutModal
- Update save/load logic to store `layout_type` ('pdf' or 'image') if needed for metadata

### 4. Modify `src/components/floor-plan/components/Toolbar.tsx`

Changes:
- Rename "Load PDF" button to "Load Layout"
- Remove inline file input
- Add `onOpenLoadLayout` prop (replaces `onLoadPdf`)
- Update `pdfLoaded` prop to `layoutLoaded`

### 5. Update Database Persistence

The `pv_layouts.pdf_data` column will store the base64 image string (works for both converted PDF images and map captures). No schema change needed - just the content type changes.

## Technical Implementation Details

### PDF to Image Conversion (in LoadLayoutModal)

```typescript
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
```

### Google Maps Capture (in LoadLayoutModal)

```typescript
const handleCaptureMap = async () => {
  const mapDiv = mapContainerRef.current;
  if (!mapDiv) return;
  
  const canvas = await html2canvas(mapDiv, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
  });
  
  onImageLoad(canvas.toDataURL('image/png'));
};
```

### Simplified Canvas Image Rendering

```typescript
// In Canvas.tsx
useEffect(() => {
  if (!backgroundImage || !pdfCanvasRef.current) return;
  
  const img = new Image();
  img.onload = () => {
    const canvas = pdfCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = img.width;
    canvas.height = img.height;
    setCanvasSize({ width: img.width, height: img.height });
    ctx.drawImage(img, 0, 0);
  };
  img.src = backgroundImage;
}, [backgroundImage]);
```

## UI/UX Design

### LoadLayoutModal Dialog

```text
+-----------------------------------------------------------+
|  Load Layout                                          [X] |
+-----------------------------------------------------------+
|                                                           |
|  +------------------------+  +------------------------+   |
|  |  [PDF Icon]            |  |  [Satellite Icon]      |   |
|  |                        |  |                        |   |
|  |  Upload PDF            |  |  Google Maps           |   |
|  |                        |  |  Satellite             |   |
|  |  Browse for a local    |  |  Capture from the      |   |
|  |  floor plan file       |  |  project location      |   |
|  +------------------------+  +------------------------+   |
|                                                           |
|  -------------------------------------------------------- |
|                                                           |
|  When "Google Maps Satellite" is selected:                |
|                                                           |
|  +-----------------------------------------------------+  |
|  |                                                     |  |
|  |         [Mapbox Satellite View]                     |  |
|  |         Pan and zoom to desired view                |  |
|  |                                                     |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  Location: -25.7479, 28.2293                             |
|                                                           |
|  [ Cancel ]                          [ Capture View ]    |
|                                                           |
+-----------------------------------------------------------+
```

### Canvas Empty State Update

Change placeholder text from:
- "Load a PDF floor plan to begin"

To:
- "Load a layout to begin"

## Implementation Steps

1. Create `LoadLayoutModal.tsx` with PDF-to-image conversion and Mapbox integration
2. Update `Toolbar.tsx` to use "Load Layout" button and new prop
3. Update `Canvas.tsx` to accept `backgroundImage` instead of `pdfDoc`
4. Update `FloorPlanMarkup.tsx` to:
   - Manage modal state
   - Fetch project coordinates
   - Handle image loading from both sources
   - Update persistence to save/load image data
5. Test PDF upload converts correctly to image
6. Test Google Maps capture works and centers on project location

## Dependencies

All dependencies are already installed:
- `pdfjs-dist` - For PDF rendering
- `html2canvas` - For map capture
- `mapbox-gl` - For satellite view
- `MAPBOX_PUBLIC_TOKEN` - Already configured in secrets

