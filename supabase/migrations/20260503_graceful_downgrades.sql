-- Add cancel_at_period_end flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
