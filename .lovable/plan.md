

## Rewrite fetch-pnpscada to Match Working Python Reference

### Problem Summary
The current edge function follows the right general steps but has two critical issues:
1. **Missing JSESSIONID cookie** -- The Deno `Headers` API may merge or drop multiple `Set-Cookie` headers, so the Jetty session cookie is lost
2. **`_DataDownload` missing key parameters** -- The working Python script includes `doBill=1` and `selGNAME_UTILITY` in the download request, which our code omits

### What Changes

**Rewrite `supabase/functions/fetch-pnpscada/index.ts`** to closely mirror the working Python script:

#### 1. Fix Cookie Capture (Critical)

Replace the current `CookieJar.addFromResponse` with a method that also parses `response.headers.get('set-cookie')` as a **comma-delimited** string (how Deno may flatten multiple Set-Cookie headers). This catches cookies that `getSetCookie()` and `forEach` miss:

```typescript
// Parse comma-delimited set-cookie (Deno flattening workaround)
const raw = response.headers.get('set-cookie');
if (raw) {
  // Split on comma followed by a cookie name= pattern (not commas inside dates like "Thu, 01-Jan")
  const parts = raw.split(/,(?=[^ ]+=)/);
  for (const part of parts) {
    const cookie = part.trim().split(';')[0];
    const [name] = cookie.split('=');
    if (name) this.cookies.set(name.trim(), cookie);
  }
}
```

#### 2. Simplify `_DataDownload` Parameters

Match the Python reference exactly. Remove `TEMPPATH`/`LOCALTEMPPATH` and add `doBill=1` and `selGNAME_UTILITY`:

```text
/_DataDownload?CSV=Yes
  &selGNAME_UTILITY={serial}$Electricity
  &GSTARTD={day}&GSTARTM={month}&GSTARTY={year}
  &GENDD={day}&GENDM={month}&GENDY={year}
  &doBill=1
```

#### 3. Add a Debug Action for Raw Headers

Add a `debug-cookies` action that performs the login + overview + select meter + graph load sequence and returns the **raw headers from every response** so we can verify exactly which cookies are being captured and which are lost. This helps us diagnose if the fix works or if something else is wrong.

#### 4. Keep Existing Flow Structure

The 5-step flow stays the same (login -> overview -> select meter -> graph -> download). Only the cookie capture and download URL parameters change.

### Files Modified
- `supabase/functions/fetch-pnpscada/index.ts` -- Fix cookie parsing, update `_DataDownload` params, add debug-cookies action

