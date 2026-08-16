/**
 * A proposal is a public request to put an event on the hub calendar.
 *
 * It is deliberately shaped like a pull request: the proposer opens it, anyone
 * can comment, the proposer (or a steward) revises it, and it lands on the
 * calendar once it is funded and a steward confirms it.
 *
 * Storage is an append-only log of `ProposalEvent`s; the `Proposal` below is
 * the projection of that log. See ./store.ts.
 */

export type ProposalStatus =
  | "draft" // only the proposer can see it
  | "open" // public, still collecting dates / room / funding
  | "funded" // threshold reached, waiting for a steward to confirm
  | "confirmed" // on the calendar, room is held
  | "happened"
  | "declined"
  | "cancelled";

export type Audience = "public" | "members" | "invite";

/** A candidate slot. A proposal can carry several until one is picked. */
export interface Slot {
  id: string;
  /** ISO date, e.g. "2026-09-19" */
  date: string;
  /** "HH:MM" local time */
  start: string;
  /** hours, fractional allowed */
  duration: number;
}

export interface TicketPricing {
  /** null = free */
  eur: number | null;
  /** null = free. Required whenever `eur` is set. */
  tokens: number | null;
  /** Members get in without paying. */
  freeForMembers: boolean;
}

export type ContributionKind = "ticket" | "donation";
export type Currency = "eur" | "tokens";

export interface Contribution {
  id: string;
  kind: ContributionKind;
  currency: Currency;
  /** What the contributor handed over, before any fee. */
  grossAmount: number;
  /** Hub admin fee taken out of `grossAmount` (euro contributions only). */
  adminFee: number;
  /** What counts towards the funding target: grossAmount - adminFee. */
  netAmount: number;
  contributorId: string;
  contributorName: string;
  /** People count for a ticket; donations are 0. */
  seats: number;
  createdAt: string;
  /** Stripe session id, or the token transfer hash. */
  reference?: string;
  /** For token payments: where it came from, so a refund can go back there. */
  fromAddress?: string;
}

export interface Refund {
  id: string;
  contributionId: string;
  contributorId: string;
  contributorName: string;
  currency: Currency;
  amount: number;
  /** Stripe refund id, or the transfer hash. */
  reference?: string;
  explorerUrl?: string;
  createdAt: string;
}

export type RsvpState = "going" | "maybe" | "not_going";

export interface Rsvp {
  contributorId: string;
  name: string;
  state: RsvpState;
  seats: number;
  /** Set when the RSVP was paid for; free tickets have no contribution. */
  contributionId?: string;
  createdAt: string;
}

/** A picture someone attached to a comment. */
export interface Attachment {
  url: string;
  mime: string;
  name: string;
}

export interface ProposalComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  attachments?: Attachment[];
  createdAt: string;
}

/** A recorded revision, so the thread can show what changed between versions. */
export interface Revision {
  version: number;
  authorId: string;
  authorName: string;
  createdAt: string;
  changes: Array<{ field: string; from: string; to: string }>;
}

export interface Proposal {
  id: string;
  /** Human-facing, incremental: proposal #7. Also the short URL. */
  number: number;
  slug: string;
  version: number;
  status: ProposalStatus;

  title: string;
  pitch: string;
  description: string;

  slots: Slot[];
  /** Set once a slot has been picked. */
  confirmedSlotId: string | null;
  /** Room slug, or null for "any room — you decide". */
  roomSlug: string | null;
  expectedPeople: number;
  audience: Audience;
  tickets: TicketPricing;

  /** Shared task list for what the event needs (see modules/tasks). */
  taskListId: string | null;

  proposerId: string;
  proposerName: string;
  createdAt: string;
  updatedAt: string;

  comments: ProposalComment[];
  contributions: Contribution[];
  refunds: Refund[];
  rsvps: Rsvp[];
  revisions: Revision[];

  /** Set when a steward confirms or declines. */
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

/** The shape accepted from the propose form. */
export interface ProposalDraft {
  title: string;
  pitch: string;
  description: string;
  slots: Array<Omit<Slot, "id">>;
  roomSlug: string | null;
  expectedPeople: number;
  audience: Audience;
  tickets: TicketPricing;
  needs: string[];
}
