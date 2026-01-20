-- Add VAT-Inclusive columns to tariff_rates
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS rate_per_kwh_incl_vat numeric;
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS energy_charge_per_kwh_incl_vat numeric;
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS network_charge_per_kwh_incl_vat numeric;
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS ancillary_charge_per_kwh_incl_vat numeric;

-- Add missing subsidy columns to tariff_rates (both VAT-exclusive and VAT-inclusive)
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS electrification_rural_per_kwh numeric;
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS electrification_rural_per_kwh_incl_vat numeric;
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS affordability_subsidy_per_kwh numeric;
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS affordability_subsidy_per_kwh_incl_vat numeric;

-- Add VAT-Inclusive columns to tariffs table
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS legacy_charge_per_kwh_incl_vat numeric;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS service_charge_per_day_incl_vat numeric;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS administration_charge_per_day_incl_vat numeric;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS demand_charge_per_kva_incl_vat numeric;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS network_access_charge_incl_vat numeric;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS reactive_energy_charge_incl_vat numeric;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS generation_capacity_charge_incl_vat numeric;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS fixed_monthly_charge_incl_vat numeric;

-- Add demand_charge_per_kva_incl_vat to tariff_rates as well
ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS demand_charge_per_kva_incl_vat numeric;