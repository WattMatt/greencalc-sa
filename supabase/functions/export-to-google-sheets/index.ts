import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportData {
  project: {
    name: string;
    location: string | null;
    total_area_sqm: number;
    connection_size_kva: number | null;
    tenant_count: number;
  };
  simulation: {
    solar_capacity_kwp: number;
    battery_capacity_kwh: number;
    battery_power_kw: number;
    dc_ac_ratio: number;
    annual_solar_generation_kwh: number;
    annual_consumption_kwh: number;
    self_consumption_kwh: number;
    grid_import_kwh: number;
    grid_export_kwh: number;
  };
  kpis: {
    specific_yield: number;
    performance_ratio: number;
    capacity_factor: number;
    lcoe: number;
    self_consumption_rate: number;
    solar_coverage: number;
    grid_independence: number;
    peak_shaving_kw: number;
  };
  dcAcAnalysis: {
    baseline_annual_kwh: number;
    oversized_annual_kwh: number;
    clipping_loss_kwh: number;
    additional_capture_kwh: number;
    net_gain_kwh: number;
    net_gain_percent: number;
    clipping_percent: number;
    monthly_comparison: Array<{
      month: string;
      baseline_kwh: number;
      oversized_kwh: number;
      gain_kwh: number;
      gain_percent: number;
    }>;
  };
  financials: {
    system_cost: number;
    annual_grid_cost_baseline: number;
    annual_grid_cost_with_solar: number;
    annual_savings: number;
    payback_years: number;
    roi_percent: number;
    npv: number;
    irr: number;
    yearly_cashflows: Array<{
      year: number;
      cumulative_savings: number;
      cumulative_cost: number;
      net_position: number;
    }>;
  };
  environmental: {
    co2_avoided_tons: number;
    trees_equivalent: number;
    car_miles_avoided: number;
    homes_powered_equivalent: number;
    grid_emission_factor: number;
  };
}

interface ExportRequest {
  reportName: string;
  reportData: ReportData;
}

