import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceConfig, ConversationStage } from '@/lib/ai/types';
import type { CustomerProfile } from '@/lib/ai/customer-profile';

export interface SessionData {
  productId?: string;
  productName?: string;
  price?: number;
  stock?: number;
  quantity?: number;
  variant?: string;
  serviceId?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  [key: string]: any;
}

export interface SessionContext {
  workspaceId: string;
  userId: string;
  chatId: string;
  platform: 'instagram' | 'whatsapp';
  state: ConversationStage;
  loopCount: number;
  stateEnteredAt: string;
  lastBotMessage: string | null;
  lastInteractionAt: string;
  customerProfile: CustomerProfile | null;
  data: SessionData | null;
  postContext: SessionData | null;
  isFreshSession: boolean;
}

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  chatId: string;
  config: WorkspaceConfig;
  platform: 'instagram' | 'whatsapp';
  session: SessionContext;
}

export type FsmAction = 
  | 'tool_search_products' | 'tool_check_stock' | 'tool_place_order'
  | 'tool_cancel_order' | 'tool_update_order_address'
  | 'place_order_success' | 'place_order_failed'
  | 'out_of_stock_at_checkout' | 'handoff'
  | 'v3_brain_reply' | 'llm_reply'
  | string; // Keep flexible for extensions if needed

export interface FsmResult {
  nextState: ConversationStage;
  actions: FsmAction[];
  context?: {
    actionType: 'order_cancelled' | 'checkout_success' | 'appointment_booked' | 'info_gathered' | 'defer_to_llm';
    payload: Record<string, unknown>; // strict: unknown forces consumers to validate
  };
  dbWriteAttempted: boolean;
  dbWriteSuccess: boolean;
}
