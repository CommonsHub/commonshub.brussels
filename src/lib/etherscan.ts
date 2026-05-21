/**
 * Etherscan API helper functions
 * Fetches token balances and transfers from Etherscan API
 * Includes rate limiting (max 2 calls/second) and response caching (1 minute)
 */

export interface TokenTransfer {
  blockNumber: string
  timeStamp: string
  hash: string
  from: string
  to: string
  value: string
  tokenSymbol: string
  contractAddress: string
}

export interface TokenBalance {
  result: string
  status: string
  message: string
}

export interface TokenTransfersResponse {
  result: TokenTransfer[]
  status: string
  message: string
}

// Rate limiting: max 3 calls per second per domain
// Using 350ms delay to ensure we stay under 3/sec (1000/350 = 2.86 calls/sec)
const RATE_LIMIT_DELAY = 350 // 350ms between calls = ~2.86 calls/second (safely under 3/sec)
const RESPONSE_CACHE_DURATION = 60 * 1000 // 1 minute
const RETRY_DELAY = 1000 // 1 second delay between retries (for rate limit errors)
const MAX_RETRIES = 3 // Maximum number of retry attempts

// Chain-specific explorer URLs mapping
// All chains now use Etherscan V2 API for unified access
const EXPLORER_API_URLS: Record<number, string> = {
  // Migrated all chains to V2 API - uses fallback below
}

/**
 * Get the explorer API URL for a specific chain
 * Uses Etherscan v2 API with chainid parameter
 */
function getExplorerApiUrl(chainId: number): string {
  return EXPLORER_API_URLS[chainId] || `https://api.etherscan.io/v2/api?chainid=${chainId}`
}

/**
 * Check if chain uses v2 API format (has chainid in base URL)
 * Returns true for all chains since we migrated to V2 API
 */
function usesV2Api(chainId: number): boolean {
  return !EXPLORER_API_URLS[chainId]
}

// Rate limiting queues per domain
const domainQueues = new Map<
  string,
  {
    lastApiCall: number
    callQueue: Array<{
      resolve: (value: any) => void
      reject: (error: Error) => void
      fn: () => Promise<any>
    }>
    isProcessingQueue: boolean
  }
>()

// Response cache (keyed by full URL)
const responseCache = new Map<string, { data: any; cachedAt: number }>()

/**
 * Extract domain from URL
 */
function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    // Fallback if URL parsing fails
    return "unknown"
  }
}

/**
 * Get cache key for an API request (full URL)
 */
function getRequestCacheKey(url: string): string {
  return url
}

/**
 * Get or create rate limit queue for a domain
 */
function getDomainQueue(domain: string) {
  if (!domainQueues.has(domain)) {
    domainQueues.set(domain, {
      lastApiCall: 0,
      callQueue: [],
      isProcessingQueue: false,
    })
  }
  return domainQueues.get(domain)!
}

/**
 * Rate-limited API call wrapper
 * Rate limiting is per domain, caching is per full URL
 * Exported for use in other scripts
 */
export async function rateLimitedApiCall<T>(url: string, fetchFn: () => Promise<T>): Promise<T> {
  // Check cache first (based on full URL)
  const cacheKey = getRequestCacheKey(url)
  const cached = responseCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.cachedAt < RESPONSE_CACHE_DURATION) {
    return cached.data as T
  }

  // Get domain for rate limiting
  const domain = getDomainFromUrl(url)
  const domainQueue = getDomainQueue(domain)

  // Wait for rate limit (per domain)
  return new Promise<T>((resolve, reject) => {
    domainQueue.callQueue.push({
      resolve,
      reject,
      fn: async () => {
        let lastError: Error | null = null

        // Retry up to MAX_RETRIES times
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const result = await fetchFn()
            // Cache the response (based on full URL)
            responseCache.set(cacheKey, {
              data: result,
              cachedAt: Date.now(),
            })
            return result
          } catch (error) {
            lastError = error as Error

            // If this is not the last attempt, wait before retrying
            if (attempt < MAX_RETRIES) {
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
              // Continue to next attempt
            } else {
              // Last attempt failed, throw the error
              throw lastError
            }
          }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError || new Error("Failed after retries")
      },
    })

    processQueue(domain)
  })
}

/**
 * Process the rate limiting queue for a specific domain
 */
async function processQueue(domain: string) {
  const domainQueue = getDomainQueue(domain)

  if (domainQueue.isProcessingQueue || domainQueue.callQueue.length === 0) {
    return
  }

  domainQueue.isProcessingQueue = true

  while (domainQueue.callQueue.length > 0) {
    const now = Date.now()
    const timeSinceLastCall = now - domainQueue.lastApiCall

    if (timeSinceLastCall < RATE_LIMIT_DELAY) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastCall))
    }

    const item = domainQueue.callQueue.shift()
    if (item) {
      domainQueue.lastApiCall = Date.now()
      try {
        const result = await item.fn()
        item.resolve(result)
      } catch (error) {
        item.reject(error as Error)
      }
    }
  }

  domainQueue.isProcessingQueue = false
}

