// Invite email — Gmail SMTP with an app password (Notifier pattern).
// Env-gated: without SMTP_USER/SMTP_PASS the sender is inert and invites
// arrive in-app only. Sends are best-effort; a bounced email never blocks
// the invite itself.

import nodemailer from "nodemailer";

export function emailEnabled(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendInviteEmail(opts: {
  to: string;
  fromName: string;
  joinUrl: string;
  expiresMinutes: number;
}): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Blackjack Club" <${process.env.SMTP_USER}>`,
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
    return true;
  } catch (err) {
    console.error("invite email failed:", (err as Error).message);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
