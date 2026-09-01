/**
 * Members data types
 * Generated from data/{year}/{month}/members.json
 */

/**
 * Monetary amount with currency and precision
 * Use this type whenever storing monetary values
 */
export interface Amount {
  value: number;
  decimals: number;
  currency: string;
}

export interface MemberAccounts {
  emailHash: string;
  discord?: string | null;
  // Future: nostr?: string | null;
}

export interface MemberPayment {
  date: string;
  amount: Amount;
  status: "succeeded" | "pending" | "failed";
  url?: string; // Link to invoice/payment on Stripe or Odoo
}

export interface Member {
  id: string; // Stripe subscription ID (truncated) or Odoo order ID
  /**
   * Where the membership comes from. "funders" is a membership paid outside
   * both systems — a bank transfer, a grant, one someone gifted — listed by
   * hand in chb's settings/funders.json and covered until its expiry date.
   */
  source?: "stripe" | "odoo" | "funders";
  accounts: MemberAccounts;
  firstName: string;
  plan: "monthly" | "yearly";
  amount: Amount;
  interval: "month" | "year";
  status: "active" | "past_due" | "canceled" | "incomplete" | "trialing" | "unpaid" | "paused";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  latestPayment: MemberPayment | null;
  subscriptionUrl?: string; // Link to subscription on Stripe or Odoo
  createdAt: string;
  isOrganization?: boolean; // For Odoo non-profit memberships
}

export interface MembersSummary {
  totalMembers: number;
  activeMembers: number;
  monthlyMembers: number;
  yearlyMembers: number;
  mrr: Amount; // Monthly Recurring Revenue
}

export interface MembersFile {
  year: string;
  month: string;
  productId: string;
  generatedAt: string;
  summary: MembersSummary;
  members: Member[];
  /**
   * Set when this month's Odoo membership was reconstructed from a later
   * snapshot rather than captured while the month was current. Odoo's API
   * returns live state, not history, so a subscription cancelled before that
   * snapshot is missing entirely: a derived month can undercount, never
   * overcount. Present so a reader is never shown a reconstruction as if it
   * were an observation.
   */
  odooDerived?: boolean;
  odooDerivedFrom?: string;
}

/** One month of one member's standing, from their history file. */
export interface MemberHistoryMonth {
  month: string; // YYYY-MM
  source?: "stripe" | "odoo" | "funders";
  status: Member["status"];
  plan?: "monthly" | "yearly";
  amount: Amount;
  interval?: "month" | "year";
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  latestPayment?: MemberPayment | null;
  isOrganization?: boolean;
  /** This month was reconstructed rather than observed — see MembersFile. */
  derived?: boolean;
  derivedFrom?: string;
}

/**
 * One member's month-by-month history, as written by chb to
 * data/latest/generated/private/members/<memberId>.json.
 *
 * A month the member does not appear in is a month they were not a member, so
 * gaps in `months` are meaningful rather than missing data.
 */
export interface MemberHistory {
  schemaVersion: number;
  memberId: string; // the emailHash
  firstName?: string;
  discord?: string;
  createdAt?: string;
  firstMonth?: string;
  lastMonth?: string;
  monthsActive: number;
  generatedAt: string;
  months: MemberHistoryMonth[];
}
