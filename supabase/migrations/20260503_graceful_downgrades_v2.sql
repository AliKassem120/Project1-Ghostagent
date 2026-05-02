-- Add next_plan_tier column to users table for graceful downgrades
ALTER TABLE users ADD COLUMN IF NOT EXISTS next_plan_tier text null;
