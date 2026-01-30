import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Zap, ArrowRight, CheckCircle2, AlertCircle, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tenant {
    id: string;
    name: string;
    shop_number: string | null;
    shop_name: string | null;
    area_sqm: number;
    shop_type_id: string | null;
    shop_types?: { name: string } | null;
}

interface ScadaImport {
    id: string;
    site_name: string;
    shop_name: string | null;
    shop_number: string | null;
    meter_label: string | null;
    category_id: string | null;
    weekday_days: number;
    weekend_days: number;
}

interface TenantProfileMatcherProps {
    projectId: string;
    tenants: Tenant[];
}

export function TenantProfileMatcher({ projectId, tenants }: TenantProfileMatcherProps) {
    const [showMatcher, setShowMatcher] = useState(false);

    // Fetch available meter profiles
    const { data: meters, isLoading: isLoadingMeters } = useQuery({
        queryKey: ["meter-library-all"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("scada_imports")
                .select("id, site_name, shop_name, shop_number, meter_label, category_id, weekday_days, weekend_days")
                .gt("data_points", 0); // Only valid profiles

            if (error) throw error;
            return data as ScadaImport[];
        },
        enabled: showMatcher
    });

    // Calculate matches
    const tenantMatches = useMemo(() => {
        if (!tenants || !meters) return [];

        return tenants.map(tenant => {
            const tenantName = tenant.shop_name || tenant.name || '';
            
            // 1. Try to find explicit match if we had that stored (future)

            // 2. Fuzzy match on name
            const exactNameMatch = meters.find(m =>
                (m.shop_name && m.shop_name.toLowerCase() === tenantName.toLowerCase()) ||
                (m.meter_label && m.meter_label.toLowerCase() === tenantName.toLowerCase())
            );

            if (exactNameMatch) return { tenant, match: exactNameMatch, type: "exact" };

            const containsNameMatch = meters.find(m => {
                const tName = tenantName.toLowerCase();
                const mName = m.shop_name?.toLowerCase();
                const mLabel = m.meter_label?.toLowerCase();

                return (
                    (mName && (tName.includes(mName) || mName.includes(tName))) ||
                    (mLabel && (tName.includes(mLabel) || mLabel.includes(tName)))
                );
            });

            if (containsNameMatch) return { tenant, match: containsNameMatch, type: "fuzzy" };

            // 3. Match by category/type if available (simplified for now as we'd need to map category names)

            return { tenant, match: null, type: "none" };
        });
    }, [tenants, meters]);

    if (!showMatcher) {
        return (
            <Button variant="outline" onClick={() => setShowMatcher(true)} className="w-full mt-4">
                <Zap className="h-4 w-4 mr-2" />
                Analyze Tenant Load Profiles
            </Button>
        );
    }

    if (isLoadingMeters) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card className="mt-6 border-primary/20">
            <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                    <span>Tenant Load Profile Analysis</span>
                    <Button variant="ghost" size="sm" onClick={() => setShowMatcher(false)}>Close</Button>
                </CardTitle>
                <CardDescription>
                    Matches tenants to real-world meter data to generate accurate load profiles.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-green-50/50 border-green-100">
                        <CardContent className="p-4 flex items-center gap-3">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                            <div>
                                <p className="text-sm font-medium text-green-900">With Profiles</p>
                                <p className="text-2xl font-bold text-green-700">
                                    {tenantMatches.filter(m => m.match).length} / {tenants.length}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    {(() => {
                        const exactMatches = tenantMatches.filter(m => m.type === "exact").length;
                        const fuzzyMatches = tenantMatches.filter(m => m.type === "fuzzy").length;
                        const totalMatched = exactMatches + fuzzyMatches;
                        const matchRatio = tenants.length > 0 ? totalMatched / tenants.length : 0;
                        const exactRatio = totalMatched > 0 ? exactMatches / totalMatched : 0;
                        
                        // Calculate confidence: high if >70% matched with >50% exact, medium if >40% matched, low otherwise
                        const confidence = matchRatio > 0.7 && exactRatio > 0.5 ? "High" 
                            : matchRatio > 0.4 ? "Medium" 
                            : "Low";
                        const bgClass = confidence === "High" ? "bg-green-50/50 border-green-100" 
                            : confidence === "Medium" ? "bg-amber-50/50 border-amber-100"
                            : "bg-red-50/50 border-red-100";
                        const textClass = confidence === "High" ? "text-green-" 
                            : confidence === "Medium" ? "text-amber-"
                            : "text-red-";
                        
                        return (
                            <Card className={bgClass}>
                                <CardContent className="p-4 flex items-center gap-3">
                                    <AlertCircle className={`h-8 w-8 ${textClass}500`} />
                                    <div>
                                        <p className={`text-sm font-medium ${textClass}900`}>Average Confidence</p>
                                        <p className={`text-2xl font-bold ${textClass}700`}>
                                            {confidence}
                                        </p>
                                        <p className={`text-xs ${textClass}600`}>
                                            {exactMatches} exact, {fuzzyMatches} fuzzy
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })()}
                </div>

                <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                        {tenantMatches.map(({ tenant, match, type }) => (
                            <div key={tenant.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium truncate">
                                            {tenant.shop_number && (
                                                <span className="text-muted-foreground mr-1">{tenant.shop_number}</span>
                                            )}
                                            {tenant.shop_name || tenant.name}
                                        </p>
                                        {tenant.shop_types && (
                                            <Badge variant="outline" className="text-xs">
                                                {tenant.shop_types.name}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {Number(tenant.area_sqm).toLocaleString()} m²
                                    </p>
                                </div>

                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                                <div className="flex-1 min-w-0">
                                    {match ? (
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-green-700 truncate">
                                                    {match.shop_name || match.meter_label || match.site_name}
                                                </p>
                                                <Badge variant={type === "exact" ? "default" : "secondary"} className="text-[10px] h-5">
                                                    {type === "exact" ? "Exact" : "Similar"}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                                {match.site_name} • {match.weekday_days}d history
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-muted-foreground italic">No profile matched</p>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className="h-8 w-[160px] justify-between text-xs"
                                                    >
                                                        Assign...
                                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[280px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search profiles..." className="h-9" />
                                                        <CommandList>
                                                            <CommandEmpty>No profile found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {meters?.map(m => (
                                                                    <CommandItem
                                                                        key={m.id}
                                                                        value={`${m.shop_name || ""} ${m.meter_label || ""} ${m.site_name}`}
                                                                        onSelect={() => {
                                                                            // TODO: Implement assignment logic
                                                                            console.log("Assign", tenant.id, "to", m.id);
                                                                        }}
                                                                        className="text-xs"
                                                                    >
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium">
                                                                                {m.shop_name || m.meter_label || m.site_name}
                                                                            </span>
                                                                            <span className="text-muted-foreground text-[10px]">
                                                                                {m.site_name} • {m.weekday_days}d data
                                                                            </span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
