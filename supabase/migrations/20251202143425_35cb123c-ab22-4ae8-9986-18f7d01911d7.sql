-- Create enum for day types
CREATE TYPE public.day_type AS ENUM ('Weekday', 'Saturday', 'Sunday');

-- Create TOU period definitions table
CREATE TABLE public.tou_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tariff_id UUID NOT NULL REFERENCES public.tariffs(id) ON DELETE CASCADE,
  season public.season_type NOT NULL DEFAULT 'All Year',
  day_type public.day_type NOT NULL DEFAULT 'Weekday',
  time_of_use public.time_of_use_type NOT NULL DEFAULT 'Peak',
  start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INTEGER NOT NULL CHECK (end_hour >= 0 AND end_hour <= 24),
  rate_per_kwh DECIMAL(12,4) NOT NULL,
  demand_charge_per_kva DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_hour_range CHECK (start_hour < end_hour OR (start_hour > end_hour))
);

-- Create index for better query performance
CREATE INDEX idx_tou_periods_tariff ON public.tou_periods(tariff_id);
CREATE INDEX idx_tou_periods_season_day ON public.tou_periods(season, day_type);

-- Enable RLS
ALTER TABLE public.tou_periods ENABLE ROW LEVEL SECURITY;

-- RLS policies (public read, allow all writes for admin)
CREATE POLICY "Anyone can view TOU periods" ON public.tou_periods FOR SELECT USING (true);
CREATE POLICY "Allow all inserts on tou_periods" ON public.tou_periods FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on tou_periods" ON public.tou_periods FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on tou_periods" ON public.tou_periods FOR DELETE USING (true);

-- Add comment explaining the table
COMMENT ON TABLE public.tou_periods IS 'Stores granular Time of Use period definitions with specific hour ranges for each season and day type';
COMMENT ON COLUMN public.tou_periods.start_hour IS 'Start hour (0-23, e.g., 6 for 6am)';
COMMENT ON COLUMN public.tou_periods.end_hour IS 'End hour (1-24, e.g., 9 for 9am, 24 for midnight)';