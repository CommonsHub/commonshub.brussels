import settings from "@/settings/settings.json";

export interface AccountFilterSource {
  accountSlug?: string | null;
  accountId?: string | null;
}

export function parseMultiFilterParam(value: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function encodeMultiFilterParam(values: string[]): string | null {
  const filtered = values.map((item) => item.trim()).filter(Boolean);
  return filtered.length > 0 ? filtered.join(",") : null;
}

export function toggleMultiFilterValue(
  selectedValues: string[],
  value: string
): string[] {
  if (selectedValues.includes(value)) {
    return selectedValues.filter((item) => item !== value);
  }
  return [...selectedValues, value];
}

export function valueMatchesMultiFilter(
  value: string | null | undefined,
  selectedValues: string[]
): boolean {
  return selectedValues.length === 0 || (!!value && selectedValues.includes(value));
}

function normalizeId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function ethereumAccountId(chain: string | undefined, address: string | undefined) {
  if (!chain || !address) return null;
  return `ethereum:${chain}:address:${address}`.toLowerCase();
}

function stripeAccountId(accountId: string | undefined) {
  if (!accountId) return null;
  return accountId.startsWith("stripe:")
    ? accountId.toLowerCase()
    : `stripe:${accountId}`.toLowerCase();
}

const ACCOUNT_SLUG_BY_ID = new Map<string, string>();
const CONFIGURED_ACCOUNT_SLUGS = new Set<string>();

for (const account of (settings.finance as any).accounts || []) {
  if (!account?.slug) continue;
  CONFIGURED_ACCOUNT_SLUGS.add(account.slug);

  const stripeId = stripeAccountId(account.accountId);
  if (stripeId) ACCOUNT_SLUG_BY_ID.set(stripeId, account.slug);

  const ethId = ethereumAccountId(account.chain, account.address);
  if (ethId) ACCOUNT_SLUG_BY_ID.set(ethId, account.slug);

  const rawAddress = normalizeId(account.address);
  if (rawAddress) ACCOUNT_SLUG_BY_ID.set(rawAddress, account.slug);
}

export function accountFilterSlug(tx: AccountFilterSource): string | null {
  const accountId = normalizeId(tx.accountId);
  if (accountId) {
    const byAccountId = ACCOUNT_SLUG_BY_ID.get(accountId);
    if (byAccountId) return byAccountId;
  }

  const accountSlug = tx.accountSlug?.trim();
  if (!accountSlug) return null;

  if (CONFIGURED_ACCOUNT_SLUGS.has(accountSlug)) return accountSlug;

  const normalizedSlug = normalizeId(accountSlug);
  if (!normalizedSlug) return null;

  const asStripeId = normalizedSlug.startsWith("acct_")
    ? `stripe:${normalizedSlug}`
    : normalizedSlug;
  const bySlugAsId = ACCOUNT_SLUG_BY_ID.get(asStripeId);
  if (bySlugAsId) return bySlugAsId;

  return accountSlug;
}
