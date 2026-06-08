/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Shared FSM Helpers
 * ═══════════════════════════════════════════════════════════════
 * Shared utilities used by both ecommerce-fsm and appointment-fsm
 * to reduce code duplication and improve maintainability.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { extractNameAndPhone, extractAddress, detectReuseSignals } from '@/lib/ai/language';
import type { SessionContext } from '../types';

/**
 * Load known customer details (cached within a single FSM call scope).
 * Returns a factory function that creates a cached lookup for each tool context.
 */
export function createCachedCustomerLookup(lookupFn: () => Promise<{ found: boolean; name?: string; phone?: string; address?: string }>) {
  let _cachedCustomer: any = undefined;

  return async () => {
    if (_cachedCustomer !== undefined) return _cachedCustomer;
    const known = await lookupFn();
    _cachedCustomer = known.found ? known : null;
    return _cachedCustomer;
  };
}

/**
 * Resolve customer name/phone/address from a message by checking:
 * 1. Direct extraction from message
 * 2. Reuse signals (e.g. "same as before")
 * 3. Previously stored session data
 * 4. Customer profile
 */
export async function resolveCustomerDetails(
  msg: string,
  session: SessionContext,
  getKnownDetails: () => Promise<any>,
  includeAddress = true
): Promise<{ name: string | null; phone: string | null; address: string | null }> {
  const reuse = detectReuseSignals(msg);
  const known = await getKnownDetails();
  const extractedDetails = extractNameAndPhone(msg);

  const name = extractedDetails.name ||
    (reuse.reuseName && known?.name ? known.name : null) ||
    session.data?.name ||
    session.customerProfile?.name ||
    null;

  const phone = extractedDetails.phone ||
    (reuse.reusePhone && known?.phone ? known.phone : null) ||
    session.data?.phone ||
    session.customerProfile?.phone ||
    null;

  let address: string | null = null;
  if (includeAddress) {
    const extractedAddr = extractAddress(msg);
    address = extractedAddr ||
      (reuse.reuseAddress && known?.address ? known.address : null) ||
      session.data?.address ||
      session.customerProfile?.metadata?.address ||
      null;

    // Validate address is meaningful
    if (address) {
      const trimmed = address.trim();
      if (trimmed.length <= 3 || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'na') {
        address = null;
      }
    }
  }

  return { name, phone, address };
}

/**
 * Check if name and phone (and optionally address) are all filled and valid.
 * Phone must have at least 7 digits, address at least 4 meaningful chars.
 */
export function hasRequiredDetails(
  d: Record<string, any>,
  requireAddress = false
): boolean {
  const name = (d.name || '').toString().trim();
  const phone = (d.phone || '').toString().trim();
  const phoneDigits = phone.replace(/\D/g, '');

  if (!(name && name.length > 0 && phone && phoneDigits.length >= 7)) {
    return false;
  }

  if (requireAddress) {
    const address = (d.address || '').toString().trim();
    if (!(address && address.length > 3 && address.toLowerCase() !== 'n/a' && address.toLowerCase() !== 'na')) {
      return false;
    }
  }

  return true;
}

/**
 * Check if the current message is a follow-up question (like shipping, pricing, etc.)
 * rather than a new order/booking intent. This prevents getting stuck in FSM loops.
 */
export function isFollowUpQuestion(message: string, businessType: 'ecommerce' | 'appointments'): boolean {
  const sharedPattern = /\b(how much|price|cost|long|minute|hour|where|location|address|what|which|can you|do you|is there|are there|open|close|available|عنوان|وين|كم|سعر|وقت|ساعة|دقيقة)\b/i;

  const ecomPattern = /\b(deliver|delivery|ship|shipping|pay|payment|pick\s*up|pickup|cod|cash|free|charge|fee|refund|return|exchange|warranty|track|when|fast|how|what)\b/i;

  if (businessType === 'ecommerce') {
    return sharedPattern.test(message) || ecomPattern.test(message);
  }

  return sharedPattern.test(message) || /\b(cancel|reschedule|change|park)\b/i.test(message);
}

/**
 * Get the missing detail field names from session data.
 */
export function getMissingDetails(
  data: Record<string, any>,
  fields: string[]
): string[] {
  return fields.filter(k => {
    const val = data[k];
    return !val || String(val).trim().length === 0;
  });
}
