import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CodeReviewRequest {
  code: string;
  language?: string;
  reviewType: 'security' | 'quality' | 'suggestions' | 'full';
  context?: string;
}

interface CodeReviewResult {
  summary: string;
  securityIssues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    lineNumbers?: number[];
    suggestion: string;
  }>;
  qualityIssues: Array<{
    type: 'code-smell' | 'complexity' | 'best-practice' | 'performance';
    title: string;
    description: string;
    lineNumbers?: number[];
    suggestion: string;
  }>;
  improvements: Array<{
    title: string;
    description: string;
    before?: string;
    after?: string;
  }>;
  overallScore: number;
  metrics: {
    securityScore: number;
    qualityScore: number;
    maintainabilityScore: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ABACUS_API_KEY = Deno.env.get("ABACUS_AI_API_KEY");
    if (!ABACUS_API_KEY) {
      throw new Error("ABACUS_AI_API_KEY is not configured");
    }

    const { code, language = 'typescript', reviewType = 'full', context = '' }: CodeReviewRequest = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the review prompt based on review type
    const reviewPrompts: Record<string, string> = {
      security: `Perform a comprehensive SECURITY review of the following ${language} code. Focus on:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- Authentication/Authorization flaws
- Sensitive data exposure
- Input validation issues
- CSRF vulnerabilities
- Insecure dependencies patterns`,
      
      quality: `Perform a CODE QUALITY analysis of the following ${language} code. Focus on:
- Code smells and anti-patterns
- Cyclomatic complexity issues
- DRY (Don't Repeat Yourself) violations
- SOLID principles violations
- Naming conventions
- Function/method length
- Unused code or dead code paths`,
      
      suggestions: `Provide AI-POWERED REFACTORING suggestions for the following ${language} code. Focus on:
- Performance optimizations
- Modern language features that could be used
- Design pattern opportunities
- Error handling improvements
- Type safety enhancements
- Readability improvements`,
      
      full: `Perform a COMPREHENSIVE CODE REVIEW of the following ${language} code covering:

1. SECURITY (Critical):
- Vulnerabilities, injection risks, auth issues, data exposure

2. CODE QUALITY:
- Code smells, complexity, best practices, patterns

3. REFACTORING SUGGESTIONS:
- Performance, modern features, design patterns, error handling

Provide actionable recommendations with specific line references where applicable.`
    };

    const systemPrompt = `You are an expert code reviewer with deep knowledge of security best practices, design patterns, and clean code principles. 
You provide thorough, actionable code reviews that help developers improve their code quality and security.
${context ? `Additional context: ${context}` : ''}

Respond with a structured JSON analysis following this exact schema:
{
  "summary": "Brief overall assessment",
  "securityIssues": [{"severity": "critical|high|medium|low", "title": "string", "description": "string", "lineNumbers": [numbers], "suggestion": "string"}],
  "qualityIssues": [{"type": "code-smell|complexity|best-practice|performance", "title": "string", "description": "string", "lineNumbers": [numbers], "suggestion": "string"}],
  "improvements": [{"title": "string", "description": "string", "before": "code snippet", "after": "improved code snippet"}],
  "overallScore": number between 0-100,
  "metrics": {"securityScore": 0-100, "qualityScore": 0-100, "maintainabilityScore": 0-100}
}`;

    const userPrompt = `${reviewPrompts[reviewType]}

\`\`\`${language}
${code}
\`\`\`

Provide your analysis as valid JSON.`;

    // Call Abacus.AI API
    const response = await fetch("https://api.abacus.ai/api/v0/predict", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ABACUS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deployment_token: ABACUS_API_KEY,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        llm_name: "CLAUDE_V3_5_SONNET",
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      // Fallback to alternative Abacus.AI endpoint format
      const altResponse = await fetch("https://api.abacus.ai/api/v0/describeAgentResponse", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ABACUS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deploymentToken: ABACUS_API_KEY,
          query: `${systemPrompt}\n\n${userPrompt}`,
        }),
      });

      if (!altResponse.ok) {
        // Final fallback - use the chat completion style endpoint
        const chatResponse = await fetch("https://api.abacus.ai/api/v0/chat", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ABACUS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: ABACUS_API_KEY,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            model: "claude-3-5-sonnet",
          }),
        });

        if (!chatResponse.ok) {
          const errorText = await chatResponse.text();
          console.error("Abacus.AI API error:", chatResponse.status, errorText);
          throw new Error(`Abacus.AI API error: ${chatResponse.status}`);
        }

        const chatData = await chatResponse.json();
        const content = chatData.response || chatData.choices?.[0]?.message?.content || chatData.result;
        
        return processAndReturnResult(content, corsHeaders);
      }

      const altData = await altResponse.json();
      const content = altData.response || altData.result;
      
      return processAndReturnResult(content, corsHeaders);
    }

    const data = await response.json();
    const content = data.result || data.response || data.choices?.[0]?.message?.content;
    
    return processAndReturnResult(content, corsHeaders);

  } catch (error) {
    console.error("Code review error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Failed to perform code review"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function processAndReturnResult(content: string, corsHeaders: Record<string, string>): Response {
  try {
    // Try to extract JSON from the response
    let jsonStr = content;
    
    // Check if response is wrapped in markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    const result: CodeReviewResult = JSON.parse(jsonStr);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (parseError) {
    // If JSON parsing fails, return a structured response from the raw content
    const fallbackResult: CodeReviewResult = {
      summary: content.substring(0, 500),
      securityIssues: [],
      qualityIssues: [],
      improvements: [],
      overallScore: 70,
      metrics: {
        securityScore: 70,
        qualityScore: 70,
        maintainabilityScore: 70
      }
    };
    
    return new Response(
      JSON.stringify(fallbackResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
