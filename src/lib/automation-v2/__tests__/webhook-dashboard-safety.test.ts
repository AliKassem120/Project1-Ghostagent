import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = process.cwd();

describe('webhook and dashboard safety wiring', () => {
    it('Instagram and WhatsApp webhooks run last-mile final reply guards', () => {
        const instagramRoute = readFileSync(path.join(root, 'src/app/api/webhook/instagram/route.ts'), 'utf8');
        const whatsappRoute = readFileSync(path.join(root, 'src/app/api/webhook/whatsapp/route.ts'), 'utf8');

        expect(instagramRoute).toContain('guardFinalReply');
        expect(instagramRoute).toContain('guardOutboundText');
        expect(whatsappRoute).toContain('guardFinalReply');
        expect(whatsappRoute).toContain('guardWhatsAppOutbound');
    });

    it('Orders dashboard supports Cancelled safely', () => {
        const ordersPage = readFileSync(path.join(root, 'src/app/[locale]/dashboard/orders/page.tsx'), 'utf8');

        expect(ordersPage).toContain("'Cancelled'");
        expect(ordersPage).toContain('normalizeOrderStatus');
        expect(ordersPage).toContain('platform');
    });
});
