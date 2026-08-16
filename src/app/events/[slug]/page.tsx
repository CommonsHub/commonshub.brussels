import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, ImageIcon, MapPin, ScrollText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProposal, progressFor } from "@/modules/proposals/store";
import { formatEur, formatTokens, getRoom } from "@/modules/proposals/funding";
import { FundingMeter } from "@/components/proposals/funding-meter";
import { statusLabel, statusTone } from "@/components/proposals/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const proposal = getProposal(slug);
  if (!proposal) return { title: "Event not found | Commons Hub Brussels" };
  return {
    title: `${proposal.title} | Commons Hub Brussels`,
    description: proposal.pitch || proposal.description.slice(0, 160),
  };
}

function when(slot: { date: string; start: string; duration: number }): string {
  const date = new Date(`${slot.date}T${slot.start}:00`);
  if (Number.isNaN(date.getTime())) return `${slot.date} ${slot.start}`;
  return `${date.toLocaleDateString("en-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })} · ${slot.start} · ${slot.duration}h`;
}

/**
 * The event, as anyone would want to see it — what it is, when, where, what it
 * costs. How it came about, and whether it is fully funded, lives one click
 * away on the proposal.
 */
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const proposal = getProposal(slug);
  if (!proposal) notFound();

  const funding = progressFor(proposal);
  const room = getRoom(proposal.roomSlug);
  const slot = proposal.slots.find((s) => s.id === proposal.confirmedSlotId) ?? proposal.slots[0];
  const going = proposal.rsvps.filter((r) => r.state === "going");
  const seats = going.reduce((sum, r) => sum + r.seats, 0);
  const photos = proposal.comments.reduce((sum, c) => sum + (c.attachments?.length ?? 0), 0);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusTone(proposal.status)}>{statusLabel(proposal.status)}</Badge>
            {proposal.status !== "confirmed" && (
              <span className="text-sm text-muted-foreground">
                Not confirmed yet — it still needs what the proposal lists.
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">{proposal.title}</h1>
          {proposal.pitch && <p className="text-lg text-muted-foreground">{proposal.pitch}</p>}
        </div>

        <Card>
          <CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <CalendarDays className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">When</p>
                {proposal.confirmedSlotId || proposal.slots.length === 1 ? (
                  <p className="font-medium">{slot ? when(slot) : "To be decided"}</p>
                ) : (
                  <ul className="font-medium space-y-0.5">
                    {proposal.slots.map((option) => (
                      <li key={option.id}>{when(option)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Where</p>
                <p className="font-medium">
                  {room ? room.name : "A room, once one is picked"}
                  <span className="block text-sm text-muted-foreground font-normal">
                    Commons Hub Brussels
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Who</p>
                <p className="font-medium">
                  {proposal.audience === "public"
                    ? "Open to everyone"
                    : proposal.audience === "members"
                      ? "Members only"
                      : "Invite only"}
                  <span className="block text-sm text-muted-foreground font-normal">
                    {seats > 0 ? `${seats} coming` : "Nobody signed up yet"} · room for about{" "}
                    {proposal.expectedPeople}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <ScrollText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tickets</p>
                <p className="font-medium">
                  {proposal.tickets.eur || proposal.tickets.tokens ? (
                    <>
                      {proposal.tickets.eur ? formatEur(proposal.tickets.eur) : ""}
                      {proposal.tickets.eur && proposal.tickets.tokens ? " · " : ""}
                      {proposal.tickets.tokens ? formatTokens(proposal.tickets.tokens) : ""}
                      {proposal.tickets.freeForMembers && (
                        <span className="block text-sm text-muted-foreground font-normal">
                          Members come free
                        </span>
                      )}
                    </>
                  ) : (
                    "Free"
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {proposal.description && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{proposal.description}</p>
          </div>
        )}

        {proposal.status !== "confirmed" && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <FundingMeter funding={funding} />
              <Button asChild className="w-full">
                <Link href={`/proposals/${proposal.number}`}>
                  Help make it happen — proposal #{proposal.number}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 border-t pt-6">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/proposals/${proposal.number}`}>
              <ExternalLink className="w-4 h-4 mr-1" /> The proposal
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/events/${proposal.eventSlug}/photos`}>
              <ImageIcon className="w-4 h-4 mr-1" /> Photos{photos > 0 && ` (${photos})`}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/events/${proposal.eventSlug}/log`}>
              <ScrollText className="w-4 h-4 mr-1" /> Activity log
            </Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Proposed by {proposal.proposerName}. Everything about how this event came together is
          public — see <Link href={`/proposals/${proposal.number}`} className="text-primary hover:underline">proposal #{proposal.number}</Link>.
        </p>
      </div>
    </div>
  );
}
