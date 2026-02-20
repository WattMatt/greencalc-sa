import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MeterFormFieldsProps {
  idPrefix: string;
  defaultValues: {
    meter_label?: string;
    site_name?: string;
    shop_name?: string;
    shop_number?: string;
  };
}

export function MeterFormFields({ idPrefix, defaultValues }: MeterFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_meter_label`}>Meter Label</Label>
        <Input id={`${idPrefix}_meter_label`} name="meter_label" defaultValue={defaultValues.meter_label || ''} placeholder="Main Board" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_site_name`}>Site Name</Label>
        <Input id={`${idPrefix}_site_name`} name="site_name" defaultValue={defaultValues.site_name || ''} placeholder="Clearwater Mall" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_shop_name`}>Shop Name</Label>
        <Input id={`${idPrefix}_shop_name`} name="shop_name" defaultValue={defaultValues.shop_name || ''} placeholder="Woolworths" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_shop_number`}>Shop Number</Label>
        <Input id={`${idPrefix}_shop_number`} name="shop_number" defaultValue={defaultValues.shop_number || ''} placeholder="G12" />
      </div>
    </div>
  );
}
