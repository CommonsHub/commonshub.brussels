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
