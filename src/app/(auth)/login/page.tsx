"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Spade, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { loginWithCredentials, loginWithGoogle, isGoogleOAuthEnabled } from "@/lib/actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    isGoogleOAuthEnabled().then(setGoogleEnabled);
  }, []);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("Welcome to the club", {
        description: "Your seat is ready — sign in to collect your 1,000 chips.",
      });
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginWithCredentials(formData);

    if (result?.error) {
      toast.error("Sign in failed", { description: result.error });
      setLoading(false);
    } else {
      router.push(searchParams.get("callbackUrl") ?? "/play");
      router.refresh();
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
            WELCOME BACK
          </h1>
          <p className="text-sm text-[var(--cream)]/50">The table is waiting</p>
        </div>

        <div className="gold-ring space-y-5 rounded-2xl bg-black/30 p-6">
          {googleEnabled && (
            <>
              <form action={loginWithGoogle}>
                <button
                  type="submit"
                  className="action-btn w-full !normal-case !tracking-normal !font-sans"
                >
                  Continue with Google
                </button>
              </form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--gold)]/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#141009] px-2 text-[var(--cream)]/40">or</span>
                </div>
              </div>
            </>
          )}

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

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm text-[var(--cream)]/70">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="input-dark pr-10"
                  placeholder="••••••••"
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
            </div>

            <button type="submit" disabled={loading} className="action-btn primary w-full !py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--cream)]/50">
          New here?{" "}
          <Link href="/register" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
            Join the club
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
