import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Required: nodemailer needs Node.js runtime (not Vercel Edge)
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    // ── 1. Security: verify the shared secret header ──────────────────────
    const secret = request.headers.get('x-webhook-secret');
    if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
        console.warn('[Welcome Webhook] Unauthorized request — bad or missing secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // ── 2. Parse Supabase payload ──────────────────────────────────────
        const body = await request.json();
        const { email } = body.record ?? {};

        if (!email) {
            console.error('[Welcome Webhook] No email found in payload:', body);
            return NextResponse.json({ error: 'No email in payload' }, { status: 400 });
        }

        console.log(`[Welcome Webhook] Sending welcome email to: ${email}`);

        // ── 3. Guard: env vars ─────────────────────────────────────────────
        if (!process.env.ZOHO_TEAM_EMAIL || !process.env.ZOHO_TEAM_PASSWORD) {
            console.error('[Welcome Webhook] Missing ZOHO_TEAM_EMAIL or ZOHO_TEAM_PASSWORD');
            return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
        }

        // ── 4. Zoho SMTP Transporter ───────────────────────────────────────
        const transporter = nodemailer.createTransport({
            host: 'smtp.zoho.com',
            port: 465,
            secure: true,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            auth: {
                user: process.env.ZOHO_TEAM_EMAIL,
                pass: process.env.ZOHO_TEAM_PASSWORD,
            },
        });

        // ── 5. HTML Email Template ─────────────────────────────────────────
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Ghost Agent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d0d14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 580px; margin: 40px auto; background: #13131f; border: 1px solid #1e1e30; border-radius: 16px; overflow: hidden; }
    .hero { background: linear-gradient(135deg, #1a0533 0%, #0d1a40 100%); padding: 48px 40px 40px; text-align: center; position: relative; }
    .ghost-icon { font-size: 52px; display: block; margin-bottom: 16px; }
    .hero h1 { color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px; }
    .hero p { color: rgba(255,255,255,0.55); font-size: 14px; }
    .badge { display: inline-block; background: linear-gradient(90deg, #7c3aed, #4f46e5); color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }
    .body { padding: 36px 40px; }
    .greeting { color: #e2e8f0; font-size: 16px; line-height: 1.7; margin-bottom: 28px; }
    .greeting strong { color: #a78bfa; }
    .steps-title { color: #6b7280; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
    .step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .step-text { color: #cbd5e1; font-size: 14px; line-height: 1.6; }
    .step-text strong { color: #e2e8f0; display: block; margin-bottom: 2px; }
    .cta-wrapper { text-align: center; margin: 32px 0; }
    .cta { display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff !important; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 12px; text-decoration: none; letter-spacing: -0.2px; }
    .divider { border: none; border-top: 1px solid #1e2030; margin: 28px 0; }
    .support { background: #0f1120; border: 1px solid #1e2030; border-radius: 10px; padding: 18px 20px; }
    .support p { color: #6b7280; font-size: 13px; line-height: 1.6; }
    .support a { color: #7c3aed; text-decoration: none; font-weight: 600; }
    .footer { padding: 24px 40px; text-align: center; border-top: 1px solid #1a1a2e; }
    .footer p { color: #374151; font-size: 12px; line-height: 1.6; }
    .footer a { color: #4b5563; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Hero -->
    <div class="hero">
      <span class="ghost-icon">👻</span>
      <span class="badge">You're In</span>
      <h1>Welcome to Ghost Agent</h1>
      <p>Your AI-powered Instagram assistant is ready to deploy.</p>
    </div>

    <!-- Body -->
    <div class="body">
      <p class="greeting">
        Hey there 👋<br /><br />
        You've just unlocked <strong>Ghost Agent</strong> — the AI that reads, replies to, and manages your Instagram DMs and comments automatically, 24/7, so you never miss a customer again.
      </p>

      <p class="steps-title">Get started in 3 steps</p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">
          <strong>Connect your Instagram account</strong>
          Head to your dashboard and click "Connect Instagram" to link your business account. This takes about 60 seconds.
        </div>
      </div>

      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">
          <strong>Configure your AI agent</strong>
          Go to Agent Settings and tell Ghost Agent about your business — your products, tone, shipping rules, and anything else it needs to know.
        </div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">
          <strong>Go live</strong>
          That's it. Ghost Agent will start replying to your customers automatically. You can monitor all conversations from your dashboard.
        </div>
      </div>

      <div class="cta-wrapper">
        <a href="https://getghostagent.com/dashboard" class="cta">Open My Dashboard →</a>
      </div>

      <hr class="divider" />

      <div class="support">
        <p>
          💬 <strong style="color:#e2e8f0;">Need help?</strong> Just reply to this email — we respond personally within 24 hours. You can also reach us anytime at <a href="mailto:team@getghostagent.com">team@getghostagent.com</a>.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        You received this email because you signed up at <a href="https://getghostagent.com">getghostagent.com</a>.<br />
        © ${new Date().getFullYear()} Ghost Agent. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>`;

        // ── 6. Send the email ──────────────────────────────────────────────
        await transporter.sendMail({
            from: `"Ghost Agent" <${process.env.ZOHO_TEAM_EMAIL}>`,
            to: email,
            replyTo: process.env.ZOHO_TEAM_EMAIL,
            subject: 'Welcome to Ghost Agent 👻 - Next Steps',
            html,
        });

        console.log(`[Welcome Webhook] ✅ Welcome email sent to ${email}`);
        return NextResponse.json({ success: true, message: `Welcome email sent to ${email}` });

    } catch (error: any) {
        console.error('[Welcome Webhook] ❌ Failed to send welcome email:', error?.message || error);
        return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
    }
}
