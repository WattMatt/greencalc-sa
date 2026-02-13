import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PNPSCADA_BASE_URL = 'https://thukela-kadesh.pnpscada.com';

interface MeterInfo {
  entityId: string;
  serial: string;
  name: string;
  classId: string;
}

// Cookie jar - accumulates cookies across requests
class CookieJar {
  private cookies: Map<string, string> = new Map();
  
  addFromResponse(response: Response) {
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    for (const header of setCookieHeaders) {
      const cookie = header.split(';')[0];
      const [name] = cookie.split('=');
      if (name) this.cookies.set(name.trim(), cookie);
    }
  }
  
  toString(): string {
    return Array.from(this.cookies.values()).join('; ');
  }
  
  get count(): number {
    return this.cookies.size;
  }
}

// Login, follow redirects, return a working session
async function createSession(): Promise<{ jar: CookieJar; memh: string; overviewHtml: string; authenticated: boolean }> {
  const username = Deno.env.get('PNPSCADA_USERNAME');
  const password = Deno.env.get('PNPSCADA_PASSWORD');

  if (!username || !password) {
    throw new Error('PNPSCADA credentials not configured');
  }

  const jar = new CookieJar();
  console.log('Attempting PNPSCADA login...');

  const formData = new URLSearchParams();
  formData.append('lusr', username);
  formData.append('lpwd', password);

  // Step 1: POST login (don't follow redirect to capture cookies)
  const loginResponse = await fetch(`${PNPSCADA_BASE_URL}/_Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    redirect: 'manual',
  });

  jar.addFromResponse(loginResponse);
  console.log('Login status:', loginResponse.status, '| Cookies:', jar.count);

  if (loginResponse.status !== 302 && loginResponse.status !== 200) {
    return { jar, memh: '', overviewHtml: '', authenticated: false };
  }

  // Step 2: Follow the redirect (or go to overview)
  const redirectUrl = loginResponse.headers.get('location') || '/overview';
  const fullRedirectUrl = redirectUrl.startsWith('http') ? redirectUrl : `${PNPSCADA_BASE_URL}${redirectUrl}`;
  
  console.log('Following redirect to:', fullRedirectUrl);
  const redirectResponse = await fetch(fullRedirectUrl, {
    headers: { 'Cookie': jar.toString() },
    redirect: 'manual',
  });
  jar.addFromResponse(redirectResponse);
  
  // If there's another redirect, follow it too
  let overviewHtml = '';
  if (redirectResponse.status === 302) {
    const secondRedirect = redirectResponse.headers.get('location') || '/overview';
    const fullSecondUrl = secondRedirect.startsWith('http') ? secondRedirect : `${PNPSCADA_BASE_URL}${secondRedirect}`;
    console.log('Following second redirect to:', fullSecondUrl);
    const finalResponse = await fetch(fullSecondUrl, {
      headers: { 'Cookie': jar.toString() },
    });
    jar.addFromResponse(finalResponse);
    overviewHtml = await finalResponse.text();
  } else {
    overviewHtml = await redirectResponse.text();
  }
  
  // If we got a login page, try fetching overview directly
  if (overviewHtml.includes('Please authenticate') || overviewHtml.includes('_Login')) {
    console.log('Got login page, trying overview directly...');
    const overviewResponse = await fetch(`${PNPSCADA_BASE_URL}/overview`, {
      headers: { 'Cookie': jar.toString() },
    });
    jar.addFromResponse(overviewResponse);
    overviewHtml = await overviewResponse.text();
  }
  
  // Extract memh
  const memhMatch = overviewHtml.match(/memh=(-?\d+)/);
  const memh = memhMatch ? memhMatch[1] : '';
  console.log('Session established. Cookies:', jar.count, '| memh:', memh, '| HTML:', overviewHtml.length);

  const authenticated = overviewHtml.includes('Meter Account') && memh !== '';
  return { jar, memh, overviewHtml, authenticated };
}

// Parse meters from overview HTML
// Structure: <A href='/overview?...&PNPENTID=109600&PNPENTCLASID=109'> 31177</A></TD>\n<TD>&nbsp;&nbsp;Parkdene Checkers</TD>
function parseMeters(html: string): MeterInfo[] {
  const meters: MeterInfo[] = [];
  // Match: PNPENTID=X&PNPENTCLASID=Y'> SERIAL</A></TD>\n<TD>&nbsp;&nbsp;NAME</TD>
  const pattern = /PNPENTID=(\d+)&(?:amp;)?PNPENTCLASID=(\d+)[^>]*>\s*(\d+)\s*<\/A>\s*<\/TD>\s*\n?\s*<TD>(?:&nbsp;|\s)*([^<]+)<\/TD>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = match[4].trim();
    if (name) {
      meters.push({
        entityId: match[1],
        classId: match[2],
        serial: match[3].trim(),
        name,
      });
    }
  }

  // Deduplicate by serial
  const seen = new Set<string>();
  return meters.filter(m => {
    if (seen.has(m.serial)) return false;
    seen.add(m.serial);
    return true;
  });
}

// Fetch a page using session jar
async function fetchPage(jar: CookieJar, url: string): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : `${PNPSCADA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  console.log('Fetching:', fullUrl);
  const response = await fetch(fullUrl, {
    headers: { 'Cookie': jar.toString() },
  });
  jar.addFromResponse(response);
  return await response.text();
}

// Download CSV data for a meter using session-based navigation
async function downloadMeterCSV(jar: CookieJar, memh: string, entityId: string, classId: string, serial: string, startDate: string, endDate: string): Promise<string> {
  // Approach: Login fresh for each meter to get a valid session, then navigate
  const username = Deno.env.get('PNPSCADA_USERNAME')!;
  const password = Deno.env.get('PNPSCADA_PASSWORD')!;
  
  // Login with redirect directly to the meter page
  const meterJar = new CookieJar();
  const targetUrl = `${PNPSCADA_BASE_URL}/overview?PNPENTID=${entityId}&PNPENTCLASID=${classId}`;
  
  const formData = new URLSearchParams();
  formData.append('lusr', username);
  formData.append('lpwd', password);
  formData.append('lredirect', targetUrl);
  
  // Post login - let it redirect naturally
  const loginResponse = await fetch(`${PNPSCADA_BASE_URL}/_Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    redirect: 'manual',
  });
  meterJar.addFromResponse(loginResponse);
  
  // Follow the redirect chain
  let currentUrl = loginResponse.headers.get('location') || '';
  let html = '';
  let redirectCount = 0;
  
  while (currentUrl && redirectCount < 5) {
    const fullUrl = currentUrl.startsWith('http') ? currentUrl : `${PNPSCADA_BASE_URL}${currentUrl}`;
    console.log(`Meter ${serial} redirect ${redirectCount}: ${fullUrl}`);
    const response = await fetch(fullUrl, {
      headers: { 'Cookie': meterJar.toString() },
      redirect: 'manual',
    });
    meterJar.addFromResponse(response);
    
    const nextRedirect = response.headers.get('location');
    if (nextRedirect) {
      currentUrl = nextRedirect;
      redirectCount++;
    } else {
      html = await response.text();
      break;
    }
  }
  
  // If we still got a login page, try fetching the target directly
  if (html.includes('authenticate') || html.length < 1000) {
    console.log(`Meter ${serial}: redirect chain ended at login, trying target directly`);
    const directResponse = await fetch(targetUrl, {
      headers: { 'Cookie': meterJar.toString() },
    });
    meterJar.addFromResponse(directResponse);
    html = await directResponse.text();
  }
  
  console.log(`Meter ${serial}: final page ${html.length} bytes, has "graph": ${html.includes('graph')}`);
  
  // Extract the new memh from this page
  const memhMatch = html.match(/memh=(-?\d+)/);
  const meterMemh = memhMatch ? memhMatch[1] : memh;
  
  // Now look for CSV/export links or try known endpoints
  const allLinks: string[] = [];
  const linkPattern = /href=['"]([^'"]+)['"]/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    if (!match[1].includes('JavaScript:') && !match[1].startsWith('#')) {
      allLinks.push(match[1]);
    }
  }
  
  const dataLinks = allLinks.filter(l => /csv|profile|graph|export|download/i.test(l));
  console.log(`Meter ${serial}: ${dataLinks.length} data links, ${allLinks.length} total links`);
  
  // Try CSV endpoints with the meter-specific memh
  const csvUrls = [
    `${PNPSCADA_BASE_URL}/profilecsv?memh=${meterMemh}&startdate=${startDate}&enddate=${endDate}`,
    `${PNPSCADA_BASE_URL}/profileCSV?memh=${meterMemh}&startdate=${startDate}&enddate=${endDate}`,
    `${PNPSCADA_BASE_URL}/exportcsv?memh=${meterMemh}&startdate=${startDate}&enddate=${endDate}`,
  ];
  
  for (const csvUrl of csvUrls) {
    console.log(`Trying: ${csvUrl}`);
    const csvResponse = await fetch(csvUrl, {
      headers: { 'Cookie': meterJar.toString() },
    });
    meterJar.addFromResponse(csvResponse);
    const text = await csvResponse.text();
    
    if (text.length > 100 && !text.includes('<HTML') && !text.includes('ERROR') && !text.includes('authenticate')) {
      console.log(`CSV found: ${text.length} bytes`);
      return text;
    }
    console.log(`${csvUrl}: ${text.length} bytes, ${text.includes('<HTML') ? 'HTML' : text.slice(0, 80)}`);
  }
  
  return JSON.stringify({
    error: 'No CSV export found',
    meterPageLength: html.length,
    dataLinks,
    allLinks: allLinks.slice(0, 30),
    htmlSnippet: html.slice(0, 3000),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, serial, serials, startDate, endDate, entityId, classId } = await req.json();

    const session = await createSession();
    if (!session.authenticated) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { jar, memh, overviewHtml } = session;

    // === LIST METERS ===
    if (action === 'list-meters') {
      const meters = parseMeters(overviewHtml);
      console.log(`Parsed ${meters.length} meters from overview`);
      return new Response(JSON.stringify({ success: true, meters }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DOWNLOAD CSV (single meter) ===
    if (action === 'download-csv') {
      if (!serial || !startDate || !endDate || !entityId || !classId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing serial, entityId, classId, startDate, or endDate' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const csvData = await downloadMeterCSV(jar, memh, entityId, classId, serial, startDate, endDate);
      return new Response(JSON.stringify({ success: true, serial, csvData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DOWNLOAD ALL ===
    if (action === 'download-all') {
      if (!serials?.length || !startDate || !endDate) {
        return new Response(JSON.stringify({ success: false, error: 'Missing serials array, startDate, or endDate' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results: { serial: string; csvData: string; error?: string }[] = [];
      for (const m of serials) {
        try {
          const csvData = await downloadMeterCSV(jar, memh, m.entityId, m.classId, m.serial, startDate, endDate);
          results.push({ serial: m.serial, csvData });
        } catch (err) {
          console.error(`Error downloading meter ${m.serial}:`, err);
          results.push({ serial: m.serial, csvData: '', error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DEBUG ===
    if (action === 'debug') {
      return new Response(JSON.stringify({
        success: true,
        authenticated: true,
        memh,
        cookieCount: jar.count,
        htmlSample: overviewHtml.slice(0, 10000),
        htmlLength: overviewHtml.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action. Use "list-meters", "download-csv", "download-all", or "debug"'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('PNPSCADA error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
