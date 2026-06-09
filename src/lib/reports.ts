/**
 * Report aggregation functions for yearly and monthly reports
 * Aggregates data from Discord messages and financial transactions
 */

import * as fs from "fs";
import * as path from "path";
import settings from "@/settings/settings.json";
import type { CachedMessage } from "./discord-cache";
import { getLocalImagePath } from "./discord-cache";
import { getProxiedImageUrl } from "./image-proxy";
import { DATA_DIR } from "./data-paths";
import type { Transaction as ConsolidatedTx } from "@/types/transactions";
import {
  readMonthlyTransactions,
  tagValue,
  txDirection,
  isInternalTransfer,
  type Direction,
} from "./transactions";
import { addressFromUri } from "./nip73";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ========== Type Definitions ==========

export interface UserInfo {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

export interface PopularPhoto {
  url: string;
  proxyUrl: string;
  id: string;
  author: UserInfo;
  reactions: Array<{ emoji: string; count: number; me?: boolean }>;
  totalReactions: number;
  message: string;
  timestamp: string;
  channelId: string;
  messageId: string;
}

export interface TokenData {
  minted: number;
  burnt: number;
  net: number;
  transactionCount: number;
  activeAccounts: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface BalanceData {
  opening: number | null;
  closing: number | null;
}

export interface FinancialData {
  income: number;
  expenses: number;
  net: number;
  tokens: TokenData;
  balance: BalanceData;
  byCategory: BreakdownRow[];
  byCollective: BreakdownRow[];
  byAccount: Array<{
    slug: string;
    name: string;
    provider: string;
    income: number;
    expenses: number;
    net: number;
  }>;
}

export interface MonthlyReportData {
  year: string;
  month: string;
  activeMembers: {
    count: number;
    userIds: string[];
    users: UserInfo[];
  };
  photos: PopularPhoto[];
  financials: FinancialData;
}

export interface YearlyReportData {
  year: string;
  activeMembers: {
    count: number;
    userIds: string[];
    users: UserInfo[];
  };
  photos: PopularPhoto[];
  financials: {
    totalIncome: number;
    totalExpenses: number;
    net: number;
    totalTokensMinted: number;
    totalTokensBurnt: number;
    balance: BalanceData;
    byCategory: BreakdownRow[];
    byCollective: BreakdownRow[];
    byAccount: BreakdownRow[];
    monthlyBreakdown: Array<{
      month: string;
      income: number;
      expenses: number;
      activeMembers: number;
      tokensMinted: number;
      tokensBurnt: number;
    }>;
  };
  months: string[];
}

// ========== File System Utilities ==========

/**
 * Get all available years with data
 * @param excludeFuture - If true, exclude years in the future (default: true for UI display)
 */
export function getAvailableYears(excludeFuture: boolean = true): string[] {
  try {
    if (!fs.existsSync(DATA_DIR)) return [];

    let years = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    // Filter out future years if requested
    if (excludeFuture) {
      const currentYear = new Date().getFullYear();
      years = years.filter((year) => parseInt(year, 10) <= currentYear);
    }

    return years;
  } catch (error) {
    console.error("Error reading available years:", error);
    return [];
  }
}

/**
 * Get all available months with data for a specific year
 * @param year - The year to get months for
 * @param excludeFuture - If true, exclude months in the future (default: false)
 */
export function getAvailableMonths(year: string, excludeFuture: boolean = false): string[] {
  try {
    const yearPath = path.join(DATA_DIR, year);
    if (!fs.existsSync(yearPath)) return [];

    let months = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    // Filter out future months if requested
    if (excludeFuture) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-indexed

      months = months.filter((month) => {
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);

        // Keep months that are in the past or current
        if (yearNum < currentYear) return true;
        if (yearNum > currentYear) return false;
        // Same year - compare months
        return monthNum <= currentMonth;
      });
    }

    return months;
  } catch (error) {
    console.error(`Error reading available months for ${year}:`, error);
    return [];
  }
}

// ========== Discord Data Functions ==========

/**
 * Read photos from pre-generated yearly images.json file
 * These files are generated by the external data-sync process and contain all photos for the year
 */
export function readYearlyImages(year: string): PopularPhoto[] {
  const imagesPath = path.join(DATA_DIR, year, "generated", "images.json");

  if (!fs.existsSync(imagesPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content) as {
      images: Array<{
        url: string;
        proxyUrl: string;
        id: string;
        author: {
          id: string;
          username: string;
          displayName: string | null;
          avatar: string | null;
        };
        reactions: Array<{ emoji: string; count: number; me?: boolean }>;
        totalReactions: number;
        message: string;
        timestamp: string;
        channelId: string;
        messageId: string;
      }>;
    };

    // Map to PopularPhoto format (remove 'me' from reactions)
    return (data.images || []).map((img) => ({
      url: img.url,
      proxyUrl: img.proxyUrl,
      id: img.id,
      author: img.author,
      reactions: (img.reactions || []).map((r) => ({ emoji: r.emoji, count: r.count, me: r.me ?? false })),
      totalReactions: img.totalReactions,
      message: img.message,
      timestamp: img.timestamp,
      channelId: img.channelId,
      messageId: img.messageId,
    }));
  } catch (error) {
    console.error(`Error reading yearly images.json for ${year}:`, error);
    return [];
  }
}

/**
 * Read photos from pre-generated images.json file for a specific month
 * These files are generated by the external data-sync process and contain processed photo data
 */
