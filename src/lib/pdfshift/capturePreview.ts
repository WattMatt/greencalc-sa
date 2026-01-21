/**
 * WYSIWYG PDF capture utility
 * Captures the live preview DOM with computed styles for true WYSIWYG PDF generation
 */

/**
 * Inline all computed styles into an element and its children
 * This ensures PDFShift renders the exact same styling
 * Uses iteration instead of recursion to avoid stack overflow
 */
function inlineComputedStyles(originalRoot: Element, cloneRoot: Element): void {
  // Use a stack-based approach to avoid recursion and stack overflow
  const stack: Array<{ original: Element; clone: Element; depth: number }> = [
    { original: originalRoot, clone: cloneRoot, depth: 0 }
  ];

  const maxDepth = 50; // Prevent excessive nesting
  const processedNodes = new WeakSet<Element>(); // Prevent circular references

  // Key CSS properties that affect visual appearance
  const propertiesToInline = [
    'background', 'background-color', 'background-image', 'background-size',
    'border', 'border-radius', 'border-color', 'border-width', 'border-style',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'text-align', 'text-decoration', 'text-transform', 'letter-spacing',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'display', 'flex-direction', 'justify-content', 'align-items', 'gap', 'flex-wrap',
    'grid-template-columns', 'grid-template-rows', 'grid-gap',
    'position', 'top', 'right', 'bottom', 'left',
    'box-shadow', 'opacity', 'overflow', 'white-space',
    'box-sizing', 'vertical-align'
  ];

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;

    const { original, clone, depth } = item;

    // Skip if already processed or too deep
    if (processedNodes.has(original) || depth > maxDepth) continue;
    processedNodes.add(original);

    try {
      const computedStyle = window.getComputedStyle(original);
      const inlineStyle = (clone as HTMLElement).style;

      if (inlineStyle) {
        propertiesToInline.forEach(prop => {
          try {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px') {
              inlineStyle.setProperty(prop, value);
            }
          } catch {
            // Skip properties that can't be read
          }
        });
      }

      // Add children to stack (in reverse order to maintain order)
      const children = original.children;
      const cloneChildren = clone.children;
      for (let i = children.length - 1; i >= 0; i--) {
        if (cloneChildren[i]) {
          stack.push({ original: children[i], clone: cloneChildren[i], depth: depth + 1 });
        }
      }
    } catch (error) {
      // Skip elements that can't be processed
      console.warn('Failed to process element:', error);
    }
  }
}

/**
 * Convert images to base64 data URLs
 */
async function convertImagesToBase64(clone: Element): Promise<void> {
  const images = clone.querySelectorAll('img');

  await Promise.all(Array.from(images).map(async (img) => {
    try {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;

      const response = await fetch(src);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      img.setAttribute('src', base64);
    } catch (error) {
      console.warn('Failed to convert image to base64:', error);
    }
  }));
}

/**
 * Simplified HTML capture - gets outer HTML without heavy style inlining
 * Relies on inline styles already present in the React components
 */
export async function capturePreviewAsHTML(
  previewElement: HTMLElement,
  options: {
    title?: string;
    pageWidth?: string;
    pageMargin?: string;
  } = {}
): Promise<string> {
  const { title = 'Proposal', pageWidth = '210mm', pageMargin = '10mm' } = options;

  // Clone the element to avoid modifying the original
  const clone = previewElement.cloneNode(true) as HTMLElement;

  // Inline computed styles (non-recursive)
  inlineComputedStyles(previewElement, clone);

  // Convert images to base64
  await convertImagesToBase64(clone);

  // Remove interactive elements that shouldn't be in PDF
  clone.querySelectorAll('button, [data-no-print], script').forEach(el => el.remove());

  // Get the HTML content
  const content = clone.outerHTML;

  // Check content size - PDFShift has limits
  const contentSizeKB = new Blob([content]).size / 1024;
  console.log(`Captured HTML size: ${contentSizeKB.toFixed(1)} KB`);

  if (contentSizeKB > 5000) {
    console.warn('HTML content is very large, PDF generation may be slow');
  }

  // Wrap in a full HTML document with print-optimized styles
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: ${pageMargin};
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
    }
    
    .preview-container {
      width: ${pageWidth};
      margin: 0 auto;
      background: white;
    }
    
    /* Ensure SVGs render correctly */
    svg {
      max-width: 100%;
      height: auto;
    }
    
    /* Page break utilities */
    .page-break {
      page-break-after: always;
    }
    
    .avoid-break {
      page-break-inside: avoid;
    }
    
    /* Hide scroll areas overflow */
    [data-radix-scroll-area-viewport] {
      overflow: visible !important;
    }
    
    /* Ensure flex containers work */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    
    /* Grid utilities */
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    
    /* Text utilities */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    
    /* Spacing */
    .p-2 { padding: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .p-8 { padding: 2rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-8 { margin-bottom: 2rem; }
    .mt-auto { margin-top: auto; }
    
    /* Sizing */
    .w-full { width: 100%; }
    .h-full { height: 100%; }
    .min-h-screen { min-height: 100vh; }
    
    /* Borders */
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .border { border-width: 1px; }
    
    /* Shrink behavior */
    .shrink-0 { flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="preview-container">
    ${content}
  </div>
</body>
</html>`;

  return html;
}

/**
 * Generate WYSIWYG PDF from a preview element
 */
export async function generateWYSIWYGPDF(
  previewElement: HTMLElement,
  filename: string,
  options: {
    title?: string;
    landscape?: boolean;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    console.log('Capturing preview for WYSIWYG PDF...');
    const html = await capturePreviewAsHTML(previewElement, { title: options.title });

    console.log('Sending to PDFShift...');
    const { data, error } = await supabase.functions.invoke('generate-pdf', {
      body: {
        type: 'proposal',
        html,
        filename,
        options: {
          landscape: options.landscape || false,
          format: 'A4',
          margin: '10mm',
        },
      },
    });

    if (error) {
      console.error('PDF generation error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      console.error('PDF generation failed:', data.error);
      return { success: false, error: data.error };
    }

    // Convert base64 to blob and download
    const byteCharacters = atob(data.pdf);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`WYSIWYG PDF downloaded: ${filename}`);
    return { success: true };
  } catch (error) {
    console.error('WYSIWYG PDF generation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
