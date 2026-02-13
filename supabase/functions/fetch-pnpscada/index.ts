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
  'Cache-Control': 'no-cache, no-store',
  'Pragma': 'no-cache',
};

interface MeterInfo {
  entityId: string;
  serial: string;
  name: string;
  classId: string;
}

// Cookie jar - accumulates cookies across requests with robust parsing
class CookieJar {
  private cookies: Map<string, string> = new Map();

  addFromResponse(response: Response) {
    // Method 1: getSetCookie (modern API)
    try {
      const setCookieHeaders = response.headers.getSetCookie?.() || [];
      for (const header of setCookieHeaders) {
        this._parseSingle(header);
      }
    } catch (_) { /* ignore */ }

    // Method 2: forEach iteration fallback
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        this._parseSingle(value);
      }
    });

    // Method 3: get('set-cookie') — Deno may flatten multiple Set-Cookie into one comma-delimited string
    const raw = response.headers.get('set-cookie');
    if (raw) {
      // Split on comma followed by a token= pattern, but NOT commas inside date strings like "Thu, 01-Jan"
      const parts = raw.split(/,(?=\s*[A-Za-z_][A-Za-z0-9_]*=)/);
      for (const part of parts) {
        this._parseSingle(part.trim());
      }
    }

    console.log('Cookies now:', Array.from(this.cookies.keys()).join(', '), '| count:', this.cookies.size);
  }

  private _parseSingle(setCookieStr: string) {
    const cookie = setCookieStr.split(';')[0];
    const eqIdx = cookie.indexOf('=');
    if (eqIdx > 0) {
      const name = cookie.substring(0, eqIdx).trim();
      const value = cookie.substring(eqIdx + 1).trim();
      if (!name) return;

      // Check if this is a deletion (Expires in the past or empty value)
      const lowerStr = setCookieStr.toLowerCase();
      const expiresMatch = lowerStr.match(/expires=([^;]+)/);
      if (expiresMatch) {
        const expiresDate = new Date(expiresMatch[1].trim());
        if (!isNaN(expiresDate.getTime()) && expiresDate.getTime() < Date.now()) {
          console.log(`Cookie "${name}" expired, removing from jar`);
          this.cookies.delete(name);
          return;
        }
      }
      // Also remove if value is empty
      if (!value) {
        console.log(`Cookie "${name}" has empty value, removing from jar`);
        this.cookies.delete(name);
        return;
      }

      this.cookies.set(name, cookie);
    }
  }

  // Return raw headers info for debugging
  static rawHeaders(response: Response): string[] {
    const headers: string[] = [];
    response.headers.forEach((v, k) => headers.push(`${k}: ${v}`));
    return headers;
  }

  toString(): string {
    return Array.from(this.cookies.values()).join('; ');
  }

  get count(): number {
    return this.cookies.size;
  }

  get names(): string[] {
    return Array.from(this.cookies.keys());
  }
}

