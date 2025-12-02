-- Add High Demand and Low Demand to time_of_use_type enum
ALTER TYPE time_of_use_type ADD VALUE IF NOT EXISTS 'High Demand';
ALTER TYPE time_of_use_type ADD VALUE IF NOT EXISTS 'Low Demand';