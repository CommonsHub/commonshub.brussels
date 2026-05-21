/**
 * @jest-environment node
 */

/**
 * API Forms Integration Tests
 * Tests that contact and booking forms properly call Resend and Discord APIs
 */

import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals"

// Mock Resend before importing any modules
const mockResendSend = jest.fn<any>()
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}))

describe("Form API Integration", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "test-resend-key",
      DISCORD_BOT_TOKEN: "test-discord-token",
    }

    // Mock successful responses
    mockResendSend.mockResolvedValue({ id: "email-123" })

    // Mock Discord API calls
    global.fetch = jest.fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "message-123" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "thread-123" }),
      } as Response) as any
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  describe("Contact Form Email Integration", () => {
    test("sends two emails when contact form is submitted", async () => {
      // Import after mocks are set up
      const { POST } = await import("../../src/app/api/contact/route")

      const formData = {
        name: "John Doe",
        email: "john@example.com",
        organisation: "Test Org",
        reason: "visit",
        message: "I would like to visit",
      }

      const request = {
        json: async () => formData,
      } as any

      await POST(request)

      // Should send 2 emails (notification + confirmation)
      expect(mockResendSend).toHaveBeenCalledTimes(2)
    })

    test("includes user email in CC for notification", async () => {
      const { POST } = await import("../../src/app/api/contact/route")

      const formData = {
        name: "Jane Smith",
        email: "jane@example.com",
        organisation: "",
        reason: "booking-room",
        message: "Need a room",
      }

      const request = {
        json: async () => formData,
      } as any

      await POST(request)

      // Find the notification email (to Commons Hub)
      const calls = mockResendSend.mock.calls as any[][]
      const notificationCall = calls.find((call: any) =>
        call[0].to?.includes("hello@commonshub.brussels")
      )

      expect(notificationCall).toBeDefined()
      expect(notificationCall![0]).toMatchObject({
        to: ["hello@commonshub.brussels"],
        cc: ["jane@example.com"],
        subject: expect.stringContaining("Booking a room"),
      })
    })

    test("sends confirmation email to user", async () => {
      const { POST } = await import("../../src/app/api/contact/route")

      const formData = {
        name: "Bob Wilson",
        email: "bob@example.com",
        reason: "joining-community",
        message: "I want to join",
      }

      const request = {
        json: async () => formData,
      } as any

      await POST(request)

      const calls = mockResendSend.mock.calls as any[][]
      const confirmationCall = calls.find((call: any) =>
        call[0].to?.includes("bob@example.com") &&
        call[0].subject?.includes("We received your message")
      )

      expect(confirmationCall).toBeDefined()
      expect(confirmationCall![0]).toMatchObject({
        from: "Commons Hub Brussels <hello@commonshub.brussels>",
        to: ["bob@example.com"],
      })
    })

    test("handles all contact reasons correctly", async () => {
      const { POST } = await import("../../src/app/api/contact/route")
      const reasons = ["booking-room", "joining-community", "research", "visit", "media", "other"]

      for (const reason of reasons) {
        mockResendSend.mockClear()

        const request = {
          json: async () => ({
            name: "Test User",
            email: "test@example.com",
            reason,
            message: "Test message",
          }),
        } as any

        await POST(request)

        expect(mockResendSend).toHaveBeenCalledTimes(2)
      }
    })
  })

  describe("Contact Form Discord Integration", () => {
    test("creates Discord thread with contact details", async () => {
      const mockFetch = jest.fn<any>()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "message-456" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "thread-456" }),
        } as Response)

      global.fetch = mockFetch as any

      const { POST } = await import("../../src/app/api/contact/route")

      const formData = {
        name: "Alice Brown",
        email: "alice@example.com",
        organisation: "Community Group",
        reason: "media",
        message: "Press inquiry",
      }

      const request = {
        json: async () => formData,
      } as any

      await POST(request)

      // Should call Discord API
      expect(mockFetch).toHaveBeenCalled()

      // Find the message creation call
      const messageCalls = (mockFetch.mock.calls as any[][]).filter((call: any) =>
        call[0].includes("/channels/") && call[0].includes("/messages")
      )

      expect(messageCalls.length).toBeGreaterThan(0)

      // Check authorization header
      const firstCall = messageCalls[0] as any[]
      expect(firstCall[1].headers.Authorization).toContain("Bot test-discord-token")
    })
  })

  describe("Booking Request Email Integration", () => {
    test("sends booking confirmation and notification emails", async () => {
      const { POST } = await import("../../src/app/api/booking-request/route")

      const bookingData = {
        name: "Sarah Connor",
        email: "sarah@example.com",
        organisation: "Resistance",
        numberOfPeople: 10,
        dateTime: "2024-08-29T14:00:00",
        duration: 2,
        room: "ostrom",
        projector: true,
        whiteboard: false,
        facilitationKit: false,
        coffeeTea: true,
        snacks: false,
        isPrivate: false,
        additionalNotes: "Important meeting",
      }

      const request = {
        json: async () => bookingData,
      } as any

      await POST(request)

      expect(mockResendSend).toHaveBeenCalledTimes(2)

      // Check confirmation email
      const confirmationCall = (mockResendSend.mock.calls as any[][]).find((call: any) =>
        call[0].to?.includes("sarah@example.com")
      )
      expect(confirmationCall![0].subject).toContain("Booking Request Received")

      // Check notification email
      const notificationCall = (mockResendSend.mock.calls as any[][]).find((call: any) =>
        call[0].to?.includes("hello@commonshub.brussels")
      )
      expect(notificationCall![0].subject).toContain("New Booking Request")
    })

    test("marks private bookings in email subject", async () => {
      const { POST } = await import("../../src/app/api/booking-request/route")

      const bookingData = {
        name: "Private User",
        email: "private@example.com",
        organisation: "Secret Org",
        numberOfPeople: 5,
        dateTime: "2024-09-01T10:00:00",
        duration: 3,
        room: "angel",
        projector: false,
        whiteboard: true,
        facilitationKit: false,
        coffeeTea: false,
        snacks: false,
        isPrivate: true,
        additionalNotes: "",
      }

      const request = {
        json: async () => bookingData,
      } as any

      await POST(request)

      const notificationCall = (mockResendSend.mock.calls as any[][]).find((call: any) =>
        call[0].to?.includes("hello@commonshub.brussels")
      )
      expect(notificationCall![0].subject).toContain("[PRIVATE]")
    })

    test("includes all booking options in email", async () => {
      const { POST } = await import("../../src/app/api/booking-request/route")

      const bookingData = {
        name: "Full Options User",
        email: "full@example.com",
        organisation: "Test Company",
        numberOfPeople: 20,
        dateTime: "2024-10-15T09:00:00",
        duration: 4,
        room: "satoshi",
        projector: true,
        whiteboard: true,
        facilitationKit: true,
        coffeeTea: true,
        snacks: true,
        isPrivate: false,
        additionalNotes: "All options needed",
      }

      const request = {
        json: async () => bookingData,
      } as any

      await POST(request)

      const notificationCall = (mockResendSend.mock.calls as any[][]).find((call: any) =>
        call[0].to?.includes("hello@commonshub.brussels")
      )

      const html = notificationCall![0].html
      expect(html).toContain("Projector")
      expect(html).toContain("Whiteboard")
      expect(html).toContain("Facilitation kit")
      expect(html).toContain("Coffee/Tea")
      expect(html).toContain("Snacks")
    })
  })

  describe("Booking Request Discord Integration", () => {
    test("creates Discord thread with booking details", async () => {
      const mockFetch = jest.fn<any>()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "message-789" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "thread-789" }),
        } as Response)

      global.fetch = mockFetch as any

      const { POST } = await import("../../src/app/api/booking-request/route")

      const bookingData = {
        name: "Discord Test",
        email: "discord@example.com",
        organisation: "Test Org",
        numberOfPeople: 8,
        dateTime: "2024-11-20T13:00:00",
        duration: 2,
        room: "mush",
        projector: false,
        whiteboard: false,
        facilitationKit: false,
        coffeeTea: false,
        snacks: false,
        isPrivate: false,
        additionalNotes: "",
      }

      const request = {
        json: async () => bookingData,
      } as any

      await POST(request)

      expect(mockFetch).toHaveBeenCalled()

      const messageCalls = (mockFetch.mock.calls as any[][]).filter((call: any) =>
        call[0].includes("/channels/") && call[0].includes("/messages")
      )

      expect(messageCalls.length).toBeGreaterThan(0)
    })
  })

  describe("Error Handling", () => {
    test("returns error response when email sending fails", async () => {
      mockResendSend.mockRejectedValueOnce(new Error("Email service error"))

      const { POST } = await import("../../src/app/api/contact/route")

      const request = {
        json: async () => ({
          name: "Error Test",
          email: "error@example.com",
          reason: "test",
          message: "This should fail",
        }),
      } as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty("error")
    })
  })
})