// Login and return session
async function createSession(): Promise<{ jar: CookieJar; memh: string; overviewHtml: string; authenticated: boolean; rawHeaderLog: string[][] }> {
  const username = Deno.env.get('PNPSCADA_USERNAME');
  const password = Deno.env.get('PNPSCADA_PASSWORD');
  if (!username || !password) throw new Error('PNPSCADA credentials not configured');

  const jar = new CookieJar();
  const rawHeaderLog: string[][] = [];

  // Step 0: GET the root page to establish a JSESSIONID before login (like a browser navigating to the site)
  // NOTE: Do NOT GET /_Login — the server treats it as a failed login attempt and taints the session
  console.log('Step 0 - Pre-establishing session by GETting root page...');
  const preLoginResponse = await fetch(`${PNPSCADA_BASE_URL}/`, {
    method: 'GET',
    headers: { ...BROWSER_HEADERS },
    redirect: 'manual',
  });
  jar.addFromResponse(preLoginResponse);
  rawHeaderLog.push(CookieJar.rawHeaders(preLoginResponse));
  console.log('Pre-login status:', preLoginResponse.status, '| cookies:', jar.names.join(', '));
  // Follow one redirect if needed to get the session cookie
  const preRedirect = preLoginResponse.headers.get('location');
  if (preRedirect) {
    const preRedirectUrl = preRedirect.startsWith('http') ? preRedirect : `${PNPSCADA_BASE_URL}${preRedirect}`;
    console.log('Pre-login redirect to:', preRedirectUrl);
    const preRedirectResp = await fetch(preRedirectUrl, {
      headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() },
      redirect: 'manual',
    });
    jar.addFromResponse(preRedirectResp);
    rawHeaderLog.push(CookieJar.rawHeaders(preRedirectResp));
    await preRedirectResp.text();
    console.log('Pre-login after redirect cookies:', jar.names.join(', '));
  } else {
    await preLoginResponse.text();
  }

  // Step 1: POST login with credentials, sending the pre-established session cookies
  const formData = new URLSearchParams();
  formData.append('lusr', username);
  formData.append('lpwd', password);

  const loginResponse = await fetch(`${PNPSCADA_BASE_URL}/_Login`, {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': jar.toString() },
    body: formData.toString(),
    redirect: 'manual',
  });
  jar.addFromResponse(loginResponse);
  rawHeaderLog.push(CookieJar.rawHeaders(loginResponse));
  console.log('Login status:', loginResponse.status, '| cookies:', jar.names.join(', '));

  if (loginResponse.status !== 302 && loginResponse.status !== 200) {
    return { jar, memh: '', overviewHtml: '', authenticated: false, rawHeaderLog };
  }

  // Follow redirect — but STOP if redirected to /launch (which clears psl and breaks auth)
  let currentUrl = loginResponse.headers.get('location') || '/overview';
  let overviewHtml = '';
  let redirectCount = 0;

  while (currentUrl && redirectCount < 5) {
    // If the redirect goes to /launch, SKIP it — it clears the psl cookie and breaks auth
    if (currentUrl.includes('/launch')) {
      console.log('Skipping /launch redirect, going to /overview directly');
      currentUrl = '/overview';
    }
    const fullUrl = currentUrl.startsWith('http') ? currentUrl : `${PNPSCADA_BASE_URL}${currentUrl}`;
    const response = await fetch(fullUrl, {
      headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() },
      redirect: 'manual',
    });
    jar.addFromResponse(response);
    rawHeaderLog.push(CookieJar.rawHeaders(response));
    const nextRedirect = response.headers.get('location');
    if (nextRedirect && !nextRedirect.includes('/launch')) {
      currentUrl = nextRedirect;
      redirectCount++;
    } else if (nextRedirect && nextRedirect.includes('/launch')) {
      // Don't follow to /launch, fetch /overview directly instead
      console.log('Redirect to /launch detected, fetching /overview directly with cookies:', jar.names.join(', '));
      const overviewResponse = await fetch(`${PNPSCADA_BASE_URL}/overview`, {
        headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() },
      });
      jar.addFromResponse(overviewResponse);
      rawHeaderLog.push(CookieJar.rawHeaders(overviewResponse));
      overviewHtml = await overviewResponse.text();
      break;
    } else {
      overviewHtml = await response.text();
      break;
    }
  }

  // Fallback: if we still got a login page
  if (overviewHtml.includes('Please authenticate') || overviewHtml.includes('_Login')) {
    console.log('Still on login page, trying /overview directly');
    const overviewResponse = await fetch(`${PNPSCADA_BASE_URL}/overview`, {
      headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() },
    });
    jar.addFromResponse(overviewResponse);
    rawHeaderLog.push(CookieJar.rawHeaders(overviewResponse));
    overviewHtml = await overviewResponse.text();
  }

  const memhMatch = overviewHtml.match(/memh=(-?\d+)/);
  const memh = memhMatch ? memhMatch[1] : '';
  const authenticated = overviewHtml.includes('Meter Account') && memh !== '';
  console.log('Session:', authenticated ? 'OK' : 'FAIL', '| memh:', memh, '| cookies:', jar.count, '|', jar.names.join(', '));
  return { jar, memh, overviewHtml, authenticated, rawHeaderLog };
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

  const meters: MeterInfo[] = [];
  const optionPattern = /<option\s+value="(\d+),(\d+)"[^>]*>([^<]+)<\/option>/gi;
  let match;
  while ((match = optionPattern.exec(html)) !== null) {
    const label = match[3].trim();
    const serialMatch = label.match(/\((\d+)\)\s*$/);
    const serial = serialMatch ? serialMatch[1] : '';
    meters.push({ entityId: match[1], classId: match[2], serial, name: label });
  }
  console.log(`browseopen.jsp search "${searchStr}": ${meters.length} results`);
  return meters;
}

