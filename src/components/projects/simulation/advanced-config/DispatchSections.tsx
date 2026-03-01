/**
 * Charge/Discharge strategy lists and Battery/Solar characteristics sections.
 * Extracted from AdvancedSimulationConfig.tsx.
 */

import React, { useState } from "react";
import { GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Separator } from "@/components/ui/separator";
import { DischargeTOUSelection, DEFAULT_DISCHARGE_TOU_SELECTION } from "@/components/projects/load-profile/types";
import type {
  BatteryDispatchStrategy,
  DispatchConfig,
  TimeWindow,
  ChargeSource,
  DischargeSource,
} from "../EnergySimulationEngine";
import { getDefaultDispatchConfig, DEFAULT_CHARGE_SOURCES, DEFAULT_DISCHARGE_SOURCES } from "../EnergySimulationEngine";

type TOUPeriod = 'off-peak' | 'standard' | 'peak';

// ─── Charge Sources List ─────────────────────────────────────────────

const CHARGE_SOURCE_LABELS: Record<string, string> = { pv: 'PV (Solar)', grid: 'Grid', generator: 'Generator' };

export function ChargeSourcesList({ sources, onChange }: { sources: ChargeSource[]; onChange: (sources: ChargeSource[]) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const moveItem = (from: number, to: number) => { if (from === to) return; const n = [...sources]; const [m] = n.splice(from, 1); n.splice(to, 0, m); onChange(n); };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Charge Strategy</Label>
        <span className="text-[10px] text-muted-foreground">Top = highest priority</span>
      </div>
      <div className="rounded border bg-muted/30 divide-y divide-border">
        {sources.map((source, idx) => (
          <div key={source.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIdx !== null) moveItem(dragIdx, idx); setDragIdx(null); }} onDragEnd={() => setDragIdx(null)} className={`px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-opacity ${dragIdx === idx ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <Checkbox checked={source.enabled} onCheckedChange={(v) => { const next = sources.map((s, i) => i === idx ? { ...s, enabled: !!v } : s); onChange(next); }} className="h-3.5 w-3.5" />
              <span className={`shrink-0 ${source.enabled ? '' : 'text-muted-foreground'}`}>{CHARGE_SOURCE_LABELS[source.id] || source.id}</span>
              {source.enabled && (
                <>
                  <span className="text-[9px] text-muted-foreground shrink-0 ml-1">Charge during</span>
                  {([{ value: 'off-peak' as const, label: 'Off-Peak' }, { value: 'standard' as const, label: 'Standard' }, { value: 'peak' as const, label: 'Peak' }]).map((period) => {
                    const periods = source.chargeTouPeriods ?? (source.chargeTouPeriod ? [source.chargeTouPeriod] : []);
                    const checked = periods.includes(period.value);
                    return (
                      <label key={period.value} className="flex items-center gap-1 text-[10px] cursor-pointer shrink-0">
                        <Checkbox checked={checked} onCheckedChange={(v) => { const next = v ? [...periods, period.value] : periods.filter(p => p !== period.value); const updated = sources.map((s, i) => i === idx ? { ...s, chargeTouPeriods: next } : s); onChange(updated); }} className="h-3 w-3" />
                        {period.label}
                      </label>
                    );
                  })}
                </>
              )}
              <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0">{idx + 1}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Discharge Sources List ──────────────────────────────────────────

const DISCHARGE_SOURCE_LABELS: Record<string, string> = { load: 'Load', battery: 'Battery', 'grid-export': 'Grid Export' };

export function DischargeSourcesList({ sources, onChange }: { sources: DischargeSource[]; onChange?: (sources: DischargeSource[]) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const moveItem = (from: number, to: number) => { if (from === to) return; const n = [...sources]; const [m] = n.splice(from, 1); n.splice(to, 0, m); onChange?.(n); };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Discharge Strategy</Label>
        <span className="text-[10px] text-muted-foreground">Top = highest priority</span>
      </div>
      <div className="rounded border bg-muted/30 divide-y divide-border">
        {sources.map((source, idx) => (
          <div key={source.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIdx !== null) moveItem(dragIdx, idx); setDragIdx(null); }} onDragEnd={() => setDragIdx(null)} className={`px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-opacity ${dragIdx === idx ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <Checkbox checked={source.enabled} onCheckedChange={(v) => { const next = sources.map((s, i) => i === idx ? { ...s, enabled: !!v } : s); onChange?.(next); }} className="h-3.5 w-3.5" />
              <span className={`shrink-0 ${source.enabled ? '' : 'text-muted-foreground'}`}>{DISCHARGE_SOURCE_LABELS[source.id] || source.id}</span>
              {source.enabled && (
                <>
                  <span className="text-[9px] text-muted-foreground shrink-0 ml-1">Discharge during</span>
                  {([{ value: 'off-peak' as const, label: 'Off-Peak' }, { value: 'standard' as const, label: 'Standard' }, { value: 'peak' as const, label: 'Peak' }]).map((period) => {
                    const periods = source.dischargeTouPeriods ?? ['peak'];
                    const checked = periods.includes(period.value);
                    return (
                      <label key={period.value} className="flex items-center gap-1 text-[10px] cursor-pointer shrink-0">
                        <Checkbox checked={checked} onCheckedChange={(v) => { const next = v ? [...periods, period.value] : periods.filter(p => p !== period.value); const updated = sources.map((s, i) => i === idx ? { ...s, dischargeTouPeriods: next } : s); onChange?.(updated); }} className="h-3 w-3" />
                        {period.label}
                      </label>
                    );
                  })}
                </>
              )}
              <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0">{idx + 1}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Solar Characteristics ───────────────────────────────────────────

export function SolarCharacteristicsSection({ dischargeSources, onDischargeSourcesChange }: { dischargeSources: DischargeSource[]; onDischargeSourcesChange?: (sources: DischargeSource[]) => void }) {
  return (
    <div className="space-y-3">
      <DischargeSourcesList sources={dischargeSources} onChange={onDischargeSourcesChange} />
    </div>
  );
}

// ─── Battery Characteristics ─────────────────────────────────────────

interface BatteryCharacteristicsSectionProps {
  chargeCRate: number;
  onChargeCRateChange?: (value: number) => void;
  dischargeCRate: number;
  onDischargeCRateChange?: (value: number) => void;
  doD: number;
  minSoC: number;
  onMinSoCChange?: (value: number) => void;
  maxSoC: number;
  onMaxSoCChange?: (value: number) => void;
  batteryStrategy?: BatteryDispatchStrategy;
  onBatteryStrategyChange?: (strategy: BatteryDispatchStrategy) => void;
  dispatchConfig?: DispatchConfig;
  onDispatchConfigChange?: (config: DispatchConfig) => void;
  chargeTouPeriod?: TOUPeriod;
  onChargeTouPeriodChange?: (period: TOUPeriod) => void;
  dischargeTouSelection?: DischargeTOUSelection;
  onDischargeTouSelectionChange?: (selection: DischargeTOUSelection) => void;
  touPeriodToWindows?: (period: TOUPeriod) => TimeWindow[];
}

export function BatteryCharacteristicsSection({
  chargeCRate, onChargeCRateChange, dischargeCRate, onDischargeCRateChange,
  doD, minSoC, onMinSoCChange, maxSoC, onMaxSoCChange,
  batteryStrategy, onBatteryStrategyChange, dispatchConfig, onDispatchConfigChange,
  chargeTouPeriod, onChargeTouPeriodChange, dischargeTouSelection, onDischargeTouSelectionChange,
  touPeriodToWindows,
}: BatteryCharacteristicsSectionProps) {
  const effectiveDispatchConfig = dispatchConfig ?? getDefaultDispatchConfig(batteryStrategy);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Charging C-Rate</Label>
          <NumericInput value={chargeCRate} onChange={(v) => onChargeCRateChange?.(Math.max(0.01, Math.min(5, v)))} fallback={0.5} className="h-8 text-xs" min={0.01} max={5} step={0.01} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Discharging C-Rate</Label>
          <NumericInput value={dischargeCRate} onChange={(v) => onDischargeCRateChange?.(Math.max(0.01, Math.min(5, v)))} fallback={0.5} className="h-8 text-xs" min={0.01} max={5} step={0.01} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Depth of Discharge (%)</Label>
          <Input type="number" value={maxSoC - minSoC} readOnly disabled className="h-8 text-xs bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Min SoC (%)</Label>
          <NumericInput value={minSoC} onChange={(v) => { const val = Math.max(0, Math.min(100, v)); onMinSoCChange?.(val); if (val >= maxSoC) onMaxSoCChange?.(Math.min(100, val + 5)); }} integer className="h-8 text-xs" min={0} max={100} step={5} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max SoC (%)</Label>
          <NumericInput value={maxSoC} onChange={(v) => { const val = Math.max(0, Math.min(100, v)); onMaxSoCChange?.(val); if (val <= minSoC) onMinSoCChange?.(Math.max(0, val - 5)); }} fallback={100} integer className="h-8 text-xs" min={0} max={100} step={5} />
        </div>
      </div>

      <Separator className="my-2" />
      <ChargeSourcesList
        sources={effectiveDispatchConfig.chargeSources ?? DEFAULT_CHARGE_SOURCES}
        onChange={(sources) => {
          const allowGrid = sources.find(s => s.id === 'grid')?.enabled ?? false;
          onDispatchConfigChange?.({ ...effectiveDispatchConfig, chargeSources: sources, allowGridCharging: allowGrid });
        }}
      />

      <Separator className="my-2" />
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Discharge Strategy</Label>
          <Select
            value={batteryStrategy}
            onValueChange={(v: BatteryDispatchStrategy) => {
              onBatteryStrategyChange?.(v);
              const newConfig = getDefaultDispatchConfig(v);
              const preservedChargeConfig = {
                chargeSources: effectiveDispatchConfig.chargeSources,
                chargeWindows: effectiveDispatchConfig.chargeWindows,
                allowGridCharging: effectiveDispatchConfig.allowGridCharging,
              };
              if (v === 'tou-arbitrage' && touPeriodToWindows) {
                const sel = dischargeTouSelection ?? DEFAULT_DISCHARGE_TOU_SELECTION;
                const windows: TimeWindow[] = [];
                for (const season of ['highSeason', 'lowSeason'] as const) {
                  for (const dayType of ['weekday', 'weekend'] as const) {
                    const flags = sel[season][dayType];
                    if (flags.peak) windows.push(...touPeriodToWindows('peak'));
                    if (flags.standard) windows.push(...touPeriodToWindows('standard'));
                    if (flags.offPeak) windows.push(...touPeriodToWindows('off-peak'));
                  }
                }
                const uniqueWindows = windows.filter((w, i, arr) => arr.findIndex(x => x.start === w.start && x.end === w.end) === i);
                onDispatchConfigChange?.({ ...newConfig, ...preservedChargeConfig, dischargeWindows: uniqueWindows.length > 0 ? uniqueWindows : [{ start: 0, end: 0 }], dischargeTouSelection: sel });
              } else {
                onDispatchConfigChange?.({ ...newConfig, ...preservedChargeConfig });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Self-Consumption</SelectItem>
              <SelectItem value="tou-arbitrage">TOU Arbitrage</SelectItem>
              <SelectItem value="peak-shaving">Peak Shaving</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {batteryStrategy === 'tou-arbitrage' && (() => {
          const sel = dischargeTouSelection ?? DEFAULT_DISCHARGE_TOU_SELECTION;
          const periods = [
            { key: 'peak' as const, label: 'Peak', color: 'hsl(0 72% 51%)' },
            { key: 'standard' as const, label: 'Standard', color: 'hsl(38 92% 50%)' },
            { key: 'offPeak' as const, label: 'Off-Peak', color: 'hsl(160 84% 39%)' },
          ];
          const rows: { seasonKey: 'highSeason' | 'lowSeason'; dayKey: 'weekday' | 'weekend'; label: string; seasonLabel?: string; seasonColor?: string }[] = [
            { seasonKey: 'highSeason', dayKey: 'weekday', label: 'Weekday', seasonLabel: 'High-Demand', seasonColor: 'hsl(230 70% 50%)' },
            { seasonKey: 'highSeason', dayKey: 'weekend', label: 'Weekend' },
            { seasonKey: 'lowSeason', dayKey: 'weekday', label: 'Weekday', seasonLabel: 'Low-Demand', seasonColor: 'hsl(270 50% 60%)' },
            { seasonKey: 'lowSeason', dayKey: 'weekend', label: 'Weekend' },
          ];
          const handleToggle = (seasonKey: 'highSeason' | 'lowSeason', dayKey: 'weekday' | 'weekend', periodKey: 'peak' | 'standard' | 'offPeak', checked: boolean) => {
            const newSel: DischargeTOUSelection = { highSeason: { weekday: { ...sel.highSeason.weekday }, weekend: { ...sel.highSeason.weekend } }, lowSeason: { weekday: { ...sel.lowSeason.weekday }, weekend: { ...sel.lowSeason.weekend } } };
            newSel[seasonKey][dayKey][periodKey] = checked;
            onDischargeTouSelectionChange?.(newSel);
          };
          return (
            <div className="space-y-2 p-2 rounded bg-muted/30">
              <Label className="text-xs font-medium">Discharge During</Label>
              <div className="grid grid-cols-[auto_auto_1fr_1fr_1fr] gap-x-2 gap-y-1 text-xs items-center">
                <div /><div />
                {periods.map(p => (<div key={p.key} className="text-center font-medium" style={{ color: p.color }}>{p.label}</div>))}
                {rows.map((row) => (
                  <React.Fragment key={`${row.seasonKey}-${row.dayKey}`}>
                    {row.seasonLabel ? <span className="font-semibold pr-1" style={{ color: row.seasonColor }}>{row.seasonLabel}</span> : <span />}
                    <span className="text-muted-foreground">{row.label}</span>
                    {periods.map(p => {
                      const checked = sel[row.seasonKey][row.dayKey][p.key];
                      return (<div key={p.key} className="flex justify-center items-center"><Checkbox checked={checked} onCheckedChange={(v) => handleToggle(row.seasonKey, row.dayKey, p.key, !!v)} className="h-3.5 w-3.5" /></div>);
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
