import { AlertCircle, Check } from "lucide-react";
import { formatEur, formatTokens, type FundingProgress } from "@/modules/proposals/funding";
import type { Proposal } from "@/modules/proposals/types";
import type { TaskListSnapshot } from "@/modules/tasks/tasklist";

/**
 * What still stands between this proposal and a date in the calendar, said
 * plainly. An event that is short of something is not a failure — it is an
 * invitation, and this is where it gets made.
 */
export function WhatsMissing({
  proposal,
  funding,
  taskList,
}: {
  proposal: Proposal;
  funding: FundingProgress;
  taskList: TaskListSnapshot | null;
}) {
  if (proposal.status === "declined" || proposal.status === "cancelled") return null;

  const openTasks = taskList?.tasks.filter((t) => !t.done && !t.assignee) ?? [];

  const missing: string[] = [];
  if (!funding.funded) {
    missing.push(
      `${formatEur(funding.remainingEur)} — or ${formatTokens(funding.remainingTokens)}, or any mix — towards the room`,
    );
  }
  if (!proposal.roomSlug) missing.push("a room that fits");
  if (!proposal.confirmedSlotId && proposal.slots.length > 1) {
    missing.push("one date, picked out of the options");
  }
  const going = proposal.rsvps
    .filter((r) => r.state === "going")
    .reduce((sum, r) => sum + r.seats, 0);
  if (proposal.minAttendees !== null && going < proposal.minAttendees) {
    const gap = proposal.minAttendees - going;
    missing.push(`${gap} more ${gap === 1 ? "person" : "people"} saying they are coming`);
  }
  if (openTasks.length > 0) {
    missing.push(
      openTasks.length === 1
        ? `someone to take on “${openTasks[0].title}”`
        : `someone for each of ${openTasks.length} things on the list`,
    );
  }

  if (missing.length === 0) {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-1">
        <p className="font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-primary" />
          {proposal.status === "confirmed"
            ? "This one is happening."
            : "Everything this needs is in place."}
        </p>
        <p className="text-sm text-muted-foreground">
          {proposal.status === "confirmed"
            ? "The room is held and it is on the hub calendar."
            : "A steward can put it on the calendar now."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4 space-y-2">
      <p className="font-medium flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500" />
        This event still needs a few things
      </p>
      <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
        {missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-sm">
        Chip in your part and it happens. If it never gathers everything it needs, it does not go
        ahead and everyone is refunded — in the currency they paid.
      </p>
    </div>
  );
}
