

## Minimal Dropbox Test Edge Function

### What Gets Built

**1. Edge function: `supabase/functions/dropbox-proxy/index.ts`**

A single edge function that accepts a POST with an `action` parameter. For this test phase, it supports one action:

- **`list_folder`**: Takes an optional `path` (defaults to `""` for root) and an `access_token`, then calls the Dropbox API `POST https://api.dropboxapi.com/2/files/list_folder` and returns the results.

The access token is passed in the request body for now (since the short-lived token you generated expires in ~4 hours, this keeps things simple for testing). Once we confirm connectivity, we will implement the full OAuth refresh token flow.

**2. Config: `supabase/config.toml`** (auto-managed)

Registers `[functions.dropbox-proxy]` with `verify_jwt = false`.

### Testing Plan

After deployment:
1. I will call the edge function with `action: "list_folder"`, `path: ""`, and your access token
2. The response will show your root Dropbox folder structure
3. We can then navigate into subfolders to confirm you can see the shared folders
4. Based on what we see, we decide how to scope the browser in the UI

### Technical Details

The edge function implementation:

```text
POST /dropbox-proxy
Body: {
  "action": "list_folder",
  "path": "",           // "" = root, or "/Some Folder"
  "access_token": "sl.u.xxx..."
}

Response: {
  "entries": [
    { ".tag": "folder", "name": "Projects", "path_lower": "/projects" },
    { ".tag": "file", "name": "readme.txt", "path_lower": "/readme.txt", "size": 1234 }
  ],
  "has_more": false
}
```

The function proxies to `https://api.dropboxapi.com/2/files/list_folder` with the provided token, includes standard CORS headers, and returns the Dropbox API response directly.

### Files
- **New**: `supabase/functions/dropbox-proxy/index.ts`

No database changes needed for this test phase.

