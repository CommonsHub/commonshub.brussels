/**
 * Funding maths for event proposals.
 *
 * Every room has a price per hour in euros and a price per hour in tokens, so
 * a proposal's minimum contribution to the hub is simply the room rate times
 * the booked hours, expressed in both currencies. Contributors pick either
 * currency; a mix is fine because each contribution is counted as the fraction
 * of the target it covers, in the currency it was paid in.
 *
 * Euro transactions carry a 10% hub admin fee, on top of whatever the payment
 * processor charges. Token transactions carry no admin fee.
 */

import roomsData from "@/settings/rooms.json";

export const ADMIN_FEE_RATE = 0.1;

/**
 * "deducted" — the fee comes out of what the contributor pays, so a €10 ticket
 * puts €9 towards the target. "on_top" — the contributor pays €11 and the full
 * €10 counts. Deducted is the default; set HUB_ADMIN_FEE_MODE to switch.
 */
export type AdminFeeMode = "deducted" | "on_top";

export function adminFeeMode(): AdminFeeMode {
  return process.env.HUB_ADMIN_FEE_MODE === "on_top" ? "on_top" : "deducted";
}

interface RoomRecord {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  pricePerHour?: number;
  tokensPerHour?: number;
  heroImage?: string;
}

const rooms = (roomsData as { rooms: RoomRecord[] }).rooms;

export function getRoom(slug: string | null | undefined): RoomRecord | null {
  if (!slug) return null;
  return rooms.find((r) => r.slug === slug || r.id === slug) ?? null;
}

export function bookableRooms(): RoomRecord[] {
  return rooms.filter((r) => (r.pricePerHour ?? 0) > 0);
}

/** The smallest room that still fits the expected crowd. */
export function suggestRoom(expectedPeople: number): RoomRecord | null {
  const fitting = bookableRooms()
    .filter((r) => r.capacity >= expectedPeople)
    .sort((a, b) => a.capacity - b.capacity);
  return fitting[0] ?? null;
}

export interface FundingTarget {
  eur: number;
  tokens: number;
  hours: number;
  roomSlug: string | null;
  roomName: string | null;
  /** True when the room was guessed from the headcount rather than chosen. */
  estimated: boolean;
}

/**
 * What the hub needs for this proposal. When no room has been picked yet we
 * estimate with the smallest room that fits, and say so.
 */
export function fundingTarget(input: {
  roomSlug: string | null;
  hours: number;
  expectedPeople: number;
}): FundingTarget {
  const chosen = getRoom(input.roomSlug);
  const room = chosen ?? suggestRoom(input.expectedPeople);
  const hours = Math.max(0, input.hours);

  if (!room) {
    return { eur: 0, tokens: 0, hours, roomSlug: null, roomName: null, estimated: true };
  }

  return {
    eur: round2((room.pricePerHour ?? 0) * hours),
    tokens: round2((room.tokensPerHour ?? 0) * hours),
    hours,
    roomSlug: room.slug,
    roomName: room.name,
    estimated: !chosen,
  };
}

/** Total booked hours: the confirmed slot if there is one, else the longest option. */
export function bookedHours(
  slots: Array<{ id: string; duration: number }>,
  confirmedSlotId: string | null,
): number {
  if (!slots.length) return 0;
  if (confirmedSlotId) {
    const slot = slots.find((s) => s.id === confirmedSlotId);
    if (slot) return slot.duration;
  }
  return Math.max(...slots.map((s) => s.duration));
}

export interface FeeBreakdown {
  /** What the contributor is charged. */
  charged: number;
  /** The hub's 10% admin fee. */
  adminFee: number;
  /** What counts towards the funding target. */
  net: number;
}

/**
 * Split a euro contribution into the admin fee and the part that funds the
 * event. `amount` is the headline amount — the ticket price or the donation
 * the contributor typed in.
 */
