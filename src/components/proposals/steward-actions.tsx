"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * The confirm button holds a room, so it says what it will do before it does
 * it, and it only appears once the room is actually covered.
 */
export function StewardActions({
  proposalId,
  canConfirm,
  whatConfirmingDoes,
  blockedReason,
}: {
  proposalId: string;
  canConfirm: boolean;
  whatConfirmingDoes: string;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(status: "confirmed" | "declined") {
    setBusy(status);
    setError(null);
    try {
      const response = await fetch(`/api/proposals/${proposalId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "That did not work.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-primary/40 p-4 space-y-3">
      <p className="text-xs uppercase tracking-wide text-primary">Stewards</p>
      <p className="text-sm text-muted-foreground">{whatConfirmingDoes}</p>
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="A note with your decision (optional)"
      />
      {blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act("confirmed")} disabled={!canConfirm || busy !== null}>
          {busy === "confirmed" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Confirm &amp; add to the calendar
        </Button>
        <Button variant="outline" onClick={() => act("declined")} disabled={busy !== null}>
          {busy === "declined" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Decline
        </Button>
      </div>
    </div>
  );
}
