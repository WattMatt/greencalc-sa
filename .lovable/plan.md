

## Fix: Add API Key Authentication for External Scripts

### Problem
The `upload-generation-csv` edge function currently only accepts:
1. The Supabase service role key (which you can't easily retrieve)
2. A logged-in user's JWT token (complex for external Python scripts)

Antigravity's script is getting 401 Unauthorized because it doesn't have either.

### Solution
Add a dedicated **API key** auth path to the edge function. We'll create a simple shared secret called `UPLOAD_API_KEY`, store it as a backend secret, and give it to Antigravity to use in their script.

### Steps

1. **Create an `UPLOAD_API_KEY` secret**
   - Generate a random key (e.g. a UUID or hex string)
   - Store it as a backend secret using the secrets tool
   - Share this same key with Antigravity for their `.env` file

2. **Update `upload-generation-csv/index.ts` auth logic**
   - Add a third auth path: check if the Bearer token matches `UPLOAD_API_KEY`
   - Keep existing service role and JWT auth paths unchanged
   - The change is ~5 lines in the auth section (lines 63-80)

   Before:
   ```
   const isServiceRole = token === serviceRoleKey;
   if (!isServiceRole && (claimsErr || !claimsData?.claims?.sub)) { ... 401 }
   ```

   After:
   ```
   const uploadApiKey = Deno.env.get("UPLOAD_API_KEY");
   const isServiceRole = token === serviceRoleKey;
   const isApiKey = uploadApiKey && token === uploadApiKey;
   if (!isServiceRole && !isApiKey && (claimsErr || !claimsData?.claims?.sub)) { ... 401 }
   ```

3. **Share the key with Antigravity**
   - They put it in their `.env` as `UPLOAD_API_KEY=<the value>`
   - Their script sends: `Authorization: Bearer <the key>`
   - Done. No dashboard hunting required.

### Technical Details
- File modified: `supabase/functions/upload-generation-csv/index.ts`
- New secret: `UPLOAD_API_KEY`
- No database changes needed
- No other files affected
- The edge function redeploys automatically

### Security
- The API key only grants access to this one endpoint (not full DB access like service role)
- Can be rotated independently without affecting other services
- Scoped to CSV upload functionality only
