"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Spade, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { resetPassword } from "@/lib/actions";
import { getPasswordStrength } from "@/lib/password";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await resetPassword(formData);

    if (result?.error) {
      toast.error("Couldn't reset your password", { description: result.error });
      setLoading(false);
    } else {
      toast.success("Password reset — sign in with your new password");
      router.push("/login");
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fade-up w-full max-w-sm space-y-6 text-center">
          <p className="text-sm text-[var(--cream)]/70">
            This reset link is missing its token.
          </p>
          <Link
            href="/forgot-password"
            className="text-[var(--gold-bright)] underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="fade-up w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <Spade className="h-8 w-8 text-[var(--gold-bright)]" fill="currentColor" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-[0.15em] gold-text">
            NEW PASSWORD
          </h1>
          <p className="text-sm text-[var(--cream)]/50">Pick something you'll remember</p>
        </div>

        <div className="gold-ring rounded-2xl bg-black/30 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="token" value={token} />

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm text-[var(--cream)]/70">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  className="input-dark pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cream)]/40 hover:text-[var(--cream)]/80"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/50">
                    <div
                      className={`h-full ${strength.color} transition-all`}
                      style={{ width: `${(strength.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--cream)]/50">{strength.label}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm text-[var(--cream)]/70">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                className="input-dark"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="action-btn primary w-full !py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting…
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
