/**
 * Stripe API Tests
 * Tests the Stripe helper functions for fetching balance and transactions
 */

import { describe, test, expect, jest, beforeEach, afterAll } from "@jest/globals";
import {
  fetchStripeBalance,
  fetchCurrentMonthTransactions,
  calculateStripeBalance,
  getMonthKey,
  getMonthKeyFromDate,
} from "../src/lib/stripe";
import settings from "../src/settings/settings.json";

describe("Stripe API", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: "sk_test_1234567890",
    };
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe("fetchStripeBalance", () => {
    test("fetches Stripe balance successfully", async () => {
      const mockBalance = {
        available: [{ amount: 10000, currency: "eur" }],
        pending: [{ amount: 5000, currency: "eur" }],
      };

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => mockBalance,
      } as Response);
      global.fetch = mockFetch as any;

      const result = await fetchStripeBalance("sk_test_1234567890");

      expect(result).toEqual(mockBalance);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stripe.com/v1/balance",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk_test_1234567890",
          }),
        })
      );
    });

    test("throws error on API failure", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        statusText: "Unauthorized",
      } as Response);
      global.fetch = mockFetch as any;

      await expect(fetchStripeBalance("invalid-key")).rejects.toThrow(
        "Failed to fetch Stripe balance"
      );
    });
  });

  describe("fetchCurrentMonthTransactions", () => {
    test("fetches current month transactions successfully", async () => {
      const now = Math.floor(Date.now() / 1000);
      const currentMonth = getMonthKeyFromDate(new Date());

      const mockTransactions = {
        data: [
          {
            id: "txn_123",
            created: now - 86400, // 1 day ago
            amount: 10000,
            fee: 320,
            net: 9680,
            currency: "eur",
            type: "charge",
            description: "Test charge",
            reporting_category: "charge",
          },
        ],
        has_more: false,
        object: "list",
        url: "/v1/balance_transactions",
      };

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => mockTransactions,
      } as Response);
      global.fetch = mockFetch as any;

      const result = await fetchCurrentMonthTransactions("sk_test_1234567890");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("txn_123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.stripe.com/v1/balance_transactions"),
        expect.any(Object)
      );
    });

    test("filters out transactions from previous months", async () => {
      const now = Math.floor(Date.now() / 1000);
      const lastMonth = now - 35 * 86400; // 35 days ago (previous month)

      const mockTransactions = {
        data: [
          {
            id: "txn_current",
            created: now - 86400, // Current month
            amount: 10000,
            fee: 320,
            net: 9680,
            currency: "eur",
            type: "charge",
            reporting_category: "charge",
          },
          {
            id: "txn_old",
            created: lastMonth, // Previous month
            amount: 5000,
            fee: 160,
            net: 4840,
            currency: "eur",
            type: "charge",
            reporting_category: "charge",
          },
        ],
        has_more: false,
        object: "list",
        url: "/v1/balance_transactions",
      };

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => mockTransactions,
      } as Response);
      global.fetch = mockFetch as any;

      const result = await fetchCurrentMonthTransactions("sk_test_1234567890");

      // Should only include current month transaction
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("txn_current");
    });

    test("handles pagination correctly", async () => {
      // Use November 15, 2025 as test date
      const nov15_2025 = new Date("2025-11-15T12:00:00Z");
      jest.useFakeTimers();
      jest.setSystemTime(nov15_2025);

      // November 2025 timestamps (correct year)
      const nov2025Start = 1761955200; // Nov 1, 2025 00:00:00 UTC
      const nov2025End = 1764547199; // Nov 30, 2025 23:59:59 UTC

      const firstPage = {
        data: Array.from({ length: 100 }, (_, i) => ({
          id: `txn_${i}`,
          // Create timestamps within November 2025, spaced throughout the month
          created: nov2025Start + Math.floor((i / 100) * (nov2025End - nov2025Start)),
          amount: 10000,
          fee: 320,
          net: 9680,
          currency: "eur",
          type: "charge",
          reporting_category: "charge",
        })),
        has_more: true,
        object: "list",
        url: "/v1/balance_transactions",
      };

      const secondPage = {
        data: Array.from({ length: 15 }, (_, i) => ({
          id: `txn_${100 + i}`,
          // Additional transactions also in November 2025
          created: nov2025Start + Math.floor(((100 + i) / 115) * (nov2025End - nov2025Start)),
          amount: 5000,
          fee: 160,
          net: 4840,
          currency: "eur",
          type: "charge",
          reporting_category: "charge",
        })),
        has_more: false,
        object: "list",
        url: "/v1/balance_transactions",
      };

      let callCount = 0;
      const mockFetch = jest.fn<any>().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => firstPage,
          } as Response);
        } else {
          return Promise.resolve({
            ok: true,
            json: async () => secondPage,
          } as Response);
        }
      });
      global.fetch = mockFetch as any;

      const result = await fetchCurrentMonthTransactions("sk_test_1234567890");

      jest.useRealTimers();

      expect(result).toHaveLength(115); // 100 from first page + 15 from second (matching real Nov 2025 data)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("calculateStripeBalance", () => {
    test("calculates balance from available and pending", () => {
      const balanceData = {
        available: [{ amount: 10000, currency: "eur" }],
        pending: [{ amount: 5000, currency: "eur" }],
      };

      const result = calculateStripeBalance(balanceData, "eur");
      // Amounts are in cents, so 10000 + 5000 = 15000 cents = 150.00 EUR
      expect(result).toBe(150);
    });

    test("uses first available currency if specified currency not found", () => {
      const balanceData = {
        available: [{ amount: 20000, currency: "usd" }],
        pending: [{ amount: 10000, currency: "usd" }],
      };

      const result = calculateStripeBalance(balanceData, "eur");
      // Should use USD since EUR not found
      expect(result).toBe(300);
    });

    test("handles zero balance", () => {
      const balanceData = {
        available: [{ amount: 0, currency: "eur" }],
        pending: [{ amount: 0, currency: "eur" }],
      };

      const result = calculateStripeBalance(balanceData, "eur");
      expect(result).toBe(0);
    });

    test("handles empty arrays", () => {
      const balanceData = {
        available: [],
        pending: [],
      };

      const result = calculateStripeBalance(balanceData, "eur");
      expect(result).toBe(0);
    });
  });

  describe("getMonthKey", () => {
    test("returns correct month key from timestamp", () => {
      // January 1, 2024 00:00:00 UTC
      const timestamp = 1704067200;
      const result = getMonthKey(timestamp);
      expect(result).toBe("2024-01");
    });

    test("pads month with zero", () => {
      // January 1, 2024
      const timestamp = 1704067200;
      const result = getMonthKey(timestamp);
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe("getMonthKeyFromDate", () => {
    test("returns correct month key from Date object", () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      const result = getMonthKeyFromDate(date);
      expect(result).toBe("2024-01");
    });

    test("handles December correctly", () => {
      const date = new Date(2024, 11, 25); // December 25, 2024
      const result = getMonthKeyFromDate(date);
      expect(result).toBe("2024-12");
    });
  });

  describe("Integration with settings", () => {
    test("can fetch balance for Stripe account from settings", async () => {
      const stripeAccount = settings.finance.accounts.find(
        (a) => a.slug === "stripe"
      );

      if (!stripeAccount || stripeAccount.provider !== "stripe") {
        throw new Error("Stripe account not found in settings");
      }

      const mockBalance = {
        available: [{ amount: 10000, currency: "eur" }],
        pending: [{ amount: 5000, currency: "eur" }],
      };

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => mockBalance,
      } as Response);
      global.fetch = mockFetch as any;

      const result = await fetchStripeBalance("sk_test_1234567890");
      const balance = calculateStripeBalance(result, stripeAccount.currency?.toLowerCase() || "eur");

      expect(balance).toBe(150);
      expect(stripeAccount.currency).toBe("EUR");
    });
  });
});






