/**
 * Discord message cache with year/month folder structure
 * Similar to the financial transactions cache strategy
 */

import { toZonedTime } from "date-fns-tz"
import * as fs from "fs"
import * as path from "path"
import { DATA_DIR } from "./data-paths"
import { ensureDirFor, runtimePath } from "./runtime-paths"
const TIMEZONE = process.env.TZ || "Europe/Brussels"

const memoryCache = new Map<string, CachedMessage[]>()

export interface CachedMessage {
  id: string
  channel_id?: string
  author: {
    id: string
    username: string
    global_name: string | null
    avatar: string | null
  }
  content: string
  timestamp: string
  attachments: Array<{
    id: string
    url: string
    proxy_url: string
    content_type?: string
  }>
  embeds: Array<{
    thumbnail?: { url: string; proxy_url: string }
    image?: { url: string; proxy_url: string }
  }>
  mentions: Array<{
    id: string
    username: string
    global_name: string | null
    avatar: string | null
  }>
  reactions?: Array<{
    emoji: { id: string | null; name: string }
    count: number
    me: boolean
  }>
}

interface ChannelCache {
  messages: CachedMessage[]
  cachedAt: string
  oldestMessageId?: string
  newestMessageId?: string
}

/**
 * Check if file system is available
 */
function isFileSystemAvailable(): boolean {
  return fs !== null && path !== null
}

/**
 * Path to the pipeline-generated messages for a channel/month, inside the
 * read-only DATA_DIR.
 * Format: data/{year}/{month}/messages/discord/{channelId}/messages.json
 */
function getChannelMonthCachePath(channelId: string, year: string, month: string): string {
  if (!path) return ""
  return path.join(DATA_DIR, year, month, "messages", "discord", channelId, "messages.json")
}

/**
 * Path to the runtime cache for a channel/month, mirroring the DATA_DIR layout
 * under RUNTIME_DIR. DATA_DIR is read-only, so messages fetched live at runtime
 * are cached here instead. This copy is newer than the DATA_DIR one whenever it
 * exists, so reads prefer it.
 */
function getRuntimeChannelMonthCachePath(channelId: string, year: string, month: string): string {
  if (!path) return ""
  return runtimePath("messages", "discord", channelId, year, month, "messages.json")
}

/**
 * Get all cached months for a channel
 */
