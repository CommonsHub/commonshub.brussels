import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-refunds-"));
process.env.PROPOSALS_DIR = dir;
process.env.PROPOSAL_SIGNER_KEY = "1".repeat(64);

import {
  addContribution,
  createProposal,
  getProposal,
  recordRefunds,
  timelineFor,
} from "@/modules/proposals/store";
import { safeOwners, safesConfigured, saltNonce, SAFE_THRESHOLD } from "@/modules/payments/safe";
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

describe("the Safe a proposal collects into", () => {
  it("is owned by the server signer, and one signature is enough", () => {
    expect(safesConfigured()).toBe(true);
    const owners = safeOwners();
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(SAFE_THRESHOLD).toBe(1);
  });

  it("becomes 1-of-2 when a second owner is configured", () => {
    const second = "0x1111111111111111111111111111111111111111";
    process.env.SAFE_SECOND_OWNER = second;
    try {
      const owners = safeOwners();
      expect(owners).toHaveLength(2);
      expect(owners[1].toLowerCase()).toBe(second);
      // Still a threshold of one: the server can act alone, the human can too.
      expect(SAFE_THRESHOLD).toBe(1);
    } finally {
      delete process.env.SAFE_SECOND_OWNER;
    }
  });

  it("salts the address with the proposal, deterministically", () => {
    const salt = saltNonce("abc123");
    expect(salt).toBe(saltNonce("abc123"));
    expect(salt).not.toBe(saltNonce("abc124"));
    expect(salt > BigInt(0)).toBe(true);
  });

  it("ignores a second owner that is the signer itself", () => {
    process.env.SAFE_SECOND_OWNER = safeOwners()[0];
    try {
      expect(safeOwners()).toHaveLength(1);
    } finally {
      delete process.env.SAFE_SECOND_OWNER;
    }
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
