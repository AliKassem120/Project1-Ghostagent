import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runEcommerceFSM } from '../automation-v3/fsm/ecommerce-fsm';
import { runAppointmentFSM } from '../automation-v3/fsm/appointment-fsm';
import type { SessionContext } from '../automation-v3/session-manager';
import type { WorkspaceConfig } from '@/lib/ai/types';

describe('V3 FSM Architecture Tests (Zero-LLM Paths)', () => {
  let mockSupabase: any;
  let mockSession: SessionContext;
  let mockConfig: WorkspaceConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
    chain.upsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabase = {
      from: vi.fn().mockReturnValue(chain),
    };

    mockSession = {
      state: 'idle',
      data: {},
      postContext: null,
      loopCount: 0,
      lastBotMessage: null,
      lastInteractionAt: new Date().toISOString(),
      stateEnteredAt: new Date().toISOString(),
      isFreshSession: true,
      customerProfile: {
        id: 'cp_123',
        workspaceId: 'ws_123',
        name: 'Ali Kassem',
        phone: '96171123456',
        instagramChatId: 'chat_123',
        totalOrders: 2,
        totalAppointments: 1,
        tags: [],
        firstInteractionAt: new Date().toISOString(),
        lastInteractionAt: new Date().toISOString(),
        metadata: { address: 'Beirut, Hamra' }
      },
      platform: 'instagram',
      workspaceId: 'ws_123',
      chatId: 'chat_123',
      userId: 'user_123',
    };

    mockConfig = {
      workspaceId: 'ws_123',
      userId: 'user_123',
      businessName: 'Test Business',
      businessType: 'ecommerce',
      tone: 'Casual',
      language: 'English',
      timezone: 'Asia/Beirut',
      useEmojis: true,
      systemInstructions: null,
      storeLocation: 'Beirut, Lebanon',
      contactInfo: '71123456',
      handoffKeywords: [],
      shippingRules: null,
      maxDiscount: null,
      minOrderForDiscount: null,
      slotDurationMinutes: 30,
      automationEngineVersion: 'v3_brain',
    };
  });

  describe('E-Commerce FSM Flow', () => {
    it('Scenario 1: Searches products and prompts for size/variant if unspecified', async () => {
      // Mock searchProducts to return a Hoodie with variants
      vi.mock('../ai/ecommerce/products', async (importOriginal) => {
        const original: any = await importOriginal();
        return {
          ...original,
          searchProducts: vi.fn().mockResolvedValue([
            { id: 'prod_1', itemName: 'Essential Hoodie', price: 60, stockLevel: 10, variants: ['S', 'M', 'L'] }
          ]),
          findBestProductMatch: vi.fn().mockReturnValue({
            id: 'prod_1', itemName: 'Essential Hoodie', price: 60, stockLevel: 10, variants: ['S', 'M', 'L']
          })
        };
      });

      const result = await runEcommerceFSM(
        'I want to buy the hoodie',
        mockSession,
        mockConfig,
        mockSupabase
      );

      expect(result.nextState).toBe('awaiting_variant');
      expect(result.context.actionType).toBe('info_gathered');
      expect(result.context.payload.isAwaitingVariant).toBe(true);
      expect(result.actions).toContain('tool_search_products');
      expect(mockSession.data?.productName).toBe('Essential Hoodie');
    });

    it('Scenario 2: Collects details and transitions to confirmation', async () => {
      mockSession.state = 'awaiting_order_details';
      mockSession.data = {
        productId: 'prod_1',
        productName: 'Essential Hoodie',
        price: 60,
        variant: 'M',
        quantity: 1
      };

      const result = await runEcommerceFSM(
        'Ali Kassem, phone is 71123456, Beirut Hamra',
        mockSession,
        mockConfig,
        mockSupabase
      );

      expect(result.nextState).toBe('awaiting_checkout_confirmation');
      expect(result.context.actionType).toBe('info_gathered');
      expect(result.context.payload.productName).toBe('Essential Hoodie');
      expect(result.context.payload.isReadyToConfirm).toBe(true);
      expect(mockSession.data?.name).toBe('Ali Kassem');
      expect(mockSession.data?.phone).toBe('71123456');
      expect(mockSession.data?.address).toBe('Beirut Hamra');
    });
  });

  describe('Appointments FSM Flow', () => {
    beforeEach(() => {
      mockConfig.businessType = 'appointments';
    });

    it('Scenario 1: Matches service and asks for preferred slot', async () => {
      vi.mock('../ai/appointments/services', async (importOriginal) => {
        const original: any = await importOriginal();
        return {
          ...original,
          loadActiveServices: vi.fn().mockResolvedValue([
            { id: 'serv_1', name: 'Haircut', price: 20, durationMinutes: 30 }
          ]),
          findBestServiceMatch: vi.fn().mockReturnValue({
            id: 'serv_1', name: 'Haircut', price: 20, durationMinutes: 30
          })
        };
      });

      const result = await runAppointmentFSM(
        'I want to book a haircut',
        mockSession,
        mockConfig,
        mockSupabase
      );

      expect(result.nextState).toBe('awaiting_date_time');
      expect(result.context.actionType).toBe('info_gathered');
      expect(result.context.payload.isAwaitingDateTime).toBe(true);
      expect(mockSession.data?.service).toBe('Haircut');
    });
  });
});