// Step 3: Select meter by loading its overview page (sets server-side context)
async function selectMeter(jar: CookieJar, memh: string, entityId: string, classId: string): Promise<{ memh: string; rawHeaders: string[] }> {
  const url = `${PNPSCADA_BASE_URL}/overview?PNPENTID=${entityId}&PNPENTCLASID=${classId}&memh=${memh}`;
  console.log('Step 3 - Select meter:', url);
  const resp = await fetch(url, { headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString() } });
  jar.addFromResponse(resp);
  const html = await resp.text();
  const rawHeaders = CookieJar.rawHeaders(resp);

  const memhMatch = html.match(/memh=(-?\d+)/);
  const newMemh = memhMatch ? memhMatch[1] : memh;
  console.log('Select meter done | memh:', newMemh, '| cookies:', jar.count, '| html:', html.length, 'bytes');
  return { memh: newMemh, rawHeaders };
}

// Step 4: Load graph page to prepare server-side data
async function prepareGraph(jar: CookieJar, memh: string, serial: string, startDate: string): Promise<{ memh: string; graphHtml: string; rawHeaders: string[] }> {
  const start = new Date(startDate);
  const params = new URLSearchParams({
    hasTariffs: 'true',
    hasBills: 'false',
    hasCustomers: 'false',
    memh,
    hasTOU: '$hasTOU',
    doBill: '1',
    GSTARTH: '0', GSTARTN: '0', GENDH: '0', GENDN: '0',
    TRIGHT0: 'False', TLEFT0: 'True',
    TRIGHT1: 'False', TLEFT1: 'True',
    TRIGHT2: 'False', TLEFT2: 'True',
    TRIGHT3: 'False', TLEFT3: 'True',
    TRIGHT4: 'False', TLEFT4: 'True',
    TRIGHT5: 'False', TLEFT5: 'True',
    TLEFT6: 'False', TRIGHT6: 'True',
    GINCY: String(start.getUTCFullYear()),
    GINCM: String(start.getUTCMonth() + 1),
    GINCD: '1',
    TIMEMODE: '2',
    selGNAME_UTILITY: `${serial}$Electricity`,
    TGIDX: '0',
  });

  const graphUrl = `${PNPSCADA_BASE_URL}/_Graph?${params.toString()}`;
  console.log('Step 4 - Prepare graph:', graphUrl);
  const resp = await fetch(graphUrl, {
    headers: { ...BROWSER_HEADERS, 'Cookie': jar.toString(), 'Referer': `${PNPSCADA_BASE_URL}/overview` },
  });
  jar.addFromResponse(resp);
  const graphHtml = await resp.text();
  const rawHeaders = CookieJar.rawHeaders(resp);
  const memhMatch = graphHtml.match(/memh=(-?\d+)/);
  const newMemh = memhMatch ? memhMatch[1] : memh;
  console.log('Graph page:', graphHtml.length, 'bytes | memh:', newMemh, '| cookies:', jar.count);
  console.log('Graph snippet (first 500):', graphHtml.slice(0, 500));

  // Wait for server to prepare data
  await new Promise(resolve => setTimeout(resolve, 5000));

  return { memh: newMemh, graphHtml, rawHeaders };
}

// Step 5: Download CSV — simplified params matching Python reference
async function downloadCSV(jar: CookieJar, memh: string, serial: string, startDate: string, endDate: string): Promise<string> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const params = new URLSearchParams({
    CSV: 'Yes',
    selGNAME_UTILITY: `${serial}$Electricity`,
    GSTARTD: String(start.getUTCDate()),
    GSTARTM: String(start.getUTCMonth() + 1),
    GSTARTY: String(start.getUTCFullYear()),
    GENDD: String(end.getUTCDate()),
    GENDM: String(end.getUTCMonth() + 1),
    GENDY: String(end.getUTCFullYear()),
    doBill: '1',
    memh,
    TGIDX: '0',
  });

  const csvUrl = `${PNPSCADA_BASE_URL}/_DataDownload?${params.toString()}`;
  console.log('Step 5 - Download CSV:', csvUrl);
  console.log('Sending cookies:', jar.toString());

  const response = await fetch(csvUrl, {
    headers: {
      'Cookie': jar.toString(),
      'Referer': `${PNPSCADA_BASE_URL}/_Graph?memh=${memh}`,
      'User-Agent': BROWSER_HEADERS['User-Agent'],
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
    },
  });
  jar.addFromResponse(response);

  const responseHeaders = Object.fromEntries(response.headers.entries());
  console.log('CSV response status:', response.status, '| headers:', JSON.stringify(responseHeaders));

  // Stream read
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); totalBytes += value.length; }
    }
    console.log(`Stream read: ${totalBytes} bytes in ${chunks.length} chunks`);
    if (totalBytes > 0) {
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      return new TextDecoder().decode(merged);
    }
  }

  console.log('Stream empty, content-length was:', response.headers.get('content-length'));
  return '';
}

