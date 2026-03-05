import { supabase } from "@/integrations/supabase/client";

const BUCKET = "scada-csvs";

/**
 * Upload original CSV content to scada-csvs storage bucket.
 * Returns the storage path on success, null on failure.
 */
export async function uploadCsvToStorage(
  csvContent: string,
  meterId: string,
  fileName?: string
): Promise<string | null> {
  try {
    const safeName = (fileName || "meter.csv")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    const path = `meters/${meterId}/${Date.now()}_${safeName}`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true });

    if (error) {
      console.error("[csvStorage] Upload failed:", error);
      return null;
    }

    // Save path reference on the scada_imports row
    await supabase
      .from("scada_imports")
      .update({ csv_file_path: path } as Record<string, unknown>)
      .eq("id", meterId);

    return path;
  } catch (err) {
    console.error("[csvStorage] Unexpected error:", err);
    return null;
  }
}

/**
 * Download original CSV content from storage for a given meter.
 * Returns the CSV string on success, null on failure.
 */
export async function downloadCsvFromStorage(
  meterId: string
): Promise<string | null> {
  try {
    // First get the stored path
    const { data: meter, error: fetchErr } = await supabase
      .from("scada_imports")
      .select("csv_file_path")
      .eq("id", meterId)
      .single();

    if (fetchErr || !meter) return null;

    const csvPath = (meter as Record<string, unknown>).csv_file_path as string | null;
    if (!csvPath) return null;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(csvPath);

    if (error || !data) {
      console.error("[csvStorage] Download failed:", error);
      return null;
    }

    return await data.text();
  } catch (err) {
    console.error("[csvStorage] Unexpected error:", err);
    return null;
  }
}
