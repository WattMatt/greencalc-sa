

## Store Source File Reference on Extraction Runs

### Current State
When you upload a tariff file, it gets stored in the `tariff-uploads` storage bucket with a timestamped name (e.g. `1771491250342-Limpopo_Province_Tariffs_20250601_20260531.pdf`). The file exists in storage, but there is no record linking it back to the municipalities or extraction runs it produced. If you want to find and download the original file later, there is no easy way to do so.

### What We Will Do

1. **Add a `source_file_path` and `source_file_name` column to the `extraction_runs` table** so each extraction records which file it came from.

2. **Update the edge function** (`process-tariff-file/index.ts`) to save the `filePath` into the `extraction_runs` record when creating it during the extraction phase.

3. **Update the UI** to show a download/preview button next to each extraction run or municipality, using the stored file path to fetch from the `tariff-uploads` bucket.

### Technical Details

| Step | Change |
|---|---|
| Database migration | `ALTER TABLE extraction_runs ADD COLUMN source_file_path text, ADD COLUMN source_file_name text;` |
| Edge function (`process-tariff-file/index.ts`) | When inserting into `extraction_runs`, include `source_file_path: filePath` and `source_file_name` (parsed from the path) |
| UI (`ProvinceFilesManager.tsx`) | Where extraction runs are displayed, add a download/preview button that uses the `FilePreviewDialog` with the stored `source_file_path` |

### Backfill
The most recent uploads are already in the bucket. We can backfill the latest extraction runs with the most recent file path if needed, or simply start tracking from now onwards.
