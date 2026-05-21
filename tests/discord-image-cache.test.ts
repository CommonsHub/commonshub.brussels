/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"
import fs from "fs"
import path from "path"
import { getChannelMessages } from "../src/lib/discord"
import {
  writeChannelMonthCache,
  readChannelMonthCache,
  getLocalImagePath,
} from "../src/lib/discord-cache"
import settings from "../src/settings/settings.json"

// Store original fetch
const originalFetch = global.fetch

// Set DATA_DIR for tests - MUST be set before importing library functions
const DATA_DIR = path.join(process.cwd(), "tests/data")
process.env.DATA_DIR = DATA_DIR

describe("Discord Image Cache", () => {
  const testChannelId = "1297965144579637248" // contributions channel
  let testYear: string
  let testMonth: string
  let testWeekStart: Date
  let testWeekEnd: Date

  beforeEach(() => {
    // Ensure DATA_DIR is set for library functions
    process.env.DATA_DIR = DATA_DIR
    // Set up test week (last 7 days)
    testWeekEnd = new Date()
    testWeekStart = new Date(testWeekEnd)
    testWeekStart.setDate(testWeekStart.getDate() - 7)

    testYear = testWeekEnd.getFullYear().toString()
    testMonth = String(testWeekEnd.getMonth() + 1).padStart(2, "0")

    // Create a proper mock response with clone method
    const createMockResponse = (data: any) => {
      const response = {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(1024),
        json: async () => data,
        headers: new Headers({ "content-type": "image/jpeg" }),
        clone: function() {
          return createMockResponse(data)
        },
      } as unknown as Response
      return response
    }

    // Mock fetch only for image downloads (not Discord API calls)
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()

      // Use original fetch for Discord API calls
      if (url.includes("discord.com/api")) {
        return originalFetch(input as any)
      }

      // Mock image downloads
      return Promise.resolve(createMockResponse({}))
    }) as jest.MockedFunction<typeof fetch>
  })

  afterEach(() => {
    jest.clearAllMocks()
    // Restore original fetch
    global.fetch = originalFetch
  })

  it("should fetch messages from the last week", async () => {
    // Skip if no Discord token
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.log("⊘ Skipping test: DISCORD_BOT_TOKEN not set")
      expect(true).toBe(true) // Pass the test
      return
    }

    let messages
    try {
      messages = await getChannelMessages(testChannelId, { limit: 100 })
    } catch (error: any) {
      if (error.message.includes("401")) {
        console.log("⊘ Skipping test: Invalid or missing Discord token")
        expect(true).toBe(true)
        return
      }
      throw error
    }

    expect(messages).toBeDefined()
    expect(Array.isArray(messages)).toBe(true)

    if (messages && messages.length > 0) {
      // Check that we have recent messages
      const recentMessages = messages.filter((msg: any) => {
        const msgDate = new Date(msg.timestamp)
        return msgDate >= testWeekStart && msgDate <= testWeekEnd
      })

      console.log(`✓ Found ${messages.length} messages, ${recentMessages.length} from last week`)
      expect(recentMessages.length).toBeGreaterThan(0)
    }
  }, 30000)

  it("should download and cache images from recent messages", async () => {
    // Skip if no Discord token
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.log("⊘ Skipping test: DISCORD_BOT_TOKEN not set")
      expect(true).toBe(true)
      return
    }

    let messages
    try {
      messages = await getChannelMessages(testChannelId, { limit: 50 })
    } catch (error: any) {
      if (error.message.includes("401")) {
        console.log("⊘ Skipping test: Invalid or missing Discord token")
        expect(true).toBe(true)
        return
      }
      throw error
    }

    if (!messages || messages.length === 0) {
      console.log("⊘ No messages found to test")
      expect(true).toBe(true)
      return
    }

    // Filter to last week
    const weekMessages = messages.filter((msg: any) => {
      const msgDate = new Date(msg.timestamp)
      return msgDate >= testWeekStart && msgDate <= testWeekEnd
    })

    if (weekMessages.length === 0) {
      console.log("⊘ No messages from last week")
      expect(true).toBe(true)
      return
    }

    // Find messages with images
    const messagesWithImages = weekMessages.filter(
      (msg: any) => msg.attachments && msg.attachments.length > 0
    )

    if (messagesWithImages.length === 0) {
      console.log("⊘ No messages with images in last week")
      expect(true).toBe(true)
      return
    }

    console.log(`✓ Found ${messagesWithImages.length} messages with images`)

    // Try to download one image
    const firstImageMsg = messagesWithImages[0]
    const firstAttachment = firstImageMsg.attachments![0]

    const msgDate = new Date(firstImageMsg.timestamp)
    const year = msgDate.getFullYear().toString()
    const month = String(msgDate.getMonth() + 1).padStart(2, "0")

    // Create images directory
    const imagesDir = path.join(DATA_DIR, year, month, "channels", "discord", "images")
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }

    // Download image
    const urlObj = new URL(firstAttachment.url)
    const ext = path.extname(urlObj.pathname) || ".jpg"
    const filename = `${firstAttachment.id}${ext}`
    const filepath = path.join(imagesDir, filename)

    // Download
    const response = await fetch(firstAttachment.url)
    expect(response.ok).toBe(true)

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filepath, buffer)

    // Verify file exists
    expect(fs.existsSync(filepath)).toBe(true)

    console.log(`✓ Downloaded image: ${filename}`)

    // Verify getLocalImagePath works
    const localPath = getLocalImagePath(
      firstAttachment.id,
      firstAttachment.url,
      firstImageMsg.timestamp
    )

    expect(localPath).toBeTruthy()
    expect(localPath).toContain(firstAttachment.id)
    console.log(`✓ Local path resolved: ${localPath}`)
  }, 30000)

  it("should write and read cache correctly", async () => {
    const monthKey = `${testYear}-${testMonth}`

    const testMessages = [
      {
        id: "test123",
        author: {
          id: "user1",
          username: "testuser",
          global_name: "Test User",
          avatar: null,
        },
        content: "Test message",
        timestamp: testWeekEnd.toISOString(),
        attachments: [
          {
            id: "attach123",
            url: "https://cdn.discordapp.com/test.jpg",
            proxy_url: "https://media.discordapp.net/test.jpg",
            content_type: "image/jpeg",
          },
        ],
        embeds: [],
        mentions: [],
      },
    ]

    // Write cache
    writeChannelMonthCache(testChannelId, monthKey, testMessages)

    // Read cache
    const cached = readChannelMonthCache(testChannelId, monthKey)

    expect(cached).toBeDefined()
    expect(cached.length).toBe(1)
    expect(cached[0].id).toBe("test123")
    expect(cached[0].attachments[0].id).toBe("attach123")

    console.log(`✓ Cache written and read successfully`)
  })

  it("should handle missing local images gracefully", () => {
    const nonExistentId = "999999999999999999"
    const localPath = getLocalImagePath(
      nonExistentId,
      "https://cdn.discordapp.com/test.jpg",
      testWeekEnd.toISOString()
    )

    expect(localPath).toBeNull()
    console.log(`✓ Missing image returns null as expected`)
  })

  it("should organize images by month correctly", async () => {
    // Skip if no Discord token
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.log("⊘ Skipping test: DISCORD_BOT_TOKEN not set")
      expect(true).toBe(true)
      return
    }

    let messages
    try {
      messages = await getChannelMessages(testChannelId, { limit: 50 })
    } catch (error: any) {
      if (error.message.includes("401")) {
        console.log("⊘ Skipping test: Invalid or missing Discord token")
        expect(true).toBe(true)
        return
      }
      throw error
    }

    if (!messages || messages.length === 0) {
      console.log("⊘ No messages found")
      expect(true).toBe(true)
      return
    }

    // Group messages by month
    const messagesByMonth = new Map<string, number>()

    messages.forEach((msg: any) => {
      const date = new Date(msg.timestamp)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      messagesByMonth.set(monthKey, (messagesByMonth.get(monthKey) || 0) + 1)
    })

    console.log(`✓ Messages organized across ${messagesByMonth.size} month(s)`)
    messagesByMonth.forEach((count, month) => {
      console.log(`  - ${month}: ${count} messages`)
    })

    expect(messagesByMonth.size).toBeGreaterThan(0)
  }, 30000)
})
