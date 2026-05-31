import { SupabaseClient } from '@supabase/supabase-js';
import type { SessionContext } from '../session-manager';
import type { WorkspaceConfig } from '@/lib/ai/types';
import { getTemplate } from '../templates';
import { detectLanguageScript, detectYesNo, extractPhone, extractNameAndPhone, extractAddress, detectReuseSignals } from '@/lib/ai/language';
import { searchProducts, findBestProductMatch } from '@/lib/ai/ecommerce/products';
import { createEcommerceTools } from '@/lib/ai/tools';
import { checkVoiceConsistency } from '../voice-consistency-guard';

export interface FSMResult {
  replyText: string;
  nextState: string;
  actions: string[];
  dbWriteAttempted: boolean;
  dbWriteSuccess: boolean;
}

export async function runEcommerceFSM(
  message: string,
  session: SessionContext,
  config: WorkspaceConfig,
  supabase: SupabaseClient
): Promise<FSMResult> {
  const actions: string[] = [];
  let dbWriteAttempted = false;
  let dbWriteSuccess = false;
  
  const langScript = detectLanguageScript(message);
  
  // 1. Initialize session data if null
  if (!session.data) {
    session.data = {};
  }

  const currentState = session.state;
  let nextState = currentState;

  // Resolve tools context
  const toolCtx = {
    supabase,
    userId: session.userId,
    workspaceId: session.workspaceId,
    chatId: session.chatId,
    config,
    platform: session.platform,
  };
  const tools = createEcommerceTools(toolCtx);

  // Helper to load known customer details
  const getKnownDetails = async () => {
    const known = await tools.lookup_customer.execute();
    return known.found ? known : null;
  };

  // Helper to extract or reuse name/phone/address
  const resolveDetails = async (msg: string) => {
    const reuse = detectReuseSignals(msg);
    const known = await getKnownDetails();
    
    const extractedDetails = extractNameAndPhone(msg);
    const extractedAddr = extractAddress(msg);

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

    const address = extractedAddr || 
                    (reuse.reuseAddress && known?.address ? known.address : null) || 
                    session.data?.address || 
                    session.customerProfile?.metadata?.address || 
                    null;

    return { name, phone, address };
  };

  // Helper to check if name, phone, and address are all filled
  const hasAllDetails = (d: Record<string, any>) => {
    return !!(d.name && d.phone && d.address);
  };

  // Helper to extract variant from message or products catalog
  const extractVariant = (msg: string) => {
    const lower = msg.toLowerCase();
    
    // Sizes
    const sizes = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxs', 'small', 'medium', 'large'];
    for (const size of sizes) {
      const regex = new RegExp(`\\b${size}\\b`, 'i');
      if (regex.test(lower)) {
        return size.toUpperCase();
      }
    }
    
    // Colors
    const colors = ['black', 'white', 'red', 'blue', 'green', 'grey', 'gray', 'yellow', 'pink', 'navy'];
    for (const color of colors) {
      if (lower.includes(color)) {
        return color.charAt(0).toUpperCase() + color.slice(1);
      }
    }
    
    return null;
  };

  // Extract quantity if mentioned
  const extractQty = (msg: string): number => {
    const match = msg.match(/\b([1-9]|10)\s*(pcs|pieces|quantity|qty)?\b/);
    return match ? parseInt(match[1], 10) : 1;
  };

  // Handle flow states
  if (currentState === 'post_order_modify') {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('cancel') || lowerMsg.includes('el8e') || lowerMsg.includes('la8e') || lowerMsg.includes('mesh badda')) {
      dbWriteAttempted = true;
      actions.push('tool_cancel_order');
      const cancelRes = await tools.cancel_order.execute();
      if (cancelRes.success) {
        dbWriteSuccess = true;
        actions.push('cancel_order_success');
        nextState = 'idle';
        return {
          replyText: langScript === 'franco' || langScript === 'mixed'
            ? 'Tmm, l order tghalgha. ✅'
            : 'Your order has been successfully cancelled. ✅',
          nextState,
          actions,
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        actions.push('cancel_order_failed');
        return {
          replyText: langScript === 'franco' || langScript === 'mixed'
            ? 'Ma 2darna nelghe l order. L team ra7 ykellmak halla2.'
            : 'We could not cancel your order automatically. A team member will assist you shortly.',
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    }
  }

  if (currentState === 'awaiting_checkout_confirmation') {
    const yesNo = detectYesNo(message);
    if (yesNo === 'yes') {
      const productName = session.data.productName;
      const variant = session.data.variant || '';
      const qty = session.data.quantity || 1;
      const { name, phone, address } = session.data;

      if (!productName || !name || !phone || !address) {
        // Missing state details, fall back to details collection
        const details = await resolveDetails(message);
        session.data = { ...session.data, ...details };
        if (hasAllDetails(session.data)) {
          nextState = 'awaiting_checkout_confirmation';
          const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
          const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                        `Ready to place order for ${session.data.productName}?`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        } else {
          nextState = 'awaiting_order_details';
          const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
          const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                        `Please send your name, phone number, and address to place the order.`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        }
      }

      dbWriteAttempted = true;
      actions.push('tool_place_order');
      
      const orderRes = await tools.place_order.execute({
        name,
        phone,
        address,
        product: productName,
        variant,
        quantity: qty
      });

      if (orderRes.success) {
        dbWriteSuccess = true;
        actions.push('place_order_success');
        nextState = 'idle';
        // Clear session order fields after placement
        session.data = {};
        const reply = getTemplate('order_confirmed', langScript) || 'Order placed successfully! ✅';
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      } else {
        actions.push('place_order_failed');
        return {
          replyText: langScript === 'franco' || langScript === 'mixed'
            ? 'Moshkle bl order. L team ra7 ykellmak halla2.'
            : 'There was an issue completing your order. A team member will assist you shortly.',
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else if (yesNo === 'no') {
      nextState = 'idle';
      session.data = {};
      return {
        replyText: langScript === 'franco' || langScript === 'mixed'
          ? 'Tmm, lghayna l order. Nshalla marra tanye! 👍'
          : 'Understood, the order has been cancelled. Let us know if you need anything else! 👍',
        nextState,
        actions,
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      // Repeat prompt for confirmation
      const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
      const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                    `Would you like to confirm the order? Yes or No?`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    }
  }

  if (currentState === 'awaiting_order_details') {
    const details = await resolveDetails(message);
    session.data = { ...session.data, ...details };

    if (hasAllDetails(session.data)) {
      nextState = 'awaiting_checkout_confirmation';
      const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
      const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                    `Ready to confirm order for ${session.data.productName}? Say Yes or No.`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    } else {
      // Prompt for missing details
      const missing: string[] = [];
      if (!session.data.name) missing.push(langScript === 'franco' || langScript === 'mixed' ? 'ismak (name)' : 'name');
      if (!session.data.phone) missing.push(langScript === 'franco' || langScript === 'mixed' ? 'ra2mak (phone)' : 'phone');
      if (!session.data.address) missing.push(langScript === 'franco' || langScript === 'mixed' ? '3nwenak (address)' : 'address');
      
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? `B3atle kman: ${missing.join(', ')}.`
        : `Please provide your missing details: ${missing.join(', ')}.`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    }
  }

  if (currentState === 'awaiting_variant') {
    const variant = extractVariant(message);
    if (variant) {
      session.data.variant = variant;
      const details = await resolveDetails(message);
      session.data = { ...session.data, ...details };

      if (hasAllDetails(session.data)) {
        nextState = 'awaiting_checkout_confirmation';
        const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
        const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                      `Ready to confirm order for ${session.data.productName}?`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      } else {
        nextState = 'awaiting_order_details';
        const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
        const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                      `Please provide your name, phone number, and address.`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      }
    } else {
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? 'Ayya size aw lon baddak?'
        : 'Which size or color would you like?';
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    }
  }

  // Fallback (e.g. starting flow or idle)
  // Look for product mention in the message
  actions.push('tool_search_products');
  const products = await searchProducts({ supabase, workspaceId: session.workspaceId, query: message });
  const match = findBestProductMatch(products, message);

  if (match) {
    session.data.productId = match.id;
    session.data.productName = match.itemName;
    session.data.price = match.price;
    session.data.stock = match.stockLevel;
    session.data.quantity = extractQty(message);
    
    const variant = extractVariant(message);
    if (variant) {
      session.data.variant = variant;
    }

    // Determine next state
    // Check if product requires variant selection (e.g. match has variants or sizes/colors string)
    const hasVariants = match.variants && match.variants.length > 0;
    const hasSizesOrColors = (match as any).sizes || (match as any).colors;
    
    if ((hasVariants || hasSizesOrColors) && !session.data.variant) {
      nextState = 'awaiting_variant';
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? `L ${match.itemName} b $${match.price}. Ayya size baddak?`
        : `The ${match.itemName} is $${match.price}. Which size do you need?`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    } else {
      const details = await resolveDetails(message);
      session.data = { ...session.data, ...details };

      if (hasAllDetails(session.data)) {
        nextState = 'awaiting_checkout_confirmation';
        const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
        const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                      `Ready to confirm order for ${session.data.productName}?`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      } else {
        nextState = 'awaiting_order_details';
        const variables = { productName: session.data.productName || '', price: String(session.data.price || '') };
        const reply = getTemplate('awaiting_order_details', langScript, variables) || 
                      `Please provide your name, phone number, and address.`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      }
    }
  } else {
    // No product matched
    const reply = langScript === 'franco' || langScript === 'mixed'
      ? 'Ma l2ina hal product. Shou kman 3ndak?'
      : "We couldn't find that product. What else are you looking for?";
    return { replyText: reply, nextState: 'idle', actions, dbWriteAttempted, dbWriteSuccess };
  }
}
