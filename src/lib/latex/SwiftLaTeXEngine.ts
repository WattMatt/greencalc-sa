import { supabase } from "@/integrations/supabase/client";

export interface CompileResult {
  pdf: Blob | null;
  pdfUrl: string | null;
  log: string;
  success: boolean;
}

let lastBlobUrl: string | null = null;

export async function compileLatex(source: string): Promise<CompileResult> {
  const { data: { session } } = await supabase.auth.getSession();

  const resp = await supabase.functions.invoke('compile-latex', {
    body: { source },
  });

  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }

  // If the response is a Blob (PDF binary)
  if (resp.data instanceof Blob) {
    const blob = resp.data;
    if (blob.type === 'application/pdf' || blob.size > 100) {
      const url = URL.createObjectURL(blob);
      lastBlobUrl = url;
      return { pdf: blob, pdfUrl: url, log: '', success: true };
    }
    // Might be JSON error returned as blob
    const text = await blob.text();
    try {
      const json = JSON.parse(text);
      return { pdf: null, pdfUrl: null, log: json.log || text, success: false };
    } catch {
      return { pdf: null, pdfUrl: null, log: text, success: false };
    }
  }

  // JSON error response
  if (resp.data && typeof resp.data === 'object' && resp.data.error) {
    return { pdf: null, pdfUrl: null, log: resp.data.log || 'Compilation failed', success: false };
  }

  if (resp.error) {
    return { pdf: null, pdfUrl: null, log: resp.error.message || 'Request failed', success: false };
  }

  return { pdf: null, pdfUrl: null, log: 'Unknown response', success: false };
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