export function readGeneratedImages(year: string, month: string): PopularPhoto[] {
  const imagesPath = path.join(DATA_DIR, year, month, "generated", "images.json");

  if (!fs.existsSync(imagesPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content) as {
      images: Array<{
        url: string;
        proxyUrl: string;
        id: string;
        author: {
          id: string;
          username: string;
          displayName: string | null;
          avatar: string | null;
        };
        reactions: Array<{ emoji: string; count: number; me?: boolean }>;
        totalReactions: number;
        message: string;
        timestamp: string;
        channelId: string;
        messageId: string;
      }>;
    };

    // Map to PopularPhoto format (remove 'me' from reactions)
    return (data.images || []).map((img) => ({
      url: img.url,
      proxyUrl: img.proxyUrl,
      id: img.id,
      author: img.author,
      reactions: (img.reactions || []).map((r) => ({ emoji: r.emoji, count: r.count, me: r.me ?? false })),
      totalReactions: img.totalReactions,
      message: img.message,
      timestamp: img.timestamp,
      channelId: img.channelId,
      messageId: img.messageId,
    }));
  } catch (error) {
    console.error(`Error reading images.json for ${year}-${month}:`, error);
    return [];
  }
}

/**
 * Read all Discord messages for a specific month
 */
export function readDiscordMessages(
  year: string,
  month: string
): CachedMessage[] {
  const discordDir = path.join(DATA_DIR, year, month, "sources", "discord");

  if (!fs.existsSync(discordDir)) {
    return [];
  }

  const allMessages: CachedMessage[] = [];

  try {
    // Get all channel directories
    const channelDirs = fs
      .readdirSync(discordDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const channelId of channelDirs) {
      const messagesPath = path.join(discordDir, channelId, "messages.json");

      if (!fs.existsSync(messagesPath)) continue;

      const content = fs.readFileSync(messagesPath, "utf-8");
      const data = JSON.parse(content) as { messages: CachedMessage[] };

      if (data.messages && Array.isArray(data.messages)) {
        // Add channel_id to each message
        const messagesWithChannel = data.messages.map((msg) => ({
          ...msg,
          channel_id: channelId,
        }));
        allMessages.push(...messagesWithChannel);
      }
    }
  } catch (error) {
    console.error(
      `Error reading Discord messages for ${year}-${month}:`,
      error
    );
  }

  return allMessages;
}

/**
 * Get active members from messages (authors + mentioned users)
 */
export function getActiveMembers(messages: CachedMessage[]): {
  count: number;
  userIds: string[];
  users: UserInfo[];
} {
  const userMap = new Map<string, UserInfo>();

  for (const msg of messages) {
    // Add message author
    userMap.set(msg.author.id, {
      id: msg.author.id,
      username: msg.author.username,
      displayName: msg.author.global_name,
      avatar: msg.author.avatar,
    });

    // Add mentioned users
    if (msg.mentions && Array.isArray(msg.mentions)) {
      for (const mention of msg.mentions) {
        userMap.set(mention.id, {
          id: mention.id,
          username: mention.username,
          displayName: mention.global_name,
          avatar: mention.avatar,
        });
      }
    }
  }

  const users = Array.from(userMap.values());

  return {
    count: users.length,
    userIds: users.map((u) => u.id),
    users,
  };
}

function readGeneratedActiveMembers(
  year: string,
  month: string
): {
  count: number;
  userIds: string[];
  users: UserInfo[];
} | null {
  const contributorsFile = path.join(
    DATA_DIR,
    year,
    month,
    "generated",
    "contributors.json"
  );

  if (!fs.existsSync(contributorsFile)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(contributorsFile, "utf-8")) as {
      summary?: { totalContributors?: number };
      contributors?: Array<{
        id: string;
        profile?: {
          username?: string;
          name?: string;
          avatar_url?: string | null;
        };
      }>;
      users?: Array<{
        id: string;
        username?: string;
        displayName?: string | null;
        avatar?: string | null;
      }>;
    };

    const contributors = data.contributors ?? [];
    if (contributors.length > 0) {
      const users = contributors
        .filter((contributor) => contributor.id)
        .map((contributor) => ({
          id: contributor.id,
          username: contributor.profile?.username || contributor.id,
          displayName:
            contributor.profile?.name ||
            contributor.profile?.username ||
            contributor.id,
          avatar: contributor.profile?.avatar_url || null,
        }));

      return {
        count: data.summary?.totalContributors ?? users.length,
        userIds: users.map((user) => user.id),
        users,
      };
    }

    const legacyUsers = data.users ?? [];
    if (legacyUsers.length > 0) {
      const users = legacyUsers
        .filter((user) => user.id)
        .map((user) => ({
          id: user.id,
          username: user.username || user.id,
          displayName: user.displayName || user.username || user.id,
          avatar: user.avatar || null,
        }));

      return {
        count: data.summary?.totalContributors ?? users.length,
        userIds: users.map((user) => user.id),
        users,
      };
    }
  } catch (error) {
    console.error(
      `Error reading generated contributors for ${year}-${month}:`,
      error
    );
  }

  return null;
}

/**
 * Get popular photos ranked by reaction count
 */
export function getPopularPhotos(
  messages: CachedMessage[],
  limit: number = 12,
  options?: { relative?: boolean }
): PopularPhoto[] {
  const photos: PopularPhoto[] = [];

  for (const msg of messages) {
    // Only include Discord attachments (uploaded images), not external embed images
    const imageAttachments =
      msg.attachments?.filter(
        (att) =>
          att.content_type?.startsWith("image/") ||
          att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) || [];

    // Skip if no image attachments
    if (imageAttachments.length === 0) continue;

    // Get image URL from attachment - prefer local path if available
    const attachment = imageAttachments[0];
    const localPath = getLocalImagePath(
      attachment.id,
      attachment.url,
      msg.timestamp
    );
    const imageUrl = localPath || attachment.url;
    if (!imageUrl) continue;

    // Calculate total reactions with weighted stars (⭐ = 3x weight)
    const reactions = msg.reactions || [];
    const totalReactions = reactions.reduce((sum, r) => {
      // Check if emoji is a star (⭐ or star)
      const isStarEmoji =
        r.emoji.name === "⭐" ||
        r.emoji.name === "star" ||
        r.emoji.name === "⭐️";
      const weight = isStarEmoji ? 3 : 1;
      return sum + r.count * weight;
    }, 0);

    const proxyUrl = getProxiedImageUrl(imageUrl, undefined, options);

    photos.push({
      url: proxyUrl,
      proxyUrl: proxyUrl,
      id: attachment.id,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        displayName: msg.author.global_name,
        avatar: msg.author.avatar,
      },
      reactions: reactions.map((r) => ({
        emoji: r.emoji.name,
        count: r.count,
        me: r.me || false,
      })),
      totalReactions,
      message: msg.content,
      timestamp: msg.timestamp,
      channelId: msg.channel_id || "",
      messageId: msg.id,
    });
  }

  // Sort by total reactions (descending) and take top N
  return photos
    .sort((a, b) => b.totalReactions - a.totalReactions)
    .slice(0, limit);
}

