

## Fix: Cookie Capture and CSV Download Debugging

### Problem
Testing confirms that `list-meters` works (serial 31177 = "Parkdene Checkers", entityId 109600, classId 109), but `download-csv` still returns 0 bytes. The server returns `content-length: 0` on every `_DataDownload` request.

### Root Cause: Missing JSESSIONID Cookie
The browser sends 5 cookies to the SCADA server, including the critical `JSESSIONID` (Jetty session cookie). Our edge function only captures 2 cookies. The `JSESSIONID` ties the server-side session state (including prepared graph data) to the client. Without it, `_DataDownload` has no data to serve.

The `Headers.getSetCookie()` method may not work reliably in the Supabase Edge Runtime (Deno). This means `Set-Cookie` headers from the Jetty server are silently dropped.

### Fix (in `supabase/functions/fetch-pnpscada/index.ts`)

**1. Fix CookieJar.addFromResponse to capture ALL cookies**

Replace the cookie capture logic with a more robust approach that:
- Tries `getSetCookie()` first
- Falls back to iterating raw headers via `response.headers.forEach()`
- Also tries parsing `response.headers.get('set-cookie')` as a last resort
- Logs captured cookie names after each response for debugging

```typescript
addFromResponse(response: Response) {
  // Method 1: getSetCookie (modern API)
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  if (setCookieHeaders.length > 0) {
    for (const header of setCookieHeaders) {
      const cookie = header.split(';')[0];
      const [name] = cookie.split('=');
      if (name) this.cookies.set(name.trim(), cookie);
    }
  }
  
  // Method 2: forEach iteration
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookie = value.split(';')[0];
      const [name] = cookie.split('=');
      if (name) this.cookies.set(name.trim(), cookie);
    }
  });
  
  console.log('Cookies now:', Array.from(this.cookies.keys()).join(', '));
}
```

**2. Add verbose logging to the download flow**

In `downloadMeterCSV`, after `selectMeter` returns, log:
- The exact cookie string being sent
- The full `_DataDownload` URL
- Whether a graph link was found in the HTML
- Response headers from the download attempt

In `downloadCSV`, log:
- The cookie string being sent with the request
- Response status and all headers

**3. Increase the delay after graph load**

The user mentioned the graph "updates after five seconds". Change the delay from 3 seconds to 5 seconds to match the browser experience.

**4. Try the exact `_DataDownload` link from the graph HTML**

The graph page HTML contains the exact download link with the correct `memh`. Instead of constructing our own URL, prefer the link extracted from the graph page. Only fall back to the constructed URL if no link is found.

### Files Modified
- `supabase/functions/fetch-pnpscada/index.ts` -- Fix cookie capture, add logging, increase delay

