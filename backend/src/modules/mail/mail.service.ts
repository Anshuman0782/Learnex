import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export type CodePurpose = 'verify' | 'reset' | 'change';

const COPY: Record<CodePurpose, { subject: string; heading: string; line: string }> = {
  verify: {
    subject: 'Verify your LERNEX email',
    heading: 'Confirm your email',
    line: 'Enter this code in the LERNEX app to verify your email address.',
  },
  reset: {
    subject: 'Your LERNEX password reset code',
    heading: 'Reset your password',
    line: 'Enter this code in the LERNEX app to choose a new password.',
  },
  change: {
    subject: 'Confirm your LERNEX account change',
    heading: 'Confirm this change',
    line: 'Someone (hopefully you) asked to change the email or phone number on your LERNEX account. Enter this code in the app to confirm.',
  },
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Transactional email via Brevo's HTTPS API (free plan: 300 emails/day, no
 * card). HTTPS — not SMTP — because free hosts like Render block SMTP ports.
 * Without BREVO_API_KEY in development, emails are printed to the console so
 * flows stay testable; in production a missing key is a clear error.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get isProd() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  get configured(): boolean {
    return !!this.config.get<string>('BREVO_API_KEY') && !!this.config.get<string>('MAIL_FROM_EMAIL');
  }

  /** Sends a branded 6-digit code email. */
  async sendCode(to: { email: string; name?: string }, purpose: CodePurpose, code: string): Promise<void> {
    const c = COPY[purpose];
    const name = escapeHtml(to.name?.split(' ')[0] || 'there');
    const html = `<!doctype html><html><body style="margin:0;background:#F4F3FB;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:linear-gradient(90deg,#F59E0B,#EC4899);background-color:#F2542D;padding:22px 28px;color:#fff;font-size:22px;font-weight:800;letter-spacing:2px">LERNEX</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0F172A">${c.heading}</p>
<p style="margin:0 0 18px;font-size:14px;color:#475569;line-height:20px">Hi ${name}, ${escapeHtml(c.line)}</p>
<div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0F172A;background:#FFF1EC;border-radius:14px;padding:16px 0;text-align:center">${code}</div>
<p style="margin:18px 0 0;font-size:12px;color:#94A3B8;line-height:18px">This code expires in 15 minutes. If you didn't ask for it, you can ignore this email — your account stays safe.</p>
</td></tr></table></td></tr></table></body></html>`;
    const text = `${c.heading}\n\nHi ${to.name ?? 'there'}, ${c.line}\n\nYour code: ${code}\n\nIt expires in 15 minutes. If you didn't ask for it, ignore this email.`;
    await this.send(to, c.subject, html, text, code);
  }

  /** A plain security notice (e.g. "your email was changed"). */
  async sendNotice(to: { email: string; name?: string }, subject: string, message: string): Promise<void> {
    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#F4F3FB;padding:24px">
<div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;padding:24px">
<p style="font-size:18px;font-weight:800;color:#0F172A;margin:0 0 10px">${escapeHtml(subject)}</p>
<p style="font-size:14px;color:#475569;line-height:20px;margin:0">${escapeHtml(message)}</p></div></body></html>`;
    await this.send(to, subject, html, message).catch((e) => this.logger.warn(`Notice email failed: ${String(e)}`));
  }

  private async send(to: { email: string; name?: string }, subject: string, html: string, text: string, devCode?: string) {
    if (!this.configured) {
      if (this.isProd) {
        this.logger.error('Email is not configured (BREVO_API_KEY / MAIL_FROM_EMAIL missing)');
        throw new ServiceUnavailableException('Email is temporarily unavailable. Please try again later.');
      }
      // Development only: show the code in the server console.
      this.logger.warn(`[dev email] to ${to.email} — ${subject}${devCode ? ` — code ${devCode}` : ''}`);
      return;
    }
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': this.config.get<string>('BREVO_API_KEY')!,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.config.get<string>('MAIL_FROM_EMAIL'), name: this.config.get<string>('MAIL_FROM_NAME') || 'LERNEX' },
        to: [{ email: to.email, ...(to.name ? { name: to.name } : {}) }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const detail = res ? await res.text().catch(() => '') : 'network error';
      this.logger.error(`Brevo send failed (${res?.status ?? '-'}): ${detail.slice(0, 200)}`);
      throw new ServiceUnavailableException('Could not send the email. Please try again in a minute.');
    }
  }
}