/**
 * Get all photos in reverse chronological order (newest first)
 */
export function getAllPhotos(
  messages: CachedMessage[],
  options?: { relative?: boolean }
): PopularPhoto[] {
  const photos: PopularPhoto[] = [];

  for (const msg of messages) {
    // Only include Discord attachments (uploaded images), not external embed images
    const imageAttachments =
      msg.attachments?.filter(
        (att) =>
          att.content_type?.startsWith("image/") ||
          att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) || [];

    // Skip if no image attachments
    if (imageAttachments.length === 0) continue;

    // Calculate total reactions with weighted stars (⭐ = 3x weight)
    const reactions = msg.reactions || [];
    const totalReactions = reactions.reduce((sum, r) => {
      // Check if emoji is a star (⭐ or star)
      const isStarEmoji =
        r.emoji.name === "⭐" ||
        r.emoji.name === "star" ||
        r.emoji.name === "⭐️";
      const weight = isStarEmoji ? 3 : 1;
      return sum + r.count * weight;
    }, 0);

    // Process ALL image attachments, not just the first one
    for (const attachment of imageAttachments) {
      // Get image URL from attachment - prefer local path if available
      const localPath = getLocalImagePath(
        attachment.id,
        attachment.url,
        msg.timestamp
      );
      const imageUrl = localPath || attachment.url;
      if (!imageUrl) continue;

      const proxyUrl = getProxiedImageUrl(imageUrl, undefined, options);

      photos.push({
        url: proxyUrl,
        proxyUrl: proxyUrl,
        id: attachment.id,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          displayName: msg.author.global_name,
          avatar: msg.author.avatar,
        },
        reactions: reactions.map((r) => ({
          emoji: r.emoji.name,
          count: r.count,
          me: r.me || false,
        })),
        totalReactions,
        message: msg.content,
        timestamp: msg.timestamp,
        channelId: msg.channel_id || "",
        messageId: msg.id,
      });
    }
  }

  // Sort by timestamp (descending - newest first)
  return photos.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ========== Message Visibility Functions ==========

export interface UserSession {
  userId?: string;
  roles?: string[];
}

/**
 * Check if a message is less than one week old
 */
export function isMessageRecent(timestamp: string): boolean {
  const messageDate = new Date(timestamp);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return messageDate > oneWeekAgo;
}

/**
 * Check if user has the member role
 */
export function isUserMember(session: UserSession | null): boolean {
  if (!session || !session.roles) return false;
  const memberRoleId = settings.discord.roles.member;
  return session.roles.includes(memberRoleId);
}

/**
 * Check if user is an admin
 */
export function isUserAdmin(session: UserSession | null): boolean {
  if (!session || !session.roles) return false;
  // Check for admin or moderator roles (if configured in settings)
  const roles = settings.discord.roles as Record<string, string>;
  const adminRoles = [roles.admin, roles.moderator].filter(Boolean);

  // If no admin roles configured, no one is admin
  if (adminRoles.length === 0) return false;

  return session.roles.some((role) => adminRoles.includes(role));
}

/**
 * Check if user is the author of a message
 */
export function isMessageAuthor(
  message: CachedMessage,
  session: UserSession | null
): boolean {
  if (!session || !session.userId) return false;
  return message.author.id === session.userId;
}

/**
 * Check if user is mentioned in a message
 */
export function isUserMentioned(
  message: CachedMessage,
  session: UserSession | null
): boolean {
  if (!session || !session.userId) return false;
  if (!message.mentions || !Array.isArray(message.mentions)) return false;
  return message.mentions.some((mention) => mention.id === session.userId);
}

/**
 * Check if a message has the remove emoji (❌)
 */
export function hasRemoveEmoji(message: CachedMessage): boolean {
  if (!message.reactions || !Array.isArray(message.reactions)) return false;
  return message.reactions.some(
    (r) =>
      r.emoji.name === "❌" || r.emoji.name === "x" || r.emoji.name === "❎"
  );
}

/**
 * Check if a message should be visible to the user
 */
export function isMessageVisible(
  message: CachedMessage,
  session: UserSession | null
): boolean {
  const isAdmin = isUserAdmin(session);
  const isMember = isUserMember(session);
  const isAuthor = isMessageAuthor(message, session);
  const isMentioned = isUserMentioned(message, session);
  const isRemoved = hasRemoveEmoji(message);
  const isRecent = isMessageRecent(message.timestamp);

  // If message is removed (has ❌ emoji)
  if (isRemoved) {
    // Only show to admin, author, or mentioned users
    return isAdmin || isAuthor || isMentioned;
  }

  // If message is recent (< 1 week old)
  if (isRecent) {
    // Only show to members (or admins who are also members)
    return isMember;
  }

  // Otherwise, message is visible to everyone
  return true;
}

/**
 * Filter messages based on visibility rules
 */
export function filterVisibleMessages(
  messages: CachedMessage[],
  session: UserSession | null
): CachedMessage[] {
  return messages.filter((msg) => isMessageVisible(msg, session));
}

/**
 * Filter photos based on their parent message visibility
 */
