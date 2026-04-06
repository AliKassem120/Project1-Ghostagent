export interface BusinessProfile {
    business_name: string;
    business_type:
    | 'ecommerce'
    | 'appointments';
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
}

export interface PromptContext {
    business: BusinessProfile;
    inventoryContext: string;
    catalogContext: string;
    historyContext: string;
    contextSummary: string | null;
    hasGreetedRecently: boolean;
}
