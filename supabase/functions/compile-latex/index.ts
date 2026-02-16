const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source } = await req.json();
    if (!source || typeof source !== 'string') {
      return new Response(JSON.stringify({ error: true, log: 'No LaTeX source provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build multipart/form-data for texlive.net
    const formData = new FormData();
    formData.append('filecontents[]', source);
    formData.append('filename[]', 'document.tex');
    formData.append('engine', 'pdflatex');
    formData.append('return', 'pdf');

    const texliveResp = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: formData,
    });

    const contentType = texliveResp.headers.get('content-type') || '';

    if (contentType.includes('application/pdf')) {
      const pdfBuffer = await texliveResp.arrayBuffer();
      return new Response(pdfBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
        },
      });
    }

    // Compilation error — return log text
    const logText = await texliveResp.text();
    return new Response(JSON.stringify({ error: true, log: logText }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: true, log: `Server error: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
