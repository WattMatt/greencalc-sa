import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Unit = 'm' | 'cm' | 'mm';

interface DimensionInputProps {
  label: string;
  /** Value in meters (always stored as meters internally) */
  value: number;
  onChange: (valueInMeters: number) => void;
  step?: number;
  className?: string;
}

const CONVERSION_FACTORS: Record<Unit, number> = {
  'm': 1,
  'cm': 100,
  'mm': 1000,
};

export function DimensionInput({ label, value, onChange, step, className }: DimensionInputProps) {
  const [unit, setUnit] = useState<Unit>('m');
  const [displayValue, setDisplayValue] = useState<string>('');

  // Convert meters to display unit
  const metersToDisplay = (meters: number, targetUnit: Unit): number => {
    return meters * CONVERSION_FACTORS[targetUnit];
  };

  // Convert display unit to meters
  const displayToMeters = (displayVal: number, fromUnit: Unit): number => {
    return displayVal / CONVERSION_FACTORS[fromUnit];
  };

  // Update display value when value or unit changes
  useEffect(() => {
    const converted = metersToDisplay(value, unit);
    // Round to avoid floating point issues
    const rounded = Math.round(converted * 10000) / 10000;
    setDisplayValue(rounded.toString());
  }, [value, unit]);

  const handleValueChange = (inputValue: string) => {
    setDisplayValue(inputValue);
    // Normalize locale decimal separators (comma → period)
    const normalizedValue = inputValue.replace(',', '.');
    const numericValue = parseFloat(normalizedValue);
    if (!isNaN(numericValue)) {
      const meters = displayToMeters(numericValue, unit);
      onChange(meters);
    }
  };

  const handleUnitChange = (newUnit: Unit) => {
    setUnit(newUnit);
    // Value in meters stays the same, display updates via effect
  };

  // Determine appropriate step based on unit
  const getStep = (): string => {
    if (step !== undefined) {
      return (step * CONVERSION_FACTORS[unit]).toString();
    }
    switch (unit) {
      case 'm': return '0.001';
      case 'cm': return '0.1';
      case 'mm': return '1';
    }
  };

  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Input 
          type="number" 
          step={getStep()}
          value={displayValue}
          onChange={e => handleValueChange(e.target.value)}
          className="h-8 text-sm flex-1"
        />
        <Select value={unit} onValueChange={(v) => handleUnitChange(v as Unit)}>
          <SelectTrigger className="h-8 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="m" className="text-xs">m</SelectItem>
            <SelectItem value="cm" className="text-xs">cm</SelectItem>
            <SelectItem value="mm" className="text-xs">mm</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
