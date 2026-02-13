import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PNPSCADA_BASE_URL = 'https://thukela-kadesh.pnpscada.com';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
};

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
    // Method 1: getSetCookie (modern API)
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    for (const header of setCookieHeaders) {
      const cookie = header.split(';')[0];
      const [name] = cookie.split('=');
      if (name) this.cookies.set(name.trim(), cookie);
    }

    // Method 2: forEach iteration fallback
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        const cookie = value.split(';')[0];
        const [name] = cookie.split('=');
        if (name) this.cookies.set(name.trim(), cookie);
      }
    });

    console.log('Cookies now:', Array.from(this.cookies.keys()).join(', '), '| count:', this.cookies.size);
  }

  toString(): string {
    return Array.from(this.cookies.values()).join('; ');
  }

  get count(): number {
    return this.cookies.size;
  }
}

// Login and return session with memh token
async function createSession(): Promise<{ jar: CookieJar; memh: string; overviewHtml: string; authenticated: boolean }> {
  const username = Deno.env.get('PNPSCADA_USERNAME');
  const password = Deno.env.get('PNPSCADA_PASSWORD');
  if (!username || !password) throw new Error('PNPSCADA credentials not configured');

  const jar = new CookieJar();
  const formData = new URLSearchParams();
  formData.append('lusr', username);
  formData.append('lpwd', password);

  // POST login
  const loginResponse = await fetch(`${PNPSCADA_BASE_URL}/_Login`, {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    redirect: 'manual',
  });
  
  // Debug: log ALL headers from login response
  console.log('Login response status:', loginResponse.status);
  console.log('Login getSetCookie:', JSON.stringify(loginResponse.headers.getSetCookie?.() || []));
  console.log('Login get set-cookie:', loginResponse.headers.get('set-cookie'));
  const allHeaders: string[] = [];
  loginResponse.headers.forEach((v, k) => allHeaders.push(`${k}: ${v}`));
  console.log('Login ALL headers:', JSON.stringify(allHeaders));
  
  jar.addFromResponse(loginResponse);

  if (loginResponse.status !== 302 && loginResponse.status !== 200) {
    return { jar, memh: '', overviewHtml: '', authenticated: false };
  }

  // Follow redirect chain
  let currentUrl = loginResponse.headers.get('location') || '/overview';
  let overviewHtml = '';
  let redirectCount = 0;

  while (currentUrl && redirectCount < 5) {
    const fullUrl = currentUrl.startsWith('http') ? currentUrl : `${PNPSCADA_BASE_URL}${currentUrl}`;
    const response = await fetch(fullUrl, {
      headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() },
      redirect: 'manual',
    });
    jar.addFromResponse(response);
    const nextRedirect = response.headers.get('location');
    if (nextRedirect) {
      currentUrl = nextRedirect;
      redirectCount++;
    } else {
      overviewHtml = await response.text();
      break;
    }
  }

  // If we got a login page, try overview directly
  if (overviewHtml.includes('Please authenticate') || overviewHtml.includes('_Login')) {
    const overviewResponse = await fetch(`${PNPSCADA_BASE_URL}/overview`, {
      headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() },
    });
    jar.addFromResponse(overviewResponse);
    overviewHtml = await overviewResponse.text();
  }

  const memhMatch = overviewHtml.match(/memh=(-?\d+)/);
  const memh = memhMatch ? memhMatch[1] : '';
  const authenticated = overviewHtml.includes('Meter Account') && memh !== '';
  console.log('Session:', authenticated ? 'OK' : 'FAIL', '| memh:', memh, '| cookies:', jar.count);
  return { jar, memh, overviewHtml, authenticated };
}

// Parse meters from overview HTML
function parseMetersFromOverview(html: string): MeterInfo[] {
  const meters: MeterInfo[] = [];
  const pattern = /PNPENTID=(\d+)&(?:amp;)?PNPENTCLASID=(\d+)[^>]*>\s*(\d+)\s*<\/A>\s*<\/TD>\s*\n?\s*<TD>(?:&nbsp;|\s)*([^<]+)<\/TD>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = match[4].trim();
    if (name) {
      meters.push({ entityId: match[1], classId: match[2], serial: match[3].trim(), name });
    }
  }
  const seen = new Set<string>();
  return meters.filter(m => { if (seen.has(m.serial)) return false; seen.add(m.serial); return true; });
}

