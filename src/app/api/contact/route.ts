import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Required: nodemailer uses Node.js APIs not available on Vercel Edge Runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Basic validation
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    // Guard: fail fast if env vars are missing (e.g. not set on Vercel)
    if (!process.env.ZOHO_CONTACT_EMAIL || !process.env.ZOHO_CONTACT_PASSWORD) {
      console.error('[Contact API] Missing ZOHO_CONTACT_EMAIL or ZOHO_CONTACT_PASSWORD env vars');
      return NextResponse.json(
        { success: false, error: 'Email service is not configured. Please contact us directly.' },
        { status: 500 }
      );
    }

    // Configure Zoho SMTP transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: process.env.ZOHO_CONTACT_EMAIL,
        pass: process.env.ZOHO_CONTACT_PASSWORD,
      },
    });

    // HTML email template
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif; background: #f4f4f7; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6d28d9, #4f46e5); padding: 32px 40px; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 36px 40px; }
    .field { margin-bottom: 24px; }
    .field label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
    .field p { margin: 0; font-size: 15px; color: #111827; line-height: 1.6; }
    .field a { color: #6d28d9; text-decoration: none; }
    .message-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; }
    .message-box p { margin: 0; font-size: 15px; color: #374151; line-height: 1.7; white-space: pre-wrap; }
    .footer { border-top: 1px solid #f3f4f6; padding: 20px 40px; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📬 New Contact Form Submission</h1>
      <p>Received via GhostAgent contact form</p>
    </div>
    <div class="body">
      <div class="field">
        <label>Name</label>
        <p>${escapeHtml(name)}</p>
      </div>
      <div class="field">
        <label>Email</label>
        <p><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      </div>
      <div class="field">
        <label>Message</label>
        <div class="message-box">
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Reply directly to this email to respond to ${escapeHtml(name)}.</p>
    </div>
  </div>
</body>
</html>`;

    // Send the email
    await transporter.sendMail({
      from: `"GhostAgent Contact" <${process.env.ZOHO_CONTACT_EMAIL}>`,
      to: process.env.ZOHO_CONTACT_EMAIL,
      replyTo: email,
      subject: `New Contact Form Submission from ${name}`,
      html: htmlBody,
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully.' });

  } catch (error: any) {
    console.error('[Contact API] Error sending email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}

// Prevent XSS in the email HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
