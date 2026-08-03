/**
 * @jest-environment jsdom
 */

import React from "react";
import "@testing-library/jest-dom/jest-globals";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { RecentContributors } from "@/components/recent-contributors";

jest.mock("@/components/member-card", () => ({
  MemberCard: ({ member }: { member: { displayName: string } }) => (
    <div>{member.displayName}</div>
  ),
}));

const contributorsResponse = {
  contributors: [
    {
      id: "123",
      username: "jane",
      displayName: "Jane",
      avatar: "https://example.com/jane.png",
      contributionCount: 7,
      joinedAt: "2026-06-01T00:00:00Z",
      walletAddress: null,
    },
    {
      id: "456",
      username: "no-avatar",
      displayName: "Hidden contributor",
      avatar: null,
      contributionCount: 3,
      joinedAt: null,
      walletAddress: null,
    },
  ],
  totalMembers: 2,
  activeCommoners: 2,
  timestamp: 1785744000,
  isMockData: false,
};

describe("RecentContributors", () => {
  beforeEach(() => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => contributorsResponse,
    } as Response);
  });

  test("renders the flat /api/contributors payload", async () => {
    render(<RecentContributors />);

    await waitFor(() => expect(screen.getByText("Jane")).toBeInTheDocument());

    expect(screen.getByText(/active contributors/).parentElement).toHaveTextContent(
      "1 active contributors"
    );
    expect(screen.getByText(/contributions/).parentElement).toHaveTextContent(
      "7 contributions"
    );
    expect(screen.queryByText("Hidden contributor")).not.toBeInTheDocument();
  });
});
