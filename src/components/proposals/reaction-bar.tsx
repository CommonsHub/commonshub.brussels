"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";

export interface ReactionGroup {
  emoji: string;
  count: number;
  names: string[];
  mine: boolean;
}

const PALETTE = ["👍", "❤️", "🎉", "😄", "🤔", "🙏"];

/**
 * Emoji on a proposal or a comment. Tap to add yours, tap again to take it
 * back — the same semantics nostr reactions have.
 */
export function ReactionBar({
  proposalId,
  targetId,
  initial,
  signedIn,
}: {
  proposalId: string;
  targetId: string;
  initial: ReactionGroup[];
  signedIn: boolean;
}) {
  const [groups, setGroups] = useState<ReactionGroup[]>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(emoji: string) {
    if (!signedIn || busy) return;
    setBusy(true);
    setPickerOpen(false);
    try {
      const response = await fetch(`/api/proposals/${proposalId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, emoji }),
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.reactions ?? []);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn && groups.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.map((group) => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => toggle(group.emoji)}
          disabled={!signedIn || busy}
          title={group.names.join(", ")}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
            group.mine
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/40"
          } ${signedIn ? "" : "cursor-default"}`}
        >
          <span>{group.emoji}</span>
          <span className="tabular-nums text-muted-foreground">{group.count}</span>
        </button>
      ))}

      {signedIn && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="Add a reaction"
            className="inline-flex items-center rounded-full border border-border px-2 py-1 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
          {pickerOpen && (
            <div className="absolute bottom-full left-0 mb-1 z-10 flex gap-1 rounded-lg border bg-popover p-1.5 shadow-md">
              {PALETTE.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  className="rounded-md px-1.5 py-0.5 text-base hover:bg-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
