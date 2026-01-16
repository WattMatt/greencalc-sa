import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchFilesRequest {
  filePaths: string[];
  owner?: string;
  repo?: string;
  branch?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePaths, owner, repo, branch = "main" } = await req.json() as FetchFilesRequest;

    if (!filePaths || filePaths.length === 0) {
      return new Response(
        JSON.stringify({ error: "No file paths provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get GitHub token from environment (user needs to configure this)
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    
    if (!GITHUB_TOKEN) {
      // Return a helpful error with instructions
      return new Response(
        JSON.stringify({ 
          error: "GITHUB_TOKEN not configured",
          message: "To fetch file contents, please add your GitHub personal access token as a secret named GITHUB_TOKEN.",
          requiresSetup: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default to the connected repo info (these would ideally come from project settings)
    const repoOwner = owner || Deno.env.get("GITHUB_OWNER");
    const repoName = repo || Deno.env.get("GITHUB_REPO");

    if (!repoOwner || !repoName) {
      return new Response(
        JSON.stringify({ 
          error: "GitHub repository not configured",
          message: "Please configure GITHUB_OWNER and GITHUB_REPO secrets, or provide owner and repo in the request.",
          requiresSetup: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching ${filePaths.length} files from ${repoOwner}/${repoName}@${branch}`);

    const files: { path: string; content: string; error?: string }[] = [];

    // Fetch files in parallel (with reasonable limit)
    const batchSize = 10;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (filePath) => {
          try {
            const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;
            
            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3.raw",
                "User-Agent": "Lovable-Code-Review",
              },
            });

            if (!response.ok) {
              if (response.status === 404) {
                return { path: filePath, content: "", error: "File not found" };
              }
              throw new Error(`GitHub API error: ${response.status}`);
            }

            const content = await response.text();
            return { path: filePath, content };
          } catch (error) {
            console.error(`Error fetching ${filePath}:`, error);
            return { 
              path: filePath, 
              content: "", 
              error: error instanceof Error ? error.message : "Unknown error" 
            };
          }
        })
      );

      files.push(...results);
    }

    const successCount = files.filter(f => !f.error).length;
    console.log(`Successfully fetched ${successCount}/${filePaths.length} files`);

    return new Response(
      JSON.stringify({ files, successCount, totalRequested: filePaths.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fetch files error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
