"use client";

/**
 * The RSVP: one token, back if the event does not happen. When the wallet is
 * short, the way to the top-up page is right there.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AttendButton({
  proposalId,
  dateSet,
  alreadyGoing,
  full,
  symbol,
  signedIn,
}: {
  proposalId: string;
  dateSet: boolean;
  alreadyGoing: boolean;
  full: boolean;
  symbol: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsTopUp, setNeedsTopUp] = useState(false);
  const [done, setDone] = useState(false);

  if (alreadyGoing || done) {
    return (
      <p className="text-sm font-medium flex items-center gap-2">
        <Check className="w-4 h-4 text-primary" /> You&apos;re in — your {symbol} comes back if it
        does not happen.
      </p>
    );
  }
  if (full) {
    return <p className="text-sm text-muted-foreground">This one is full.</p>;
  }
  if (!dateSet) {
    return (
      <p className="text-sm text-muted-foreground">RSVPs open once the date is set.</p>
    );
  }
  if (!signedIn) {
    return (
      <Button asChild className="w-full">
        <Link href="/signin">Sign in to RSVP</Link>
      </Button>
    );
  }

  async function attend() {
    setBusy(true);
    setError(null);
    setNeedsTopUp(false);
    try {
      const response = await fetch(`/api/proposals/${proposalId}/attend`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.needsTopUp) setNeedsTopUp(true);
        throw new Error(data?.error || "That did not work.");
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={attend} disabled={busy} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        RSVP · 1 {symbol}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Refunded if the event is cancelled or does not happen.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {needsTopUp && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/topup/${symbol}`}>Top up your wallet first</Link>
        </Button>
      )}
    </div>
  );
}