export function getCachedMonths(channelId: string): string[] {
  if (!isFileSystemAvailable() || !fs || !path) return []

  const months: string[] = []

  // Months cached at runtime, which DATA_DIR may not know about yet.
  try {
    const runtimeChannelDir = runtimePath("messages", "discord", channelId)
    if (fs.existsSync(runtimeChannelDir)) {
      const years = fs
        .readdirSync(runtimeChannelDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
        .map((dirent) => dirent.name)

      for (const year of years) {
        const yearPath = path.join(runtimeChannelDir, year)
        const monthDirs = fs
          .readdirSync(yearPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
          .map((dirent) => dirent.name)

        for (const month of monthDirs) {
          if (fs.existsSync(path.join(yearPath, month, "messages.json"))) {
            months.push(`${year}-${month}`)
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading runtime cached months for channel ${channelId}:`, error)
  }

  try {
    if (!fs.existsSync(DATA_DIR)) return Array.from(new Set(months)).sort()

    // Read all year directories
    const years = fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
      .map((dirent) => dirent.name)

    for (const year of years) {
      const yearPath = path.join(DATA_DIR, year)

      // Read all month directories in this year
      const monthDirs = fs
        .readdirSync(yearPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
        .map((dirent) => dirent.name)

      for (const month of monthDirs) {
        const discordDir = path.join(yearPath, month, "messages", "discord")
        if (fs.existsSync(discordDir)) {
          const cacheFile = path.join(discordDir, channelId, "messages.json")
          if (fs.existsSync(cacheFile)) {
            months.push(`${year}-${month}`)
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading cached months for channel ${channelId}:`, error)
  }

  // A month can appear in both the runtime cache and DATA_DIR.
  return Array.from(new Set(months)).sort()
}

/**
 * Read cached messages for a specific channel and month
 */
export function readChannelMonthCache(channelId: string, monthKey: string): CachedMessage[] {
  if (!isFileSystemAvailable() || !fs) return []

  const [year, month] = monthKey.split("-")

  // Runtime cache first (written by a live fetch, so newer), then the
  // pipeline-generated copy in the read-only DATA_DIR.
  const candidates = [
    getRuntimeChannelMonthCachePath(channelId, year, month),
    getChannelMonthCachePath(channelId, year, month),
  ]

  for (const filePath of candidates) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8")
        const cache: ChannelCache = JSON.parse(content)
        return cache.messages || []
      }
    } catch (error) {
      console.error(`Error reading cache for ${channelId}/${monthKey}:`, error)
    }
  }

  // Fall back to whatever this process cached in memory when no directory was
  // writable at all.
  return memoryCache.get(`${channelId}/${monthKey}`) || []
}

/**
 * Write messages to cache for a specific channel and month
 */
export function writeChannelMonthCache(channelId: string, monthKey: string, messages: CachedMessage[]): void {
  // Always keep the in-memory copy: it is the fallback whenever no directory
  // is writable, and readChannelMonthCache falls back to it.
  const key = `${channelId}/${monthKey}`
  memoryCache.set(key, messages)

  if (!isFileSystemAvailable() || !fs || !path) return

  const [year, month] = monthKey.split("-")
  // DATA_DIR is read-only; the runtime cache is the only writable location.
  const filePath = getRuntimeChannelMonthCachePath(channelId, year, month)
  if (!filePath || !ensureDirFor(filePath)) return

  try {
    // Sort messages by timestamp (newest first)
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )

    const cache: ChannelCache = {
      messages: sortedMessages,
      cachedAt: new Date().toISOString(),
      newestMessageId: sortedMessages[0]?.id,
      oldestMessageId: sortedMessages[sortedMessages.length - 1]?.id,
    }

    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf-8")
    console.log(`[v2] Discord cache: wrote ${messages.length} messages to ${filePath}`)
  } catch (error) {
    console.error(`Error writing cache for ${channelId}/${monthKey}:`, error)
  }
}

/**
 * Get all cached messages for a channel (across all months)
 */
export function getAllCachedMessages(channelId: string): CachedMessage[] {
  if (!isFileSystemAvailable()) {
    const allMessages: CachedMessage[] = []
    for (const [key, messages] of memoryCache.entries()) {
      if (key.startsWith(`${channelId}/`)) {
        allMessages.push(...messages)
      }
    }
    const seen = new Set<string>()
    return allMessages
      .filter((msg) => {
        if (seen.has(msg.id)) return false
        seen.add(msg.id)
        return true
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  const months = getCachedMonths(channelId)
  const allMessages: CachedMessage[] = []

  for (const monthKey of months) {
    const messages = readChannelMonthCache(channelId, monthKey)
    allMessages.push(...messages)
  }

  // Deduplicate by ID and sort by timestamp (newest first)
  const seen = new Set<string>()
  return allMessages
    .filter((msg) => {
      if (seen.has(msg.id)) return false
      seen.add(msg.id)
      return true
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * Get the newest cached message ID for a channel
 */
export function getNewestCachedMessageId(channelId: string): string | null {
  const messages = getAllCachedMessages(channelId)
  return messages[0]?.id || null
}

/**
 * Get the oldest cached message ID for a channel
 */
export function getOldestCachedMessageId(channelId: string): string | null {
  const messages = getAllCachedMessages(channelId)
  return messages[messages.length - 1]?.id || null
}

/**
 * Add new messages to the cache, organizing by month
 */
export function addMessagesToCache(channelId: string, newMessages: CachedMessage[]): void {
  // Group messages by month
  const messagesByMonth = new Map<string, CachedMessage[]>()

  for (const msg of newMessages) {
    const utcDate = new Date(msg.timestamp)
    const zonedDate = toZonedTime(utcDate, TIMEZONE)
    const monthKey = `${zonedDate.getFullYear()}-${String(zonedDate.getMonth() + 1).padStart(2, "0")}`

    if (!messagesByMonth.has(monthKey)) {
      messagesByMonth.set(monthKey, [])
    }
    messagesByMonth.get(monthKey)!.push(msg)
  }

  // For each month, merge with existing cache
  for (const [monthKey, messages] of messagesByMonth) {
    const existingMessages = readChannelMonthCache(channelId, monthKey)
    const existingIds = new Set(existingMessages.map((m) => m.id))

    // Add only new messages
    const uniqueNewMessages = messages.filter((m) => !existingIds.has(m.id))
    if (uniqueNewMessages.length > 0 || existingMessages.length === 0) {
      const mergedMessages = [...existingMessages, ...uniqueNewMessages]
      writeChannelMonthCache(channelId, monthKey, mergedMessages)
    }
  }
}

/**
 * Check if cache exists and has data
 */
export function hasCacheData(channelId: string): boolean {
  if (!isFileSystemAvailable()) {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(`${channelId}/`)) return true
    }
    return false
  }
  return getCachedMonths(channelId).length > 0
}

/**
 * Get cache statistics
 */
export function getCacheStats(channelId: string): {
  totalMessages: number
  months: number
  oldestMessage?: string
  newestMessage?: string
} {
  const messages = getAllCachedMessages(channelId)
  const months = getCachedMonths(channelId)

  return {
    totalMessages: messages.length,
    months: months.length,
    oldestMessage: messages[messages.length - 1]?.timestamp,
    newestMessage: messages[0]?.timestamp,
  }
}

/**
 * Get local image path for an attachment
 * Returns the local path if the file exists, null otherwise
 */
export function getLocalImagePath(attachmentId: string, url: string, timestamp: string): string | null {
  if (!isFileSystemAvailable() || !fs || !path) return null

  try {
    // Extract file extension from URL
    const urlObj = new URL(url)
    const ext = path.extname(urlObj.pathname) || ".jpg"

    // Calculate year/month from timestamp (timezone-aware)
    const utcDate = new Date(timestamp)
    const zonedDate = toZonedTime(utcDate, TIMEZONE)
    const year = zonedDate.getFullYear().toString()
    const month = String(zonedDate.getMonth() + 1).padStart(2, "0")

    // Construct local file path
    const filename = `${attachmentId}${ext}`
    const localPath = path.join(DATA_DIR, year, month, "channels", "discord", "images", filename)

    // Check if file exists
    if (fs.existsSync(localPath)) {
      return `/data/${year}/${month}/channels/discord/images/${filename}`
    }
  } catch (error) {
    // Invalid URL or other error, return null
  }

  return null
}
