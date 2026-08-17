"use client";

/**
 * Where the proposal is on its way to happening. Desktop shows the whole road
 * with the current stop lit; mobile shows the current stop, tap to unfold the
 * road.
 */

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProposalStatus } from "@/modules/proposals/types";
import { statusLabel } from "./status";

const ROAD: Array<{ statuses: ProposalStatus[]; label: string }> = [
  { statuses: ["draft", "open"], label: "Collecting support" },
  { statuses: ["funded"], label: "Room covered" },
  { statuses: ["confirmed"], label: "On the calendar" },
  { statuses: ["happened"], label: "Happened" },
];

export function StatusLine({ status }: { status: ProposalStatus }) {
  const [open, setOpen] = useState(false);

  if (status === "declined" || status === "cancelled") {
    return <Badge variant="destructive">{statusLabel(status)}</Badge>;
  }

  const currentIndex = ROAD.findIndex((step) => step.statuses.includes(status));

  const steps = (vertical: boolean) => (
    <ol className={vertical ? "space-y-1.5" : "flex items-center gap-1.5 flex-wrap"}>
      {ROAD.map((step, index) => {
        const done = index < currentIndex;
        const now = index === currentIndex;
        return (
          <li key={step.label} className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap ${
                now
                  ? "bg-primary text-primary-foreground font-medium"
                  : done
                    ? "border border-primary/50 text-primary"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {done && <Check className="w-3 h-3" />}
              {step.label}
            </span>
            {!vertical && index < ROAD.length - 1 && (
              <span className="text-muted-foreground/50 text-xs" aria-hidden>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <div>
      {/* desktop: the whole road */}
      <div className="hidden sm:block">{steps(false)}</div>

      {/* mobile: the current stop, tap for the road */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-medium"
          aria-expanded={open}
        >
          {ROAD[Math.max(currentIndex, 0)].label}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div className="mt-2">{steps(true)}</div>}
      </div>
    </div>
  );
}
