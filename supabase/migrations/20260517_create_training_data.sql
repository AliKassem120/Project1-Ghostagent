-- Create the training data table for RAG Personality Clone
CREATE TABLE IF NOT EXISTS public.business_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('passive_listening', 'manual_upload', 'ig_historical')),
    customer_message TEXT NOT NULL,
    owner_reply TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by workspace when the AI agent boots up
CREATE INDEX IF NOT EXISTS idx_business_training_workspace ON public.business_training_data(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_training_created_at ON public.business_training_data(created_at DESC);
