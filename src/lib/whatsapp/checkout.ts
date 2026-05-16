/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Native Checkout
 * ═══════════════════════════════════════════════════════════════
 * Sends interactive order summary messages with payment buttons
 * (Whish, Cash on Delivery) inside WhatsApp instead of external links.
 */

import { sendButtons, sendCTAButton, type WhatsAppCredentials } from './send';

// ── Order Summary with Payment Options ───────────────────────

export async function sendOrderSummary(
    creds: WhatsAppCredentials,
    to: string,
    order: {
        itemName: string;
        variant?: string;
        quantity: number;
        unitPrice: number;
        customerName: string;
        shippingCost?: number;
    }
) {
    const subtotal = order.unitPrice * order.quantity;
    const shipping = order.shippingCost || 0;
    const total = subtotal + shipping;

    const variantLine = order.variant ? `\n📏 Variant: ${order.variant}` : '';
    const shippingLine = shipping > 0 ? `\n🚚 Shipping: $${shipping}` : '\n🚚 Shipping: Free';

    const body = `🛒 *Order Summary*\n\n` +
        `📦 ${order.itemName}${variantLine}\n` +
        `🔢 Qty: ${order.quantity}\n` +
        `💰 Price: $${order.unitPrice} each${shippingLine}\n\n` +
        `━━━━━━━━━━━━━\n` +
        `*Total: $${total}*\n\n` +
        `How would you like to pay?`;

    return sendButtons(creds, to, body, [
        { id: 'pay_whish', title: '💳 Pay via Whish' },
        { id: 'pay_cod', title: '🚚 Cash on Delivery' },
    ], '🧾 Your Order', `Order for ${order.customerName}`);
}

// ── Whish Payment Link ───────────────────────────────────────

export async function sendWhishPaymentLink(
    creds: WhatsAppCredentials,
    to: string,
    amount: number,
    orderId: string,
    whishLink: string
) {
    return sendCTAButton(
        creds,
        to,
        `💳 Pay $${amount} securely via Whish.\n\nOrder #${orderId.slice(-6)}\n\nTap below to complete your payment:`,
        'Pay Now via Whish',
        whishLink,
        '💳 Secure Payment',
        'Powered by GhostAgent'
    );
}

// ── Cash on Delivery Confirmation ────────────────────────────

export async function sendCODConfirmation(
    creds: WhatsAppCredentials,
    to: string,
    itemName: string,
    total: number,
    orderId: string
) {
    const body = `✅ *Order Confirmed!*\n\n` +
        `📦 ${itemName}\n` +
        `💰 Total: $${total}\n` +
        `📋 Order #${orderId.slice(-6)}\n\n` +
        `Payment: Cash on Delivery 🚚\n\n` +
        `We'll contact you soon to arrange delivery. Thank you! 🙏`;

    return sendButtons(creds, to, body, [
        { id: 'track_order', title: '📦 Track Order' },
        { id: 'cancel_order', title: '❌ Cancel Order' },
    ]);
}
