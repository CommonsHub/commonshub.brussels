"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { WalletAddress } from "@/components/wallet-address";
import type { AccountData } from "@/lib/financials";

function AccountCard({ account }: { account: AccountData }) {
  return (
    <Link href={`/finance/${account.slug}`} className="block h-full">
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{account.name}</span>
            {account.address && (
              <WalletAddress
                address={account.address}
                chain={account.chain || "ethereum"}
                showLink={false}
                showCopy={false}
              />
            )}
          </CardTitle>
          <CardDescription>
            {account.provider === "stripe"
              ? "Stripe"
              : `${account.chain} blockchain`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold">
            {Math.round(account.balance ?? 0).toLocaleString()}{" "}
            <span className="text-lg text-muted-foreground">
              {account.tokenSymbol}
            </span>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1 text-green-600">
              <ArrowDownLeft className="w-4 h-4" />+
              {(account.totalInflow ?? 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <ArrowUpRight className="w-4 h-4" />-
              {(account.totalOutflow ?? 0).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function AccountCards({
  active,
  archived,
}: {
  active: AccountData[];
  archived: AccountData[];
}) {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {active.map((account) => (
          <AccountCard key={account.slug} account={account} />
        ))}
        {showArchived &&
          archived.map((account) => (
            <AccountCard key={account.slug} account={account} />
          ))}
      </div>
      {archived.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide" : "Show"} archived accounts ({archived.length})
          </Button>
        </div>
      )}
    </div>
  );
}
