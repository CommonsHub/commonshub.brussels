"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTokens } from "@/modules/proposals/funding";

interface TokenRequest {
  amount: number;
  account: string | null;
  command: string;
  symbol: string;
}

/**
 * Chip in towards the room, or buy a ticket. Euros go through the card
 * checkout; tokens are sent with the Discord bot people already use, and we
 * watch for the transfer.
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
}: {
  proposalId: string;
  ticketEur: number | null;
  ticketTokens: number | null;
  freeForMembers: boolean;
  signedIn: boolean;
  isMember: boolean;
  discordLinked: boolean;
  tokenBalance: number | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<number | "">(ticketEur ?? 20);
  const [tokenAmount, setTokenAmount] = useState<number | "">(ticketTokens ?? 1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenRequest, setTokenRequest] = useState<TokenRequest | null>(null);
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
      setTokenRequest(data.tokenRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmTokenPayment() {
    if (!tokenRequest) return;
    setError(null);
    setBusy("confirm");
    try {
      const data = await post(`/api/proposals/${proposalId}/contribute/token`, {
        amount: tokenRequest.amount,
        kind,
        seats: kind === "ticket" ? 1 : 0,
      });
      setConfirmation(data.explorerUrl ?? "recorded");
      setTokenRequest(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not find that payment yet.");
    } finally {
      setBusy(null);
    }
  }

  async function rsvpFree() {
    setError(null);
    setBusy("rsvp");
    try {
      await post(`/api/proposals/${proposalId}/rsvp`, { state: "going", seats: 1 });
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
          Sign in to say you are coming or to chip in towards the room.
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
        {confirmation !== "recorded" && (
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

  if (tokenRequest) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Send <span className="font-medium tabular-nums">{tokenRequest.amount}</span>{" "}
          {tokenRequest.symbol} with the hub bot on Discord:
        </p>
        <code className="block rounded-md bg-muted px-3 py-2 text-sm">{tokenRequest.command}</code>
        <p className="text-xs text-muted-foreground">
          The odd last digits are how we recognise your payment — send exactly that amount.
        </p>
        <Button onClick={confirmTokenPayment} disabled={busy === "confirm"} className="w-full">
          {busy === "confirm" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          I&apos;ve sent it
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setTokenRequest(null)}>
          Cancel
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasTicket && freeForMembers && isMember && (
        <Button onClick={rsvpFree} disabled={busy === "rsvp"} className="w-full">
          {busy === "rsvp" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Come along — members are free
        </Button>
      )}

      {!hasTicket && (
        <Button onClick={rsvpFree} disabled={busy === "rsvp"} className="w-full">
          {busy === "rsvp" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          I&apos;m coming
        </Button>
      )}

      <div className="space-y-2">
        <Label htmlFor="eur-amount" className="text-xs uppercase tracking-wide text-muted-foreground">
          {hasTicket ? "Ticket in euros" : "Chip in, in euros"}
        </Label>
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
          <Button onClick={payWithCard} disabled={busy === "eur" || !amount} className="flex-1">
            {busy === "eur" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Pay by card
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The hub keeps 10% of euro payments as its admin fee; the rest goes towards the room.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label
            htmlFor="token-amount"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            {hasTicket ? "Ticket in tokens" : "Chip in, in tokens"}
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
            variant="outline"
            onClick={payWithTokens}
            disabled={busy === "tokens" || !tokenAmount || !discordLinked}
            className="flex-1"
          >
            {busy === "tokens" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Pay with tokens
          </Button>
        </div>
        {tokenBalance !== null && typeof tokenAmount === "number" && tokenAmount > tokenBalance && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            That is more than you hold. Earn some at the hub, or pay in euros.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {discordLinked
            ? "Sent with the hub bot on Discord. No admin fee on token payments."
            : "Connect Discord to pay with tokens — that is where your tokens live."}
        </p>
        {!discordLinked && (
          <Button variant="ghost" size="sm" asChild className="px-0">
            <a href="/signin">Connect Discord</a>
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
