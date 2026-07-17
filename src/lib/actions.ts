"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { validatePasswordComplexity } from "@/lib/password";
import {
  isDisposableEmail,
  registerLimiter,
  resetRequestLimiter,
  verifyTurnstile,
} from "@/lib/registration-guard";
import { generateRawToken, hashToken, isTokenExpired, RESET_TOKEN_TTL_MS } from "@/lib/reset-token";
import { emailEnabled, sendPasswordResetEmail } from "@/lib/email";

/** Client IP behind Cloudflare → Traefik → Next. */
async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function register(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Honeypot: invisible to humans, autofilled by naive bots. Pretend
  // success so the script learns nothing.
  if (formData.get("website")) {
    return { success: true };
  }

  if (!name || !email || !password) {
    return { error: "All fields are required" };
  }

  // Rate limit BEFORE content checks so junk attempts (disposable domains,
  // bad captchas) still burn the connection's budget.
  const ip = await clientIp();
  if (!registerLimiter.allow(ip, Date.now())) {
    return { error: "Too many accounts created from this connection — try again later" };
  }

  if (isDisposableEmail(email)) {
    return { error: "Please use a real email address — disposable inboxes aren't allowed" };
  }

  // Cloudflare Turnstile (active only when TURNSTILE_SECRET_KEY is set)
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { error: "Human check failed — please try again" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const complexityError = validatePasswordComplexity(password);
  if (complexityError) {
    return { error: complexityError };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      emailVerified: new Date(),
    },
  });

  return { success: true };
}

export async function loginWithCredentials(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw err;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

// A generic response regardless of whether the email matched an account —
// leaking existence would let anyone enumerate registered players.
const GENERIC_RESET_RESPONSE = {
  success: true,
  message: "If an account exists for that email, a reset link is on its way.",
};

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) {
    return { error: "Email is required" };
  }

  const ip = await clientIp();
  if (!resetRequestLimiter.allow(ip, Date.now())) {
    return { error: "Too many reset requests from this connection — try again later" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role === "banned") {
    return GENERIC_RESET_RESPONSE;
  }

  const raw = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.AUTH_URL}/reset-password?token=${raw}`;
  const expiresMinutes = RESET_TOKEN_TTL_MS / 60_000;
  if (emailEnabled()) {
    await sendPasswordResetEmail({ to: email, resetUrl, expiresMinutes });
  } else {
    // Dev convenience only — in prod, Resend is configured, so this branch
    // never fires and the raw link never touches the server log.
    console.log(`[password reset] email not configured — link for ${email}: ${resetUrl}`);
  }

  return GENERIC_RESET_RESPONSE;
}

export async function resetPassword(formData: FormData) {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token || !password) {
    return { error: "Missing reset token or password" };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }
  const complexityError = validatePasswordComplexity(password);
  if (complexityError) {
    return { error: complexityError };
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || isTokenExpired(row.expiresAt)) {
    return { error: "This reset link is invalid or has expired — request a new one" };
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  return { success: true };
}

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/play" });
}

export async function isGoogleOAuthEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}
