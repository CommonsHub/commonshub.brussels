import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOKEN_SYMBOL, tokenNetwork } from "@/modules/payments/chain";
import { FaucetForm } from "./faucet-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Faucet | Commons Hub Brussels" };

/** Test money on tap — only exists where the money is worth nothing. */
export default function FaucetPage() {
  if (tokenNetwork() !== "testnet") notFound();

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Faucet</h1>
          <p className="text-muted-foreground mt-2">
            This deployment runs on the Celo Sepolia test network — {TOKEN_SYMBOL} here is worth
            nothing, so help yourself.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mint {TOKEN_SYMBOL}</CardTitle>
          </CardHeader>
          <CardContent>
            <FaucetForm symbol={TOKEN_SYMBOL} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
