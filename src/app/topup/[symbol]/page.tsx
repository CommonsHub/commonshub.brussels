import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, HandHeart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOKEN_SYMBOL, tokenNetwork } from "@/modules/payments/chain";
import { currentCaller } from "@/modules/identity/server";
import { userWallet } from "@/modules/payments/user-wallet";

export const dynamic = "force-dynamic";

const STRIPE_TOPUP_URL =
  process.env.STRIPE_TOPUP_URL || "https://buy.stripe.com/7sIdSnbxz7AE1bi28m";
const WIRE_IBAN = "BE46 7340 7223 8636";
const WIRE_HOLDER = "Commons Hub Brussels";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `Top up ${symbol.toUpperCase()} | Commons Hub Brussels` };
}

/**
 * How to get more of a currency. Tokens are earned by taking part — that is
 * the whole point of them; euros are paid in by card or wire.
 */
export default async function TopUpPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const upper = decodeURIComponent(symbol).toUpperCase();

  const isToken = upper === TOKEN_SYMBOL.toUpperCase() || upper === "CHT" || upper === "TCHT";
  const isEuro = upper === "EUR" || upper === "EURO" || upper === "€";
  if (!isToken && !isEuro) notFound();

  const caller = await currentCaller();
  const wallet = isToken && caller ? await userWallet(caller.account.id).catch(() => null) : null;

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <Link href="/proposals">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">
            Top up {isToken ? TOKEN_SYMBOL : "euros"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isToken
              ? "Tokens are not bought — they are earned by taking part in the commons."
              : "Euros go in by card for small amounts, by wire for bigger ones."}
          </p>
        </div>

        {isToken ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HandHeart className="w-5 h-5 text-primary" /> Ways to earn {TOKEN_SYMBOL}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li>
                    <p className="font-medium">Join the weekly park cleaning</p>
                    <p className="text-muted-foreground">
                      An hour of picking up the park with the neighbours, every week.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Become a member and come to the heartbeat meeting</p>
                    <p className="text-muted-foreground">
                      The community's weekly pulse — members who show up keep the place steering.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Steward an event</p>
                    <p className="text-muted-foreground">
                      Take responsibility for an event finding its room, its people and its
                      clean-up.
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Do shifts</p>
                    <p className="text-muted-foreground">
                      Opening, closing, welcoming — the recurring work that keeps the hub open.
                    </p>
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  Members with an active subscription can also claim one token every calendar
                  month, from their profile. Tokens are paid out by the hub bot on Discord. See{" "}
                  <Link href="/economy" className="text-primary hover:underline">
                    how the token economy works
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>

            {wallet && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Already hold some on Discord?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Move them to your website wallet with the bot:
                  </p>
                  <code className="block rounded-md bg-muted px-2.5 py-1.5 text-xs break-all">
                    /send 5 to {wallet.address}
                  </code>
                </CardContent>
              </Card>
            )}

            {tokenNetwork() === "testnet" && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-sm space-y-2">
                  <p className="flex items-center gap-2 font-medium">
                    <Sparkles className="w-4 h-4 text-primary" /> This is the test network
                  </p>
                  <p className="text-muted-foreground">
                    {TOKEN_SYMBOL} here is worth nothing —{" "}
                    <Link href="/faucet" className="text-primary hover:underline">
                      mint yourself some at the faucet
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-primary" /> By card
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[20, 50, 100].map((amount) => (
                    <Button key={amount} asChild variant="outline">
                      <a
                        href={`${STRIPE_TOPUP_URL}?__prefilled_amount=${amount * 100}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        €{amount}
                      </a>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Card payments run through Stripe, which takes its usual card fee.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By wire, for larger amounts</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Account holder:</span> {WIRE_HOLDER}
                </p>
                <p>
                  <span className="text-muted-foreground">IBAN:</span>{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">{WIRE_IBAN}</code>
                </p>
                <p className="text-muted-foreground pt-1">
                  Put your name and what it is for in the message, and it gets matched to you.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
