import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProposal, progressFor, timelineFor } from "@/modules/proposals/store";
import { formatEur, formatTokens, getRoom } from "@/modules/proposals/funding";
import { fetchTaskList } from "@/modules/tasks/tasklist";
import { currentCaller } from "@/modules/identity/server";
import { isMember, isSteward } from "@/modules/identity/service";
import { balanceForDiscordUser } from "@/modules/payments/tokens";
import { proposalTreasury } from "@/modules/payments/treasury";
import { FundingMeter } from "@/components/proposals/funding-meter";
import { StatusSteps, statusLabel, statusTone } from "@/components/proposals/status";
import { Contributors } from "@/components/proposals/contributors";
import { WhatsMissing } from "@/components/proposals/whats-missing";
import { ActivityLog } from "@/components/proposals/activity-log";
import { ContributePanel } from "@/components/proposals/contribute-panel";
import { CommentBox } from "@/components/proposals/comment-box";
import { StewardActions } from "@/components/proposals/steward-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const proposal = getProposal(id);
  if (!proposal) return { title: "Proposal not found | Commons Hub Brussels" };
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
  })} · ${slot.start} · ${slot.duration}h`;
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days > 1) return `${days} days ago`;
  if (days === 1) return "yesterday";
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  return "just now";
}

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = getProposal(id);
  if (!proposal) notFound();

  const funding = progressFor(proposal);
  const timeline = timelineFor(proposal);
  const room = getRoom(proposal.roomSlug);
  const caller = await currentCaller();
  const account = caller?.account ?? null;

  const taskList = proposal.taskListId ? await fetchTaskList(proposal.taskListId).catch(() => null) : null;

  const treasury = await proposalTreasury(proposal.id).catch(() => null);
  const balance =
    account?.discordId && (await balanceForDiscordUser(account.discordId).catch(() => null));
  const tokenBalance = balance && balance.available ? balance.balance : null;

  const photoCount = proposal.comments.reduce(
    (sum, c) => sum + (c.attachments?.length ?? 0),
    0,
  );
  const going = proposal.rsvps.filter((r) => r.state === "going");
  const seats = going.reduce((sum, r) => sum + r.seats, 0);
  const confirmedSlot = proposal.slots.find((s) => s.id === proposal.confirmedSlotId);

  const blockedReason = !funding.funded
    ? "Not funded yet — the room still needs covering before this can go on the calendar."
    : !proposal.roomSlug
      ? "Pick a room before confirming."
      : !proposal.confirmedSlotId
        ? "Pick which of the dates it is happening on."
        : null;

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/proposals">
          <Button variant="ghost" size="sm" className="gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" /> All proposals
          </Button>
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div className="space-y-2 min-w-0">
            <h1 className="text-3xl font-bold">{proposal.title}</h1>
            <p className="text-muted-foreground">
              #{proposal.number} · proposed by {proposal.proposerName} · {ago(proposal.createdAt)} ·
              version {proposal.version}
            </p>
            <Link
              href={`/events/${proposal.eventSlug}`}
              className="text-sm text-primary hover:underline"
            >
              See the event page →
            </Link>
          </div>
          <Badge variant={statusTone(proposal.status)} className="text-sm">
            {statusLabel(proposal.status)}
          </Badge>
        </div>

        {/* What this is and how it is doing comes first — on a phone that means
            before the thread, not after it. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          {/* ── the thread ── */}
          <div className="space-y-6 min-w-0 order-2 lg:order-1">
            <Card>
              <CardContent className="pt-6 space-y-3">
                {proposal.pitch && <p className="font-medium">{proposal.pitch}</p>}
                {proposal.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{proposal.description}</p>
                )}
              </CardContent>
            </Card>

            {timeline.map((item, index) => {
              if (item.kind === "comment") {
                return (
                  <div key={index} className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">{item.comment.authorName}</span>{" "}
                      <span className="text-muted-foreground">· {ago(item.at)}</span>
                    </p>
                    {item.comment.body && (
                      <p className="text-sm whitespace-pre-wrap">{item.comment.body}</p>
                    )}
                    {item.comment.attachments && item.comment.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.comment.attachments.map((attachment) => (
                          <a
                            key={attachment.url}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              loading="lazy"
                              className="w-28 h-28 object-cover rounded-md border hover:border-primary"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (item.kind === "revision") {
                return (
                  <div key={index} className="rounded-lg border border-dashed p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{item.revision.authorName}</span>{" "}
                      updated this — version {item.revision.version} · {ago(item.at)}
                    </p>
                    <div className="font-mono text-xs space-y-0.5">
                      {item.revision.changes.map((change) => (
                        <div key={change.field}>
                          <div className="text-destructive">
                            − {change.field}: {change.from}
                          </div>
                          <div className="text-primary">
                            + {change.field}: {change.to}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (item.kind === "contribution") {
                const c = item.contribution;
                return (
                  <p key={index} className="text-sm text-muted-foreground px-1">
                    <span className="font-medium text-foreground">{c.contributorName}</span>{" "}
                    {c.kind === "ticket" ? "took a ticket" : "chipped in"} —{" "}
                    {c.currency === "eur" ? formatEur(c.grossAmount) : formatTokens(c.grossAmount)}
                    {c.adminFee > 0 && ` (${formatEur(c.adminFee)} admin fee)`} · {ago(item.at)}
                  </p>
                );
              }

              if (item.kind === "rsvp") {
                return (
                  <p key={index} className="text-sm text-muted-foreground px-1">
                    <span className="font-medium text-foreground">{item.rsvp.name}</span>{" "}
                    {item.rsvp.state === "going" ? "is coming" : "cannot make it"} · {ago(item.at)}
                  </p>
                );
              }

              if (item.kind === "refund") {
                return (
                  <p key={index} className="text-sm text-primary px-1">
                    Everyone was refunded — {item.refunds.length}{" "}
                    {item.refunds.length === 1 ? "contribution" : "contributions"} went back ·{" "}
                    {ago(item.at)}
                    {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
                  </p>
                );
              }

              return (
                <p key={index} className="text-sm px-1">
                  <span className="font-medium">{item.by}</span> marked this{" "}
                  {statusLabel(item.status).toLowerCase()} · {ago(item.at)}
                  {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
                </p>
              );
            })}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Activity</CardTitle>
                  {photoCount > 0 && (
                    <Link
                      href={`/events/${proposal.eventSlug}/photos`}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      {photoCount} {photoCount === 1 ? "photo" : "photos"}
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ActivityLog items={timeline} slug={proposal.slug} />
              </CardContent>
            </Card>

            <CommentBox proposalId={proposal.id} authorName={account?.displayName ?? null} />

            {isSteward(account) && proposal.status !== "confirmed" && (
              <StewardActions
                proposalId={proposal.id}
                canConfirm={blockedReason === null}
                whatConfirmingDoes={
                  confirmedSlot && room
                    ? `Confirming books the ${room.name} on ${when(confirmedSlot)} and publishes it to the hub calendar.`
                    : "Confirming books the room and publishes the event to the hub calendar."
                }
                blockedReason={blockedReason}
              />
            )}
          </div>

          {/* ── the summary ── */}
          <aside className="space-y-6 order-1 lg:order-2 lg:sticky lg:top-6">
            <WhatsMissing proposal={proposal} funding={funding} taskList={taskList} />

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    Current version{" "}
                    <span className="text-muted-foreground">· v{proposal.version}</span>
                  </CardTitle>
                  <Badge variant={statusTone(proposal.status)}>
                    {statusLabel(proposal.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <StatusSteps status={proposal.status} />
                <hr className="border-border" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">When</p>
                  {confirmedSlot ? (
                    <p className="font-medium">{when(confirmedSlot)}</p>
                  ) : (
                    <ul className="space-y-1">
                      {proposal.slots.map((slot) => (
                        <li key={slot.id} className="font-medium">
                          {when(slot)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Where</p>
                  <p className="font-medium">
                    {room ? `${room.name} · seats ${room.capacity}` : "Any room — to be decided"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected</p>
                  <p className="font-medium">~{proposal.expectedPeople} people</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Who can come</p>
                  <p className="font-medium">
                    {proposal.audience === "public"
                      ? "Open to everyone"
                      : proposal.audience === "members"
                        ? "Members only"
                        : "Invite only"}
                  </p>
                </div>
                {proposal.link && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Link</p>
                    <a
                      href={proposal.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline break-all"
                    >
                      {proposal.link.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Tickets</p>
                  <p className="font-medium">
                    {proposal.tickets.eur || proposal.tickets.tokens ? (
                      <>
                        {proposal.tickets.eur ? formatEur(proposal.tickets.eur) : ""}
                        {proposal.tickets.eur && proposal.tickets.tokens ? " · " : ""}
                        {proposal.tickets.tokens ? formatTokens(proposal.tickets.tokens) : ""}
                        {proposal.tickets.freeForMembers && " · members free"}
                      </>
                    ) : (
                      "Free"
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Funding, how to add to it, and who already has. */}
            <Card>
              <CardContent className="pt-6 space-y-5">
                <FundingMeter funding={funding} />

                <hr className="border-border" />

                <ContributePanel
                  proposalId={proposal.id}
                  ticketEur={proposal.tickets.eur}
                  ticketTokens={proposal.tickets.tokens}
                  freeForMembers={proposal.tickets.freeForMembers}
                  signedIn={!!account}
                  isMember={isMember(account)}
                  discordLinked={!!account?.discordId}
                  tokenBalance={tokenBalance}
                />

                <hr className="border-border" />

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-sm">Who has chipped in</h3>
                    {going.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {seats} {seats === 1 ? "person" : "people"} coming
                      </span>
                    )}
                  </div>
                  <Contributors contributions={proposal.contributions} />
                </div>

                {treasury && (
                  <>
                    <hr className="border-border" />
                    <p className="text-xs text-muted-foreground">
                      Token contributions collect in this proposal&apos;s own Safe
                      {treasury.tokenBalance > 0 && (
                        <> — holding {treasury.tokenBalance} {treasury.symbol} right now</>
                      )}
                      {!treasury.deployed && " (deployed the first time money moves out)"}
                      {": "}
                      <a
                        href={treasury.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary hover:underline break-all"
                      >
                        {treasury.address}
                      </a>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What it needs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {taskList && taskList.tasks.length > 0 ? (
                  <>
                    <ul className="space-y-1.5 text-sm">
                      {taskList.tasks.map((task) => (
                        <li key={task.id} className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              task.done ? "bg-primary border-primary text-primary-foreground" : ""
                            }`}
                            aria-hidden
                          >
                            {task.done && <Check className="w-3 h-3" />}
                          </span>
                          <span className={task.done ? "line-through text-muted-foreground" : ""}>
                            {task.title}
                            {task.assigneeName && !task.done && (
                              <span className="text-muted-foreground"> · {task.assigneeName}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {taskList.openCount} still open · {taskList.claimedCount} taken
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The list is empty so far — open it to add what this event needs.
                  </p>
                )}

                {proposal.taskListId && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a
                      href={`https://tasklist.sh/#${proposal.taskListId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Take a task <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Share that link with anyone — they can pick something up without an account here.
                </p>
              </CardContent>
            </Card>

          </aside>
        </div>
      </div>
    </div>
  );
}