// Search meters via browseopen.jsp
async function searchMeters(jar: CookieJar, memh: string, searchStr: string = '*'): Promise<MeterInfo[]> {
  const formData = new URLSearchParams();
  formData.append('memh', memh);
  formData.append('clas', '%');
  formData.append('searchStr', searchStr);

  const response = await fetch(`${PNPSCADA_BASE_URL}/browseopen.jsp`, {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': jar.toString() },
    body: formData.toString(),
  });
  jar.addFromResponse(response);
  const html = await response.text();

  // Parse <option value="entityId,classId">Label (serial)</option>
  const meters: MeterInfo[] = [];
  const optionPattern = /<option\s+value="(\d+),(\d+)"[^>]*>([^<]+)<\/option>/gi;
  let match;
  while ((match = optionPattern.exec(html)) !== null) {
    const label = match[3].trim();
    // Extract serial from label - typically last part in parentheses like (98124008)
    const serialMatch = label.match(/\((\d+)\)\s*$/);
    const serial = serialMatch ? serialMatch[1] : '';
    meters.push({ entityId: match[1], classId: match[2], serial, name: label });
  }
  console.log(`browseopen.jsp search "${searchStr}": ${meters.length} results`);
  return meters;
}

// Select a meter into the session, load its graph page with full params, and get its memh
async function selectMeter(jar: CookieJar, memh: string, entityId: string, classId: string, serial: string, startDate: string, endDate: string): Promise<{ memh: string; graphHtml: string }> {
  // Step 1: Load the meter overview page to set session context
  const overviewUrl = `${PNPSCADA_BASE_URL}/overview?PNPENTID=${entityId}&PNPENTCLASID=${classId}&memh=${memh}`;
  console.log('Selecting meter (overview):', overviewUrl);
  const overviewResp = await fetch(overviewUrl, { headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() } });
  jar.addFromResponse(overviewResp);
  const overviewHtml = await overviewResp.text();
  console.log('Meter overview:', overviewHtml.length, 'bytes, title:', overviewHtml.includes('Overview') ? 'Overview' : overviewHtml.includes('Login') ? 'LOGIN PAGE!' : 'Unknown');
  const overviewMemhMatch = overviewHtml.match(/memh=(-?\d+)/);
  const overviewMemh = overviewMemhMatch ? overviewMemhMatch[1] : memh;

  // Step 2: Load the graph page with FULL parameters to prepare server-side data
  const start = new Date(startDate);
  const graphUrl = `${PNPSCADA_BASE_URL}/_Graph?hasTariffs=true&hasBills=false&hasCustomers=false&memh=${overviewMemh}&hasTOU=$hasTOU&doBill=1&GSTARTH=0&GSTARTN=0&GENDH=0&GENDN=0&TRIGHT0=False&TLEFT0=True&TRIGHT1=False&TLEFT1=True&TRIGHT2=False&TLEFT2=True&TRIGHT3=False&TLEFT3=True&TRIGHT4=False&TLEFT4=True&TRIGHT5=False&TLEFT5=True&TLEFT6=False&TRIGHT6=True&GINCY=${start.getUTCFullYear()}&GINCM=${start.getUTCMonth() + 1}&GINCD=1&TIMEMODE=2&selGNAME_UTILITY=${serial}$Electricity&TGIDX=0`;
  console.log('Loading graph page (full params):', graphUrl);
  const graphResp = await fetch(graphUrl, { headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString(), 'Referer': overviewUrl } });
  jar.addFromResponse(graphResp);
  const graphHtml = await graphResp.text();
  const graphMemhMatch = graphHtml.match(/memh=(-?\d+)/);
  const finalMemh = graphMemhMatch ? graphMemhMatch[1] : overviewMemh;
  console.log('Meter ready, memh:', finalMemh, '| graph page:', graphHtml.length, 'bytes', '| cookies:', jar.count);
  console.log('Graph HTML snippet (first 2000):', graphHtml.slice(0, 2000));
  console.log('Graph HTML snippet (last 1000):', graphHtml.slice(-1000));

  // Step 3: Wait for server to prepare data (server needs ~5s)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Log all links and data endpoints found on graph page
  const dataLinks: string[] = [];
  const linkPattern = /href=['"]([^'"]*(?:DataDownload|csv|download|data|profile|nrs)[^'"]*)['"]/gi;
  let match;
  while ((match = linkPattern.exec(graphHtml)) !== null) {
    dataLinks.push(match[1]);
  }
  console.log('Graph page data links:', JSON.stringify(dataLinks.slice(0, 10)));

  return { memh: finalMemh, graphHtml };
}

