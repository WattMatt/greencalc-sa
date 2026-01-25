import { getDegradationVariables } from "@/hooks/useCalculationDefaults";

// Project lifetime for financial calculations and simulations
// NOTE: This now reads from centralized calculation variables
export const PROJECT_LIFETIME_YEARS = getDegradationVariables().projectLifetimeYears;

export const SOUTH_AFRICAN_PROVINCES = [
    "Eastern Cape",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "Northern Cape",
    "North West",
    "Western Cape",
    "Eskom",
] as const;
