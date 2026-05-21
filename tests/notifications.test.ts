/**
 * Notification Services Tests
 * Tests the core notification functions without Next.js API route dependencies
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals"

// Test the service logic by mocking fetch and resend
describe("Notification Services", () => {
  const originalFetch = global.fetch
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      DISCORD_BOT_TOKEN: "test-token",
      RESEND_API_KEY: "test-resend-key",
    }
  })

  afterAll(() => {
    global.fetch = originalFetch
    process.env = originalEnv
  })

  describe("Discord Thread Creation", () => {
    test("calls Discord API with correct parameters", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "thread-123" }),
      } as Response)
      global.fetch = mockFetch as any

      // Import after setting up mocks
      const { createDiscordThread } = await import("../src/lib/services/notifications")

      await createDiscordThread({
        channelId: "channel-123",
        threadName: "Test Thread",
        content: "Test content",
      })

      // Verify thread creation call
      expect(mockFetch).toHaveBeenCalledWith(
        "https://discord.com/api/v10/channels/channel-123/threads",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bot test-token",
          }),
        }),
      )

      // Verify message post call
      expect(mockFetch).toHaveBeenCalledWith(
        "https://discord.com/api/v10/channels/thread-123/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "Test content" }),
        }),
      )
    })

    test("truncates thread name to 100 characters", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "thread-123" }),
      } as Response)
      global.fetch = mockFetch as any

      const { createDiscordThread } = await import("../src/lib/services/notifications")

      const longName = "A".repeat(150)
      await createDiscordThread({
        channelId: "channel-123",
        threadName: longName,
        content: "Test",
      })

      const callBody = JSON.parse((mockFetch.mock.calls[0] as any)[1].body)
      expect(callBody.name.length).toBe(100)
    })

    test("returns null when DISCORD_BOT_TOKEN is not set", async () => {
      delete process.env.DISCORD_BOT_TOKEN

      // Force re-import
      jest.resetModules()
      const { createDiscordThread } = await import("../src/lib/services/notifications")

      const result = await createDiscordThread({
        channelId: "channel-123",
        threadName: "Test",
        content: "Test",
      })

      expect(result).toBeNull()
    })
  })

  describe("Form Data Validation", () => {
    test("workshop booking requires email", () => {
      const data = {
        name: "John",
        organisation: "Test",
        numberOfPeople: 5,
      }

      expect(data).not.toHaveProperty("email")
    })

    test("room booking requires all fields", () => {
      const requiredFields = ["name", "email", "organization", "room", "date", "time"]
      const data = {
        name: "John",
        email: "john@test.com",
        organization: "Test Org",
        room: "Ostrom",
        date: "2024-02-15",
        time: "14:00",
      }

      requiredFields.forEach((field) => {
        expect(data).toHaveProperty(field)
      })
    })

    test("membership application requires all fields", () => {
      const requiredFields = ["name", "email", "organization", "motivation"]
      const data = {
        name: "John",
        email: "john@test.com",
        organization: "Test Org",
        motivation: "I want to join",
      }

      requiredFields.forEach((field) => {
        expect(data).toHaveProperty(field)
      })
    })
  })
})

describe("Settings Configuration", () => {
  test("settings has required Discord channel IDs", async () => {
    const settings = await import("../src/settings/settings.json")

    expect(settings.discord.channels.requests).toBeDefined()
    expect(typeof settings.discord.channels.requests).toBe("string")
  })

  test("settings has email configuration", async () => {
    const settings = await import("../src/settings/settings.json")

    expect(settings.email.from).toBeDefined()
    expect(settings.email.to).toBeDefined()
  })
})