/**
 * Get month key from timestamp (YYYY-MM format)
 */
export function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Get month key from Date object (YYYY-MM format)
 */
export function getMonthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Fetch token balance for an address
 * Rate limited and cached
 */
export async function fetchTokenBalance(
  chainId: number,
  contractAddress: string,
  address: string,
  apiKey: string,
): Promise<TokenBalance> {
  const baseUrl = getExplorerApiUrl(chainId)
  const separator = usesV2Api(chainId) ? "&" : "?"
  const url = `${baseUrl}${separator}module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest&apikey=${apiKey}`

  console.log(`[v2] fetchTokenBalance chainId=${chainId} url=${url.replace(apiKey, "***")}`)

  return rateLimitedApiCall(url, async () => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch token balance: ${response.statusText}`)
    }
    const data = await response.json()
    console.log(`[v2] fetchTokenBalance response: status=${data.status} message=${data.message} result=${data.result}`)
    return data
  })
}

/**
 * Fetch token transfers for an address
 * Rate limited and cached
 */
export async function fetchTokenTransfers(
  chainId: number,
  contractAddress: string,
  address: string,
  apiKey: string,
): Promise<TokenTransfersResponse> {
  const baseUrl = getExplorerApiUrl(chainId)
  const separator = usesV2Api(chainId) ? "&" : "?"
  const url = `${baseUrl}${separator}module=account&action=tokentx&contractaddress=${contractAddress}&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`

  console.log(`[v2] fetchTokenTransfers chainId=${chainId} url=${url.replace(apiKey, "***")}`)

  return rateLimitedApiCall(url, async () => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch token transfers: ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`[v2] fetchTokenTransfers response status:`, data.status, data.message)

    // Check for API errors
    if (data.status === "0" && data.message !== "No transactions found") {
      // Check if it's a rate limit error
      if (data.message && data.message.toLowerCase().includes("rate limit")) {
        console.warn(`⚠ Etherscan rate limit hit: ${data.message}`)
        // For rate limit errors, wait longer before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds
        throw new Error(`Etherscan rate limit: ${data.message}`)
      }
      console.error(`Etherscan API error: ${data.message}`, data)
      throw new Error(`Etherscan API error: ${data.message}`)
    }

    return data
  })
}

/**
 * Fetch all token transfers for an address (for warmup/caching purposes)
 * This is the same as fetchTokenTransfers but with a clearer name for warmup scripts
 * Rate limited and cached
 */
export async function fetchAllTokenTransfers(
  chainId: number,
  contractAddress: string,
  address: string,
  apiKey: string,
): Promise<TokenTransfer[]> {
  const transfersData = await fetchTokenTransfers(chainId, contractAddress, address, apiKey)

  return Array.isArray(transfersData.result) ? transfersData.result : []
}

// In-memory cache for current month transactions (5 minutes)
const CURRENT_MONTH_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const currentMonthCache: Map<string, { data: TokenTransfer[]; lastFetched: number; month: string }> = new Map()

/**
 * Get cache key for an account
 */
function getCacheKey(chainId: number, contractAddress: string, address: string): string {
  return `${chainId}-${contractAddress}-${address}`
}

/**
 * Fetch current month token transfers for an address
 * Only fetches transactions from the start of the current month
 * Caches the result for 5 minutes
 */
export async function fetchCurrentMonthTokenTransfers(
  chainId: number,
  contractAddress: string,
  address: string,
  apiKey: string,
): Promise<TokenTransfer[]> {
  const cacheKey = getCacheKey(chainId, contractAddress, address)
  const currentMonth = getMonthKeyFromDate(new Date())
  const now = Date.now()

  // Check cache first
  const cached = currentMonthCache.get(cacheKey)
  if (cached && cached.month === currentMonth && now - cached.lastFetched < CURRENT_MONTH_CACHE_DURATION) {
    return cached.data
  }

  // Calculate first day of current month timestamp
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const firstDayTimestamp = Math.floor(firstDayOfMonth.getTime() / 1000)

  // Fetch all transfers (Etherscan API doesn't support timestamp filtering)
  const transfersData = await fetchTokenTransfers(chainId, contractAddress, address, apiKey)

  // Filter to only current month transactions
  const currentMonthTransfers = (transfersData.result || []).filter((tx: TokenTransfer) => {
    const txTimestamp = Number.parseInt(tx.timeStamp)
    return txTimestamp >= firstDayTimestamp
  })

  // Update cache
  currentMonthCache.set(cacheKey, {
    data: currentMonthTransfers,
    lastFetched: now,
    month: currentMonth,
  })

  return currentMonthTransfers
}

/**
 * Parse token balance from raw result
 */
export function parseTokenBalance(rawBalance: string, decimals: number): number {
  return Number.parseFloat(rawBalance || "0") / Math.pow(10, decimals)
}

/**
 * Parse token value from raw value
 */
export function parseTokenValue(rawValue: string, decimals: number): number {
  return Number.parseFloat(rawValue) / Math.pow(10, decimals)
}
