import { avatarFor } from "@/modules/proposals/avatars";
import type { Proposal } from "@/modules/proposals/types";

/**
 * The people already behind this — going, or having put something in. Faces
 * first: an event feels real when you can see who is coming.
 */
export function Supporters({ proposal }: { proposal: Proposal }) {
  const people = new Map<string, { name: string; going: boolean; contributed: boolean }>();

  for (const rsvp of proposal.rsvps) {
    if (rsvp.state !== "going") continue;
    people.set(rsvp.contributorId, {
      name: rsvp.name,
      going: true,
      contributed: people.get(rsvp.contributorId)?.contributed ?? false,
    });
  }
  for (const contribution of proposal.contributions) {
    const existing = people.get(contribution.contributorId);
    people.set(contribution.contributorId, {
      name: contribution.contributorName,
      going: existing?.going ?? false,
      contributed: true,
    });
  }

  const list = Array.from(people.values());
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody yet — the first two make it real.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {list.map((person) => {
        const url = avatarFor(person.name);
        return (
          <li key={person.name} className="flex items-center gap-2 text-sm">
            <span className="w-7 h-7 rounded-full overflow-hidden border bg-primary/10 text-primary text-xs font-medium flex items-center justify-center shrink-0">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="w-full h-full object-cover" />
              ) : (
                person.name.charAt(0).toUpperCase()
              )}
            </span>
            <span>
              {person.name}
              <span className="text-xs text-muted-foreground">
                {" "}
                {person.going && person.contributed
                  ? "· going"
                  : person.going
                    ? "· going"
                    : "· supporting"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
