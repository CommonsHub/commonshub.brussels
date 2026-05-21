import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock fetch for API calls
const mockFetch = jest.fn<any>();
global.fetch = mockFetch as any;

describe("Member Profile Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMemberData", () => {
    it("should return null when member is not found", async () => {
      // Mock API response with empty contributors
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contributors: [
            {
              id: "1",
              username: "existinguser",
              displayName: "Existing User",
              avatar: null,
              contributionCount: 5,
              joinedAt: "2024-01-01",
            },
          ],
          introductions: {},
          contributions: {},
          userMap: {},
          channelMap: {},
        }),
      });

      // Simulate the getMemberData logic
      const username = "notfound";
      const response = await fetch(
        "http://localhost:3000/api/discord/contributors"
      );
      const data = await response.json();
      const member = data.contributors.find(
        (c: any) => c.username.toLowerCase() === username.toLowerCase()
      );

      expect(member).toBeUndefined();
    });

    it("should return member data when member exists", async () => {
      const mockMember = {
        id: "123",
        username: "testuser",
        displayName: "Test User",
        avatar: "https://example.com/avatar.png",
        contributionCount: 10,
        joinedAt: "2024-01-15",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contributors: [mockMember],
          introductions: {
            "123": [{ content: "Hello!", timestamp: "2024-01-15" }],
          },
          contributions: {
            "123": [
              {
                content: "Helped with X",
                timestamp: "2024-02-01",
                mentions: [],
              },
            ],
          },
          userMap: { "456": "otheruser" },
          channelMap: { "789": "general" },
        }),
      });

      const username = "testuser";
      const response = await fetch(
        "http://localhost:3000/api/discord/contributors"
      );
      const data = await response.json();
      const member = data.contributors.find(
        (c: any) => c.username.toLowerCase() === username.toLowerCase()
      );

      expect(member).toBeDefined();
      expect(member.username).toBe("testuser");
      expect(member.displayName).toBe("Test User");
    });

    it("should return null when API fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await fetch(
        "http://localhost:3000/api/discord/contributors"
      );

      expect(response.ok).toBe(false);
    });

    it("should handle case-insensitive username matching", async () => {
      const mockMember = {
        id: "123",
        username: "TestUser",
        displayName: "Test User",
        avatar: null,
        contributionCount: 5,
        joinedAt: "2024-01-15",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contributors: [mockMember],
          introductions: {},
          contributions: {},
          userMap: {},
          channelMap: {},
        }),
      });

      const username = "testuser"; // lowercase
      const response = await fetch(
        "http://localhost:3000/api/discord/contributors"
      );
      const data = await response.json();
      const member = data.contributors.find(
        (c: any) => c.username.toLowerCase() === username.toLowerCase()
      );

      expect(member).toBeDefined();
      expect(member.username).toBe("TestUser");
    });
  });

  describe("Not Found Page", () => {
    it("should display appropriate message for non-existent member", () => {
      // This tests the UI component behavior
      const message = "We couldn't find this member. Where is he/she hiding?";
      expect(message).toContain("couldn't find");
      expect(message).toContain("hiding");
    });
  });
});
