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

    // Build the prompt based on section type - now supports ALL report sections
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

      tariff_details: `Generate a tariff analysis section explaining TOU optimization for this project:

Tariff: ${projectData.tariffName || 'Standard commercial TOU'}
Municipality: ${projectData.municipalityName || 'Not specified'}
Tariff Type: ${projectData.tariffType || 'TOU'}
Solar Capacity: ${projectData.solarCapacityKwp} kWp
Annual Savings: R${Math.round(projectData.annualSavings || 0).toLocaleString()}

Write 2-3 concise paragraphs explaining:
1. The tariff structure and peak/off-peak periods relevant to this client
2. How solar generation aligns with expensive tariff periods to maximize savings
3. The savings optimization strategy (TOU arbitrage, demand reduction, etc.)

Reference South African electricity market context briefly.`,

      dcac_comparison: `Generate a DC/AC ratio analysis section for this solar installation:

Solar DC Capacity: ${projectData.solarCapacityKwp} kWp
Inverter AC Capacity: ${Math.round((projectData.solarCapacityKwp || 100) / (projectData.dcAcRatio || 1.3))} kW
DC/AC Ratio: ${projectData.dcAcRatio || 1.3}:1
Location: ${projectData.location || 'South Africa'}

Write 2 paragraphs explaining:
1. What the DC/AC ratio means and why ${(projectData.dcAcRatio || 1.3).toFixed(2)}:1 was selected
2. The trade-off between energy clipping and cost optimization - is this ratio aggressive, conservative, or balanced?

Be technical but accessible. Reference that higher ratios harvest more morning/evening energy at the cost of midday clipping.`,

      sizing_comparison: `Generate a sizing alternatives analysis for this solar project:

Current Design: ${projectData.solarCapacityKwp} kWp / ${projectData.batteryCapacityKwh} kWh battery
Conservative Option: ~${Math.round((projectData.solarCapacityKwp || 100) * 0.7)} kWp
Aggressive Option: ~${Math.round((projectData.solarCapacityKwp || 100) * 1.4)} kWp
Connection Size: ${projectData.connectionSize ? `${projectData.connectionSize} kVA` : 'Not specified'}
Annual Savings (current): R${Math.round(projectData.annualSavings || 0).toLocaleString()}

Write 2-3 paragraphs explaining:
1. Why we recommend the current design as the optimal balance
2. When a conservative approach might be appropriate (budget constraints, phased approach)
3. When a more aggressive sizing might make sense (future load growth, export opportunities)

Help the client understand the sizing decision with business rationale.`,

      energy_flow: `Generate an energy flow analysis for this solar installation:

Solar Capacity: ${projectData.solarCapacityKwp} kWp
Estimated Annual Generation: ${Math.round((projectData.solarCapacityKwp || 100) * 1600)} kWh
Battery: ${projectData.batteryCapacityKwh} kWh
Building Type: Commercial facility

Write 2 paragraphs explaining:
1. How energy flows through the system - from solar generation to building consumption and grid interaction
2. Expected self-consumption ratio and what happens to excess energy

Keep it simple - help a non-technical executive understand the energy dynamics.`,

      monthly_yield: `Generate a monthly yield analysis for this South African solar installation:

Solar Capacity: ${projectData.solarCapacityKwp} kWp
Location: ${projectData.location || 'South Africa'}
Expected Annual Yield: ${Math.round((projectData.solarCapacityKwp || 100) * 1600)} kWh
Specific Yield: ~1,600 kWh/kWp/year

Write 2 paragraphs explaining:
1. The seasonal variation in solar production (summer vs winter) and why
2. How this affects the financial model - higher production months vs lower

Reference South African solar irradiance patterns.`,

      payback_timeline: `Generate a financial payback analysis for this solar investment:

System Cost: R${Math.round((projectData.solarCapacityKwp || 100) * 12000).toLocaleString()} (estimated)
Annual Savings: R${Math.round(projectData.annualSavings || 0).toLocaleString()}
Payback Period: ${(projectData.paybackYears || 5).toFixed(1)} years
ROI: ${projectData.roiPercent || 0}%
25-Year Net Returns: R${Math.round((projectData.annualSavings || 0) * 25 - (projectData.solarCapacityKwp || 100) * 12000).toLocaleString()}

Write 2-3 paragraphs covering:
1. The investment profile - upfront cost, payback timeline, and break-even point
2. Long-term value creation - what happens after payback
3. How tariff escalation improves returns over time

Present this as an investment case to a CFO.`,

      sensitivity_analysis: `Generate a sensitivity analysis summary for this solar investment:

Base Payback: ${(projectData.paybackYears || 5).toFixed(1)} years
Annual Savings: R${Math.round(projectData.annualSavings || 0).toLocaleString()}
System Cost: R${Math.round((projectData.solarCapacityKwp || 100) * 12000).toLocaleString()}

Write 2 paragraphs explaining:
1. How payback changes with tariff escalation scenarios (0%, 10%, 20% annual increases)
2. How system cost variations affect the investment case

Help the client understand the range of outcomes and which factors most influence returns.`,

      environmental_impact: `Generate an environmental impact section for this solar installation:

Solar Capacity: ${projectData.solarCapacityKwp} kWp
Annual CO2 Avoided: ~${Math.round((projectData.solarCapacityKwp || 100) * 1.2)} tonnes
25-Year CO2 Avoided: ~${Math.round((projectData.solarCapacityKwp || 100) * 1.2 * 25)} tonnes
Trees Equivalent: ~${Math.round((projectData.solarCapacityKwp || 100) * 1.2 * 45)} trees

Write 2 paragraphs covering:
1. The annual environmental impact in terms of CO2 reduction
2. The broader sustainability narrative - ESG reporting, corporate responsibility

Make it impactful but not preachy.`,

      engineering_specs: `Generate a technical specifications summary for this solar installation:

PV Array: ${projectData.solarCapacityKwp} kWp DC
Inverter Capacity: ${Math.round((projectData.solarCapacityKwp || 100) / (projectData.dcAcRatio || 1.3))} kW AC
DC/AC Ratio: ${(projectData.dcAcRatio || 1.3).toFixed(2)}:1
Battery: ${projectData.batteryCapacityKwh} kWh
Connection Size: ${projectData.connectionSize ? `${projectData.connectionSize} kVA` : 'TBC'}

Write 2 paragraphs explaining:
1. The key technical specifications and how they work together
2. Expected performance metrics (capacity factor, specific yield, performance ratio)

Be technical but ensure a non-engineer can understand the headline specs.`,

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

    console.log(`Generating narrative for section: ${sectionType}`);

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
                    description: 'The professional narrative text for this section, formatted with paragraphs separated by newlines. Keep it concise - 2-4 paragraphs maximum.'
                  },
                  keyHighlights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of 2-4 key highlights or talking points from this section'
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
