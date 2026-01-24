/**
 * Smart WhatsApp Link Generator for GhostAgent
 * Generates pre-filled WhatsApp messages to reduce customer friction
 */

export interface WhatsAppLinkParams {
    phoneNumber: string;
    productName: string;
    price: number;
    customerName?: string;
}

/**
 * Generates a smart WhatsApp link with pre-filled message
 * @param params - WhatsApp link parameters
 * @returns Complete wa.me link with encoded message
 */
export function generateSmartLink(params: WhatsAppLinkParams): string {
    const { phoneNumber, productName, price, customerName } = params;

    // Clean phone number (remove spaces, dashes, plus signs)
    const cleanPhone = phoneNumber.replace(/[\s\-+]/g, '');

    // Construct the pre-filled message
    const greeting = customerName ? `Hi! I'm ${customerName}.` : 'Hello!';
    const message = `${greeting} I saw the ${productName} on Instagram for $${price.toFixed(2)} USD and I would like to order it. #GhostAgent`;

    // URL encode the message
    const encodedMessage = encodeURIComponent(message);

    // Return the complete WhatsApp link
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Generates a custom WhatsApp link with a custom message template
 * @param phoneNumber - WhatsApp phone number
 * @param customMessage - Custom message to send
 * @returns Complete wa.me link
 */
export function generateCustomLink(phoneNumber: string, customMessage: string): string {
    const cleanPhone = phoneNumber.replace(/[\s\-+]/g, '');
    const encodedMessage = encodeURIComponent(customMessage);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Preview the message that will be sent via WhatsApp
 * @param params - WhatsApp link parameters
 * @returns The message text that will be pre-filled
 */
export function previewMessage(params: WhatsAppLinkParams): string {
    const { productName, price, customerName } = params;
    const greeting = customerName ? `Hi! I'm ${customerName}.` : 'Hello!';
    return `${greeting} I saw the ${productName} on Instagram for $${price.toFixed(2)} USD and I would like to order it. #GhostAgent`;
}
