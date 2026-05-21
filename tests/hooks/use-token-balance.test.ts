/**
 * @jest-environment jsdom
 *
 * useTokenBalance Hook Tests
 * Tests the token balance hook that fetches CHT balance from the API
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals"
import { renderHook, waitFor } from "@testing-library/react"
import { useTokenBalance } from "../../src/hooks/use-token-balance"
import { useSession } from "next-auth/react"

// next-auth/react is mocked globally in jest.setup.js

describe("useTokenBalance", () => {
  const mockDiscordId = "123456789"
  const mockBalance = 150
  const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock fetch
    global.fetch = jest.fn<any>() as jest.MockedFunction<typeof fetch>
  })

  test("returns null balance when user is not logged in", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn<any>(),
    })

    const { result } = renderHook(() => useTokenBalance())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.balance).toBeNull()
  })

  test("fetches and returns balance for logged in user", async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          discordId: mockDiscordId,
          username: "testuser",
          discriminator: "0001",
          avatar: "avatar123",
          roles: [],
          roleDetails: [],
          accessToken: "token123",
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
      status: "authenticated",
      update: jest.fn<any>(),
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        walletAddress: "0x123",
        balance: mockBalance,
        monthlyActivity: [],
        totalReceived: 200,
        symbol: "CHT",
        firstActivityDate: "2024-01-01",
      }),
    } as Response)

    const { result } = renderHook(() => useTokenBalance())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith(`/api/member/${mockDiscordId}/tokens`)
    expect(result.current.balance).toBe(mockBalance)
  })

  test("returns 0 balance when API returns error", async () => {
    const errorTestDiscordId = "error-test-123"
    mockUseSession.mockReturnValue({
      data: {
        user: {
          discordId: errorTestDiscordId,
          username: "testuser",
          discriminator: "0001",
          avatar: "avatar123",
          roles: [],
          roleDetails: [],
          accessToken: "token123",
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
      status: "authenticated",
      update: jest.fn<any>(),
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    const { result } = renderHook(() => useTokenBalance())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.balance).toBe(0)
  })

  test("caches balance and doesn't refetch within cache duration", async () => {
    const cacheTestDiscordId = "cache-test-456"
    mockUseSession.mockReturnValue({
      data: {
        user: {
          discordId: cacheTestDiscordId,
          username: "testuser",
          discriminator: "0001",
          avatar: "avatar123",
          roles: [],
          roleDetails: [],
          accessToken: "token123",
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
      status: "authenticated",
      update: jest.fn<any>(),
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        walletAddress: "0x123",
        balance: mockBalance,
        monthlyActivity: [],
        totalReceived: 200,
        symbol: "CHT",
        firstActivityDate: "2024-01-01",
      }),
    } as Response)

    // First render - should fetch
    const { result: result1, unmount: unmount1 } = renderHook(() => useTokenBalance())
    await waitFor(() => {
      expect(result1.current.loading).toBe(false)
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    unmount1()

    // Second render within cache duration - should use cache
    const { result: result2 } = renderHook(() => useTokenBalance())
    await waitFor(() => {
      expect(result2.current.loading).toBe(false)
    })

    // Should still be 1 call (cached)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result2.current.balance).toBe(mockBalance)
  })
})
