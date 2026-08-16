import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatEur, formatTokens } from "@/modules/proposals/funding";
import { statusLabel } from "@/components/proposals/status";
import type { TimelineItem } from "@/modules/proposals/store";

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days > 1) return `${days} days ago`;
  if (days === 1) return "yesterday";
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60_000);
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

function money(currency: "eur" | "tokens", amount: number): string {
  return currency === "eur" ? formatEur(amount) : formatTokens(amount);
}

/**
 * Everything that has happened to this proposal, in order: money in, money
 * back, changes, decisions. Comments live in the thread above — this is the
 * ledger, and it should be readable as one.
 */
export function ActivityLog({ items, slug }: { items: TimelineItem[]; slug: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>;
  }

  return (
    <ol className="space-y-2 text-sm">
      {items.map((item, index) => {
        const time = <span className="text-muted-foreground"> · {ago(item.at)}</span>;

        if (item.kind === "contribution") {
          const c = item.contribution;
          return (
            <li key={index} className="flex flex-wrap gap-x-1">
              <span className="font-medium">{c.contributorName}</span>
              <span>
                {c.kind === "ticket" ? "took a ticket" : "contributed"}{" "}
                <span className="tabular-nums">{money(c.currency, c.grossAmount)}</span>
                {c.adminFee > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({formatEur(c.adminFee)} admin fee)
                  </span>
                )}
              </span>
              {time}
            </li>
          );
        }

        if (item.kind === "refund") {
          return (
            <li key={index} className="space-y-1">
              <p className="text-primary">
                Refunded {item.refunds.length}{" "}
                {item.refunds.length === 1 ? "contribution" : "contributions"}
                {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
                {time}
              </p>
              <ul className="pl-4 space-y-0.5 text-muted-foreground">
                {item.refunds.map((refund) => (
                  <li key={refund.id} className="flex flex-wrap gap-x-1">
                    <span>
                      {refund.contributorName} got back{" "}
                      <span className="tabular-nums">
                        {money(refund.currency, refund.amount)}
                      </span>
                    </span>
                    {refund.explorerUrl && (
                      <a
                        href={refund.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-primary"
                      >
                        transfer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        }

        if (item.kind === "revision") {
          return (
            <li key={index}>
              <span className="font-medium">{item.revision.authorName}</span> changed{" "}
              {item.revision.changes.map((c) => c.field).join(", ")} — version{" "}
              {item.revision.version}
              {time}
            </li>
          );
        }

        if (item.kind === "rsvp") {
          return (
            <li key={index}>
              <span className="font-medium">{item.rsvp.name}</span>{" "}
              {item.rsvp.state === "going" ? "is coming" : "cannot make it"}
              {time}
            </li>
          );
        }

        if (item.kind === "status") {
          return (
            <li key={index}>
              <span className="font-medium">{item.by}</span> marked it{" "}
              {statusLabel(item.status).toLowerCase()}
              {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
              {time}
            </li>
          );
        }

        const photos = item.comment.attachments?.length ?? 0;
        return (
          <li key={index}>
            <span className="font-medium">{item.comment.authorName}</span> commented
            {photos > 0 && (
              <>
                {" with "}
                <Link href={`/events/${slug}/photos`} className="hover:text-primary">
                  {photos} {photos === 1 ? "photo" : "photos"}
                </Link>
              </>
            )}
            {time}
          </li>
        );
      })}
    </ol>
  );
}