export function filterVisiblePhotos(
  photos: PopularPhoto[],
  messages: CachedMessage[],
  session: UserSession | null
): PopularPhoto[] {
  // Create a map of message visibility
  const messageVisibility = new Map<string, boolean>();

  for (const msg of messages) {
    messageVisibility.set(msg.id, isMessageVisible(msg, session));
  }

  // Filter photos whose parent messages are visible
  return photos.filter((photo) => {
    const isVisible = messageVisibility.get(photo.messageId);
    return isVisible === true;
  });
}

// ========== Financial Data Functions ==========

function legacyTokenWideAddresses(tx: ConsolidatedTx): { from?: string; to?: string } | null {
  const legacy = tx as ConsolidatedTx & {
    account?: string | null;
    counterparty?: string | null;
    txHash?: string | null;
  };
  if (tx.provider !== "etherscan" || tx.accountId || tx.counterpartyId) return null;
  if (!tx.chain || tx.accountSlug !== tx.chain) return null;

  const tokenContract = normaliseAddress(legacy.account);
  const counterparty = normaliseAddress(legacy.counterparty);
  if (!tokenContract || !counterparty) return null;
  const isKnownFinanceAccount = settings.finance.accounts.some((account) =>
    "address" in account && typeof account.address === "string" && account.address.toLowerCase() === tokenContract
  );
  if (isKnownFinanceAccount) return null;

  // Legacy generated token-wide rows stored the token contract in `account`
  // and the non-contract side in `counterparty`. For zero-address rows that
  // means: counterparty=0x0 is a mint; otherwise it is a burn from the
  // counterparty to 0x0. New CHB output carries accountId/counterpartyId and
  // MINT/BURN types, so this is only a compatibility shim for old /data.
  if (counterparty === ZERO_ADDRESS.toLowerCase()) {
    return { from: ZERO_ADDRESS.toLowerCase(), to: tokenContract };
  }
  return { from: counterparty, to: ZERO_ADDRESS.toLowerCase() };
}

function txFromAddress(tx: ConsolidatedTx): string | undefined {
  const tagged = tagValue(tx, "from");
  if (tagged) return tagged.toLowerCase();
  const legacy = legacyTokenWideAddresses(tx);
  if (legacy) return legacy.from;
  if (tx.type === "MINT") return ZERO_ADDRESS.toLowerCase();
  const accountAddr = txAccountAddress(tx);
  if (tx.type === "BURN") return accountAddr;
  const dir = txDirection(tx);
  const cpAddr = txCounterpartyAddress(tx);
  return (dir === "CREDIT" ? cpAddr : accountAddr) ?? undefined;
}

function txToAddress(tx: ConsolidatedTx): string | undefined {
  const tagged = tagValue(tx, "to");
  if (tagged) return tagged.toLowerCase();
  const legacy = legacyTokenWideAddresses(tx);
  if (legacy) return legacy.to;
  const accountAddr = txAccountAddress(tx);
  if (tx.type === "MINT") return accountAddr;
  if (tx.type === "BURN") return ZERO_ADDRESS.toLowerCase();
  const dir = txDirection(tx);
  const cpAddr = txCounterpartyAddress(tx);
  return (dir === "CREDIT" ? accountAddr : cpAddr) ?? undefined;
}

function normaliseAddress(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const fromUri = addressFromUri(value);
  const address = fromUri || value;
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : undefined;
}

function txAccountAddress(tx: ConsolidatedTx): string | undefined {
  const legacy = tx as ConsolidatedTx & { account?: string | null };
  return normaliseAddress(tx.accountId) ?? normaliseAddress(legacy.account);
}

function txCounterpartyAddress(tx: ConsolidatedTx): string | undefined {
  const legacy = tx as ConsolidatedTx & { counterparty?: string | null };
  return normaliseAddress(tx.counterpartyId) ?? normaliseAddress(legacy.counterparty);
}

type FinanceAccount = (typeof settings.finance.accounts)[number];

function txFinanceAccount(tx: ConsolidatedTx): FinanceAccount | undefined {
  const legacy = tx as ConsolidatedTx & { account?: string | null };
  const ids = [tx.accountSlug, tx.accountId, legacy.account]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => v.toLowerCase());
  const accountAddress = txAccountAddress(tx);

  return settings.finance.accounts.find((account) => {
    if (ids.includes(account.slug.toLowerCase())) return true;
    if ("accountId" in account && typeof account.accountId === "string") {
      if (ids.includes(account.accountId.toLowerCase())) return true;
    }
    if ("address" in account && typeof account.address === "string") {
      if (accountAddress === account.address.toLowerCase()) return true;
    }
    return false;
  });
}

function txMetadata(tx: ConsolidatedTx): NonNullable<ConsolidatedTx["metadata"]> {
  return (tx.metadata ?? {}) as NonNullable<ConsolidatedTx["metadata"]>;
}

function collectiveLabel(key: string): string {
  const collectives = settings.finance.collectives as Record<string, { name?: string }>;
  return collectives[key]?.name || key;
}

const MAIN_CATEGORY_LABELS: Record<string, string> = {
  rental: "Rentals",
  membership: "Memberships",
  donation: "Donations",
  ticket: "Tickets & events",
  coworking: "Coworking",
  service: "Services",
  catering: "Catering",
  rent: "Rent",
  consulting: "Consulting",
  tax: "Taxes",
  fee: "Fees",
  food_drinks: "Food & drinks",
  utilities: "Utilities",
  insurance: "Insurance",
  equipment: "Equipment",
  furniture: "Furniture",
  consumable: "Consumables",
  refund: "Refunds",
  uncategorized_bank_payment: "Uncategorized bank payments",
  other_income: "Other income",
  other_expense: "Other expenses",
};

function isStripePayout(tx: ConsolidatedTx): boolean {
  const metadata = txMetadata(tx);
  return tx.provider === "stripe" && String(metadata.category || "").toLowerCase() === "payout";
}

