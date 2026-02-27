import * as React from "react";
import { Input } from "@/components/ui/input";

export interface NumericInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number;
  onChange: (value: number) => void;
  /** Value to use when field is empty on blur. Default: 0 */
  fallback?: number;
  /** Use integer parsing instead of float. Default: false */
  integer?: boolean;
}

export function NumericInput({
  value,
  onChange,
  fallback = 0,
  integer = false,
  onBlur,
  onKeyDown,
  ...props
}: NumericInputProps) {
  const [displayValue, setDisplayValue] = React.useState(String(value));
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync from parent when not focused
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(String(value));
    }
  }, [value, isFocused]);

  const commit = () => {
    const parsed = integer ? parseInt(displayValue) : parseFloat(displayValue);
    let finalValue = isNaN(parsed) ? fallback : parsed;

    // Clamp to min/max if provided
    const min = props.min !== undefined ? Number(props.min) : undefined;
    const max = props.max !== undefined ? Number(props.max) : undefined;
    if (min !== undefined && !isNaN(min) && finalValue < min) finalValue = min;
    if (max !== undefined && !isNaN(max) && finalValue > max) finalValue = max;

    onChange(finalValue);
    setDisplayValue(String(finalValue));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    commit();
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit();
    }
    onKeyDown?.(e);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  return (
    <Input
      type="number"
      {...props}
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
