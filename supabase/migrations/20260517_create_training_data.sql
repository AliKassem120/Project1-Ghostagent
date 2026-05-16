-- Create the training data table
CREATE TABLE IF NOT EXISTS public.business_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('passive_listening', 'manual_upload', 'ig_historical')),
    customer_message TEXT NOT NULL,
    owner_reply TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by workspace when the AI agent boots up
CREATE INDEX IF NOT EXISTS idx_business_training_workspace ON public.business_training_data(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_training_created_at ON public.business_training_data(created_at DESC);

-- Enable RLS
ALTER TABLE public.business_training_data ENABLE ROW LEVEL SECURITY;

-- Create policies for dashboard access
CREATE POLICY "Enable read access for workspace users" ON public.business_training_data
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM workspace_users WHERE workspace_id = business_training_data.workspace_id
    ));

CREATE POLICY "Enable insert access for workspace users" ON public.business_training_data
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM workspace_users WHERE workspace_id = business_training_data.workspace_id
    ));

CREATE POLICY "Enable delete access for workspace users" ON public.business_training_data
    FOR DELETE USING (auth.uid() IN (
        SELECT user_id FROM workspace_users WHERE workspace_id = business_training_data.workspace_id
    ));
