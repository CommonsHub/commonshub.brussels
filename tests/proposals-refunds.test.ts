import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-refunds-"));
process.env.PROPOSALS_DIR = dir;
process.env.PROPOSAL_WALLET_SEED = "f".repeat(64);

import {
  addContribution,
  createProposal,
  getProposal,
  recordRefunds,
  timelineFor,
} from "@/modules/proposals/store";
import { proposalAddress, walletsConfigured } from "@/modules/payments/proposal-wallet";
import type { Refund } from "@/modules/proposals/types";

const author = { id: "acc_1", name: "Ana" };

function draft(title: string) {
  return {
    title,
    pitch: "",
    description: "",
    slots: [{ date: "2026-09-19", start: "14:00", duration: 4 }],
    roomSlug: "ostrom",
    expectedPeople: 25,
    audience: "public" as const,
    tickets: { eur: 10, tokens: 0.5, freeForMembers: true },
    needs: [],
  };
}

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("proposal numbers", () => {
  it("counts up, and puts the number in the url", () => {
    const first = createProposal(draft("First thing"), author);
    const second = createProposal(draft("Second thing"), author);

    expect(second.number).toBe(first.number + 1);
    expect(first.slug).toBe(`${first.number}-first-thing`);
  });

  it("finds a proposal by number, by slug, or by id", () => {
    const proposal = createProposal(draft("Findable"), author);

    expect(getProposal(String(proposal.number))?.id).toBe(proposal.id);
    expect(getProposal(proposal.slug)?.id).toBe(proposal.id);
    expect(getProposal(proposal.id)?.id).toBe(proposal.id);
    // A wrong title with the right number still lands: the number is the key.
    expect(getProposal(`${proposal.number}-whatever-someone-typed`)?.id).toBe(proposal.id);
  });

  it("does not reuse a number if the counter goes missing", () => {
    const before = createProposal(draft("Before"), author);
    fs.rmSync(path.join(dir, "counter.json"), { force: true });
    const after = createProposal(draft("After"), author);
    expect(after.number).toBeGreaterThan(before.number);
  });
});

describe("the wallet a proposal collects into", () => {
  it("is derived, so the same proposal always has the same address", () => {
    expect(walletsConfigured()).toBe(true);
    const address = proposalAddress("abc123");
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(proposalAddress("abc123")).toBe(address);
  });

  it("is different for every proposal", () => {
    expect(proposalAddress("abc123")).not.toBe(proposalAddress("abc124"));
  });
});

describe("recording refunds", () => {
  it("shows up on the proposal and in the activity log", () => {
    const proposal = createProposal(draft("Refunded thing"), author);
    const contribution = addContribution(proposal.id, {
      kind: "ticket",
      currency: "eur",
      grossAmount: 10,
      adminFee: 1,
      netAmount: 9,
      contributorId: "acc_2",
      contributorName: "Rita",
      seats: 1,
      reference: "cs_test_123",
    });

    const refund: Refund = {
      id: "ref_1",
      contributionId: contribution!.id,
      contributorId: "acc_2",
      contributorName: "Rita",
      currency: "eur",
      amount: 10,
      reference: "re_test_123",
      createdAt: new Date().toISOString(),
    };

    const updated = recordRefunds(proposal.id, [refund], "This event is not going ahead.");
    expect(updated?.refunds).toHaveLength(1);
    expect(updated?.refunds[0].contributorName).toBe("Rita");

    const timeline = timelineFor(updated!);
    const entry = timeline.find((i) => i.kind === "refund");
    expect(entry).toBeDefined();
    if (entry?.kind !== "refund") return;
    expect(entry.refunds[0].amount).toBe(10);
    expect(entry.note).toBe("This event is not going ahead.");
  });

  it("skips what has already gone back, so running it twice is safe", async () => {
    const proposal = createProposal(draft("Twice thing"), author);
    const first = addContribution(proposal.id, {
      kind: "donation",
      currency: "eur",
      grossAmount: 20,
      adminFee: 2,
      netAmount: 18,
      contributorId: "acc_3",
      contributorName: "Tom",
      seats: 0,
      reference: "cs_test_a",
    })!;
    const second = addContribution(proposal.id, {
      kind: "donation",
      currency: "eur",
      grossAmount: 5,
      adminFee: 0.5,
      netAmount: 4.5,
      contributorId: "acc_4",
      contributorName: "Sofie",
      seats: 0,
      reference: "cs_test_b",
    })!;

    const { refundEverything } = await import("@/modules/payments/refunds");
    const live = getProposal(proposal.id)!;

    // Nothing refunded yet: both are attempted (and fail here, with no Stripe
    // key configured — which is the point: failures are reported, not hidden).
    const firstRun = await refundEverything(live.id, live.contributions, new Set());
    expect(firstRun).toHaveLength(2);
    expect(firstRun.every((r) => !r.ok && r.error)).toBe(true);

    // With one already refunded, only the other is attempted.
    const secondRun = await refundEverything(live.id, live.contributions, new Set([first.id]));
    expect(secondRun.map((r) => r.contributionId)).toEqual([second.id]);

    // With both refunded, there is nothing left to do.
    const thirdRun = await refundEverything(
      live.id,
      live.contributions,
      new Set([first.id, second.id]),
    );
    expect(thirdRun).toHaveLength(0);
  });
});
