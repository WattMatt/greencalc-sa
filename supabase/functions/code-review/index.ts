import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CodeReviewRequest {
  files: { path: string; content: string }[];
  context?: string;
  reviewType?: "security" | "performance" | "quality" | "full";
}

interface ReviewIssue {
  file: string;
  location: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  issue: string;
  suggestion: string;
  codeSnippet?: string;
}

interface CodeReviewResponse {
  summary: string;
  overallScore: number;
  issues: ReviewIssue[];
  improvements: string[];
  actionItems: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { files, context, reviewType = "full" } = await req.json() as CodeReviewRequest;

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided for review" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build file content for the prompt
    const fileContents = files.map(f => 
      `### File: ${f.path}\n\`\`\`typescript\n${f.content}\n\`\`\``
    ).join("\n\n");

    const reviewFocus = {
      security: "Focus primarily on security vulnerabilities: XSS, injection attacks, authentication issues, data exposure, unsafe patterns.",
      performance: "Focus primarily on performance: unnecessary re-renders, memory leaks, inefficient algorithms, bundle size issues.",
      quality: "Focus primarily on code quality: readability, maintainability, DRY principles, TypeScript best practices, naming conventions.",
      full: "Perform a comprehensive review covering security, performance, code quality, and architecture."
    };

    const systemPrompt = `You are an expert code reviewer for React/TypeScript applications. 
You must respond with valid JSON only, no markdown or explanation outside the JSON.

Analyze the provided code and return a JSON object with this exact structure:
{
  "summary": "Brief 2-3 sentence summary of the code quality",
  "overallScore": <number 1-100>,
  "issues": [
    {
      "file": "path/to/file.tsx",
      "location": "Line ~X or function name",
      "severity": "critical|high|medium|low",
      "category": "security|performance|quality|architecture|bug",
      "issue": "Clear description of the problem",
      "suggestion": "Specific fix or improvement",
      "codeSnippet": "Optional: relevant code snippet"
    }
  ],
  "improvements": ["Prioritized improvement suggestion 1", "..."],
  "actionItems": ["Numbered action item 1", "..."]
}

${reviewFocus[reviewType]}

Be specific and actionable. Every issue should have a clear fix.`;

    const userPrompt = `${context ? `Context: ${context}\n\n` : ""}Review the following ${files.length} file(s):\n\n${fileContents}`;

    console.log(`Starting code review for ${files.length} files, type: ${reviewType}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON from the response (handle markdown code blocks)
    let reviewResult: CodeReviewResponse;
    try {
      let jsonStr = content;
      // Remove markdown code blocks if present
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```\n?/g, "");
      }
      reviewResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content);
      // Return a structured fallback
      reviewResult = {
        summary: content.substring(0, 200) + "...",
        overallScore: 70,
        issues: [],
        improvements: ["Full review parsing failed - raw response available"],
        actionItems: ["Retry the review or check individual files"],
      };
    }

    console.log(`Review complete: ${reviewResult.issues.length} issues found, score: ${reviewResult.overallScore}`);

    return new Response(
      JSON.stringify(reviewResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Code review error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
