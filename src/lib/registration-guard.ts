// Registration defense — the pure pieces (testable without I/O) plus the
// Turnstile verifier. Wired into the register server action.
//
// Layers (all optional-fail-open EXCEPT the honeypot):
//   1. honeypot form field ("website") — bots autofill it, humans never see it
//   2. disposable-email domain blocklist
//   3. sliding-window rate limit per IP (in-memory; single-container deploy)
//   4. Cloudflare Turnstile — active only when the env keys are set, so the
//      code ships before the site key exists

export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "trashmail.com",
  "fakeinbox.com",
  "mintemail.com",
  "mytemp.email",
  "burnermail.io",
  "spamgourmet.com",
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Sliding-window limiter: at most `limit` hits per `windowMs` per key.
 * Pure given `now` — the register action passes Date.now().
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private limit: number,
    private windowMs: number
  ) {}

  /** Record an attempt; returns false when the key is over the limit. */
  allow(key: string, now: number): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Opportunistic cleanup so the map can't grow unbounded
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) {
        if (v.every((t) => t <= cutoff)) this.hits.delete(k);
      }
    }
    return true;
  }
}

// 3 registrations per IP per hour — module singleton survives across
// requests in the standalone server (one container in prod).
export const registerLimiter = new SlidingWindowLimiter(3, 60 * 60 * 1000);

// 5 password-reset requests per IP per hour — generous enough for a
// legitimate user retrying a typo'd email, tight enough to block using the
// endpoint as an email bomb.
export const resetRequestLimiter = new SlidingWindowLimiter(5, 60 * 60 * 1000);

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Server-side Turnstile verification. Fails CLOSED when enabled (network
 * error → rejected), inert when the secret isn't configured.
 */
export async function verifyTurnstile(
  token: string | null,
  ip: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
