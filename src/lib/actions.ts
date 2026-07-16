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
  verifyTurnstile,
} from "@/lib/registration-guard";

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

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/play" });
}

export async function isGoogleOAuthEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}