// Build _DataDownload URL and fetch CSV
async function downloadCSV(jar: CookieJar, memh: string, serial: string, startDate: string, endDate: string): Promise<string> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const csvUrl = `${PNPSCADA_BASE_URL}/_DataDownload?CSV=Yes&TEMPPATH=../temp/&LOCALTEMPPATH=docroot/temp/&GSTARTH=0&GSTARTN=0&GENDH=0&GENDN=0&GSTARTD=${start.getUTCDate()}&GSTARTY=${start.getUTCFullYear()}&GSTARTM=${start.getUTCMonth() + 1}&GENDD=${end.getUTCDate()}&GENDY=${end.getUTCFullYear()}&GENDM=${end.getUTCMonth() + 1}&selGNAME_UTILITY=${serial}$Electricity&TGIDX=0&memh=${memh}`;
  console.log('Downloading CSV:', csvUrl);
  console.log('Sending cookies:', jar.toString());

  const response = await fetch(csvUrl, {
    headers: {
      'Cookie': jar.toString(),
      'Referer': `${PNPSCADA_BASE_URL}/_Graph?memh=${memh}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
    },
  });
  jar.addFromResponse(response);

  const headers = Object.fromEntries(response.headers.entries());
  console.log(`CSV response headers:`, JSON.stringify(headers));

  // Try stream reading to get all data
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalBytes += value.length;
      }
    }
    
    console.log(`Stream read: ${totalBytes} bytes in ${chunks.length} chunks`);
    
    if (totalBytes > 0) {
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      return new TextDecoder().decode(merged);
    }
  }

  console.log('Stream empty, content-length was:', response.headers.get('content-length'));
  return '';
}

// Download CSV using an existing session (no re-login)
async function downloadMeterCSV(jar: CookieJar, memh: string, entityId: string, classId: string, serial: string, startDate: string, endDate: string): Promise<string> {
  const { memh: meterMemh, graphHtml } = await selectMeter(jar, memh, entityId, classId, serial, startDate, endDate);

  // Extract any _DataDownload link from graph page HTML
  const downloadLinkMatch = graphHtml.match(/href="([^"]*_DataDownload[^"]*)"/i);
  if (downloadLinkMatch) {
    const downloadLink = downloadLinkMatch[1].replace(/&amp;/g, '&');
    const fullUrl = downloadLink.startsWith('http') ? downloadLink : `${PNPSCADA_BASE_URL}/${downloadLink.replace(/^\//, '')}`;
    console.log('Found _DataDownload link:', fullUrl);

    // Modify with our date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    let modifiedUrl = fullUrl
      .replace(/GSTARTD=\d+/, `GSTARTD=${start.getUTCDate()}`)
      .replace(/GSTARTY=\d+/, `GSTARTY=${start.getUTCFullYear()}`)
      .replace(/GSTARTM=\d+/, `GSTARTM=${start.getUTCMonth() + 1}`)
      .replace(/GENDD=\d+/, `GENDD=${end.getUTCDate()}`)
      .replace(/GENDY=\d+/, `GENDY=${end.getUTCFullYear()}`)
      .replace(/GENDM=\d+/, `GENDM=${end.getUTCMonth() + 1}`);
    
    console.log('Modified URL:', modifiedUrl);
    const resp = await fetch(modifiedUrl, {
      headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() },
    });
    jar.addFromResponse(resp);
    const text = await resp.text();
    console.log('Graph link download:', text.length, 'bytes, status:', resp.status);
    if (text.length > 0 && !text.includes('<HTML') && !text.includes('authenticate')) {
      return text;
    }
  }
  // Fallback: constructed URL
  const csvData = await downloadCSV(jar, meterMemh, serial, startDate, endDate);
  if (csvData.includes('<HTML') || csvData.includes('<html') || csvData.includes('authenticate')) {
    return JSON.stringify({
      error: 'Got HTML instead of CSV',
      graphHtmlSnippet: graphHtml.slice(0, 5000),
    });
  }
  return csvData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, serial, serials, startDate, endDate, entityId, classId, searchStr } = await req.json();

    const session = await createSession();
    if (!session.authenticated) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication failed' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { jar, memh, overviewHtml } = session;

    // === LIST METERS ===
    if (action === 'list-meters') {
      // Parse from overview page
      const overviewMeters = parseMetersFromOverview(overviewHtml);

      // Also search via browseopen.jsp for more complete results
      let browseMeters: MeterInfo[] = [];
      try {
        browseMeters = await searchMeters(jar, memh, searchStr || '*');
      } catch (err) {
        console.error('browseopen.jsp search failed:', err);
      }

      // Merge: overview meters take priority (they have cleaner names), add any new from browse
      const seenSerials = new Set(overviewMeters.map(m => m.serial));
      const merged = [...overviewMeters];
      for (const bm of browseMeters) {
        if (bm.serial && !seenSerials.has(bm.serial)) {
          seenSerials.add(bm.serial);
          merged.push(bm);
        }
      }

      console.log(`Meters: ${overviewMeters.length} from overview, ${browseMeters.length} from browse, ${merged.length} merged`);
      return new Response(JSON.stringify({ success: true, meters: merged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DOWNLOAD CSV (single meter) ===
    if (action === 'download-csv') {
      if (!serial || !startDate || !endDate || !entityId || !classId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing serial, entityId, classId, startDate, or endDate' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        success: true, authenticated: true, memh, cookieCount: jar.count,
        htmlSample: overviewHtml.slice(0, 10000), htmlLength: overviewHtml.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action. Use "list-meters", "download-csv", "download-all", or "debug"' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('PNPSCADA error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
