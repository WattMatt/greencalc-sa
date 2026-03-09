

# Plan: Use filename as meter label for all new uploads

## Change

In `src/components/loadprofiles/BulkCsvDropzone.tsx`, line 385, replace:

```typescript
const displayName = config.meterName || file.name.replace(/\.csv$/i, '');
```

with:

```typescript
const displayName = file.name.replace(/\.csv$/i, '');
```

This removes the PnP metadata `meterName` override, so every new upload always uses the sanitised filename as the meter label. One line change, no other files affected.

