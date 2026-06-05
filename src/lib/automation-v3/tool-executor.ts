import { buildTimeContext, formatTime12, resolveDateFromMessage, resolveTimeFromMessage } from '@/lib/ai/time';

export async function executeTool(
  toolName: string,
  message: string,
  entities: Record<string, any>,
  toolCtx: any
): Promise<any> {
  const timeCtx = buildTimeContext(toolCtx.config.timezone);

  if (toolName === 'search_products' || toolName === 'check_stock') {
    const { searchProducts } = await import('@/lib/ai/ecommerce/products');
    const query = entities.productName || toolCtx.session?.data?.productName || message;
    const products = await searchProducts({ supabase: toolCtx.supabase, workspaceId: toolCtx.workspaceId, query });
    return {
      products: products.map(p => ({
        name: p.itemName,
        price: p.price,
        inStock: p.stockLevel > 0,
        stock: p.stockLevel,
        colors: (p as any).colors || undefined,
        sizes: (p as any).sizes || undefined,
        variants: p.variants || []
      })),
      count: products.length
    };
  }

  if (toolName === 'get_business_hours') {
    const { loadBusinessHours } = await import('@/lib/ai/appointments/hours');
    const hours = await loadBusinessHours(toolCtx.supabase, toolCtx.workspaceId);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return { hours: hours.map(h => ({ day: dayNames[h.dayOfWeek], isOpen: h.isOpen, open: h.isOpen ? formatTime12(h.openTime) : null, close: h.isOpen ? formatTime12(h.closeTime) : null })) };
  }

  if (toolName === 'check_slot') {
    const { loadActiveServices, findBestServiceMatch } = await import('@/lib/ai/appointments/services');
    const { checkAvailability } = await import('@/lib/ai/appointments/availability');
    const { loadBusinessHours } = await import('@/lib/ai/appointments/hours');
    const services = await loadActiveServices(toolCtx.supabase, toolCtx.workspaceId);
    const serviceName = entities.serviceName || toolCtx.session?.data?.serviceName || '';
    const match = findBestServiceMatch(services, serviceName);
    if (!match) return { available: false, reason: 'service_not_found', services_available: services.map(s => s.name) };

    const date = resolveDateFromMessage(message, timeCtx);
    const time = resolveTimeFromMessage(message);
    if (!date || !time) {
      return { available: false, reason: 'missing_date_time', message: 'Preferred date and time are missing from message.' };
    }

    const hours = await loadBusinessHours(toolCtx.supabase, toolCtx.workspaceId);
    const r = await checkAvailability({ supabase: toolCtx.supabase, workspaceId: toolCtx.workspaceId, date, startTime: time, durationMinutes: match.durationMinutes, businessHours: hours });
    if (r.available) return { available: true, service: match.name, price: match.price, duration: match.durationMinutes, date, time: formatTime12(time) };
    return { available: false, reason: r.reason || 'overlap', message: 'Slot taken' };
  }

  if (toolName === 'get_services') {
    const { loadActiveServices } = await import('@/lib/ai/appointments/services');
    const services = await loadActiveServices(toolCtx.supabase, toolCtx.workspaceId);
    return {
      services: services.map(s => ({
        name: s.name,
        price: s.price,
        duration: s.durationMinutes,
        description: s.description || null
      })),
      count: services.length
    };
  }

  if (toolName === 'lookup_customer') {
    const { getKnownCustomerDetails } = await import('@/lib/ai/customer-history');
    const known = await getKnownCustomerDetails(toolCtx.supabase, toolCtx.workspaceId, toolCtx.chatId);
    if (!known) return { found: false };
    return { found: true, name: known.name, phone: known.phone, address: known.address };
  }

  /*
  if (toolName === 'send_booking_flow') {
    const { loadActiveServices, findBestServiceMatch } = await import('@/lib/ai/appointments/services');
    const services = await loadActiveServices(toolCtx.supabase, toolCtx.workspaceId);
    const match = findBestServiceMatch(services, entities.serviceName || '');
    if (!match) return { success: false, error: 'Service not found' };

    const isSimulator = toolCtx.chatId.startsWith('sim_') || toolCtx.chatId.includes('simulator');
    if (isSimulator) {
      return { success: true, message: `Sent booking flow for ${match.name} (Simulated)` };
    }

    const { data: ws } = await toolCtx.supabase.from('ai_settings').select('whatsapp_booking_flow_id, whatsapp_phone_number_id, whatsapp_access_token').eq('id', toolCtx.workspaceId).maybeSingle();
    if (!ws?.whatsapp_phone_number_id || !ws?.whatsapp_access_token) return { success: false, error: 'WhatsApp credentials missing' };

    const creds = { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token };
    if (ws.whatsapp_booking_flow_id) {
      const { sendFlow } = await import('@/lib/whatsapp/send');
      await sendFlow(
        creds,
        toolCtx.chatId,
        ws.whatsapp_booking_flow_id,
        `book_${match.id}_${Date.now()}`,
        `📅 Ready to book your *${match.name}*?\n\nTap below to open the booking form and select a time!`,
        'Book Appointment',
        'BOOKING_DETAILS',
        { service_id: match.id, service_name: match.name },
        toolCtx.config.businessName || 'Booking',
        'Powered by GhostAgent'
      );
      return { success: true, message: `Sent native booking flow for ${match.name}` };
    }
    return { success: false, error: 'Flow ID missing' };
  }
  */

  if (toolName === 'send_product_card') {
    if (toolCtx.platform !== 'whatsapp') return { success: false, error: 'Only available on WhatsApp' };

    const { searchProducts, findBestProductMatch } = await import('@/lib/ai/ecommerce/products');
    const productQuery = entities.productName || toolCtx.session?.data?.productName || '';
    const products = await searchProducts({ supabase: toolCtx.supabase, workspaceId: toolCtx.workspaceId, query: productQuery });
    const match = findBestProductMatch(products, productQuery);
    if (!match) return { success: false, error: 'Product not found' };

    const isSimulator = toolCtx.chatId.startsWith('sim_') || toolCtx.chatId.includes('simulator');
    if (isSimulator) {
      return { success: true, message: `Sent product card for ${match.itemName} (Simulated)` };
    }

    const { data: ws } = await toolCtx.supabase.from('ai_settings').select('whatsapp_catalog_id, whatsapp_phone_number_id, whatsapp_access_token').eq('id', toolCtx.workspaceId).maybeSingle();
    if (!ws?.whatsapp_phone_number_id || !ws?.whatsapp_access_token) return { success: false, error: 'WhatsApp credentials missing' };

    if (!ws.whatsapp_catalog_id) {
      const { sendButtons } = await import('@/lib/whatsapp/send');
      await sendButtons(
        { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token },
        toolCtx.chatId,
        `🛍️ *${match.itemName}*\n\nPrice: *$${match.price}*\nStock: ${match.stockLevel > 0 ? '✅ In Stock' : '❌ Out of Stock'}\n\nTap below if you'd like to order!`,
        [{ id: `buy_now_${match.id}`, title: '🛍️ Order Now' }],
        match.itemName,
        'Powered by GhostAgent'
      );
      return { success: true, message: `Sent product details button (Catalog fallback) for ${match.itemName}` };
    }

    const { sendSingleProductCard } = await import('@/lib/whatsapp/catalog');
    await sendSingleProductCard(
      { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token },
      toolCtx.chatId,
      ws.whatsapp_catalog_id,
      match.id
    );
    return { success: true, message: `Sent product card for ${match.itemName}` };
  }

  return null;
}