function isUnmemoedMoneriumBurn(tx: ConsolidatedTx, direction: Direction): boolean {
  if (direction !== "DEBIT" || tx.provider !== "etherscan" || tx.currency !== "EURe") return false;
  const metadata = txMetadata(tx);
  if (metadata.category || metadata.description || metadata.collective) return false;
  return txToAddress(tx) === ZERO_ADDRESS.toLowerCase();
}

function knownBankPaymentCategory(tx: ConsolidatedTx, direction: Direction): { key: string; label: string } | null {
  if (!isUnmemoedMoneriumBurn(tx, direction)) return null;

  // Monerium redemptions to IBANs are represented on-chain as burns to 0x0.
  // If CHB generate applied a semantic rule, metadata.category/collective will
  // be present and is handled by mainCategoryFor below. Rows that still have no
  // generated semantic metadata remain visible as uncategorized bank payments
  // instead of being hidden in a generic "other" bucket.
  return { key: "uncategorized_bank_payment", label: MAIN_CATEGORY_LABELS.uncategorized_bank_payment };
}

function mainCategoryFor(tx: ConsolidatedTx, direction: Direction): { key: string; label: string } {
  const knownBankPayment = knownBankPaymentCategory(tx, direction);
  if (knownBankPayment) return knownBankPayment;

  const metadata = txMetadata(tx);
  const rawCategory = String(metadata.category || "other").toLowerCase();
  const description = String(metadata.description || tx.counterpartyId || "").toLowerCase();
  const text = `${rawCategory} ${description}`;
  const account = txFinanceAccount(tx);
  const hasSemanticMetadata = Boolean(metadata.category || metadata.description || metadata.collective);

  let key: string | undefined;
  if (/member|membership|subscription|shifter/.test(text)) key = "membership";
  else if (/rental|rentals|room rental|space rental|venue|booking|chb\/\d{4}\//.test(text)) key = "rental";
  else if (/donation|financial contribution|contribution/.test(text)) key = "donation";
  else if (/ticket|tickets|luma|event|workshop|gathering|conference/.test(text)) key = "ticket";
  else if (/cowork/.test(text)) key = "coworking";
  else if (/service|sponsorship/.test(text) && direction === "CREDIT") key = "service";
  else if (/top[ -]?up|cater|food|drink|lunch|dinner|restaurant|bakery|colruyt|delhaize|bio-planet/.test(text)) key = direction === "CREDIT" ? "food_drinks" : "catering";
  else if (/wolugo|office rent|lease|landlord|loyer|\brent\b/.test(text) && direction === "DEBIT") key = "rent";
  else if (/consult|freelance|contractor/.test(text)) key = "consulting";
  else if (/tax|vat|automatic tax|imp[oô]t|précompte/.test(text)) key = "tax";
  else if (/fee|stripe|billing|usage fee|bank fee/.test(text)) key = "fee";
  else if (/utilit|energy|electric|water|internet|telecom|proximus|engie/.test(text)) key = "utilities";
  else if (/insurance|assur/.test(text)) key = "insurance";
  else if (/furniture|ikea|chair|desk|table|sofa|shelf|shelving/.test(text)) key = "furniture";
  else if (/equipment|hardware|computer|screen|monitor|cable|tool/.test(text)) key = "equipment";
  else if (/refund/.test(text)) key = "refund";
  else if (direction === "CREDIT" && account && ["fridge", "coffee"].includes(account.slug)) key = "food_drinks";
  else if (direction === "DEBIT" && account && ["fridge", "coffee"].includes(account.slug)) key = "catering";
  else if (direction === "CREDIT" && tx.provider === "stripe" && rawCategory === "charge") key = "ticket";
  else if (direction === "CREDIT" && tx.provider === "etherscan" && tx.currency === "EURe" && !hasSemanticMetadata) {
    // Legacy Monerium/EURe bank credits do not carry invoice memos in the
    // generated transaction rows. In practice these are the invoiced room/event
    // rental payments; membership/donation/coworking income is tagged by Stripe
    // descriptions above. Keep this website-side compatibility layer until the
    // generated data contains semantic bank-transfer metadata.
    key = "rental";
  }
  else if (MAIN_CATEGORY_LABELS[rawCategory]) key = rawCategory;
  else key = direction === "CREDIT" ? "other_income" : "other_expense";

  return { key, label: MAIN_CATEGORY_LABELS[key] || key };
}

function addBreakdown(
  map: Map<string, BreakdownRow>,
  key: string,
  label: string,
  direction: Direction,
  value: number
) {
  const existing = map.get(key) ?? { key, label, income: 0, expenses: 0, net: 0 };
  if (direction === "CREDIT") existing.income += value;
  else existing.expenses += value;
  existing.net = existing.income - existing.expenses;
  map.set(key, existing);
}

function sortedBreakdown<T extends BreakdownRow>(map: Map<string, T>): T[] {
  return Array.from(map.values()).sort(
    (a, b) => Math.abs(b.income) + Math.abs(b.expenses) - (Math.abs(a.income) + Math.abs(a.expenses))
  );
}

function transactionExternalValue(tx: ConsolidatedTx): number | null {
  if (!txFinanceAccount(tx)) return null;
  if (isInternalTransfer(tx)) return null;
  if (isStripePayout(tx)) return null;
  if (tx.type === "TRANSFER") return null;
  const value = tx.provider === "stripe" ? Math.abs(tx.normalizedAmount) : Math.abs(tx.amount);
  return txDirection(tx) === "CREDIT" ? value : -value;
}

function calculateExternalDelta(year: string, month: string): number {
  return readMonthlyTransactions(year, month).reduce((sum, tx) => {
    const value = transactionExternalValue(tx);
    return value == null ? sum : sum + value;
  }, 0);
}

function latestFiatBalance(): number | null {
  const filePath = path.join(DATA_DIR, "latest", "balances.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { balances?: Record<string, number> };
    const balances = data.balances ?? {};
    let total = 0;
    let seen = false;
    for (const account of settings.finance.accounts) {
      const keys: string[] = [account.slug.toLowerCase()];
      if ("accountId" in account && typeof account.accountId === "string") keys.push(account.accountId.toLowerCase());
      if ("address" in account && typeof account.address === "string") {
        keys.push(account.address.toLowerCase());
        // chb writes balances under chain-prefixed keys (e.g. "gnosis:0x…").
        if ("chain" in account && typeof account.chain === "string") {
          keys.push(`${account.chain}:${account.address}`.toLowerCase());
        }
      }
      for (const key of keys) {
        if (typeof balances[key] === "number") {
          total += balances[key];
          seen = true;
          break;
        }
      }
    }
    return seen ? total : null;
  } catch (error) {
    console.error("Error reading latest balances.json:", error);
    return null;
  }
}

function allAvailableYearMonths(): Array<{ year: string; month: string }> {
  return getAvailableYears(false)
    .flatMap((year) => getAvailableMonths(year, false).map((month) => ({ year, month })))
    .sort((a, b) => `${a.year}-${a.month}`.localeCompare(`${b.year}-${b.month}`));
}

function calculatePeriodBalance(year: string, month?: string): BalanceData {
  const latest = latestFiatBalance();
  if (latest == null) return { opening: null, closing: null };

  const periodStart = month ? `${year}-${month}` : `${year}-01`;
  const periodEnd = month ? `${year}-${month}` : `${year}-12`;
  let afterDelta = 0;
  let periodDelta = 0;

  for (const ym of allAvailableYearMonths()) {
    const key = `${ym.year}-${ym.month}`;
    const delta = calculateExternalDelta(ym.year, ym.month);
    if (key > periodEnd) afterDelta += delta;
    if (key >= periodStart && key <= periodEnd) periodDelta += delta;
  }

  const closing = latest - afterDelta;
  return {
    opening: closing - periodDelta,
    closing,
  };
}

/**
 * Calculate token minting and burning for a specific month from CHT transactions
 * Filters out outlier transactions (3+ orders of magnitude different) if they sum to zero
 */
function calculateTokenActivity(chtTransactions: ConsolidatedTx[]): TokenData {
  // First pass: calculate all values and find median for outlier detection
  const allValues: number[] = [];
  const transactionData: Array<{
    tx: ConsolidatedTx;
    value: number;
    toAddr: string;
    fromAddr: string;
  }> = [];

  for (const tx of chtTransactions) {
    const value = Math.abs(tx.amount);
    const toAddr = txToAddress(tx) ?? "";
    const fromAddr = txFromAddress(tx) ?? "";

    allValues.push(value);
    transactionData.push({ tx, value, toAddr, fromAddr });
  }

  // Calculate median value for outlier detection
  const sortedValues = [...allValues].sort((a, b) => a - b);
  const median =
    sortedValues.length > 0
      ? sortedValues[Math.floor(sortedValues.length / 2)]
      : 0;

  // Identify outliers (3+ orders of magnitude = 1000x different from median)
  const OUTLIER_THRESHOLD = 1000;
  const outlierIndices = new Set<number>();
  let outlierSum = 0;

  transactionData.forEach((data, index) => {
    const { value, toAddr, fromAddr } = data;

    // Only check mint/burn transactions for outliers
    const isMintOrBurn =
      fromAddr === ZERO_ADDRESS.toLowerCase() ||
      toAddr === ZERO_ADDRESS.toLowerCase();

    if (isMintOrBurn && median > 0) {
      const ratio = value / median;
      if (ratio >= OUTLIER_THRESHOLD || ratio <= 1 / OUTLIER_THRESHOLD) {
        outlierIndices.add(index);

        // Add to outlier sum with sign (minted positive, burnt negative)
        if (fromAddr === ZERO_ADDRESS.toLowerCase()) {
          outlierSum += value;
        } else if (toAddr === ZERO_ADDRESS.toLowerCase()) {
          outlierSum -= value;
        }
      }
    }
  });

  // Only filter outliers if they sum to approximately zero (within 0.1%)
  const shouldFilterOutliers =
    outlierIndices.size > 0 &&
    Math.abs(outlierSum) < Math.max(...allValues) * 0.001;

  if (shouldFilterOutliers) {
    console.log(
      `Filtering ${outlierIndices.size} outlier transactions (sum: ${outlierSum.toFixed(2)})`
    );
  }

  // Second pass: calculate totals, excluding outliers if appropriate
  let totalMinted = 0;
  let totalBurnt = 0;
  let filteredTransactionCount = 0;
  const activeAccountsSet = new Set<string>();

  transactionData.forEach((data, index) => {
    const { value, toAddr, fromAddr } = data;

    // Skip outliers if they sum to zero
    if (shouldFilterOutliers && outlierIndices.has(index)) {
      return;
    }

    filteredTransactionCount++;

    // Track active accounts (exclude zero address)
    if (fromAddr && fromAddr !== ZERO_ADDRESS.toLowerCase()) {
      activeAccountsSet.add(fromAddr);
    }
    if (toAddr && toAddr !== ZERO_ADDRESS.toLowerCase()) {
      activeAccountsSet.add(toAddr);
    }

    // Minted tokens (from zero address)
    if (fromAddr === ZERO_ADDRESS.toLowerCase()) {
      totalMinted += value;
    }
    // Burnt tokens (to zero address)
    if (toAddr === ZERO_ADDRESS.toLowerCase()) {
      totalBurnt += value;
    }
  });

  return {
    minted: totalMinted,
    burnt: totalBurnt,
    net: totalMinted - totalBurnt,
    transactionCount: filteredTransactionCount,
    activeAccounts: activeAccountsSet.size,
  };
}

function readContributorTokenSummary(
  year: string,
  month: string
): Partial<TokenData> | null {
  const contributorsFile = path.join(
    DATA_DIR,
    year,
    month,
    "generated",
    "contributors.json"
  );

  if (!fs.existsSync(contributorsFile)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(contributorsFile, "utf-8")) as {
      summary?: {
        contributorsWithTokens?: number;
        totalTokensIn?: number;
        totalTokensOut?: number;
      };
    };

    if (!data.summary) {
      return null;
    }

    return {
      minted: data.summary.totalTokensIn ?? 0,
      burnt: data.summary.totalTokensOut ?? 0,
      net:
        (data.summary.totalTokensIn ?? 0) -
        (data.summary.totalTokensOut ?? 0),
      activeAccounts: data.summary.contributorsWithTokens ?? 0,
    };
  } catch (error) {
    console.error(
      `Error reading contributor token summary for ${year}-${month}:`,
      error
    );
    return null;
  }
}

