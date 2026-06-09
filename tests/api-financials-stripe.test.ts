/**
 * Test for Stripe transactions in the financials API
 * Verifies that Stripe data is correctly loaded from the new file structure
 * @jest-environment node
 */

import fs from "fs";
import path from "path";

// Lazy getter for DATA_DIR to ensure jest.setup.js has set it
const getDataDir = () => process.env.DATA_DIR || path.join(process.cwd(), "data");

// Check if Stripe data files exist for testing
const hasStripeData = () => {
  const dataDir = getDataDir();
  const year = "2025";
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

  for (const month of months) {
    const stripeDir = path.join(dataDir, year, month, "finance", "stripe");
    if (fs.existsSync(stripeDir)) {
      const files = fs.readdirSync(stripeDir).filter(f => f.endsWith(".json"));
      if (files.length > 0) return true;
    }
  }
  return false;
};

describe("Financials API - Stripe Transactions", () => {
  it("should have Stripe data files in the correct location", () => {
    if (!hasStripeData()) {
      console.log("⚠️ Skipping: no Stripe data files found in", getDataDir());
      return;
    }

    const dataDir = getDataDir();
    const year = "2025";
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    let foundFiles = 0;

    for (const month of months) {
      const stripeDir = path.join(dataDir, year, month, "finance", "stripe");
      if (!fs.existsSync(stripeDir)) continue;

      const files = fs.readdirSync(stripeDir).filter(f => f.endsWith(".json"));
      for (const file of files) {
        const stripePath = path.join(stripeDir, file);
        foundFiles++;

        // Verify file structure
        const content = fs.readFileSync(stripePath, "utf-8");
        const data = JSON.parse(content);

        expect(data).toHaveProperty("transactions");
        expect(Array.isArray(data.transactions)).toBe(true);

        if (data.transactions.length > 0) {
          const tx = data.transactions[0];
          expect(tx).toHaveProperty("id");
          expect(tx).toHaveProperty("created");
          expect(tx).toHaveProperty("amount");
          expect(tx).toHaveProperty("net");
          expect(tx).toHaveProperty("currency");
        }
      }
    }

    expect(foundFiles).toBeGreaterThan(0);
  });

  it("should load Stripe transactions via the financials lib", async () => {
    if (!hasStripeData()) {
      console.log("⚠️ Skipping: no Stripe data files found in", getDataDir());
      return;
    }

    // Load the account financials directly from the server lib
    const { getAccountFinancials } = await import("@/lib/financials");

    const data = getAccountFinancials("stripe");
    expect(data).not.toBeNull();
    if (!data) return;

    // Verify response structure
    expect(data).toHaveProperty("slug", "stripe");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("provider", "stripe");
    expect(data).toHaveProperty("balance");
    expect(data).toHaveProperty("totalInflow");
    expect(data).toHaveProperty("totalOutflow");
    expect(data).toHaveProperty("monthlyBreakdown");
    expect(data).toHaveProperty("recentTransactions");

    // Verify monthly breakdown
    expect(Array.isArray(data.monthlyBreakdown)).toBe(true);

    // Verify transactions
    expect(Array.isArray(data.recentTransactions)).toBe(true);
    if (data.recentTransactions.length > 0) {
      const tx = data.recentTransactions[0];
      expect(tx).toHaveProperty("hash");
      expect(tx).toHaveProperty("date");
      expect(tx).toHaveProperty("description");
      expect(tx).toHaveProperty("amount");
      expect(tx).toHaveProperty("net");
      expect(tx).toHaveProperty("direction");
      expect(["in", "out"]).toContain(tx.direction);

      // Verify source is a string (not an object)
      if (tx.source) {
        expect(typeof tx.source).toBe("string");
      }
    }
  });

  it("should have transactions with valid data", async () => {
    if (!hasStripeData()) {
      console.log("⚠️ Skipping: no Stripe data files found in", getDataDir());
      return;
    }

    const { getAccountFinancials } = await import("@/lib/financials");
    const data = getAccountFinancials("stripe");
    expect(data).not.toBeNull();
    if (!data) return;

    // Should have some transactions
    expect(data.recentTransactions.length).toBeGreaterThan(0);

    // Check first transaction has valid amounts
    const firstTx = data.recentTransactions[0];
    expect(typeof firstTx.amount).toBe("number");
    expect(typeof firstTx.net).toBe("number");
    expect(typeof firstTx.fee).toBe("number");

    // Monthly breakdown should have data
    expect(data.monthlyBreakdown.length).toBeGreaterThan(0);

    const firstMonth = data.monthlyBreakdown[0];
    expect(firstMonth).toHaveProperty("month");
    expect(firstMonth).toHaveProperty("inflow");
    expect(firstMonth).toHaveProperty("outflow");
    expect(firstMonth).toHaveProperty("net");
    expect(typeof firstMonth.inflow).toBe("number");
    expect(typeof firstMonth.outflow).toBe("number");
  });
});
