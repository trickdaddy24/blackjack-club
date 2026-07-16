// Invite email — Resend-first (RESEND_API_KEY + EMAIL_FROM, plain fetch, no
// SDK), Gmail SMTP as fallback (SMTP_USER/SMTP_PASS, Notifier pattern).
// Fully env-gated: with neither configured the sender is inert and invites
// arrive in-app only. Sends are best-effort; a bounced email never blocks
// the invite itself.

import nodemailer from "nodemailer";

export function emailEnabled(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY || (process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

interface InviteEmail {
  to: string;
  fromName: string;
  joinUrl: string;
  expiresMinutes: number;
}

export async function sendInviteEmail(opts: InviteEmail): Promise<boolean> {
  if (process.env.RESEND_API_KEY) return sendViaResend(opts);
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return sendViaSmtp(opts);
  return false;
}

async function sendViaResend(opts: InviteEmail): Promise<boolean> {
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
        subject: subjectFor(opts),
        text: textFor(opts),
        html: htmlFor(opts),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("invite email (resend) failed:", res.status, detail.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("invite email (resend) failed:", (err as Error).message);
    return false;
  }
}

async function sendViaSmtp(opts: InviteEmail): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Blackjack Club" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: subjectFor(opts),
      text: textFor(opts),
      html: htmlFor(opts),
    });
    return true;
  } catch (err) {
    console.error("invite email (smtp) failed:", (err as Error).message);
    return false;
  }
}

const subjectFor = (o: InviteEmail) => `♠️ ${o.fromName} is holding a seat for you`;

const textFor = (o: InviteEmail) => `${o.fromName} invited you to a shared blackjack table at Blackjack Club.

Take your seat: ${o.joinUrl}

The seat is held for ${o.expiresMinutes} minutes. If the link has expired, ask ${o.fromName} to deal you back in.`;

const htmlFor = (o: InviteEmail) => `<div style="font-family:Georgia,serif;background:#151210;color:#f3e9d2;padding:32px;border-radius:12px;max-width:480px;margin:0 auto">
  <h2 style="color:#d4af37;margin:0 0 12px">♠️ ${escapeHtml(o.fromName)} is holding a seat for you</h2>
  <p style="line-height:1.5">You've been invited to a shared blackjack table at <strong>Blackjack Club</strong>.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${o.joinUrl}" style="background:#d4af37;color:#151210;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold">Take a Seat</a>
  </p>
  <p style="font-size:13px;color:#bfae8a">The seat is held for ${o.expiresMinutes} minutes — after that, ask ${escapeHtml(o.fromName)} to deal you back in.</p>
</div>`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
