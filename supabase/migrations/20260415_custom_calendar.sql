-- ═══════════════════════════════════════════════════════════════
-- Ghost Agent — Custom Calendar System
-- Replaces Google Calendar with a self-hosted booking system
-- ═══════════════════════════════════════════════════════════════

-- 1. Business Hours: Weekly schedule per workspace
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun, 6=Sat
    is_open BOOLEAN DEFAULT false,
    open_time TIME DEFAULT '09:00',
    close_time TIME DEFAULT '17:00',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, workspace_id, day_of_week)
);

-- 2. Appointments: Individual bookings
CREATE TABLE IF NOT EXISTS appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    service TEXT NOT NULL DEFAULT 'General',
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    instagram_user_id TEXT,
    instagram_handle TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add slot duration to ai_settings
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 60;

-- 4. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(workspace_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_business_hours_ws ON business_hours(workspace_id, day_of_week);

-- 5. Enable RLS
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_hours
CREATE POLICY "Users can read own business_hours" ON business_hours
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own business_hours" ON business_hours
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own business_hours" ON business_hours
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own business_hours" ON business_hours
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for appointments
CREATE POLICY "Users can read own appointments" ON appointments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own appointments" ON appointments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own appointments" ON appointments
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own appointments" ON appointments
    FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for webhook/AI operations
CREATE POLICY "Service role full access to business_hours" ON business_hours
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to appointments" ON appointments
    FOR ALL USING (auth.role() = 'service_role');
