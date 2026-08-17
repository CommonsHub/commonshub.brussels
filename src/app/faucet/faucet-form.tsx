"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FaucetForm({ symbol }: { symbol: string }) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ minted: number; label: string; explorerUrl: string } | null>(
    null,
  );

  async function mint() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim() || undefined, amount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "That did not work.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="to">Who gets it</Label>
        <Input
          id="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x address or username — empty mints to your own wallet"
        />
      </div>
      <div className="space-y-1.5 max-w-40">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          min={1}
          max={10000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>
      <Button onClick={mint} disabled={busy || !amount}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Mint {amount} {symbol}
      </Button>

      {result && (
        <p className="text-sm">
          Minted {result.minted} {symbol} to {result.label}.{" "}
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            transfer <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
