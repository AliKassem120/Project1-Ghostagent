import { SupabaseClient } from '@supabase/supabase-js';
import type { SessionContext, FsmResult } from '../types';
import type { WorkspaceConfig, InventoryRecord } from '@/lib/ai/types';
import { detectLanguageScript, detectYesNo, extractNameAndPhone, extractAddress, detectReuseSignals } from '@/lib/ai/language';
import { searchProducts, findBestProductMatch } from '@/lib/ai/ecommerce/products';
import { lookupLatestOrder, updateOrderVariant, updateOrderAddress, updateOrderQuantity } from '@/lib/ai/ecommerce/lookup';
import { createEcommerceTools } from '@/lib/ai/tools';
import { classifyConfirmationIntent } from '@/lib/ai/guardrails/confirmation-classifier';

export async function runEcommerceFSM(
  message: string,
  session: SessionContext,
  config: WorkspaceConfig,
  supabase: SupabaseClient
): Promise<FsmResult> {
  const actions: string[] = [];
  let dbWriteAttempted = false;
  let dbWriteSuccess = false;
  
  // Initialize session data if null
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

  // Helper to load known customer details (cached within this FSM call)
  let _cachedCustomer: any = undefined;
  const getKnownDetails = async () => {
    if (_cachedCustomer !== undefined) return _cachedCustomer;
    const known = await tools.lookup_customer.execute();
    _cachedCustomer = known.found ? known : null;
    return _cachedCustomer;
  };

  // Helper to extract or reuse name/phone/address
  const resolveDetails = async (msg: string) => {
    const reuse = detectReuseSignals(msg);
    const known = await getKnownDetails();
    const extractedDetails = extractNameAndPhone(msg);
    const extractedAddr = extractAddress(msg);

    // Enhanced: Check if address is meaningful (not just "N/A" or single char)
    const isValidAddress = (addr: string | null): boolean => {
        if (!addr) return false;
        const trimmed = addr.trim();
        return trimmed.length > 3 && trimmed.toLowerCase() !== 'n/a' && trimmed.toLowerCase() !== 'na';
    };

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

    return { name, phone, address: isValidAddress(address) ? address : null };
  };

  // Helper to check if name, phone, and address are all filled
  const hasAllDetails = (d: Record<string, any>) => {
    const name = (d.name || '').toString().trim();
    const phone = (d.phone || '').toString().trim();
    const address = (d.address || '').toString().trim();
    // Phone must have at least 7 digits, address at least 4 meaningful chars
    const phoneDigits = phone.replace(/\D/g, '');
    return !!(name && name.length > 0 && 
              phone && phoneDigits.length >= 7 && 
              address && address.length > 3 && 
              address.toLowerCase() !== 'n/a');
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
  const extractExplicitQty = (msg: string): number | null => {
    const match = msg.match(/\b([1-9][0-9]?)\s*(pcs|pieces|quantity|qty)?\b/);
    return match ? parseInt(match[1], 10) : null;
  };

  const extractQty = (msg: string): number => {
    return extractExplicitQty(msg) ?? 1;
  };

  // Handle flow states
  if (currentState === 'post_order_modify') {
    const lowerMsg = message.toLowerCase();

    // Cancellation signals
    if (lowerMsg.includes('cancel') || lowerMsg.includes('el8e') || lowerMsg.includes('la8e') || lowerMsg.includes('mesh badda')) {
      dbWriteAttempted = true;
      actions.push('tool_cancel_order');
      const cancelRes = await tools.cancel_order.execute();
      if (cancelRes.success) {
        dbWriteSuccess = true;
        actions.push('cancel_order_success');
        nextState = 'idle';
        return {
          nextState,
          actions,
          context: {
            actionType: 'order_cancelled',
            payload: { success: true }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        actions.push('cancel_order_failed');
        return {
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          context: {
            actionType: 'order_cancelled',
            payload: { success: false, error: 'cancellation_failed' }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    }

    // Modification signals (address, variant/size, quantity)
    const latestOrder = await lookupLatestOrder(supabase, session.workspaceId, session.chatId);
    if (latestOrder && latestOrder.isEditable) {
      const isAddressChange = /\b(address|location|deliver|ship|عنوان)\b/i.test(message);
      const isVariantChange = /\b(size|color|colour|variant|لون|قياس)\b/i.test(message);
      const isQtyChange = /\b(quantity|qty|pieces|pcs|كمية)\b/i.test(message);

      if (isAddressChange) {
        const newAddress = extractAddress(message);
        if (newAddress) {
          dbWriteAttempted = true;
          actions.push('tool_update_order_address');
          const ok = await updateOrderAddress(supabase, latestOrder.id, newAddress);
          dbWriteSuccess = ok;
          actions.push(ok ? 'update_order_address_success' : 'update_order_address_failed');
          nextState = 'idle';
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: { modified: true, field: 'address', success: ok, newAddress }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        }
        // Address mentioned but couldn't extract — ask for it
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: { modified: false, field: 'address', needsAddress: true }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }

      if (isVariantChange) {
        const newVariant = extractVariant(message);
        if (newVariant) {
          dbWriteAttempted = true;
          actions.push('tool_update_order_variant');
          const ok = await updateOrderVariant(supabase, latestOrder.id, newVariant);
          dbWriteSuccess = ok;
          actions.push(ok ? 'update_order_variant_success' : 'update_order_variant_failed');
          nextState = 'idle';
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: { modified: true, field: 'variant', success: ok, newVariant }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        }
        // Variant mentioned but couldn't extract — ask
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: { modified: false, field: 'variant', needsVariant: true }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }

      if (isQtyChange) {
        const newQty = extractExplicitQty(message);
        if (newQty !== null && newQty > 0) {
          dbWriteAttempted = true;
          actions.push('tool_update_order_quantity');
          const ok = await updateOrderQuantity(supabase, latestOrder.id, newQty);
          dbWriteSuccess = ok;
          actions.push(ok ? 'update_order_quantity_success' : 'update_order_quantity_failed');
          nextState = 'idle';
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: { modified: true, field: 'quantity', success: ok, newQty }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        }
        // Guard: quantity keyword matched but no valid number extracted — re-ask
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: { modified: false, field: 'quantity', needsValidQuantity: true }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else if (latestOrder && !latestOrder.isEditable) {
      // Order exists but is no longer editable
      return {
        nextState: 'idle',
        actions: [...actions, 'order_not_editable'],
        context: {
          actionType: 'info_gathered',
          payload: { modified: false, reason: 'order_not_editable', status: latestOrder.status }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      // Guard: in post_order_modify state but no active order found — prevent silent fall-through to product search
      return {
        nextState: 'idle',
        actions: [...actions, 'no_active_order'],
        context: {
          actionType: 'info_gathered',
          payload: { modified: false, reason: 'no_active_order' }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }
  }

  if (currentState === 'awaiting_checkout_confirmation') {
    // Use LLM-based classifier for robust intent detection in high-stakes confirmation state
    const yesNo = await classifyConfirmationIntent(message, {
      businessType: 'ecommerce',
      pendingItem: session.data.productName
        ? `${session.data.productName}${session.data.variant ? ` (${session.data.variant})` : ''} x${session.data.quantity || 1} — $${session.data.price} delivered to ${session.data.address || 'address to be confirmed'}`
        : undefined,
    });
    if (yesNo === 'yes') {
      const productName = session.data.productName;
      const variant = session.data.variant || '';
      const qty = session.data.quantity || 1;
      let { name, phone, address } = session.data;

      // FIX: If details missing, try to recover from customer profile BEFORE asking again
      if (!name || !phone || !address) {
          const known = await getKnownDetails();
          if (!name && known?.name) { session.data.name = known.name; name = known.name; }
          if (!phone && known?.phone) { session.data.phone = known.phone; phone = known.phone; }
          if (!address && known?.address) { session.data.address = known.address; address = known.address; }
          
          // Also check customer profile
          if (!name && session.customerProfile?.name) { session.data.name = session.customerProfile.name; name = session.customerProfile.name; }
          if (!phone && session.customerProfile?.phone) { session.data.phone = session.customerProfile.phone; phone = session.customerProfile.phone; }
      }

      if (!productName || !name || !phone || !address) {
          // Still missing after recovery — ask customer with context
          const missing = ['name', 'phone', 'address'].filter(k => !session.data![k]);
          nextState = 'awaiting_order_details';
          return {
              nextState,
              actions,
              context: {
                  actionType: 'info_gathered',
                  payload: {
                      productName: session.data.productName,
                      price: session.data.price,
                      name: session.data.name,
                      phone: session.data.phone,
                      address: session.data.address,
                      missingDetails: missing,
                      recoveryAttempted: true  // Tell response gen we tried
                  }
              },
              dbWriteAttempted,
              dbWriteSuccess
          };
      }

      // Re-check stock before placing order to prevent overselling
      actions.push('tool_check_stock');
      const freshProducts = await searchProducts({ supabase, workspaceId: session.workspaceId, query: productName });
      const freshMatch = findBestProductMatch(freshProducts, productName);
      if (!freshMatch || freshMatch.stockLevel < qty) {
        nextState = 'idle';
        // FIX: Preserve customer details even when product is out of stock
        const preservedCustomer = {
            name: session.data?.name,
            phone: session.data?.phone,
            address: session.data?.address,
        };
        session.data = { ...preservedCustomer };  // Keep customer context for next product
        return {
          nextState,
          actions: [...actions, 'out_of_stock_at_checkout'],
          context: {
            actionType: 'info_gathered',
            payload: {
              outOfStock: true,
              productName,
              requestedQty: qty,
              availableStock: freshMatch?.stockLevel ?? 0,
              customerStillKnown: !!preservedCustomer.name  // Flag for response gen
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
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
        return {
          nextState,
          actions,
          context: {
            actionType: 'checkout_success',
            payload: {
              success: true,
              productName,
              variant,
              quantity: qty,
              name,
              phone,
              address
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        actions.push('place_order_failed');
        return {
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          context: {
            actionType: 'checkout_success',
            payload: {
              success: false,
              error: 'order_creation_failed'
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else if (yesNo === 'no') {
      nextState = 'idle';
      session.data = {};
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            checkoutConfirmed: false
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      // Repeat prompt for confirmation
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            isReadyToConfirm: true,
            productName: session.data.productName,
            price: session.data.price
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }
  }

  if (currentState === 'awaiting_order_details') {
    const details = await resolveDetails(message);
    session.data = { ...session.data, ...details };

    if (hasAllDetails(session.data)) {
      nextState = 'awaiting_checkout_confirmation';
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            productName: session.data.productName,
            price: session.data.price,
            name: session.data.name,
            phone: session.data.phone,
            address: session.data.address,
            isReadyToConfirm: true
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            productName: session.data.productName,
            price: session.data.price,
            name: session.data.name,
            phone: session.data.phone,
            address: session.data.address,
            missingDetails: ['name', 'phone', 'address'].filter(k => !session.data![k])
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
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
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              productName: session.data.productName,
              price: session.data.price,
              name: session.data.name,
              phone: session.data.phone,
              address: session.data.address,
              variant: session.data.variant,
              isReadyToConfirm: true
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        nextState = 'awaiting_order_details';
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              productName: session.data.productName,
              price: session.data.price,
              variant: session.data.variant,
              missingDetails: ['name', 'phone', 'address'].filter(k => !session.data![k])
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else {
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            isAwaitingVariant: true,
            productName: session.data.productName,
            price: session.data.price
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }
  }

  // Fallback (e.g. starting flow or idle)
  // Look for product mention in the message
  actions.push('tool_search_products');
  const products = await searchProducts({ supabase, workspaceId: session.workspaceId, query: message });
  if (!session.data) session.data = {};
  let match = findBestProductMatch(products, message);

  // Fallback: If no product is matched in the message, but we already have one stored in session, reuse it!
  if (!match && session.data?.productName) {
    const existing: InventoryRecord = products.find(p => p.itemName === session.data?.productName) || {
      id: session.data?.productId || '',
      itemName: session.data?.productName || '',
      price: session.data?.price || 0,
      stockLevel: session.data?.stock ?? 999,
      description: null,
      variants: [],
    };
    match = existing;
  }

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
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            productName: match.itemName,
            price: match.price,
            isAwaitingVariant: true
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      const details = await resolveDetails(message);
      session.data = { ...session.data, ...details };

      if (hasAllDetails(session.data)) {
        nextState = 'awaiting_checkout_confirmation';
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              productName: session.data.productName,
              price: session.data.price,
              name: session.data.name,
              phone: session.data.phone,
              address: session.data.address,
              isReadyToConfirm: true
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        nextState = 'awaiting_order_details';
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              productName: session.data.productName,
              price: session.data.price,
              missingDetails: ['name', 'phone', 'address'].filter(k => !session.data![k])
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    }
  } else {
    // No product matched — but check if this is a mid-order question
    // (e.g. "How much is the delivery?", "Do you ship to Beirut?")
    // If the customer already has order context (product selected, details given),
    // don't loop awaiting_product — break out to idle so the LLM fallback pipeline
    // can answer contextually using conversation history.
    const isFollowUpQuestion = /\b(deliver|delivery|ship|shipping|cost|how much|price|pay|payment|pick\s*up|pickup|cod|cash|free|charge|fee|refund|return|exchange|warranty|track|where|when|long|fast|how|what|which|can you|do you|is there|are there|عنوان|توصيل|شحن|كم|سعر|دفع)\b/i.test(message);
    const hasExistingContext = !!(session.data?.productName || session.data?.name || session.data?.address);

    if (isFollowUpQuestion && hasExistingContext && currentState === 'awaiting_product') {
      // Break out of FSM loop — let LLM answer the question with full context
      return {
        nextState: 'idle',
        actions: [...actions, 'mid_order_question_detected'],
        context: {
          actionType: 'defer_to_llm',
          payload: {
            productNotFound: true,
            query: message,
            existingProduct: session.data.productName,
            existingPrice: session.data.price,
            reason: 'Customer asked a follow-up question during order flow'
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }

    const targetState = (currentState === 'idle' || currentState === 'awaiting_product')
      ? 'awaiting_product'
      : 'idle';
    return {
      nextState: targetState,
      actions,
      context: {
        actionType: 'info_gathered',
        payload: {
          productNotFound: true,
          query: message
        }
      },
      dbWriteAttempted,
      dbWriteSuccess
    };
  }
}
