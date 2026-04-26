export type WebhookOutcomeEvent = {
  requestId?: string;
  workspaceId?: string;
  workspaceType: 'appointments' | 'ecommerce';
  chatId?: string;
  autopilotEnabled?: boolean;
  language?: string;
  classifierStatus?: 'deterministic' | 'llm' | 'failed';
  classifierError?: string | null;
  intent?: string;
  stateBefore?: string;
  stateAfter?: string;
  actions?: string[];
  appointmentInsertSuccess?: boolean;
  orderInsertSuccess?: boolean;
  sentReply?: string;
  bufferStatus?: string;
};

export function logWebhookOutcome(event: WebhookOutcomeEvent) {
  console.log('[INSTAGRAM_WEBHOOK_OUTCOME]', JSON.stringify(event));
}
