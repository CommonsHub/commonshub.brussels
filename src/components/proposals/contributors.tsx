import { formatEur, formatTokens } from "@/modules/proposals/funding";
import type { Contribution } from "@/modules/proposals/types";

/**
 * Who has put something in. Grouped per person, because someone who buys a
 * ticket and then donates twice is one supporter, not three.
 */
export function Contributors({ contributions }: { contributions: Contribution[] }) {
  if (contributions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody has chipped in yet. Be the first and the room is on its way.
      </p>
    );
  }

  const byPerson = new Map<string, { name: string; eur: number; tokens: number; tickets: number }>();
  for (const c of contributions) {
    const entry = byPerson.get(c.contributorId) ?? {
      name: c.contributorName,
      eur: 0,
      tokens: 0,
      tickets: 0,
    };
    if (c.currency === "eur") entry.eur += c.grossAmount;
    else entry.tokens += c.grossAmount;
    if (c.kind === "ticket") entry.tickets += c.seats;
    byPerson.set(c.contributorId, entry);
  }

  const people = Array.from(byPerson.values()).sort(
    (a, b) => b.eur + b.tokens * 30 - (a.eur + a.tokens * 30),
  );

  return (
    <ul className="space-y-1.5 text-sm">
      {people.map((person, index) => (
        <li key={index} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            {person.name}
            {person.tickets > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {person.tickets} {person.tickets === 1 ? "ticket" : "tickets"}
              </span>
            )}
          </span>
          <span className="text-muted-foreground tabular-nums whitespace-nowrap">
            {person.eur > 0 && formatEur(person.eur)}
            {person.eur > 0 && person.tokens > 0 && " + "}
            {person.tokens > 0 && formatTokens(person.tokens)}
          </span>
        </li>
      ))}
    </ul>
  );
}