export function splitEuroContribution(amount: number): FeeBreakdown {
  const value = Math.max(0, amount);
  if (adminFeeMode() === "on_top") {
    const adminFee = round2(value * ADMIN_FEE_RATE);
    return { charged: round2(value + adminFee), adminFee, net: round2(value) };
  }
  const adminFee = round2(value * ADMIN_FEE_RATE);
  return { charged: round2(value), adminFee, net: round2(value - adminFee) };
}

/** Token contributions have no admin fee. */
export function splitTokenContribution(amount: number): FeeBreakdown {
  const value = Math.max(0, amount);
  return { charged: value, adminFee: 0, net: value };
}

export interface FundingProgress {
  target: FundingTarget;
  raisedEur: number;
  raisedTokens: number;
  adminFeesEur: number;
  /** 0–1+, how much of the target is covered across both currencies. */
  coverage: number;
  /** What is still missing, if the rest came in one currency. */
  remainingEur: number;
  remainingTokens: number;
  funded: boolean;
  contributorCount: number;
}

/**
 * Add up contributions against the target. A euro contribution covers
 * `net / target.eur` of the target and a token contribution covers
 * `amount / target.tokens`, so any mix of the two adds up to 1 when the room
 * is paid for.
 */
export function fundingProgress(
  target: FundingTarget,
  contributions: Array<{
    currency: "eur" | "tokens";
    netAmount: number;
    adminFee: number;
    contributorId: string;
  }>,
): FundingProgress {
  let raisedEur = 0;
  let raisedTokens = 0;
  let adminFeesEur = 0;
  const contributors = new Set<string>();

  for (const c of contributions) {
    contributors.add(c.contributorId);
    if (c.currency === "eur") {
      raisedEur += c.netAmount;
      adminFeesEur += c.adminFee;
    } else {
      raisedTokens += c.netAmount;
    }
  }

  const eurShare = target.eur > 0 ? raisedEur / target.eur : 0;
  const tokenShare = target.tokens > 0 ? raisedTokens / target.tokens : 0;
  // A target of zero (free room) is covered by definition.
  const coverage = target.eur === 0 && target.tokens === 0 ? 1 : eurShare + tokenShare;
  const missing = Math.max(0, 1 - coverage);

  return {
    target,
    raisedEur: round2(raisedEur),
    raisedTokens: round2(raisedTokens),
    adminFeesEur: round2(adminFeesEur),
    coverage,
    remainingEur: round2(target.eur * missing),
    remainingTokens: round2(target.tokens * missing),
    funded: coverage >= 1,
    contributorCount: contributors.size,
  };
}

/**
 * How many tickets still need to sell, at the current price, to close the gap.
 * Returns null for free events — they can only be funded by donations.
 */
export function ticketsToGo(
  progress: FundingProgress,
  tickets: { eur: number | null; tokens: number | null },
): number | null {
  if (progress.funded) return 0;
  if (tickets.eur && tickets.eur > 0) {
    const perTicket = splitEuroContribution(tickets.eur).net;
    if (perTicket > 0) return Math.ceil(progress.remainingEur / perTicket);
  }
  if (tickets.tokens && tickets.tokens > 0) {
    return Math.ceil(progress.remainingTokens / tickets.tokens);
  }
  return null;
}

/**
 * The suggested token price for a ticket priced in euros, using this room's own
 * euro/token ratio (Ostrom is €100/h and 3 tokens/h, so €10 suggests 0.3 → 0.5
 * after rounding up to the nearest half token).
 */
export function suggestTokenPrice(eurPrice: number, roomSlug: string | null): number | null {
  const room = getRoom(roomSlug);
  if (!room || !room.pricePerHour || !room.tokensPerHour) return null;
  const ratio = room.tokensPerHour / room.pricePerHour;
  const raw = eurPrice * ratio;
  return Math.max(0.5, Math.ceil(raw * 2) / 2);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("en-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatTokens(n: number): string {
  const value = n % 1 === 0 ? n.toString() : n.toFixed(1);
  return `${value} token${n === 1 ? "" : "s"}`;
}