/**
 * Calculate financial data for a specific month
 */
export function calculateMonthlyFinancials(
  year: string,
  month: string
): FinancialData {
  const transactions = readMonthlyTransactions(year, month);
  const byAccount: Map<string, BreakdownRow & { provider: string }> = new Map();
  const byCategory: Map<string, BreakdownRow> = new Map();
  const byCollective: Map<string, BreakdownRow> = new Map();

  let totalIncome = 0;
  let totalExpenses = 0;

  // CHT (contribution token) token activity
  const chtChain = settings.contributionToken?.chain ?? "celo";
  const chtSymbol = settings.contributionToken?.symbol ?? "CHT";
  const chtTransactions = transactions.filter(
    (tx) =>
      tx.provider === "etherscan" &&
      tx.chain === chtChain &&
      tx.currency === chtSymbol
  );
  const generatedTokenSummary = readContributorTokenSummary(year, month);
  const calculatedTokens = calculateTokenActivity(chtTransactions);
  const tokens = {
    ...calculatedTokens,
    ...generatedTokenSummary,
    transactionCount: chtTransactions.length,
  };

  for (const tx of transactions) {
    const account = txFinanceAccount(tx);
    if (!account) continue;

    // Skip internal transfers and peer-to-peer token transfers — neither
    // moves money into or out of the org.
    if (isInternalTransfer(tx)) continue;
    if (isStripePayout(tx)) continue;
    if (tx.type === "TRANSFER") continue;

    const existing = byAccount.get(account.slug) ?? {
      key: account.slug,
      label: account.name,
      provider: account.provider,
      income: 0,
      expenses: 0,
      net: 0,
    };

    // Stripe rows have currency already normalised to the account currency
    // (EUR/USD/…); blockchain rows use tx.amount in the account's token unit.
    // CREDIT/MINT → into the account; DEBIT/BURN → out of the account.
    const value =
      tx.provider === "stripe"
        ? Math.abs(tx.normalizedAmount)
        : Math.abs(tx.amount);

    const direction = txDirection(tx);
    if (direction === "CREDIT") {
      existing.income += value;
      totalIncome += value;
    } else {
      existing.expenses += value;
      totalExpenses += value;
    }
    existing.net = existing.income - existing.expenses;

    const metadata = txMetadata(tx);
    const collective = String(metadata.collective || "unassigned");
    const mainCategory = mainCategoryFor(tx, direction);
    addBreakdown(byCategory, mainCategory.key, mainCategory.label, direction, value);
    addBreakdown(
      byCollective,
      collective,
      collective === "unassigned" ? "Unassigned" : collectiveLabel(collective),
      direction,
      value
    );

    byAccount.set(account.slug, existing);
  }

  return {
    income: totalIncome,
    expenses: totalExpenses,
    net: totalIncome - totalExpenses,
    tokens,
    balance: calculatePeriodBalance(year, month),
    byCategory: sortedBreakdown(byCategory),
    byCollective: sortedBreakdown(byCollective),
    byAccount: sortedBreakdown(byAccount).map((acc) => ({
      slug: acc.key,
      name: acc.label,
      provider: acc.provider,
      income: acc.income,
      expenses: acc.expenses,
      net: acc.net,
    })),
  };
}

