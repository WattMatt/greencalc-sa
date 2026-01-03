import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a Senior Electrical Consulting Engineer with 15+ years experience in commercial solar PV installations across South Africa. You are preparing a professional solar energy proposal for a C-level executive client.

Your writing style is:
- Confident but not salesy - you're an engineer, not a marketer
- Technical but accessible - explain concepts without jargon overload
- Inclusive of key details but concise - every word earns its place
- South African context-aware - reference Eskom tariffs, load shedding resilience, TOU optimization

Write as if presenting to a CFO who needs to understand the value proposition without drowning in technical details. Your tone is that of a trusted advisor recommending a strategic investment.

Key principles:
1. Lead with business impact, support with technical rationale
2. Quantify benefits wherever possible
3. Acknowledge the investment context (payback, risk considerations)
4. Reference the specific tariff structure and how the system optimizes against it
5. Be specific to THIS project - don't use generic filler language`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sectionType, projectData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt based on section type
    const sectionPrompts: Record<string, string> = {
      executive_summary: `Generate an executive summary for a solar PV proposal with these details:
        
Project: ${projectData.projectName}
Location: ${projectData.location || 'Not specified'}
Building Area: ${projectData.buildingArea ? `${projectData.buildingArea.toLocaleString()} m²` : 'Not specified'}
Grid Connection: ${projectData.connectionSize ? `${projectData.connectionSize} kVA` : 'Not specified'}
Solar System Size: ${projectData.solarCapacityKwp} kWp
Battery Storage: ${projectData.batteryCapacityKwh} kWh
DC/AC Ratio: ${projectData.dcAcRatio || 1.3}
Tariff: ${projectData.tariffName || 'Standard commercial'} ${projectData.municipalityName ? `(${projectData.municipalityName})` : ''}
Tariff Type: ${projectData.tariffType || 'TOU'}
Annual Savings: R${Math.round(projectData.annualSavings || 0).toLocaleString()}
Payback Period: ${(projectData.paybackYears || 5).toFixed(1)} years
ROI: ${projectData.roiPercent || 0}%

Write 3-4 paragraphs covering:
1. Project scope and strategic sizing rationale (why this size for this building/connection)
2. Financial value proposition with the specific tariff optimization strategy
3. Expected outcomes and investment recommendation

Be specific to this project. Reference the actual numbers. Explain WHY this sizing makes sense.`,

      tariff_analysis: `Generate a tariff analysis section explaining TOU optimization for this project:

Tariff: ${projectData.tariffName || 'Standard commercial TOU'}
Municipality: ${projectData.municipalityName || 'Not specified'}
Tariff Type: ${projectData.tariffType || 'TOU'}
Solar Capacity: ${projectData.solarCapacityKwp} kWp
Annual Savings: R${Math.round(projectData.annualSavings || 0).toLocaleString()}

Write 2-3 paragraphs explaining:
1. The tariff structure and peak/off-peak periods
2. How solar generation aligns with expensive tariff periods
3. The savings optimization strategy (TOU arbitrage, demand reduction, etc.)

Reference South African electricity market context (Eskom restructuring, municipal tariff increases, etc.)`,

      sizing_methodology: `Generate a sizing methodology section for this solar installation:

Building Area: ${projectData.buildingArea ? `${projectData.buildingArea.toLocaleString()} m²` : 'Not specified'}
Connection Size: ${projectData.connectionSize ? `${projectData.connectionSize} kVA` : 'Not specified'}
Solar Capacity: ${projectData.solarCapacityKwp} kWp
DC/AC Ratio: ${projectData.dcAcRatio || 1.3}
Battery: ${projectData.batteryCapacityKwh} kWh

Write 2-3 paragraphs explaining:
1. How the solar system size was determined relative to building load and connection capacity
2. The DC/AC ratio selection and its implications for energy harvest vs clipping
3. Battery sizing rationale (if applicable) for load shifting or backup

Be technical but accessible.`,

      investment_recommendation: `Generate a professional investment recommendation section:

Project: ${projectData.projectName}
System Cost: R${Math.round((projectData.solarCapacityKwp || 100) * 12000).toLocaleString()} (estimated)
Annual Savings: R${Math.round(projectData.annualSavings || 0).toLocaleString()}
Payback Period: ${(projectData.paybackYears || 5).toFixed(1)} years
ROI: ${projectData.roiPercent || 0}%
25-Year Returns: R${Math.round((projectData.annualSavings || 0) * 25 - (projectData.solarCapacityKwp || 100) * 12000).toLocaleString()}

Write 2-3 paragraphs with:
1. Your professional recommendation as a consulting engineer
2. Key risk considerations and mitigations (technology maturity, tariff escalation, performance guarantees)
3. Suggested next steps (site survey, detailed engineering, procurement)

Conclude with a confident but measured recommendation.`
    };

    const prompt = sectionPrompts[sectionType] || sectionPrompts.executive_summary;

    // Use tool calling to get structured output
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_narrative',
              description: 'Generate professional narrative content for a solar proposal section',
              parameters: {
                type: 'object',
                properties: {
                  narrative: {
                    type: 'string',
                    description: 'The professional narrative text for this section, formatted with paragraphs separated by newlines'
                  },
                  keyHighlights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of 3-5 key highlights or talking points from this section'
                  }
                },
                required: ['narrative', 'keyHighlights'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_narrative' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('No valid response from AI');
    }

    const result = JSON.parse(toolCall.function.arguments);

    console.log(`Generated ${sectionType} narrative with ${result.keyHighlights?.length || 0} highlights`);

    return new Response(
      JSON.stringify({
        sectionType,
        narrative: result.narrative,
        keyHighlights: result.keyHighlights
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('generate-proposal-narrative error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
