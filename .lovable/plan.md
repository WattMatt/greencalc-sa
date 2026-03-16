
Problem diagnosed

- The “1 kWh/kWp/yr” value is caused by a unit mismatch in the simplified PVGIS monthly path.
- `pvgis-monthly` returns `typicalDay.hourlyGhi` in kWh/m²/hour (example from Kingswalk cache: hour 12 ≈ 0.63), but `generateSolarProfile(...)` expects W/m² and divides by 1000 internally.
- Result: simplified daily energy is reduced by ~1000×, so specific yield collapses to ~1 instead of ~1300–1400.

Implementation plan

1) Normalize PVGIS monthly hourly irradiance before profile generation  
- File: `src/components/projects/simulation/useSolarProfiles.ts`
- In `pvgisHourlyProfile` mapping, add source-aware unit normalization:
  - For `solarDataSource === "pvgis_monthly"`, detect low-range hourly values (kWh-scale) and convert to W/m² (`×1000`) for `ghi`, `dni`, `dhi`.
  - Keep `pvgis_tmy` untouched (already W/m²).

2) Keep logic backward-compatible with existing cached data  
- Use a simple heuristic (e.g., monthly peak irradiance threshold) so old cached monthly records (kWh-based) are fixed immediately without forcing a refresh.
- If future monthly payloads are already W/m², they won’t be multiplied again.

3) Preserve current display calculations  
- Keep current `simplifiedDailyOutput` and `calculatedSpecificYield` formulas in `SimulationPanel.tsx` (they are now structurally correct and DC-based).
- No denominator changes needed beyond what is already done.

Validation plan

- Kingswalk, `pvgis_monthly` + simplified mode:
  - Expected daily output returns to realistic MWh/day range (not single digits).
  - Specific yield returns to expected ~1.3–1.4 MWh/kWp/yr band.
- Cross-check no regressions:
  - `pvgis_tmy` simplified values remain consistent.
  - PVsyst mode values remain unchanged.
  - Override fields still scale from corrected baseline.