// ========== Report Generation Functions ==========

/**
 * Generate monthly report data
 */
/**
 * Read user token data from contributors.json cache file
 * Supports both old format (users array) and new format (contributors array)
 */
function readUserTokenData(
  year: string,
  month: string
): Map<
  string,
  { address: string | null; tokensReceived: number; tokensSpent: number }
> {
  const userTokenData = new Map();
  const contributorsFile = path.join(DATA_DIR, year, month, "generated", "contributors.json");

  if (!fs.existsSync(contributorsFile)) {
    return userTokenData;
  }

  try {
    const data = JSON.parse(fs.readFileSync(contributorsFile, "utf-8"));

    // New format: contributors array with nested structure
    if (data.contributors && Array.isArray(data.contributors)) {
      for (const contributor of data.contributors) {
        // New format includes id at the top level
        if (!contributor.id) continue;

        userTokenData.set(contributor.id, {
          address: contributor.address || null,
          tokensReceived: contributor.tokens?.in || 0,
          tokensSpent: contributor.tokens?.out || 0,
        });
      }
    }
    // Old format: users array with direct properties
    else if (data.users && Array.isArray(data.users)) {
      for (const user of data.users) {
        userTokenData.set(user.id, {
          address: user.address || null,
          tokensReceived: user.tokensReceived || 0,
          tokensSpent: user.tokensSpent || 0,
        });
      }
    }
  } catch (error) {
    console.error(`Error reading user token data for ${year}-${month}:`, error);
  }

  return userTokenData;
}

