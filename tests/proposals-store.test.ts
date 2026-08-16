import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-proposals-"));
process.env.PROPOSALS_DIR = dir;

// The store reads PROPOSALS_DIR at import time, so set it before importing.
import {
  addComment,
  addContribution,
  createProposal,
  getProposal,
  listProposals,
  progressFor,
  reviseProposal,
  setStatus,
  timelineFor,
} from "@/modules/proposals/store";
import { splitEuroContribution } from "@/modules/proposals/funding";

const author = { id: "acc_1", name: "Ana" };

function draft(overrides: Record<string, unknown> = {}) {
  return {
    title: "Repair café",
    pitch: "Fix it together instead of binning it.",
    description: "Bring a lamp, a laptop, a jacket.",
    slots: [{ date: "2026-09-19", start: "14:00", duration: 4 }],
    roomSlug: "ostrom",
    expectedPeople: 25,
    audience: "public" as const,
    tickets: { eur: 10, tokens: 0.5, freeForMembers: true },
    needs: ["Coffee"],
    ...overrides,
  };
}

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("the proposal log", () => {
  it("creates a proposal that can be read back by id and by slug", () => {
    const created = createProposal(draft(), author);
    expect(created.status).toBe("open");
    expect(created.version).toBe(1);
    // One date option means the date is already settled.
    expect(created.confirmedSlotId).toBe(created.slots[0].id);

    expect(getProposal(created.id)?.title).toBe("Repair café");
    expect(getProposal(created.slug)?.id).toBe(created.id);
    expect(listProposals().some((p) => p.id === created.id)).toBe(true);
  });

  it("records a revision with a readable diff instead of overwriting", () => {
    const created = createProposal(draft({ title: "Zero-waste cooking" }), author);
    const revised = reviseProposal(
      created.id,
      { roomSlug: "playroom", expectedPeople: 10 },
      { id: "acc_2", name: "Karim" },
    );

    expect(revised?.version).toBe(2);
    expect(revised?.roomSlug).toBe("playroom");

    const revision = revised?.revisions[0];
    expect(revision?.authorName).toBe("Karim");
    expect(revision?.changes).toEqual(
      expect.arrayContaining([{ field: "roomSlug", from: "ostrom", to: "playroom" }]),
    );

    // The original values are still in the log.
    const timeline = timelineFor(revised!);
    expect(timeline.some((i) => i.kind === "revision")).toBe(true);
  });

  it("keeps comments and contributions in one timeline", () => {
    const created = createProposal(draft({ title: "Commons game night" }), author);
    addComment(created.id, "Can I bring a sewing machine?", { id: "acc_3", name: "Sofie" });
    const split = splitEuroContribution(20);
    addContribution(created.id, {
      kind: "donation",
      currency: "eur",
      grossAmount: split.charged,
      adminFee: split.adminFee,
      netAmount: split.net,
      contributorId: "acc_3",
      contributorName: "Sofie",
      seats: 0,
    });

    const timeline = timelineFor(getProposal(created.id)!);
    expect(timeline.map((i) => i.kind)).toEqual(["comment", "contribution"]);
  });
});

describe("reaching the target", () => {
  it("moves to funded on its own, but never to confirmed", () => {
    const created = createProposal(draft({ title: "Funded thing" }), author);
    // Ostrom for 4h is €400; 12 tokens covers it outright.
    addContribution(created.id, {
      kind: "donation",
      currency: "tokens",
      grossAmount: 12,
      adminFee: 0,
      netAmount: 12,
      contributorId: "acc_9",
      contributorName: "Rita",
      seats: 0,
    });

    const funded = getProposal(created.id)!;
    expect(progressFor(funded).funded).toBe(true);
    expect(funded.status).toBe("funded");
  });

  it("still needs someone to confirm it", () => {
    const created = createProposal(draft({ title: "Confirmed thing" }), author);
    addContribution(created.id, {
      kind: "donation",
      currency: "tokens",
      grossAmount: 12,
      adminFee: 0,
      netAmount: 12,
      contributorId: "acc_9",
      contributorName: "Rita",
      seats: 0,
    });

    const confirmed = setStatus(created.id, "confirmed", { id: "acc_s", name: "Karim" });
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.decidedBy).toBe("Karim");
  });

  it("does not fund an event nobody has paid for", () => {
    const created = createProposal(draft({ title: "Unfunded thing" }), author);
    expect(getProposal(created.id)!.status).toBe("open");
    expect(progressFor(getProposal(created.id)!).coverage).toBe(0);
  });
});
