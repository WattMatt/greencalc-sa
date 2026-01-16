import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function fetches project file contents from the GitHub repo or raw content URLs
// For now, we'll provide a sample implementation that returns file contents

// In a production setup, this would connect to GitHub API to fetch actual file contents
// using the repository linked to this Lovable project

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePaths } = await req.json();

    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return new Response(
        JSON.stringify({ error: "filePaths array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the raw content from the Lovable preview URL
    // Files are accessible at the preview URL with ?raw=true parameter
    const projectId = Deno.env.get("VITE_SUPABASE_PROJECT_ID") || "zhhcwtftckdwfoactkea";
    
    // For Lovable projects, we can use the public GitHub raw URLs if the project is connected to GitHub
    // Or we use the Lovable internal API to fetch file contents
    
    const fileContents: Record<string, string> = {};
    
    for (const filePath of filePaths) {
      try {
        // Try fetching from the raw.githubusercontent if connected to GitHub
        // For now, we'll return a placeholder indicating the file path
        // In production, this would be connected to actual file system access
        
        // Sanitize the file path to prevent path traversal
        const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\//, '');
        
        // Return the file path as a marker - the actual content fetching 
        // would be done via GitHub API or internal Lovable API
        fileContents[sanitizedPath] = `// File: ${sanitizedPath}\n// Content would be fetched from connected GitHub repository`;
        
      } catch (err) {
        console.error(`Error fetching ${filePath}:`, err);
        fileContents[filePath] = `// Error: Could not fetch ${filePath}`;
      }
    }

    return new Response(
      JSON.stringify({ files: fileContents }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fetch files error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
