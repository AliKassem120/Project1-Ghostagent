-- 20260223_payment_infrastructure_update.sql

-- 1. Add plan tier and trial tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'free_trial';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '14 days');
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;

-- 2. Add plan_name to transactions to know which plan they bought
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plan_name TEXT;

-- 3. Update RLS policies for transactions if needed
-- (Assuming they were already created, but we can ensure they are here)
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
-- CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
-- DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
-- CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