async function getAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  console.log("Service account email:", credentials.client_email);
  console.log("Project ID:", credentials.project_id);
  
  const payload = {
    iss: credentials.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    // Only request spreadsheets scope - service accounts can create files with this
    scope: "https://www.googleapis.com/auth/spreadsheets",
  };

  // Import the private key
  const privateKey = await jose.importPKCS8(credentials.private_key, "RS256");
  
  // Create JWT
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(privateKey);

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret not configured");
    }

    const credentials = JSON.parse(serviceAccountJson);
    const { reportName, reportData }: ExportRequest = await req.json();

    console.log(`Exporting report: ${reportName}`);

    // Get access token
    const accessToken = await getAccessToken(credentials);
    console.log("Got access token");

    // Create spreadsheet
    const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: `${reportName} - ${new Date().toLocaleDateString('en-ZA')}`,
        },
        sheets: [
          { properties: { title: "Summary", index: 0 } },
          { properties: { title: "System Config", index: 1 } },
          { properties: { title: "Engineering KPIs", index: 2 } },
          { properties: { title: "DC-AC Analysis", index: 3 } },
          { properties: { title: "Financial Summary", index: 4 } },
          { properties: { title: "Monthly Yield", index: 5 } },
          { properties: { title: "Cashflow", index: 6 } },
          { properties: { title: "Environmental", index: 7 } },
        ],
      }),
    });

    if (!createResponse.ok) {
      const err = await createResponse.text();
      console.error("Create response status:", createResponse.status);
      console.error("Create response body:", err);
      throw new Error(`Failed to create spreadsheet: ${err}`);
    }

    const spreadsheet = await createResponse.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    console.log(`Created spreadsheet: ${spreadsheetId}`);

    // Build batch data
    const batchData = [
      {
        range: "Summary!A1:B15",
        values: [
          ["ENERGY ANALYSIS REPORT", ""],
          ["Report Name", reportName],
          ["Generated", new Date().toLocaleDateString('en-ZA')],
          ["", ""],
          ["PROJECT OVERVIEW", ""],
          ["Site Name", reportData.project.name],
          ["Location", reportData.project.location || "Not specified"],
          ["Total Area (m²)", reportData.project.total_area_sqm],
          ["Connection Size (kVA)", reportData.project.connection_size_kva || "N/A"],
          ["Tenant Count", reportData.project.tenant_count],
          ["", ""],
          ["KEY METRICS", ""],
          ["Annual Savings", `R ${reportData.financials.annual_savings.toLocaleString()}`],
          ["Payback Period", `${reportData.financials.payback_years.toFixed(1)} years`],
          ["25-Year ROI", `${reportData.financials.roi_percent.toFixed(0)}%`],
        ],
      },
      {
        range: "System Config!A1:B10",
        values: [
          ["SYSTEM CONFIGURATION", ""],
          ["Solar Capacity (kWp)", reportData.simulation.solar_capacity_kwp],
          ["Battery Capacity (kWh)", reportData.simulation.battery_capacity_kwh],
          ["Battery Power (kW)", reportData.simulation.battery_power_kw],
          ["DC/AC Ratio (%)", reportData.simulation.dc_ac_ratio],
          ["", ""],
          ["ENERGY PRODUCTION", ""],
          ["Annual Solar Generation (kWh)", reportData.simulation.annual_solar_generation_kwh],
          ["Annual Consumption (kWh)", reportData.simulation.annual_consumption_kwh],
          ["Self-Consumption (kWh)", reportData.simulation.self_consumption_kwh],
        ],
      },
      {
        range: "Engineering KPIs!A1:C10",
        values: [
          ["KPI", "Value", "Description"],
          ["Specific Yield", `${reportData.kpis.specific_yield.toFixed(0)} kWh/kWp`, "Energy per installed DC capacity"],
          ["Performance Ratio", `${reportData.kpis.performance_ratio.toFixed(1)}%`, "Actual vs theoretical output"],
          ["Capacity Factor", `${reportData.kpis.capacity_factor.toFixed(1)}%`, "Average vs peak capacity"],
          ["LCOE", `R ${reportData.kpis.lcoe.toFixed(2)}/kWh`, "Levelized cost of energy"],
          ["Self-Consumption Rate", `${reportData.kpis.self_consumption_rate.toFixed(1)}%`, "PV energy used on-site"],
          ["Solar Coverage", `${reportData.kpis.solar_coverage.toFixed(1)}%`, "Load met by PV"],
          ["Grid Independence", `${reportData.kpis.grid_independence.toFixed(1)}%`, "Load met by PV+battery"],
          ["Peak Shaving", `${reportData.kpis.peak_shaving_kw.toFixed(1)} kW`, "Peak demand reduction"],
        ],
      },
      {
        range: "DC-AC Analysis!A1:B8",
        values: [
          ["DC/AC RATIO ANALYSIS", ""],
          ["Baseline Annual (kWh)", reportData.dcAcAnalysis.baseline_annual_kwh],
          ["Oversized Annual (kWh)", reportData.dcAcAnalysis.oversized_annual_kwh],
          ["Clipping Loss (kWh)", reportData.dcAcAnalysis.clipping_loss_kwh],
          ["Additional Capture (kWh)", reportData.dcAcAnalysis.additional_capture_kwh],
          ["Net Gain (kWh)", reportData.dcAcAnalysis.net_gain_kwh],
          ["Net Gain (%)", `${reportData.dcAcAnalysis.net_gain_percent.toFixed(1)}%`],
          ["Clipping Rate (%)", `${reportData.dcAcAnalysis.clipping_percent.toFixed(1)}%`],
        ],
      },
      {
        range: "Financial Summary!A1:B10",
        values: [
          ["FINANCIAL SUMMARY", ""],
          ["System Cost", `R ${reportData.financials.system_cost.toLocaleString()}`],
          ["Annual Grid Cost (Baseline)", `R ${reportData.financials.annual_grid_cost_baseline.toLocaleString()}`],
          ["Annual Grid Cost (With Solar)", `R ${reportData.financials.annual_grid_cost_with_solar.toLocaleString()}`],
          ["Annual Savings", `R ${reportData.financials.annual_savings.toLocaleString()}`],
          ["Simple Payback", `${reportData.financials.payback_years.toFixed(1)} years`],
          ["25-Year ROI", `${reportData.financials.roi_percent.toFixed(0)}%`],
          ["NPV", `R ${reportData.financials.npv.toLocaleString()}`],
          ["IRR", `${reportData.financials.irr.toFixed(1)}%`],
        ],
      },
      {
        range: "Monthly Yield!A1:E13",
        values: [
          ["Month", "Baseline (kWh)", "Oversized (kWh)", "Gain (kWh)", "Gain (%)"],
          ...reportData.dcAcAnalysis.monthly_comparison.map(m => [
            m.month,
            m.baseline_kwh,
            m.oversized_kwh,
            m.gain_kwh,
            `${m.gain_percent.toFixed(1)}%`,
          ]),
        ],
      },
      {
        range: "Cashflow!A1:D26",
        values: [
          ["Year", "Cumulative Savings (R)", "Cumulative Cost (R)", "Net Position (R)"],
          ...reportData.financials.yearly_cashflows.map(cf => [
            cf.year,
            cf.cumulative_savings,
            cf.cumulative_cost,
            cf.net_position,
          ]),
        ],
      },
      {
        range: "Environmental!A1:B6",
        values: [
          ["ENVIRONMENTAL IMPACT", ""],
          ["CO₂ Avoided (tons/year)", reportData.environmental.co2_avoided_tons.toFixed(1)],
          ["Equivalent Trees Planted", reportData.environmental.trees_equivalent],
          ["Car Miles Avoided", reportData.environmental.car_miles_avoided],
          ["Homes Powered Equivalent", reportData.environmental.homes_powered_equivalent.toFixed(1)],
          ["Grid Emission Factor (kg CO₂/kWh)", reportData.environmental.grid_emission_factor],
        ],
      },
    ];

    // Batch update values
    const batchUpdateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: batchData,
        }),
      }
    );

    if (!batchUpdateResponse.ok) {
      const err = await batchUpdateResponse.text();
      throw new Error(`Failed to update spreadsheet: ${err}`);
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    console.log(`Export complete: ${spreadsheetUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        spreadsheetId,
        spreadsheetUrl,
        message: "Report exported to Google Sheets successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