export function getMonthlyReportData(
  year: string,
  month: string
): MonthlyReportData {
  const messages = readDiscordMessages(year, month);
  const activeMembers =
    readGeneratedActiveMembers(year, month) ?? getActiveMembers(messages);
  const photos = getPopularPhotos(messages, 12, { relative: true });
  const financials = calculateMonthlyFinancials(year, month);

  // Merge user token data and sort by tokens received (descending)
  const userTokenData = readUserTokenData(year, month);
  const enrichedUsers = activeMembers.users
    .map((user) => {
      const tokenData = userTokenData.get(user.id);
      return {
        ...user,
        address: tokenData?.address || null,
        tokensReceived: tokenData?.tokensReceived || 0,
        tokensSpent: tokenData?.tokensSpent || 0,
      };
    })
    .sort((a, b) => b.tokensReceived - a.tokensReceived);

  return {
    year,
    month,
    activeMembers: {
      count: activeMembers.count,
      userIds: activeMembers.userIds,
      users: enrichedUsers,
    },
    photos,
    financials,
  };
}

/**
 * Generate yearly report data
 */
export function getYearlyReportData(year: string): YearlyReportData {
  const months = getAvailableMonths(year, true); // Exclude future months

  // Build map of month -> contributor count from monthly contributors.json files
  const monthContributorMap = new Map<string, number>();
  for (const month of months) {
    const contributorsPath = path.join(
      DATA_DIR,
      year,
      month,
      "generated",
      "contributors.json"
    );
    if (fs.existsSync(contributorsPath)) {
      try {
        const content = fs.readFileSync(contributorsPath, "utf-8");
        const data = JSON.parse(content) as {
          summary?: { totalContributors: number };
          userCount?: number;
          contributors?: Array<{ id: string }>;
          users?: Array<{ id: string }>;
        };
        // Support new format (summary.totalContributors) and old formats
        const count =
          data.summary?.totalContributors ||
          data.userCount ||
          data.contributors?.length ||
          data.users?.length ||
          0;
        monthContributorMap.set(month, count);
      } catch (error) {
        console.error(
          `Error reading ${year}/${month}/contributors.json:`,
          error
        );
      }
    }
  }

  // Aggregate data from all months
  const monthlyBreakdown: Array<{
    month: string;
    income: number;
    expenses: number;
    activeMembers: number;
    tokensMinted: number;
    tokensBurnt: number;
  }> = [];

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTokensMinted = 0;
  let totalTokensBurnt = 0;
  const byCategory = new Map<string, BreakdownRow>();
  const byCollective = new Map<string, BreakdownRow>();
  const byAccount = new Map<string, BreakdownRow>();
  const yearlyActiveMembers = new Set<string>();

  // Read unique contributors from monthly contributors.json files
  for (const month of months) {
    const contributorsPath = path.join(
      DATA_DIR,
      year,
      month,
      "generated",
      "contributors.json"
    );
    if (fs.existsSync(contributorsPath)) {
      try {
        const content = fs.readFileSync(contributorsPath, "utf-8");
        const data = JSON.parse(content) as {
          contributors?: Array<{ id: string }>;
          users?: Array<{ id: string }>;
        };
        // Track unique user IDs across the year (support both formats)
        const usersList = data.contributors || data.users || [];
        for (const user of usersList) {
          yearlyActiveMembers.add(user.id);
        }
      } catch (error) {
        console.error(
          `Error reading ${year}/${month}/contributors.json:`,
          error
        );
      }
    }
  }

  // Get photos from pre-generated yearly images.json (produced by the external data-sync process)
  // This file contains all photos for the year, already sorted by reactions
  let allPhotos = readYearlyImages(year);

  // Fallback: if yearly file doesn't exist, collect from monthly files
  if (allPhotos.length === 0) {
    for (const month of months) {
      const monthPhotos = readGeneratedImages(year, month);
      allPhotos.push(...monthPhotos);
    }
    // Sort by reactions if we loaded from monthly files
    allPhotos.sort((a, b) => b.totalReactions - a.totalReactions);
  }

  // Collect financials for each month
  for (const month of months) {
    const financials = calculateMonthlyFinancials(year, month);
    totalIncome += financials.income;
    totalExpenses += financials.expenses;
    totalTokensMinted += financials.tokens.minted;
    totalTokensBurnt += financials.tokens.burnt;
    for (const row of financials.byCategory) {
      addBreakdown(byCategory, row.key, row.label, "CREDIT", row.income);
      addBreakdown(byCategory, row.key, row.label, "DEBIT", row.expenses);
    }
    for (const row of financials.byCollective) {
      addBreakdown(byCollective, row.key, row.label, "CREDIT", row.income);
      addBreakdown(byCollective, row.key, row.label, "DEBIT", row.expenses);
    }
    for (const row of financials.byAccount) {
      addBreakdown(byAccount, row.slug, row.name, "CREDIT", row.income);
      addBreakdown(byAccount, row.slug, row.name, "DEBIT", row.expenses);
    }

    // Get active members count from activity grid
    const monthlyActiveMembersCount = monthContributorMap.get(month) || 0;

    monthlyBreakdown.push({
      month,
      income: financials.income,
      expenses: financials.expenses,
      activeMembers: monthlyActiveMembersCount,
      tokensMinted: financials.tokens.minted,
      tokensBurnt: financials.tokens.burnt,
    });
  }

  // Build active members from contributors data (already collected above)
  const activeMembers = {
    count: yearlyActiveMembers.size,
    userIds: Array.from(yearlyActiveMembers),
    users: [] as UserInfo[], // Users are loaded separately if needed
  };

  // Take top 24 photos
  const photos = allPhotos.slice(0, 24);

  return {
    year,
    activeMembers,
    photos,
    financials: {
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      totalTokensMinted,
      totalTokensBurnt,
      balance: calculatePeriodBalance(year),
      byCategory: sortedBreakdown(byCategory),
      byCollective: sortedBreakdown(byCollective),
      byAccount: sortedBreakdown(byAccount),
      monthlyBreakdown,
    },
    months,
  };
}
