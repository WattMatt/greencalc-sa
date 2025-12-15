import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnhanceRequest {
  type: "explanation" | "faq" | "tips" | "glossary" | "contextual-help";
  context: {
    tourId?: string;
    stepIndex?: number;
    featureArea: string;
    currentContent?: string;
    userQuestion?: string;
  };
}

interface EnhancedContent {
  type: string;
  content: string | FAQ[] | Tip[] | GlossaryEntry[];
  generatedAt: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface Tip {
  title: string;
  description: string;
  icon?: string;
}

interface GlossaryEntry {
  term: string;
  definition: string;
  relatedTerms?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { type, context }: EnhanceRequest = await req.json();

    if (!type || !context?.featureArea) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type and context.featureArea" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(type, context);
    const systemPrompt = getSystemPrompt(type);

    console.log(`Enhancing content: type=${type}, featureArea=${context.featureArea}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        tools: getToolsForType(type),
        tool_choice: { type: "function", function: { name: getToolNameForType(type) } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract structured content from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let enhancedContent: EnhancedContent;

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      enhancedContent = {
        type,
        content: parsed[Object.keys(parsed)[0]], // Get the main content array/string
        generatedAt: new Date().toISOString(),
      };
    } else {
      // Fallback to raw content
      enhancedContent = {
        type,
        content: data.choices?.[0]?.message?.content || "No content generated",
        generatedAt: new Date().toISOString(),
      };
    }

    return new Response(JSON.stringify(enhancedContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in enhance-tour-content:", error);

    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getSystemPrompt(type: string): string {
  const baseContext = `You are an expert technical writer for a Green Energy Financial Modeling Platform used in South Africa. 
The platform helps users model ROI and payback periods for solar PV and battery storage installations based on municipal electricity tariffs.

Key platform features include:
- Tariff Management: Import and manage municipal electricity tariffs (Fixed, IBT, TOU rates)
- Load Profiles: Import SCADA meter data or use shop-type templates for consumption modeling
- Simulation Modes: Quick Estimate, Profile Builder, Sandbox, and Proposal Builder
- Energy Modeling: Solar PV sizing, battery storage, DC/AC oversizing, grid import/export
- Financial Analysis: ROI calculation, payback periods, tariff cost comparison
- Solcast Integration: Real irradiance data for accurate solar predictions

Target audience: Energy consultants, solar installers, and facility managers in South Africa.`;

  switch (type) {
    case "explanation":
      return `${baseContext}\n\nProvide clear, concise explanations suitable for onboarding new users. Use simple language but maintain technical accuracy. Focus on the "why" behind features, not just the "what".`;
    case "faq":
      return `${baseContext}\n\nGenerate frequently asked questions that address common user concerns and confusion points. Questions should be practical and answers should be actionable.`;
    case "tips":
      return `${baseContext}\n\nCreate helpful "Did you know?" tips that reveal hidden features, shortcuts, or best practices. Tips should provide immediate value and enhance user productivity.`;
    case "glossary":
      return `${baseContext}\n\nDefine technical terms in plain language. Include context-specific meanings relevant to energy modeling and South African electricity markets.`;
    case "contextual-help":
      return `${baseContext}\n\nProvide contextual assistance based on what the user is currently doing. Be helpful and anticipate follow-up questions.`;
    default:
      return baseContext;
  }
}

function buildPrompt(type: string, context: EnhanceRequest["context"]): string {
  const { featureArea, currentContent, userQuestion, tourId, stepIndex } = context;

  switch (type) {
    case "explanation":
      return `Generate an enhanced explanation for the following feature:

Feature Area: ${featureArea}
${currentContent ? `Current Description: ${currentContent}` : ""}
${tourId ? `Tour: ${tourId}, Step: ${stepIndex}` : ""}

Provide a clear, engaging explanation that:
1. Explains what this feature does
2. Explains why it's useful
3. Provides a practical example
4. Mentions any related features`;

    case "faq":
      return `Generate 4-5 frequently asked questions for:

Feature Area: ${featureArea}
${currentContent ? `Context: ${currentContent}` : ""}

Create practical FAQs that address:
- Common confusion points
- How-to questions
- Best practice questions
- Troubleshooting questions`;

    case "tips":
      return `Generate 3-4 "Did you know?" tips for:

Feature Area: ${featureArea}
${currentContent ? `Context: ${currentContent}` : ""}

Tips should reveal:
- Hidden features or shortcuts
- Best practices for better results
- Time-saving techniques
- Pro tips from experienced users`;

    case "glossary":
      return `Generate glossary entries for technical terms related to:

Feature Area: ${featureArea}
${currentContent ? `Context: ${currentContent}` : ""}

Include 4-6 relevant terms with:
- Clear definitions
- South African context where relevant
- Related terms for further learning`;

    case "contextual-help":
      return `Provide contextual help for:

Feature Area: ${featureArea}
User Question: ${userQuestion || "General help needed"}
${currentContent ? `Current Context: ${currentContent}` : ""}

Provide a helpful, conversational response that:
1. Directly answers the question or addresses the need
2. Anticipates follow-up questions
3. Suggests next steps if applicable`;

    default:
      return `Generate helpful content for: ${featureArea}`;
  }
}

function getToolsForType(type: string) {
  switch (type) {
    case "faq":
      return [{
        type: "function",
        function: {
          name: "generate_faqs",
          description: "Generate frequently asked questions with answers",
          parameters: {
            type: "object",
            properties: {
              faqs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string", description: "The FAQ question" },
                    answer: { type: "string", description: "The answer to the question" },
                  },
                  required: ["question", "answer"],
                },
              },
            },
            required: ["faqs"],
          },
        },
      }];

    case "tips":
      return [{
        type: "function",
        function: {
          name: "generate_tips",
          description: "Generate helpful tips and tricks",
          parameters: {
            type: "object",
            properties: {
              tips: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Short tip title" },
                    description: { type: "string", description: "Detailed tip description" },
                    icon: { type: "string", description: "Suggested icon name (lightbulb, zap, star, etc.)" },
                  },
                  required: ["title", "description"],
                },
              },
            },
            required: ["tips"],
          },
        },
      }];

    case "glossary":
      return [{
        type: "function",
        function: {
          name: "generate_glossary",
          description: "Generate glossary entries for technical terms",
          parameters: {
            type: "object",
            properties: {
              entries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    term: { type: "string", description: "The technical term" },
                    definition: { type: "string", description: "Plain language definition" },
                    relatedTerms: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Related terms for further learning" 
                    },
                  },
                  required: ["term", "definition"],
                },
              },
            },
            required: ["entries"],
          },
        },
      }];

    case "explanation":
    case "contextual-help":
    default:
      return [{
        type: "function",
        function: {
          name: "generate_content",
          description: "Generate enhanced content or explanation",
          parameters: {
            type: "object",
            properties: {
              content: { 
                type: "string", 
                description: "The generated content in markdown format" 
              },
            },
            required: ["content"],
          },
        },
      }];
  }
}

function getToolNameForType(type: string): string {
  switch (type) {
    case "faq":
      return "generate_faqs";
    case "tips":
      return "generate_tips";
    case "glossary":
      return "generate_glossary";
    default:
      return "generate_content";
  }
}
