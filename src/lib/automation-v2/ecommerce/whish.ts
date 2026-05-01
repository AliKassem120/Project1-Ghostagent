import { v2log } from '../logger';

export interface WhishPaymentResponse {
    collectUrl?: string;
    error?: string;
}

export async function generateWhishPaymentLink(args: {
    amount: number;
    currency: string;
    invoice: string;
    externalId: number;
}): Promise<string | null> {
    const isProd = process.env.NODE_ENV === 'production';
    // Use sandbox for testing
    const baseUrl = isProd 
        ? 'https://api.whish.money/itel-service/api'
        : 'https://api.sandbox.whish.money/itel-service/api';

    try {
        const response = await fetch(`${baseUrl}/payment/whish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'channel': '10199608',
                'secret': '66023dabdc584a00b26d8dd4916633f5',
                'websiteUrl': 'ghostagent.qzz.io',
                'User-Agent': 'Whish/1.0 (https://whish.money; support@whish.money)'
            },
            body: JSON.stringify({
                amount: args.amount.toString(),
                currency: args.currency,
                invoice: args.invoice,
                externalId: args.externalId,
                // Using generic webhooks for ecommerce for now
                successCallbackUrl: 'https://ghostagent.qzz.io/api/webhooks/whish-ecommerce',
                failureCallbackUrl: 'https://ghostagent.qzz.io/api/webhooks/whish-ecommerce',
                successRedirectUrl: 'https://ghostagent.qzz.io',
                failureRedirectUrl: 'https://ghostagent.qzz.io'
            })
        });

        const json = await response.json();

        if (json.status === true && json.data && json.data.collectUrl) {
            v2log.info('WHISH_PAYMENT', 'Generated collectUrl successfully', { externalId: args.externalId });
            return json.data.collectUrl;
        } else {
            v2log.error('WHISH_PAYMENT', 'Failed to generate Whish link', { 
                externalId: args.externalId, 
                code: json.code,
                dialog: json.dialog,
                response: json 
            });
            return null;
        }
    } catch (err: any) {
        v2log.error('WHISH_PAYMENT', 'Network exception calling Whish', { 
            externalId: args.externalId,
            error: err.message || String(err)
        });
        return null;
    }
}
