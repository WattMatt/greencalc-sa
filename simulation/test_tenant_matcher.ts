// Mock Interfaces
interface Tenant {
    id: string;
    name: string;
    area_sqm: number;
}

interface ScadaImport {
    id: string;
    site_name: string;
    shop_name: string | null;
    shop_number: string | null;
    meter_label: string | null;
}

// Mock Data
const tenants: Tenant[] = [
    { id: "1", name: "Woolworths", area_sqm: 1000 },
    { id: "2", name: "Checkers Hyper", area_sqm: 2000 },
    { id: "3", name: "Unknown Shop", area_sqm: 100 },
    { id: "4", name: "Mugg & Bean", area_sqm: 150 },
];

const meters: ScadaImport[] = [
    { id: "m1", site_name: "Clearwater Mall", shop_name: "Woolworths", shop_number: "G12", meter_label: null },
    { id: "m2", site_name: "Checkers", shop_name: null, shop_number: null, meter_label: "Checkers Hyper Main" },
    { id: "m3", site_name: "Clearwater Mall", shop_name: "Mugg & Bean", shop_number: "G45", meter_label: null },
    { id: "m4", site_name: "Some Other Place", shop_name: "Edgars", shop_number: null, meter_label: null },
];

console.log("Starting Tenant Profile Matching Simulation...");

function matchTenants(tenants: Tenant[], meters: ScadaImport[]) {
    return tenants.map(tenant => {
        // 1. Exact Match on shop_name or meter_label
        const exactNameMatch = meters.find(m =>
            (m.shop_name && m.shop_name.toLowerCase() === tenant.name.toLowerCase()) ||
            (m.meter_label && m.meter_label.toLowerCase() === tenant.name.toLowerCase())
        );

        if (exactNameMatch) return { tenant: tenant.name, match: exactNameMatch.shop_name || exactNameMatch.meter_label || exactNameMatch.site_name, type: "exact" };

        // 2. Fuzzy Match (Contains)
        const containsNameMatch = meters.find(m =>
            (m.shop_name && tenant.name.toLowerCase().includes(m.shop_name.toLowerCase())) ||
            (m.meter_label && tenant.name.toLowerCase().includes(m.meter_label.toLowerCase())) ||
            // Also check reverse: if tenant name is in meter label (e.g. "Checkers" in "Checkers Hyper")
            (m.shop_name && m.shop_name.toLowerCase().includes(tenant.name.toLowerCase())) ||
            (m.meter_label && m.meter_label.toLowerCase().includes(tenant.name.toLowerCase()))
        );

        if (containsNameMatch) return { tenant: tenant.name, match: containsNameMatch.shop_name || containsNameMatch.meter_label || containsNameMatch.site_name, type: "fuzzy" };

        return { tenant: tenant.name, match: null, type: "none" };
    });
}

const results = matchTenants(tenants, meters);

results.forEach(r => {
    const status = r.match ? "[MATCH]" : "[NO MATCH]";
    console.log(`${status} ${r.tenant} -> ${r.match || "None"} (${r.type})`);
});
