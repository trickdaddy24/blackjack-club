// Outbound email — Resend-first (RESEND_API_KEY + EMAIL_FROM, plain fetch,
// no SDK), Gmail SMTP as fallback (SMTP_USER/SMTP_PASS, Notifier pattern).
// Fully env-gated: with neither configured, sends are inert. Best-effort —
// a bounced email never blocks the action that triggered it (invite still
// works in-app; password reset logs the link server-side in dev).

import nodemailer from "nodemailer";

export function emailEnabled(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY || (process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail(opts: OutboundEmail): Promise<boolean> {
  if (process.env.RESEND_API_KEY) return sendViaResend(opts);
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return sendViaSmtp(opts);
  return false;
}

async function sendViaResend(opts: OutboundEmail): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Blackjack Club <reply@minus-one-labs.com>",
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("email (resend) failed:", res.status, detail.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("email (resend) failed:", (err as Error).message);
    return false;
  }
}

async function sendViaSmtp(opts: OutboundEmail): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Blackjack Club" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("email (smtp) failed:", (err as Error).message);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

interface InviteEmail {
  to: string;
  fromName: string;
  joinUrl: string;
  expiresMinutes: number;
}

export async function sendInviteEmail(opts: InviteEmail): Promise<boolean> {
  return sendEmail({
    to: opts.to,
    subject: `♠️ ${opts.fromName} is holding a seat for you`,
    text: `${opts.fromName} invited you to a shared blackjack table at Blackjack Club.

Take your seat: ${opts.joinUrl}

The seat is held for ${opts.expiresMinutes} minutes. If the link has expired, ask ${opts.fromName} to deal you back in.`,
    html: `<div style="font-family:Georgia,serif;background:#151210;color:#f3e9d2;padding:32px;border-radius:12px;max-width:480px;margin:0 auto">
  <h2 style="color:#d4af37;margin:0 0 12px">♠️ ${escapeHtml(opts.fromName)} is holding a seat for you</h2>
  <p style="line-height:1.5">You've been invited to a shared blackjack table at <strong>Blackjack Club</strong>.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${opts.joinUrl}" style="background:#d4af37;color:#151210;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold">Take a Seat</a>
  </p>
  <p style="font-size:13px;color:#bfae8a">The seat is held for ${opts.expiresMinutes} minutes — after that, ask ${escapeHtml(opts.fromName)} to deal you back in.</p>
</div>`,
  });
}

interface PasswordResetEmail {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
}

export async function sendPasswordResetEmail(opts: PasswordResetEmail): Promise<boolean> {
  return sendEmail({
    to: opts.to,
    subject: "♠️ Reset your Blackjack Club password",
    text: `Someone (hopefully you) asked to reset the password on your Blackjack Club account.

Reset it here: ${opts.resetUrl}

This link expires in ${opts.expiresMinutes} minutes. If you didn't request this, you can safely ignore this email — your password won't change.`,
    html: `<div style="font-family:Georgia,serif;background:#151210;color:#f3e9d2;padding:32px;border-radius:12px;max-width:480px;margin:0 auto">
  <h2 style="color:#d4af37;margin:0 0 12px">♠️ Reset your password</h2>
  <p style="line-height:1.5">Someone (hopefully you) asked to reset the password on your <strong>Blackjack Club</strong> account.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${opts.resetUrl}" style="background:#d4af37;color:#151210;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold">Reset Password</a>
  </p>
  <p style="font-size:13px;color:#bfae8a">This link expires in ${opts.expiresMinutes} minutes. If you didn't request this, you can safely ignore this email — your password won't change.</p>
</div>`,
  });
}
