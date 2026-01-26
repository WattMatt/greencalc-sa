
# Add Searchable Load Profile Dropdown in Add Tenant Modal

## Overview
Replace the basic dropdown in the "Add Tenant" modal with a searchable dropdown (Combobox) that matches the existing implementation in the tenant table. This allows users to quickly filter and find load profiles by typing.

## Current Behavior
The "Add Tenant" modal uses a simple `Select` component that shows all profiles in a scrollable list without search capability.

## Proposed Solution
Replace the `Select` component with a `Popover` + `Command` pattern (shadcn/ui Combobox) that includes:
- A search input field with "Search profiles..." placeholder
- Filterable list of profiles showing "SHOP NAME (XXX m²)" format
- Check mark indicator for the currently selected profile
- "No profile found." empty state when search has no matches

## Changes Required

### File: `src/components/projects/TenantManager.tsx`

**1. Add state for popover open/close:**
Add a new state variable to control the popover visibility:
```tsx
const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);
```

**2. Replace the Select component with Popover + Command:**
Replace lines 449-464 (the Load Profile Select) with:

```tsx
<div className="space-y-2">
  <Label>Load Profile (optional)</Label>
  <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={profilePopoverOpen}
        className="w-full justify-between"
      >
        <span className="truncate">
          {newTenant.scada_import_id
            ? formatProfileOption(
                scadaImports?.find((m) => m.id === newTenant.scada_import_id)!
              )
            : "Select profile..."}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[320px] p-0" align="start">
      <Command>
        <CommandInput placeholder="Search profiles..." className="h-9" />
        <CommandList>
          <CommandEmpty>No profile found.</CommandEmpty>
          <CommandGroup>
            {scadaImports?.map((meter) => (
              <CommandItem
                key={meter.id}
                value={`${meter.shop_name || ""} ${meter.site_name || ""} ${meter.area_sqm || ""}`}
                onSelect={() => {
                  setNewTenant({ ...newTenant, scada_import_id: meter.id });
                  setProfilePopoverOpen(false);
                }}
                className="text-sm"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    newTenant.scada_import_id === meter.id
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                {formatProfileOption(meter)}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</div>
```

## Technical Notes
- All required components are already imported in the file (Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, Popover, PopoverContent, PopoverTrigger, Check, ChevronsUpDown, cn)
- The `formatProfileOption` helper function already exists and formats profiles as "SHOP NAME (XXX m²)"
- The pattern matches exactly what's used in the tenant table (lines 560-610)
- The `value` prop on `CommandItem` enables fuzzy search matching on shop_name, site_name, and area
