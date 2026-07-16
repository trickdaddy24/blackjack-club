"use client";

// Email join link lands here: try the seat, then bounce to the table.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Spade } from "lucide-react";

export default function JoinTablePage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    (async () => {
      const res = await fetch("/api/table/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (res.status === 401) {
        router.replace(`/login?callbackUrl=/table/join/${inviteId}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't take the seat");
        return;
      }
      router.replace(`/table/${data.tableId}`);
    })();
  }, [inviteId, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Spade className="mb-4 h-8 w-8 text-[var(--gold-bright)]" fill="currentColor" />
      {error ? (
        <>
          <p className="font-display text-xl gold-text">{error}</p>
          <Link href="/play" className="mt-6 text-sm text-[var(--gold-bright)] underline-offset-4 hover:underline">
            Back to your own table
          </Link>
        </>
      ) : (
        <p className="flex items-center gap-2 text-[var(--cream)]/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Taking your seat…
        </p>
      )}
    </div>
  );
}
