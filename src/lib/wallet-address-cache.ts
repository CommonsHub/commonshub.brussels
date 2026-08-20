/**
 * Wallet Address Cache
 *
 * Caches Discord user ID to wallet address mappings to avoid repeated
 * calls to getAccountAddressFromDiscordUserId (which calls the blockchain).
 *
 * Cache is stored under RUNTIME_DIR (not DATA_DIR, which is read-only).
 * Losing it on restart only costs a few blockchain lookups.
 */

import * as fs from "fs";
import { ensureDirFor, runtimePath } from "@/lib/runtime-paths";
const CACHE_FILE = runtimePath("wallet-addresses.json");

interface WalletAddressCache {
  [discordUserId: string]: {
    address: string | null;
    updatedAt: string;
  };
}

let memoryCache: WalletAddressCache | null = null;

/**
 * Load the wallet address cache from disk
 */
function loadCache(): WalletAddressCache {
  if (memoryCache) {
    return memoryCache;
  }

  if (fs.existsSync(CACHE_FILE)) {
    try {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      memoryCache = JSON.parse(content);
      return memoryCache!;
    } catch (error) {
      console.error("[wallet-cache] Error loading cache:", error);
      memoryCache = {};
      return memoryCache;
    }
  }

  memoryCache = {};
  return memoryCache;
}

/**
 * Save the wallet address cache to disk
 */
function saveCache(cache: WalletAddressCache): void {
  // Keep the in-memory copy authoritative even if the disk write fails, so a
  // read-only or missing RUNTIME_DIR degrades to a per-process cache.
  memoryCache = cache;

  if (!ensureDirFor(CACHE_FILE)) return;

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (error) {
    console.error("[wallet-cache] Error saving cache:", error);
  }
}

/**
 * Get a wallet address from cache
 * Returns undefined if not in cache, null if address is cached as null
 */
export function getCachedWalletAddress(
  discordUserId: string
): string | null | undefined {
  const cache = loadCache();
  const entry = cache[discordUserId];

  if (!entry) {
    return undefined; // Not in cache
  }

  return entry.address;
}

/**
 * Set a wallet address in cache
 */
export function setCachedWalletAddress(
  discordUserId: string,
  address: string | null
): void {
  const cache = loadCache();
  cache[discordUserId] = {
    address,
    updatedAt: new Date().toISOString(),
  };
  saveCache(cache);
}

/**
 * Batch set multiple wallet addresses
 */
export function setBatchCachedWalletAddresses(
  entries: Array<{ discordUserId: string; address: string | null }>
): void {
  const cache = loadCache();
  const now = new Date().toISOString();

  for (const entry of entries) {
    cache[entry.discordUserId] = {
      address: entry.address,
      updatedAt: now,
    };
  }

  saveCache(cache);
}

/**
 * Get cache statistics
 */
export function getWalletCacheStats(): {
  totalEntries: number;
  withAddress: number;
  withoutAddress: number;
} {
  const cache = loadCache();
  const entries = Object.values(cache);

  return {
    totalEntries: entries.length,
    withAddress: entries.filter((e) => e.address !== null).length,
    withoutAddress: entries.filter((e) => e.address === null).length,
  };
}

/**
 * Clear old cache entries (older than specified days)
 * This is useful to refresh addresses periodically
 */
export function clearOldCacheEntries(olderThanDays: number = 90): number {
  const cache = loadCache();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  let removedCount = 0;
  const newCache: WalletAddressCache = {};

  for (const [userId, entry] of Object.entries(cache)) {
    const entryDate = new Date(entry.updatedAt);
    if (entryDate >= cutoffDate) {
      newCache[userId] = entry;
    } else {
      removedCount++;
    }
  }

  if (removedCount > 0) {
    saveCache(newCache);
  }

  return removedCount;
}
