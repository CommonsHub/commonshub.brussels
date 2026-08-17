"use client";

/**
 * Your two wallets, side by side: the website one that pays for things here,
 * and the Discord one the bot mints into. Topping up is moving tokens from
 * the second to the first, with the bot command ready to copy.
 *
 * Shown only to the person themselves — it renders nothing on someone else's
 * profile, because the API only answers about the session it is given.
 */

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WalletInfo {
  address: string;
  explorerUrl: string;
  balance: number;
  symbol?: string;
}

interface WalletResponse {
  wallet: (WalletInfo & { deployed: boolean; symbol: string }) | null;
  discordWallet: WalletInfo | null;
  hasDiscord: boolean;
}

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletCard({ profileDiscordId }: { profileDiscordId?: string }) {
  const [data, setData] = useState<WalletResponse | null>(null);
  const [myDiscordId, setMyDiscordId] = useState<string | null | undefined>(undefined);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    const response = await fetch("/api/identity/wallet", { cache: "no-store" });
    if (response.status === 401) {
      setSignedIn(false);
      return;
    }
    if (!response.ok) return;
    setSignedIn(true);
    setData(await response.json());
  }

  useEffect(() => {
    load().catch(() => undefined);
    fetch("/api/identity/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMyDiscordId(d?.account?.discordId ?? null))
      .catch(() => setMyDiscordId(null));
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the address is visible and selectable regardless */
    }
  }

  // Someone else's profile, or not signed in: nothing to show.
  if (signedIn === false) return null;
  if (profileDiscordId && myDiscordId !== undefined && myDiscordId !== profileDiscordId) {
    return null;
  }
  if (!data?.wallet && !data?.discordWallet) return null;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Your wallets
        </CardTitle>
        <CardDescription>
          The website wallet pays for things here — tickets, contributions. The Discord one is
          where the bot pays you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.wallet && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Website wallet</p>
              <p className="text-sm tabular-nums">
                {data.wallet.balance} {data.wallet.symbol}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <a
                href={data.wallet.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-primary inline-flex items-center gap-1"
              >
                {short(data.wallet.address)} <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => copyAddress(data.wallet!.address)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                {copied ? "copied" : "copy"}
              </button>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-1 hover:text-foreground"
                disabled={refreshing}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} /> refresh
              </button>
            </div>
          </div>
        )}

        {data.discordWallet && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Discord wallet</p>
              <p className="text-sm tabular-nums">{data.discordWallet.balance} tokens</p>
            </div>
            <a
              href={data.discordWallet.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              {short(data.discordWallet.address)} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {data.wallet && (
          <div className="rounded-lg border border-dashed p-3 space-y-1.5">
            <p className="text-sm font-medium">Top up your website wallet</p>
            <p className="text-xs text-muted-foreground">
              Send tokens to it with the Discord bot — for example:
            </p>
            <code className="block rounded-md bg-muted px-2.5 py-1.5 text-xs break-all">
              /send 5 to {data.wallet.address}
            </code>
            <p className="text-xs text-muted-foreground">
              Then hit refresh above. Anything sent to that address lands in your wallet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
