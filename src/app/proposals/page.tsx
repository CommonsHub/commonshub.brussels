import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listProposals, progressFor, tidyLegacyUrls } from "@/modules/proposals/store";
import { formatEur, formatTokens, getRoom } from "@/modules/proposals/funding";
import { FundingMeter } from "@/components/proposals/funding-meter";
import { statusLabel, statusTone } from "@/components/proposals/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event proposals | Commons Hub Brussels",
  description:
    "Everything the community has proposed to happen at the hub — open threads anyone can join, fund and help with.",
};

function formatSlot(slot: { date: string; start: string; duration: number }): string {
  const date = new Date(`${slot.date}T${slot.start}:00`);
  if (Number.isNaN(date.getTime())) return slot.date;
  return `${date.toLocaleDateString("en-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${slot.start} · ${slot.duration}h`;
}

export default async function ProposalsPage() {
  tidyLegacyUrls();
  const proposals = listProposals();

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Proposals</h1>
            <p className="text-muted-foreground mt-2">
              Events the community wants to make happen. Join the thread, help out, chip in — and
              once the room is covered, a steward puts it on the calendar.
            </p>
          </div>
          <Button asChild>
            <Link href="/events/propose">
              <Plus className="w-4 h-4 mr-1" /> Propose an event
            </Link>
          </Button>
        </div>

        {proposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">
                Nothing proposed yet. The first one could be yours.
              </p>
              <Button asChild>
                <Link href="/events/propose">Propose an event</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => {
              const funding = progressFor(proposal);
              const room = getRoom(proposal.roomSlug);
              const going = proposal.rsvps.filter((r) => r.state === "going").length;

              return (
                <Card key={proposal.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <Link
                          href={`/proposals/${proposal.number}`}
                          className="text-lg font-semibold hover:text-primary"
                        >
                          <span className="text-muted-foreground font-normal">
                            #{proposal.number}
                          </span>{" "}
                          {proposal.title}
                        </Link>
                        {proposal.pitch && (
                          <p className="text-sm text-muted-foreground">{proposal.pitch}</p>
                        )}
                      </div>
                      <Badge variant={statusTone(proposal.status)}>
                        {statusLabel(proposal.status)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {proposal.slots.slice(0, 3).map((slot) => (
                        <span key={slot.id} className="rounded-full border px-2 py-0.5">
                          {formatSlot(slot)}
                        </span>
                      ))}
                      <span className="rounded-full border px-2 py-0.5">
                        {room ? room.name : "Any room"}
                      </span>
                      <span className="rounded-full border px-2 py-0.5">
                        ~{proposal.expectedPeople} people
                      </span>
                      {proposal.tickets.eur || proposal.tickets.tokens ? (
                        <span className="rounded-full border px-2 py-0.5">
                          {proposal.tickets.eur ? formatEur(proposal.tickets.eur) : ""}
                          {proposal.tickets.eur && proposal.tickets.tokens ? " · " : ""}
                          {proposal.tickets.tokens ? formatTokens(proposal.tickets.tokens) : ""}
                        </span>
                      ) : (
                        <span className="rounded-full border px-2 py-0.5">Free</span>
                      )}
                    </div>

                    <FundingMeter funding={funding} compact />

                    <p className="text-xs text-muted-foreground">
                      {proposal.proposerName} · {proposal.comments.length} comments · {going} going
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
