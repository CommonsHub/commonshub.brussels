import {
  ADMIN_FEE_RATE,
  bookedHours,
  fundingProgress,
  fundingTarget,
  splitEuroContribution,
  splitTokenContribution,
  suggestRoom,
  suggestTokenPrice,
  ticketsToGo,
} from "@/modules/proposals/funding";

describe("funding target", () => {
  it("prices a booking from the room's own euro and token rates", () => {
    // Ostrom is €100/h and 3 tokens/h.
    const target = fundingTarget({ roomSlug: "ostrom", hours: 4, expectedPeople: 25 });
    expect(target.eur).toBe(400);
    expect(target.tokens).toBe(12);
    expect(target.estimated).toBe(false);
    expect(target.roomName).toBe("Ostrom Room");
  });

  it("estimates with the smallest room that fits when none is picked", () => {
    const target = fundingTarget({ roomSlug: null, hours: 2, expectedPeople: 12 });
    expect(target.estimated).toBe(true);
    // Angel seats 12 at €35/h; Mush (10) is too small.
    expect(target.roomSlug).toBe("angel");
    expect(target.eur).toBe(70);
  });

  it("suggests nothing when the crowd is bigger than the building", () => {
    expect(suggestRoom(500)).toBeNull();
    const target = fundingTarget({ roomSlug: null, hours: 2, expectedPeople: 500 });
    expect(target.eur).toBe(0);
  });

  it("takes the longest option until a date is picked, then that one", () => {
    const slots = [
      { id: "s1", duration: 2 },
      { id: "s2", duration: 5 },
    ];
    expect(bookedHours(slots, null)).toBe(5);
    expect(bookedHours(slots, "s1")).toBe(2);
  });
});

describe("the hub's 10% admin fee", () => {
  it("comes out of euro contributions", () => {
    const split = splitEuroContribution(10);
    expect(split.charged).toBe(10);
    expect(split.adminFee).toBe(1);
    expect(split.net).toBe(9);
    expect(ADMIN_FEE_RATE).toBe(0.1);
  });

  it("is never charged on token contributions", () => {
    const split = splitTokenContribution(3);
    expect(split.adminFee).toBe(0);
    expect(split.net).toBe(3);
  });

  it("adds up: what the payer pays is the fee plus what funds the room", () => {
    for (const amount of [5, 10, 12.5, 33.33, 100]) {
      const split = splitEuroContribution(amount);
      expect(split.adminFee + split.net).toBeCloseTo(split.charged, 2);
    }
  });
});

describe("funding progress", () => {
  const target = fundingTarget({ roomSlug: "ostrom", hours: 4, expectedPeople: 25 });

  const euro = (amount: number, contributorId: string) => {
    const split = splitEuroContribution(amount);
    return {
      currency: "eur" as const,
      netAmount: split.net,
      adminFee: split.adminFee,
      contributorId,
    };
  };

  const tokens = (amount: number, contributorId: string) => ({
    currency: "tokens" as const,
    netAmount: amount,
    adminFee: 0,
    contributorId,
  });

  it("counts the net of euro contributions, not the gross", () => {
    // €100 charged → €90 towards a €400 room.
    const progress = fundingProgress(target, [euro(100, "a")]);
    expect(progress.raisedEur).toBe(90);
    expect(progress.adminFeesEur).toBe(10);
    expect(progress.coverage).toBeCloseTo(0.225, 3);
    expect(progress.funded).toBe(false);
  });

  it("lets the two currencies cover the same target together", () => {
    // Half in euros (€200 net) and half in tokens (6 of 12).
    const progress = fundingProgress(target, [
      euro(200 / 0.9, "a"), // gross that nets €200
      tokens(6, "b"),
    ]);
    expect(progress.coverage).toBeCloseTo(1, 2);
    expect(progress.funded).toBe(true);
    expect(progress.contributorCount).toBe(2);
  });

  it("says what is still missing in either currency", () => {
    const progress = fundingProgress(target, [tokens(3, "a")]); // a quarter
    expect(progress.coverage).toBeCloseTo(0.25, 3);
    expect(progress.remainingEur).toBe(300);
    expect(progress.remainingTokens).toBe(9);
  });

  it("treats a free room as covered", () => {
    const free = fundingTarget({ roomSlug: "coworking", hours: 2, expectedPeople: 5 });
    const progress = fundingProgress(free, []);
    expect(progress.funded).toBe(true);
  });

  it("counts how many tickets would close the gap", () => {
    const progress = fundingProgress(target, []);
    // €400 to raise, €10 tickets net €9 each.
    expect(ticketsToGo(progress, { eur: 10, tokens: 0.5 })).toBe(Math.ceil(400 / 9));
    const funded = fundingProgress(target, [tokens(12, "a")]);
    expect(ticketsToGo(funded, { eur: 10, tokens: 0.5 })).toBe(0);
    expect(ticketsToGo(progress, { eur: null, tokens: null })).toBeNull();
  });
});

describe("suggested token price", () => {
  it("uses the room's own euro/token ratio", () => {
    // Ostrom: 3 tokens per €100, so €100 ≈ 3 tokens.
    expect(suggestTokenPrice(100, "ostrom")).toBe(3);
    // Small amounts round up to half a token rather than to nothing.
    expect(suggestTokenPrice(10, "ostrom")).toBe(0.5);
  });

  it("has nothing to suggest without a room", () => {
    expect(suggestTokenPrice(10, null)).toBeNull();
  });
});
