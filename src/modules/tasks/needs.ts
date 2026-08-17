/**
 * What a room usually needs. A starting point people edit, not a questionnaire
 * — except cleaning, which is on every event whether or not anyone ticked it.
 *
 * Kept apart from tasklist.ts so the form can use it without pulling the relay
 * client into the browser bundle.
 */

export const SUGGESTED_NEEDS = [
  { label: "TV", emoji: "📺", mandatory: false },
  { label: "Projector", emoji: "📽️", mandatory: false },
  { label: "Microphones", emoji: "🎤", mandatory: false },
  { label: "Coffee", emoji: "☕", mandatory: false },
  { label: "Tea", emoji: "🍵", mandatory: false },
  { label: "Water", emoji: "💧", mandatory: false },
  { label: "Snacks", emoji: "🍿", mandatory: false },
  { label: "Sandwiches", emoji: "🥪", mandatory: false },
  { label: "Cleaning", emoji: "🧹", mandatory: true },
] as const;

export const MANDATORY_NEEDS = SUGGESTED_NEEDS.filter((n) => n.mandatory).map((n) => n.label);

/** Always include the mandatory items, whatever the proposer picked. */
export function withMandatoryNeeds(needs: string[]): string[] {
  const chosen = needs.map((n) => n.trim()).filter(Boolean);
  const missing = MANDATORY_NEEDS.filter(
    (m) => !chosen.some((c) => c.toLowerCase() === m.toLowerCase()),
  );
  return [...chosen, ...missing];
}
