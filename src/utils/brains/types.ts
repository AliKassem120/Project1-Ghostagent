export interface BusinessProfile {
    business_name: string;
    business_type: 'ecommerce' | 'appointments';
    tone: string;
    system_instructions: string | null;
    language: string;
    store_location: string | null;
    contact_info: string | null;
    use_emojis: boolean;
    use_local_slang: boolean;
    urgency_mode: boolean;
    handoff_keywords: string[];
    shipping_rules: string | null;

    // Optional enterprise fields. They are safe to add and do not break old callers.
    timezone?: string | null;
    currency?: string | null;
    slot_duration_minutes?: number | null;
}

export interface PromptContext {
    business: BusinessProfile;
    inventoryContext: string;
    catalogContext: string;
    historyContext: string;
    contextSummary: string | null;
    hasGreetedRecently: boolean;
}

export type WorkspaceType = 'ecommerce' | 'appointments';

export interface AutomationEventPayload {
    user_id: string;
    workspace_id?: string | null;
    chat_id?: string | null;
    workspace_type: WorkspaceType;
    intent: string;
    confidence?: number | null;
    payload?: Record<string, any>;
}
