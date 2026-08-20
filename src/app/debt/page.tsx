import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEBT_REVALIDATE_SECONDS,
  DEBT_SHEET_URL,
  formatDay,
  formatEuro,
  loadDebtLedger,
  type DebtLedger,
} from "@/lib/debt";

/** The sheet is read at most once a day; the page is rebuilt on the same beat. */
export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "Debt tokens | Commons Hub Brussels",
  description:
    "Every interest-free debt token the Commons Hub has issued and settled, who holds them, and what they are redeemable for. Read straight from the stewards' ledger.",
  openGraph: {
    title: "Commons Hub Brussels — debt tokens",
    description:
      "Interest-free debt issued by the Commons Hub, redeemable against the space and what the community offers. The full ledger, in the open.",
  },
};

const TEAL = "#009689";
const GOLD = "#FFB900";

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "teal" | "gold";
}) {
  const color =
    tone === "teal" ? { color: TEAL } : tone === "gold" ? { color: GOLD } : undefined;
  return (
    <Card className="gap-0">
      <CardContent className="space-y-1 py-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`font-mono text-2xl font-semibold tabular-nums ${tone === "primary" ? "text-primary" : ""}`}
          style={color}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** How much of the outstanding total one holder carries. */
function ShareBar({ value, of }: { value: number; of: number }) {
  const percent = of > 0 ? Math.round((value / of) * 1000) / 10 : 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-1.5 rounded-full block"
        style={{ width: `${Math.max(percent, 0.6)}%`, backgroundColor: TEAL, minWidth: 4 }}
        aria-hidden
      />
      <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  );
}

function Ledger({ ledger }: { ledger: DebtLedger }) {
  const { totals, holders, transactions } = ledger;
  // Newest first: what changed recently is what people come here to see.
  const recent = [...transactions].reverse();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <Stat
          label="Outstanding debt"
          value={formatEuro(totals.outstanding)}
          hint={`held by ${totals.holders} people and companies`}
          tone="primary"
        />
        <Stat label="Issued to date" value={formatEuro(totals.minted)} hint="all mints since 2024" />
        <Stat
          label="Settled"
          value={formatEuro(totals.burned)}
          hint={`${totals.settledHolders} holders fully repaid`}
          tone="teal"
        />
        <Stat
          label="Ledger covers"
          value={`${transactions.length} entries`}
          hint={
            totals.firstAt && totals.lastAt
              ? `${formatDay(totals.firstAt)} → ${formatDay(totals.lastAt)}`
              : undefined
          }
        />
      </div>

      {/* ── who holds it ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-1">Who holds the debt</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Each balance is what the hub still owes that holder, redeemable against the space and
          what the community offers.
        </p>

        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold">Holder</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Since</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Last movement</th>
                  <th className="px-4 py-3 font-semibold hidden lg:table-cell w-40">Share</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {holders.map((holder) => (
                  <tr key={holder.name} className={holder.balance === 0 ? "text-muted-foreground" : ""}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{holder.name}</span>
                      {holder.balance === 0 && (
                        <Badge variant="outline" className="ml-2 text-xs font-normal">
                          settled
                        </Badge>
                      )}
                      <span className="block sm:hidden text-xs text-muted-foreground">
                        since {formatDay(holder.firstAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {formatDay(holder.firstAt)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {formatDay(holder.lastAt)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <ShareBar value={holder.balance} of={totals.outstanding} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatEuro(holder.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="px-4 py-3" colSpan={4}>
                    Total outstanding
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatEuro(totals.outstanding)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </section>

      {/* ── every movement ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-1">Every movement</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Newest first. A mint issues debt; a burn settles it. Where a token was moved on-chain,
          the transaction is linked.
        </p>

        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Holder</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">What for</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-right hidden sm:table-cell">
                    Their balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((transaction, index) => (
                  <tr key={`${transaction.date}-${transaction.name}-${index}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDay(transaction.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{transaction.name}</span>
                      <span className="block md:hidden text-xs text-muted-foreground">
                        {transaction.comment}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground max-w-md">
                      {transaction.comment}
                      {transaction.referenceUrl && (
                        <a
                          href={transaction.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5 ml-1"
                        >
                          decision <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span
                        className="font-mono tabular-nums"
                        style={transaction.type === "BURN" ? { color: TEAL } : undefined}
                      >
                        {formatEuro(transaction.amount, { sign: true })}
                      </span>
                      {transaction.txUrl && (
                        <a
                          href={transaction.txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="See it on-chain"
                          className="text-muted-foreground hover:text-primary inline-flex ml-1.5 align-middle"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums hidden sm:table-cell text-muted-foreground">
                      {formatEuro(transaction.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </>
  );
}

export default async function DebtPage() {
  let ledger: DebtLedger | null = null;
  let failed = false;
  try {
    ledger = await loadDebtLedger();
  } catch (error) {
    console.error("[debt] the page could not read the ledger:", error);
    failed = true;
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-10 space-y-4">
          <Badge variant="outline" style={{ borderColor: GOLD, color: "#9a6f00" }}>
            Open books
          </Badge>
          <h1 className="text-4xl font-bold">Debt tokens</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            The Commons Hub is partly financed by its own community. People and companies lend the
            hub money, work or rent, and hold an <strong>interest-free debt token</strong> in
            return — redeemable against the space and what the community offers, or transferable
            between members.
          </p>
          <p className="text-muted-foreground max-w-3xl">
            This is the whole ledger. Nothing is summarised away: every token issued, every token
            settled, and what each holder is still owed.
          </p>
        </header>

        {ledger ? (
          <Ledger ledger={ledger} />
        ) : (
          <Card className="mb-12">
            <CardContent className="space-y-2">
              <p className="font-medium">The ledger could not be read just now.</p>
              <p className="text-sm text-muted-foreground">
                {failed && "The source spreadsheet did not answer. "}
                You can always read it at the source:{" "}
                <a
                  href={DEBT_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  the debt token sheet
                </a>
                .
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── how to read this ── */}
        <section className="grid gap-6 md:grid-cols-2 mb-10">
          <Card>
            <CardContent className="space-y-2">
              <h2 className="font-semibold">What a debt token is</h2>
              <p className="text-sm text-muted-foreground">
                A promise, recorded in the open. It carries no interest and no maturity date: the
                hub owes the amount until the holder chooses to redeem it — for coworking, for a
                room, for what other members offer — or passes it on to somebody who will.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <h2 className="font-semibold">Mint and burn</h2>
              <p className="text-sm text-muted-foreground">
                A <strong>mint</strong> issues new debt: someone lends money, works a month, or
                waits on rent. A <strong>burn</strong> settles it: the holder took a year of
                coworking, or the debt was converted into a donation. A balance of zero means the
                hub and that holder are square.
              </p>
            </CardContent>
          </Card>
        </section>

        <footer className="border-t pt-6 space-y-2 text-sm text-muted-foreground">
          <p>
            Kept by the stewards in{" "}
            <a
              href={DEBT_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              a spreadsheet anyone can read <ExternalLink className="w-3 h-3" />
            </a>
            . This page reads that sheet directly and refreshes once a day
            {ledger && (
              <>
                {" "}
                — last read {formatDay(ledger.fetchedAt.slice(0, 10))}
                {ledger.stale && " (the sheet was unreachable since; these are the last figures read)"}
              </>
            )}
            . Every total here is recomputed from the individual transactions, not copied from the
            sheet.
          </p>
          <p>
            Questions about the hub&apos;s finances?{" "}
            <Link href="/finance" className="text-primary hover:underline">
              See the full financial picture
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="text-primary hover:underline">
              ask the stewards
            </Link>
            .
          </p>
          <p className="sr-only">
            Refreshed at most every {DEBT_REVALIDATE_SECONDS} seconds.
          </p>
        </footer>
      </div>
    </div>
  );
}
