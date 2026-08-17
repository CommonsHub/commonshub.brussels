"use client";

/**
 * Your balance, always in view next to your avatar. Open it for the detail —
 * profile, and a way to top up each currency.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchMe, type Me } from "@/modules/identity/client";

interface WalletInfo {
  address: string;
  balance: number;
  symbol: string;
}

export function BalanceChip() {
  const { data: session } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((account) => {
        if (cancelled) return;
        setMe(account);
        if (!account) return;
        fetch("/api/identity/wallet", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => !cancelled && d?.wallet && setWallet(d.wallet))
          .catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!me || !wallet) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 tabular-nums">
          <Coins className="w-4 h-4" />
          {wallet.balance} {wallet.symbol}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Your website wallet</p>
          <p className="font-medium tabular-nums">
            {wallet.balance} {wallet.symbol}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/topup/${wallet.symbol}`}>Top up {wallet.symbol}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/topup/EUR">Top up EUR</Link>
        </DropdownMenuItem>
        {me.hasDiscord && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/members/${me.displayName}`}>Profile</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
