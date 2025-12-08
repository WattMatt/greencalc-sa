import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PNPSCADA_BASE_URL = 'https://thukela-kadesh.pnpscada.com';

interface PNPScadaSession {
  cookies: string[];
  isAuthenticated: boolean;
}

interface MeterInfo {
  name: string;
  url: string;
  type?: string;
}

async function login(): Promise<PNPScadaSession> {
  const username = Deno.env.get('PNPSCADA_USERNAME');
  const password = Deno.env.get('PNPSCADA_PASSWORD');
  
  if (!username || !password) {
    throw new Error('PNPSCADA credentials not configured');
  }

  console.log('Attempting PNPSCADA login...');
  
  // PNPSCADA uses form-based login with specific field names
  const formData = new URLSearchParams();
  formData.append('lusr', username);
  formData.append('lpwd', password);
  
  const loginResponse = await fetch(`${PNPSCADA_BASE_URL}/_Login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  // Extract session cookies
  const setCookieHeaders = loginResponse.headers.getSetCookie?.() || [];
  const cookies = setCookieHeaders.map(c => c.split(';')[0]);
  
  console.log('Login response status:', loginResponse.status);
  console.log('Cookies received:', cookies.length);
  
  const isAuthenticated = loginResponse.status === 302 || loginResponse.status === 200;
  
  return { cookies, isAuthenticated };
}

async function fetchOverviewPage(session: PNPScadaSession): Promise<string> {
  const response = await fetch(`${PNPSCADA_BASE_URL}/overview`, {
    headers: {
      'Cookie': session.cookies.join('; '),
    },
  });
  
  return await response.text();
}

function parseMetersFromHTML(html: string): MeterInfo[] {
  const meters: MeterInfo[] = [];
  
  // Pattern 1: Direct meter links like /meterdata?meter=123 or /meter/123
  const meterDataPattern = /href="([^"]*(?:meterdata|meter)[^"]*?)"/gi;
  let match;
  while ((match = meterDataPattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.includes('JavaScript:')) {
      const nameMatch = url.match(/(?:meter=|meter\/)([^&"]+)/i);
      meters.push({
        name: nameMatch ? nameMatch[1] : url,
        url: url.startsWith('http') ? url : `${PNPSCADA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`,
      });
    }
  }
  
  // Pattern 2: Look for links with meter IDs or serial numbers
  const serialPattern = /href="([^"]*?(?:\d{8,})[^"]*?)"/gi;
  while ((match = serialPattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.includes('JavaScript:') && !meters.some(m => m.url.includes(url))) {
      meters.push({
        name: url.match(/(\d{8,})/)?.[1] || url,
        url: url.startsWith('http') ? url : `${PNPSCADA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`,
      });
    }
  }
  
  // Pattern 3: Look for graph/data links
  const graphPattern = /href="([^"]*(?:graph|data|profile|reading)[^"]*?)"/gi;
  while ((match = graphPattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.includes('JavaScript:') && !meters.some(m => m.url === url)) {
      meters.push({
        name: 'data-link',
        url: url.startsWith('http') ? url : `${PNPSCADA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`,
      });
    }
  }
  
  return meters;
}

function extractAllLinks(html: string): string[] {
  const linkPattern = /href="([^"]+)"/gi;
  const links: string[] = [];
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    if (!match[1].includes('JavaScript:') && !match[1].startsWith('#')) {
      links.push(match[1]);
    }
  }
  return [...new Set(links)];
}

async function fetchCSVData(session: PNPScadaSession, url: string): Promise<{ csvData?: string; links?: string[]; html?: string }> {
  console.log('Fetching:', url);
  
  const response = await fetch(url, {
    headers: {
      'Cookie': session.cookies.join('; '),
    },
  });
  
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  
  // If it's CSV, return directly
  if (contentType.includes('text/csv') || contentType.includes('application/csv') || text.startsWith('Date,') || text.includes(',kWh,')) {
    return { csvData: text };
  }
  
  // Look for CSV/export links in the page
  const csvLinks = extractAllLinks(text).filter(l => 
    l.toLowerCase().includes('csv') || 
    l.toLowerCase().includes('export') || 
    l.toLowerCase().includes('download')
  );
  
  if (csvLinks.length > 0) {
    // Try to fetch the first CSV link
    for (const csvLink of csvLinks) {
      const csvUrl = csvLink.startsWith('http') ? csvLink : `${PNPSCADA_BASE_URL}${csvLink.startsWith('/') ? '' : '/'}${csvLink}`;
      console.log('Trying CSV link:', csvUrl);
      
      const csvResponse = await fetch(csvUrl, {
        headers: {
          'Cookie': session.cookies.join('; '),
        },
      });
      
      const csvText = await csvResponse.text();
      const csvContentType = csvResponse.headers.get('content-type') || '';
      
      if (csvContentType.includes('csv') || csvText.includes(',')) {
        return { csvData: csvText };
      }
    }
  }
  
  // Return the links found on this page
  return { 
    links: extractAllLinks(text).slice(0, 50),
    html: text.slice(0, 5000) // First 5KB for debugging
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, url } = await req.json();
    
    const session = await login();
    
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to authenticate with PNPSCADA' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'list-meters') {
      const html = await fetchOverviewPage(session);
      const meters = parseMetersFromHTML(html);
      const allLinks = extractAllLinks(html);
      
      return new Response(JSON.stringify({ 
        success: true, 
        meters,
        allLinks: allLinks.slice(0, 100),
        pageLength: html.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'debug') {
      const html = await fetchOverviewPage(session);
      
      return new Response(JSON.stringify({ 
        success: true, 
        htmlSample: html.slice(0, 10000),
        allLinks: extractAllLinks(html)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'fetch' && url) {
      const result = await fetchCSVData(session, url);
      
      return new Response(JSON.stringify({ 
        success: true, 
        ...result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid action. Use "list-meters", "debug", or "fetch"' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('PNPSCADA fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
