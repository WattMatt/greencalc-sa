import { Tour } from "./TourContext";

export const TOURS: Record<string, Tour> = {
  quickEstimate: {
    id: "quick-estimate",
    name: "Quick Estimate Tour",
    steps: [
      {
        target: "[data-tour='location-select']",
        title: "Select Your Location",
        content: "Choose the nearest city to your site. This determines the solar irradiance levels (Peak Sun Hours) used in energy calculations.",
        placement: "right",
      },
      {
        target: "[data-tour='site-area']",
        title: "Enter Site Area",
        content: "The total floor area of your facility in square meters. This helps estimate consumption if you don't have actual billing data.",
        placement: "right",
      },
      {
        target: "[data-tour='solar-capacity']",
        title: "Configure Solar Capacity",
        content: "Adjust the peak DC capacity of the proposed solar array. Higher capacity means more generation but increased upfront cost.",
        placement: "top",
      },
      {
        target: "[data-tour='battery-capacity']",
        title: "Add Battery Storage",
        content: "Optional battery storage for peak shaving and energy shifting. Set to 0 for a solar-only analysis.",
        placement: "top",
      },
      {
        target: "[data-tour='calculate-btn']",
        title: "Calculate Your Estimate",
        content: "Click here to run the calculation and see your estimated annual generation, savings, and payback period.",
        placement: "top",
      },
    ],
  },

  simulationHub: {
    id: "simulation-hub",
    name: "Simulation Hub Tour",
    steps: [
      {
        target: "[data-tour='quick-estimate-card']",
        title: "Quick Estimate Mode",
        content: "Get instant ballpark figures for theoretical sites without needing a full project setup. Great for initial feasibility screening.",
        placement: "bottom",
      },
      {
        target: "[data-tour='profile-builder-card']",
        title: "Profile Builder Mode",
        content: "Build detailed load profiles from actual meter data or shop type templates. Provides the most accurate simulations for real projects.",
        placement: "bottom",
      },
      {
        target: "[data-tour='sandbox-card']",
        title: "Sandbox Mode",
        content: "Experiment freely with different scenarios and parameter sweeps. Changes here won't affect your production simulations.",
        placement: "bottom",
      },
      {
        target: "[data-tour='proposal-card']",
        title: "Proposal Builder",
        content: "Create professional, client-ready proposals with verification checklists, branding options, and digital signature workflows.",
        placement: "bottom",
      },
    ],
  },

  profileBuilder: {
    id: "profile-builder",
    name: "Profile Builder Tour",
    steps: [
      {
        target: "[data-tour='pv-config']",
        title: "Configure PV System",
        content: "Set up your solar PV parameters including capacity, DC/AC ratio, and whether to use real Solcast irradiance data.",
        placement: "bottom",
      },
      {
        target: "[data-tour='battery-config']",
        title: "Battery Storage Settings",
        content: "Configure battery capacity and power rating if you want to model energy storage for peak shaving or load shifting.",
        placement: "bottom",
      },
      {
        target: "[data-tour='load-chart']",
        title: "Load Profile Chart",
        content: "View your aggregated load profile with TOU period coloring. Toggle between kWh and kVA views, and navigate through days of the week.",
        placement: "top",
      },
      {
        target: "[data-tour='save-simulation']",
        title: "Save Your Simulation",
        content: "Save completed simulations to compare different configurations later or use them as the basis for client proposals.",
        placement: "left",
      },
    ],
  },

  sandbox: {
    id: "sandbox",
    name: "Sandbox Mode Tour",
    steps: [
      {
        target: "[data-tour='scenario-cards']",
        title: "Compare Scenarios",
        content: "Run up to 3 scenarios side-by-side (A, B, C) to compare different system configurations and their financial outcomes.",
        placement: "bottom",
      },
      {
        target: "[data-tour='parameter-sweep']",
        title: "Parameter Sweep",
        content: "Automatically test a range of values for solar capacity, battery size, or DC/AC ratio to find the optimal configuration.",
        placement: "bottom",
      },
      {
        target: "[data-tour='draft-save']",
        title: "Save as Draft",
        content: "Save your experimental work as a draft. Drafts are clearly marked and won't be confused with production simulations.",
        placement: "left",
      },
      {
        target: "[data-tour='promote-btn']",
        title: "Promote to Project",
        content: "Once you're satisfied with a scenario, promote it to become a real project simulation for proposal generation.",
        placement: "left",
      },
    ],
  },

  proposalBuilder: {
    id: "proposal-builder",
    name: "Proposal Builder Tour",
    steps: [
      {
        target: "[data-tour='simulation-select']",
        title: "Select Base Simulation",
        content: "Choose a saved simulation to use as the basis for your proposal. The simulation data will populate the proposal automatically.",
        placement: "bottom",
      },
      {
        target: "[data-tour='verification-checklist']",
        title: "Verification Checklist",
        content: "Complete all verification items before generating a proposal. This ensures accuracy and professionalism.",
        placement: "right",
      },
      {
        target: "[data-tour='branding-section']",
        title: "Company Branding",
        content: "Add your company logo, colors, and contact information to create professionally branded proposals.",
        placement: "left",
      },
      {
        target: "[data-tour='export-options']",
        title: "Export Options",
        content: "Export your proposal as a PDF report or Excel spreadsheet. Share links allow clients to view online.",
        placement: "top",
      },
      {
        target: "[data-tour='signature-section']",
        title: "Digital Signatures",
        content: "Enable digital signature capture for client approval. Track proposal status through the approval workflow.",
        placement: "top",
      },
    ],
  },
};

export function getTour(tourId: keyof typeof TOURS): Tour {
  return TOURS[tourId];
}
