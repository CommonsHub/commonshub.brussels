"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Coins, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTokens } from "@/modules/proposals/funding";

type Step = "closed" | "currency" | "eur" | "tokens";

/**
 * One door in: Contribute. Behind it, the choice of currency, then the amount.
 * Tokens move straight from the person's own account — the same transfer the
 * Discord bot would make, done here because they are signed in with Discord.
 */
export function ContributePanel({
  proposalId,
  ticketEur,
  ticketTokens,
  freeForMembers,
  signedIn,
  isMember,
  discordLinked,
  tokenBalance,
  walletAddress,
}: {
  proposalId: string;
  ticketEur: number | null;
  ticketTokens: number | null;
  freeForMembers: boolean;
  signedIn: boolean;
  isMember: boolean;
  discordLinked: boolean;
  tokenBalance: number | null;
  walletAddress: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [amount, setAmount] = useState<number | "">(ticketEur ?? 20);
  const [tokenAmount, setTokenAmount] = useState<number | "">(ticketTokens ?? 1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const hasTicket = !!(ticketEur || ticketTokens);
  const kind = hasTicket ? "ticket" : "donation";

  async function post(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "That did not work.");
    return data;
  }

  async function payWithCard() {
    setError(null);
    setBusy("eur");
    try {
      const data = await post(`/api/proposals/${proposalId}/contribute`, {
        currency: "eur",
        kind,
        amount: Number(amount),
        seats: kind === "ticket" ? 1 : 0,
      });
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      setBusy(null);
    }
  }

  async function payWithTokens() {
    setError(null);
    setBusy("tokens");
    try {
      const data = await post(`/api/proposals/${proposalId}/contribute`, {
        currency: "tokens",
        kind,
        amount: Number(tokenAmount),
        seats: kind === "ticket" ? 1 : 0,
      });
      setConfirmation(data.explorerUrl ?? "done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in to chip in towards making this happen.
        </p>
        <Button asChild className="w-full">
          <a href="/signin">Sign in</a>
        </Button>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Thank you — that is counted.</p>
        {confirmation !== "done" && (
          <a
            href={confirmation}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            See the transfer <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // ── the amount, in euros ──
  if (step === "eur") {
    return (
      <div className="space-y-3">
        <Label htmlFor="eur-amount">{hasTicket ? "Your ticket, in euros" : "Chip in, in euros"}</Label>
        <div className="flex gap-2">
          <Input
            id="eur-amount"
            type="number"
            min={1}
            step={0.5}
            value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-24"
          />
          <Button onClick={payWithCard} disabled={busy !== null || !amount} className="flex-1">
            {busy === "eur" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Pay by card
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The hub keeps 10% of euro payments as its admin fee; the rest goes towards the room.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="ghost" size="sm" onClick={() => setStep("currency")} disabled={busy !== null}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  // ── the amount, in tokens ──
  if (step === "tokens") {
    const overdrawn =
      tokenBalance !== null && typeof tokenAmount === "number" && tokenAmount > tokenBalance;
    const empty = tokenBalance !== null && tokenBalance <= 0;

    return (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="token-amount">
            {hasTicket ? "Your ticket, in tokens" : "Chip in, in tokens"}
          </Label>
          {tokenBalance !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              you hold {formatTokens(tokenBalance)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            id="token-amount"
            type="number"
            min={0.5}
            step={0.5}
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-24"
          />
          <Button
            onClick={payWithTokens}
            disabled={busy !== null || !tokenAmount || overdrawn}
            className="flex-1"
          >
            {busy === "tokens" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Contribute {tokenAmount || "…"} tokens
          </Button>
        </div>
        {(overdrawn || empty) && walletAddress && (
          <div className="rounded-lg border border-dashed p-3 space-y-1.5">
            <p className="text-xs font-medium">
              {empty ? "Your website wallet is empty." : "Not enough in your website wallet."} Top
              it up with the Discord bot:
            </p>
            <code className="block rounded-md bg-muted px-2.5 py-1.5 text-xs break-all">
              /send {typeof tokenAmount === "number" && tokenAmount > 0 ? tokenAmount : 5} to{" "}
              {walletAddress}
            </code>
            <p className="text-xs text-muted-foreground">
              Then come back here — a refresh picks it up.
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Paid from your website wallet, straight from here. No admin fee on tokens.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="ghost" size="sm" onClick={() => setStep("currency")} disabled={busy !== null}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  // ── euros or tokens ──
  if (step === "currency") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">How do you want to contribute?</p>
        <Button variant="outline" className="w-full justify-start" onClick={() => setStep("eur")}>
          <CreditCard className="w-4 h-4 mr-2" />
          In euros, by card
        </Button>
        <Button variant="outline" className="w-full justify-start" onClick={() => setStep("tokens")}>
          <Coins className="w-4 h-4 mr-2" />
          In tokens
          {discordLinked && tokenBalance !== null && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              you hold {formatTokens(tokenBalance)}
            </span>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStep("closed")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  // ── closed: one door in ──
  return (
    <div className="space-y-2">
      <Button onClick={() => setStep("currency")} className="w-full">
        Contribute
      </Button>
      {hasTicket && freeForMembers && isMember && (
        <p className="text-xs text-muted-foreground text-center">Members come free.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
