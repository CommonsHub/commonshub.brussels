/**
 * Revision diffs are read by people, so they speak in the reader's words —
 * "dates", "room", "expected people" — not in field names. New revisions are
 * written that way; these helpers also translate the handful of records that
 * were written before, and hide the fields that are implementation detail.
 */

const LABELS: Record<string, string> = {
  slots: "dates",
  roomSlug: "room",
  expectedPeople: "expected people",
  tickets: "price",
  audience: "who can come",
  link: "link",
  title: "title",
  description: "description",
};

export function prettyField(field: string): string {
  return LABELS[field] ?? field;
}

/** confirmedSlotId is bookkeeping that rides along with a dates change. */
export function visibleChange(field: string): boolean {
  return field !== "confirmedSlotId";
}

/** "2026-08-25 18:00 (2h)" → "Tue 25 Aug 18:00 (2h)" — best effort. */
function prettySlot(raw: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (.*)$/.exec(raw.trim());
  if (!match) return raw.trim();
  const day = new Date(`${match[1]}T12:00:00`);
  if (Number.isNaN(day.getTime())) return raw.trim();
  return `${day.toLocaleDateString("en-BE", { weekday: "short", day: "numeric", month: "short" })} ${match[2]}`;
}

/**
 * A revision as you would say it out loud: "updated the room to Ostrom Room",
 * "added a date (Wed 26 Aug 18:00)". The raw before/after stays available
 * behind a toggle for anyone who wants the exact wording.
 */
export function describeChanges(
  changes: Array<{ field: string; from: string; to: string }>,
): string[] {
  const phrases: string[] = [];

  for (const change of changes) {
    const field = prettyField(change.field);
    if (!visibleChange(change.field)) continue;

    if (field === "dates") {
      const before = change.from === "—" ? [] : change.from.split(" · ");
      const after = change.to === "—" ? [] : change.to.split(" · ");
      const added = after.filter((s) => !before.includes(s));
      const removed = before.filter((s) => !after.includes(s));
      if (added.length && removed.length && added.length === 1 && removed.length === 1) {
        phrases.push(`changed a date to ${prettySlot(added[0])}`);
      } else {
        for (const slot of added) phrases.push(`added a date (${prettySlot(slot)})`);
        for (const slot of removed) phrases.push(`removed a date (${prettySlot(slot)})`);
      }
      if (!added.length && !removed.length) phrases.push("reordered the dates");
      continue;
    }

    switch (field) {
      case "room":
        phrases.push(
          change.to === "any room" ? "opened the room back up" : `updated the room to ${change.to}`,
        );
        break;
      case "expected people":
        phrases.push(`now expecting ~${change.to} people`);
        break;
      case "price":
        phrases.push(`updated the price to ${change.to}`);
        break;
      case "who can come":
        phrases.push(`made it ${change.to}`);
        break;
      case "title":
        phrases.push(`renamed it to “${change.to}”`);
        break;
      case "description":
        phrases.push(change.from === "—" ? "added a description" : "updated the description");
        break;
      case "link":
        phrases.push(change.to === "—" ? "removed the link" : "updated the link");
        break;
      default:
        phrases.push(`updated the ${field}`);
    }
  }

  return phrases.length ? phrases : ["updated the details"];
}
