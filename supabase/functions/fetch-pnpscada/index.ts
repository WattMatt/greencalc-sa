import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    redirect: 'manual',
  });
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
      headers: { 'Cookie': jar.toString() },
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
      headers: { 'Cookie': jar.toString() },
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': jar.toString() },
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

// Select a meter into the session, load its graph page, and get its memh
async function selectMeter(jar: CookieJar, memh: string, entityId: string, classId: string): Promise<string> {
  // Step 1: Load the meter overview page to set session context
  const overviewUrl = `${PNPSCADA_BASE_URL}/overview?PNPENTID=${entityId}&PNPENTCLASID=${classId}&memh=${memh}`;
  console.log('Selecting meter (overview):', overviewUrl);
  const overviewResp = await fetch(overviewUrl, { headers: { 'Cookie': jar.toString() } });
  jar.addFromResponse(overviewResp);
  const overviewHtml = await overviewResp.text();
  const overviewMemhMatch = overviewHtml.match(/memh=(-?\d+)/);
  const overviewMemh = overviewMemhMatch ? overviewMemhMatch[1] : memh;

  // Step 2: Load the graph page to fully establish data context
  const graphUrl = `${PNPSCADA_BASE_URL}/_Graph?memh=${overviewMemh}`;
  console.log('Loading graph page:', graphUrl);
  const graphResp = await fetch(graphUrl, { headers: { 'Cookie': jar.toString() } });
  jar.addFromResponse(graphResp);
  const graphHtml = await graphResp.text();
  const graphMemhMatch = graphHtml.match(/memh=(-?\d+)/);
  const finalMemh = graphMemhMatch ? graphMemhMatch[1] : overviewMemh;
  console.log('Meter ready, memh:', finalMemh, '| graph page:', graphHtml.length, 'bytes');
  return finalMemh;
}

// Build _DataDownload URL and fetch CSV
async function downloadCSV(jar: CookieJar, memh: string, serial: string, startDate: string, endDate: string): Promise<string> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const csvUrl = `${PNPSCADA_BASE_URL}/_DataDownload?CSV=Yes&TEMPPATH=../temp/&LOCALTEMPPATH=docroot/temp/&GSTARTH=0&GSTARTN=0&GENDH=0&GENDN=0&GSTARTD=${start.getUTCDate()}&GSTARTY=${start.getUTCFullYear()}&GSTARTM=${start.getUTCMonth() + 1}&GENDD=${end.getUTCDate()}&GENDY=${end.getUTCFullYear()}&GENDM=${end.getUTCMonth() + 1}&selGNAME_UTILITY=${serial}$Electricity&TGIDX=0&memh=${memh}`;
  console.log('Downloading CSV:', csvUrl);

  const response = await fetch(csvUrl, {
    headers: {
      'Cookie': jar.toString(),
      'Referer': `${PNPSCADA_BASE_URL}/_Graph?memh=${memh}`,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  jar.addFromResponse(response);
  const text = await response.text();
  console.log(`CSV response: status=${response.status}, length=${text.length}, content-type=${response.headers.get('content-type')}, snippet: ${text.slice(0, 200)}`);
  return text;
}

// Full per-meter download: fresh login -> select meter -> download CSV
async function downloadMeterCSV(entityId: string, classId: string, serial: string, startDate: string, endDate: string): Promise<string> {
  const session = await createSession();
  if (!session.authenticated) {
    return JSON.stringify({ error: 'Authentication failed for meter ' + serial });
  }

  // Select the meter into the session
  const meterMemh = await selectMeter(session.jar, session.memh, entityId, classId);

  // Download the CSV
  const csvData = await downloadCSV(session.jar, meterMemh, serial, startDate, endDate);

  // Validate we got actual CSV data
  if (csvData.includes('<HTML') || csvData.includes('<html') || csvData.includes('authenticate')) {
    return JSON.stringify({
      error: 'Got HTML instead of CSV - session may have expired',
      htmlSnippet: csvData.slice(0, 2000),
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

      const csvData = await downloadMeterCSV(entityId, classId, serial, startDate, endDate);
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
          // Fresh login per meter to avoid session conflicts
          const csvData = await downloadMeterCSV(m.entityId, m.classId, m.serial, startDate, endDate);
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
