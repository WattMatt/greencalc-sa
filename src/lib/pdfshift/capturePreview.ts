/**
 * WYSIWYG PDF capture utility
 * Captures the live preview DOM with computed styles for true WYSIWYG PDF generation
 */

/**
 * Inline all computed styles into an element and its children
 * This ensures PDFShift renders the exact same styling
 */
function inlineComputedStyles(element: Element, clone: Element): void {
  const computedStyle = window.getComputedStyle(element);
  const inlineStyle = (clone as HTMLElement).style;
  
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

  propertiesToInline.forEach(prop => {
    const value = computedStyle.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
      inlineStyle.setProperty(prop, value);
    }
  });

  // Recursively process children
  const children = element.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < children.length; i++) {
    if (cloneChildren[i]) {
      inlineComputedStyles(children[i], cloneChildren[i]);
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
 * Capture the preview element and generate print-ready HTML
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
  
  // Inline all computed styles
  inlineComputedStyles(previewElement, clone);
  
  // Convert images to base64
  await convertImagesToBase64(clone);
  
  // Remove interactive elements that shouldn't be in PDF
  clone.querySelectorAll('button, [data-no-print]').forEach(el => el.remove());
  
  // Get the HTML content
  const content = clone.outerHTML;

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
