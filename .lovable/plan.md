

## Display PV DC Capacity Under System Size (AC)

### What
Add a "System Size (DC)" readout directly below the System Size (AC) input section in the InverterSliderPanel, showing the calculated DC panel capacity (kWp). This gives immediate visibility of both AC and DC values without scrolling to the metrics box.

### Changes

**File: `src/components/projects/InverterSliderPanel.tsx`**

After the System Size (AC) input block (line ~131), insert a small info line showing the derived DC capacity:

```tsx
{/* DC Capacity readout */}
<p className="text-xs text-muted-foreground ml-1">
  System Size (DC): <span className="font-medium text-foreground">
    {moduleMetrics?.actualDcCapacityKwp.toFixed(1) ?? (desiredAcCapacity * config.dcAcRatio).toFixed(1)} kWp
  </span>
</p>
```

This uses the same calculation already in the metrics box (line 263), just surfaced earlier for quick reference. No new props or data needed — it's derived from `desiredAcCapacity * dcAcRatio` (or the more precise `moduleMetrics` when available).