// Full download flow for a single meter
async function downloadMeterCSV(jar: CookieJar, memh: string, entityId: string, classId: string, serial: string, startDate: string, endDate: string): Promise<string> {
  // Step 3: Select meter
  const { memh: meterMemh } = await selectMeter(jar, memh, entityId, classId);

  // Step 4: Prepare graph
  const { memh: graphMemh } = await prepareGraph(jar, meterMemh, serial, startDate);

  // Step 5: Download
  const csvData = await downloadCSV(jar, graphMemh, serial, startDate, endDate);

  if (csvData.includes('<HTML') || csvData.includes('<html') || csvData.includes('authenticate')) {
    return JSON.stringify({ error: 'Got HTML instead of CSV — session may have expired' });
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
      return new Response(JSON.stringify({ success: false, error: 'Authentication failed', rawHeaderLog: session.rawHeaderLog }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { jar, memh, overviewHtml } = session;

    // === LIST METERS ===
    if (action === 'list-meters') {
      const overviewMeters = parseMetersFromOverview(overviewHtml);
      let browseMeters: MeterInfo[] = [];
      try { browseMeters = await searchMeters(jar, memh, searchStr || '*'); } catch (err) { console.error('browseopen.jsp failed:', err); }

      const seenSerials = new Set(overviewMeters.map(m => m.serial));
      const merged = [...overviewMeters];
      for (const bm of browseMeters) {
        if (bm.serial && !seenSerials.has(bm.serial)) { seenSerials.add(bm.serial); merged.push(bm); }
      }

      return new Response(JSON.stringify({ success: true, meters: merged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DOWNLOAD CSV ===
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
        success: true, authenticated: true, memh, cookieCount: jar.count, cookieNames: jar.names,
        htmlSample: overviewHtml.slice(0, 10000), htmlLength: overviewHtml.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DEBUG-COOKIES === Full flow with raw header logs at every step
    if (action === 'debug-cookies') {
      const debugLog: { step: string; rawHeaders: string[]; cookieNames: string[]; cookieCount: number }[] = [];

      // Login headers already captured
      debugLog.push({ step: 'login+redirects', rawHeaders: session.rawHeaderLog.flat(), cookieNames: jar.names, cookieCount: jar.count });

      if (entityId && classId && serial && startDate && endDate) {
        // Step 3: Select meter
        const step3 = await selectMeter(jar, memh, entityId, classId);
        debugLog.push({ step: 'select-meter', rawHeaders: step3.rawHeaders, cookieNames: jar.names, cookieCount: jar.count });

        // Step 4: Graph
        const step4 = await prepareGraph(jar, step3.memh, serial, startDate);
        debugLog.push({ step: 'prepare-graph', rawHeaders: step4.rawHeaders, cookieNames: jar.names, cookieCount: jar.count });

        // Step 5: Download attempt
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dlParams = new URLSearchParams({
          CSV: 'Yes', selGNAME_UTILITY: `${serial}$Electricity`,
          GSTARTD: String(start.getUTCDate()), GSTARTM: String(start.getUTCMonth() + 1), GSTARTY: String(start.getUTCFullYear()),
          GENDD: String(end.getUTCDate()), GENDM: String(end.getUTCMonth() + 1), GENDY: String(end.getUTCFullYear()),
          doBill: '1', memh: step4.memh, TGIDX: '0',
        });
        const dlResp = await fetch(`${PNPSCADA_BASE_URL}/_DataDownload?${dlParams.toString()}`, {
          headers: { 'Cookie': jar.toString(), 'Referer': `${PNPSCADA_BASE_URL}/_Graph`, 'User-Agent': BROWSER_HEADERS['User-Agent'], 'Accept-Encoding': 'identity' },
        });
        const dlHeaders = CookieJar.rawHeaders(dlResp);
        const dlBody = await dlResp.text();
        debugLog.push({ step: 'download-csv', rawHeaders: dlHeaders, cookieNames: jar.names, cookieCount: jar.count });

        return new Response(JSON.stringify({
          success: true, debugLog, csvLength: dlBody.length, csvPreview: dlBody.slice(0, 1000),
          cookieString: jar.toString(),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        success: true, debugLog, note: 'Pass entityId, classId, serial, startDate, endDate for full flow debug',
        cookieString: jar.toString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action. Use "list-meters", "download-csv", "download-all", "debug", or "debug-cookies"' }), {
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
