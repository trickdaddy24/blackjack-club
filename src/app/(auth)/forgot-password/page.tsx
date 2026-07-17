"use client";

import { useState } from "react";
import Link from "next/link";
import { Spade, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/actions";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await requestPasswordReset(formData);

    if ("error" in result) {
      toast.error("Couldn't send reset link", { description: result.error });
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="fade-up w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <Spade className="h-8 w-8 text-[var(--gold-bright)]" fill="currentColor" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-[0.15em] gold-text">
            RESET PASSWORD
          </h1>
          <p className="text-sm text-[var(--cream)]/50">
            {sent
              ? "Check your inbox for a reset link"
              : "We'll email you a link to get back in"}
          </p>
        </div>

        <div className="gold-ring space-y-5 rounded-2xl bg-black/30 p-6">
          {sent ? (
            <p className="text-center text-sm leading-relaxed text-[var(--cream)]/70">
              If an account exists for that email, a reset link is on its way. It expires in
              60 minutes.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm text-[var(--cream)]/70">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input-dark"
                  placeholder="you@example.com"
                />
              </div>

              <button type="submit" disabled={loading} className="action-btn primary w-full !py-3">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-[var(--cream)]/50">
          <Link href="/login" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
