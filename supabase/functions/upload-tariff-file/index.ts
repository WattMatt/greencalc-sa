import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileName, province } = await req.json();
    
    console.log("Fetching file from:", fileUrl);
    
    // Fetch the file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.status}`);
    }
    
    const fileBlob = await fileResponse.blob();
    const fileBuffer = await fileBlob.arrayBuffer();
    
    console.log("File fetched, size:", fileBuffer.byteLength);
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Upload to storage
    const timestamp = Date.now();
    const sanitizedProvince = province.replace(/\s+/g, '-');
    const ext = fileName.split('.').pop()?.toLowerCase() || 'xlsm';
    const filePath = `${timestamp}-${sanitizedProvince}.${ext}`;
    
    console.log("Uploading to path:", filePath);
    
    const { error: uploadError } = await supabase.storage
      .from("tariff-uploads")
      .upload(filePath, fileBuffer, {
        contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      });
    
    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }
    
    console.log("File uploaded successfully");
    
    return new Response(
      JSON.stringify({ success: true, filePath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
