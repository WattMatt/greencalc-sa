import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PDFRequest {
  type: 'report' | 'proposal' | 'sandbox';
  html: string;
  filename: string;
  options?: {
    landscape?: boolean;
    format?: string;
    margin?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PDFSHIFT_API_KEY = Deno.env.get('PDFSHIFT_API_KEY');
    if (!PDFSHIFT_API_KEY) {
      throw new Error('PDFSHIFT_API_KEY not configured');
    }

    const { type, html, filename, options = {} }: PDFRequest = await req.json();

    console.log(`Generating ${type} PDF: ${filename}`);

    // Call PDFShift API
    const pdfResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: html,
        landscape: options.landscape || false,
        format: options.format || 'A4',
        margin: options.margin || '10mm',
        use_print: true,
        delay: 500, // Wait for any JS/CSS to render
      }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('PDFShift error:', errorText);
      throw new Error(`PDFShift API error: ${pdfResponse.status} - ${errorText}`);
    }

    // Get PDF as binary
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    // Convert to base64 in chunks to avoid stack overflow
    const uint8Array = new Uint8Array(pdfBuffer);
    const chunkSize = 8192;
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Pdf = btoa(binaryString);

    console.log(`PDF generated successfully: ${(pdfBuffer.byteLength / 1024).toFixed(1)} KB`);

    return new Response(
      JSON.stringify({
        success: true,
        pdf: base64Pdf,
        filename,
        size: pdfBuffer.byteLength,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF generation error:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
