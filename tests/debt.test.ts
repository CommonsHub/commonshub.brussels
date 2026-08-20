import * as fs from "fs";
import * as path from "path";
import {
  parseAmount,
  parseCsv,
  parseDate,
  parseLedger,
  formatEuro,
} from "@/lib/debt";

const csv = fs.readFileSync(path.join(__dirname, "fixtures", "debt-tokens.csv"), "utf8");
const ledger = parseLedger(csv, "2026-08-20T00:00:00.000Z");

describe("reading the sheet", () => {
  it("keeps commas inside quoted fields together", () => {
    const rows = parseCsv('a,b,c\n1,"two, still two",3\n');
    expect(rows[1]).toEqual(["1", "two, still two", "3"]);
  });

  it("reads the amounts the sheet actually contains", () => {
    expect(parseAmount("10 000 €")).toBe(10000);
    expect(parseAmount("2 416,11 €")).toBe(2416.11);
    expect(parseAmount("74,6 €")).toBe(74.6);
    expect(parseAmount("-896 €")).toBe(-896);
    expect(parseAmount("")).toBe(0);
  });

  it("reads both date spellings as day-first", () => {
    expect(parseDate("16/05/2024")).toBe("2024-05-16");
    expect(parseDate("6/6/2024")).toBe("2024-06-06");
    expect(parseDate("nonsense")).toBeNull();
  });
});

describe("the ledger adds up", () => {
  it("has every transaction from the sheet", () => {
    expect(ledger.transactions).toHaveLength(44);
  });

  it("totals what the stewards report", () => {
    expect(ledger.totals.minted).toBe(143254.71);
    expect(ledger.totals.burned).toBe(10133);
    expect(ledger.totals.outstanding).toBe(133121.71);
  });

  it("balances the holders against the total, to the cent", () => {
    const sum = ledger.holders.reduce((total, holder) => total + holder.balance, 0);
    expect(Math.round(sum * 100) / 100).toBe(ledger.totals.outstanding);
  });

  it("makes outstanding exactly minted minus burned", () => {
    expect(ledger.totals.outstanding).toBe(
      Math.round((ledger.totals.minted - ledger.totals.burned) * 100) / 100,
    );
  });

  it("counts who still holds debt and who is settled", () => {
    expect(ledger.totals.holders).toBe(19);
    expect(ledger.totals.settledHolders).toBe(2);
    const settled = ledger.holders.filter((h) => h.balance === 0).map((h) => h.name).sort();
    expect(settled).toEqual(["Bastien", "Daniel"]);
  });

  it("recomputes running balances rather than trusting the sheet's rounding", () => {
    // The sheet rounds Franfin's running balance to 31 640; the transactions
    // say 31 641, and the transactions are the record.
    const franfin = ledger.holders.find((h) => h.name === "Franfin SA");
    expect(franfin?.balance).toBe(31641);
    // Same story for the cents on Jana's settlement bonus.
    expect(ledger.holders.find((h) => h.name === "Jana")?.balance).toBe(2416.11);
  });

  it("puts a burn in the ledger as a negative amount", () => {
    const burns = ledger.transactions.filter((t) => t.type === "BURN");
    expect(burns.length).toBeGreaterThan(0);
    expect(burns.every((t) => t.amount < 0)).toBe(true);
  });

  it("runs a holder's balance down to zero when their debt is settled", () => {
    const bastien = ledger.transactions.filter((t) => t.name === "Bastien");
    expect(bastien.at(-1)?.balance).toBe(0);
  });

  it("reads the transactions in date order", () => {
    const dates = ledger.transactions.map((t) => t.date);
    expect([...dates].sort()).toEqual(dates);
    expect(ledger.totals.firstAt).toBe("2024-05-16");
    expect(ledger.totals.lastAt).toBe("2026-08-01");
  });

  it("picks up the on-chain record where there is one", () => {
    const withTx = ledger.transactions.filter((t) => t.txUrl);
    expect(withTx.length).toBeGreaterThan(5);
    expect(withTx.every((t) => t.txUrl?.startsWith("https://txinfo.xyz/"))).toBe(true);
    // A Discord or document link is a reference, never mistaken for a tx.
    expect(ledger.transactions.every((t) => !t.referenceUrl?.includes("txinfo.xyz"))).toBe(true);
  });
});

describe("showing the figures", () => {
  it("writes euros the way the rest of the site does", () => {
    expect(formatEuro(133121.71)).toBe("€133,121.71");
    expect(formatEuro(-896)).toBe("−€896.00");
    expect(formatEuro(2000, { sign: true })).toBe("+€2,000.00");
  });
});
