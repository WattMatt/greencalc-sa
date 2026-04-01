

## Diagnosis: Preview Not Loading

**Root Cause**: The browser console shows `Error: supabaseUrl is required.` — the Supabase client fails to initialise because `VITE_SUPABASE_URL` is `undefined` at runtime.

This is NOT a code bug. The `.env` file exists with the correct values, and `src/integrations/supabase/client.ts` correctly reads `import.meta.env.VITE_SUPABASE_URL`. The Vite dev server is failing to inject the environment variables.

**Fix Plan**:

1. **Trigger a dev server restart** — Make a trivial whitespace edit to any file (e.g. add a blank line to `src/main.tsx`) to force the Vite dev server to restart and re-read the `.env` file. This is the standard fix for transient env loading failures in the Lovable sandbox.

No structural code changes are needed. The codebase compiles correctly — the issue is purely a dev server environment reload problem.

