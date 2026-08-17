import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProposal, progressFor, reactionsFor, timelineFor } from "@/modules/proposals/store";
import { formatEur, formatTokens, getRoom } from "@/modules/proposals/funding";
import { fetchTaskList } from "@/modules/tasks/tasklist";
import { currentCaller } from "@/modules/identity/server";
import { isMember, isSteward } from "@/modules/identity/service";
import { proposalTreasury } from "@/modules/payments/treasury";
import { userWallet } from "@/modules/payments/user-wallet";
import { FundingMeter } from "@/components/proposals/funding-meter";
import { StatusSteps, statusLabel, statusTone } from "@/components/proposals/status";
import { Contributors } from "@/components/proposals/contributors";
import { WhatsMissing } from "@/components/proposals/whats-missing";
import { ActivityLog } from "@/components/proposals/activity-log";
import { ReactionBar } from "@/components/proposals/reaction-bar";
import { ProposalFacts } from "@/components/proposals/facts";
import { AttendButton } from "@/components/proposals/attend-button";
import { TOKEN_SYMBOL } from "@/modules/payments/chain";
import { describeChanges, prettyField, visibleChange } from "@/modules/proposals/diff-labels";
import { avatarFor } from "@/modules/proposals/avatars";
import { InlineDescription } from "@/components/proposals/inline-description";
import { bookableRooms } from "@/modules/proposals/funding";
import { Pencil } from "lucide-react";
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

function whenShort(slot: { date: string; start: string; duration: number }): string {
  const date = new Date(`${slot.date}T${slot.start}:00`);
  if (Number.isNaN(date.getTime())) return `${slot.date} ${slot.start}`;
  return `${date.toLocaleDateString("en-BE", { weekday: "short", day: "numeric", month: "short" })} · ${slot.start} · ${slot.duration}h`;
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

function AuthorAvatar({ name, size = "md" }: { name: string; size?: "md" | "sm" }) {
  const url = avatarFor(name);
  const classes = size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-xs";
  return (
    <span
      className={`${classes} rounded-full overflow-hidden border bg-primary/10 text-primary font-medium flex items-center justify-center shrink-0`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** One row on the vertical timeline: the avatar sits on the line, content right. */
function TimelineRow({
  who,
  dot,
  children,
}: {
  who?: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-11">
      <span className="absolute left-0 top-0.5">
        {who && !dot ? (
          <AuthorAvatar name={who} />
        ) : (
          <span className="w-8 flex justify-center pt-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-border bg-background block" />
          </span>
        )}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
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
  const wallet = account ? await userWallet(account.id).catch(() => null) : null;
  const tokenBalance = wallet?.balance ?? null;

  const roomOptions = bookableRooms().map((r) => ({
    slug: r.slug,
    name: r.name,
    capacity: r.capacity,
    pricePerHour: r.pricePerHour ?? 0,
    tokensPerHour: r.tokensPerHour ?? 0,
    image: r.heroImage,
  }));
  const mayEdit =
    !!account && (proposal.proposerId === account.id || isSteward(account));
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
              {mayEdit && (
                <>
                  {" · "}
                  <Link
                    href={`/proposals/${proposal.number}/edit`}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" /> edit
                  </Link>
                </>
              )}
            </p>

            {/* The facts at a glance — and, for the author, each one editable in place. */}
            <ProposalFacts
              proposalId={proposal.id}
              mayEdit={mayEdit}
              rooms={roomOptions}
              roomName={room?.name ?? null}
              slots={proposal.slots.map(({ date, start, duration }) => ({ date, start, duration }))}
              roomSlug={proposal.roomSlug}
              expectedPeople={proposal.expectedPeople}
              minAttendees={proposal.minAttendees}
              maxAttendees={proposal.maxAttendees}
              tickets={proposal.tickets}
            />

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
          {/* ── the thread, github-issue style: one line, avatars on it ── */}
          <div className="min-w-0 order-2 lg:order-1 relative">
            <span
              className="absolute left-4 top-4 bottom-4 w-px bg-border"
              aria-hidden
            />
            <div className="space-y-5">
            <TimelineRow who={proposal.proposerName}>
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <p className="text-sm">
                  <span className="font-medium">{proposal.proposerName}</span>{" "}
                  <span className="text-muted-foreground">
                    proposed this · {ago(proposal.createdAt)}
                  </span>
                </p>
                {proposal.pitch && <p className="font-medium">{proposal.pitch}</p>}
                <InlineDescription
                  proposalId={proposal.id}
                  description={proposal.description}
                  mayEdit={mayEdit}
                />
                <ReactionBar
                  proposalId={proposal.id}
                  targetId="proposal"
                  initial={reactionsFor(proposal, "proposal", account?.id)}
                  signedIn={!!account}
                />
              </CardContent>
            </Card>
            </TimelineRow>

            {timeline.map((item, index) => {
              if (item.kind === "comment") {
                return (
                  <TimelineRow key={index} who={item.comment.authorName}>
                  <div className="rounded-lg border bg-card p-4 space-y-2">
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
                    <ReactionBar
                      proposalId={proposal.id}
                      targetId={item.comment.id}
                      initial={reactionsFor(proposal, item.comment.id, account?.id)}
                      signedIn={!!account}
                    />
                  </div>
                  </TimelineRow>
                );
              }

              if (item.kind === "revision") {
                const phrases = describeChanges(item.revision.changes);
                return (
                  <TimelineRow key={index} who={item.revision.authorName}>
                  <div className="text-sm pt-1.5 space-y-1">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {item.revision.authorName}
                      </span>{" "}
                      {phrases.join(", ")} · {ago(item.at)}
                    </p>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                        what changed, exactly
                      </summary>
                      <div className="font-mono mt-1.5 space-y-0.5 rounded-md border border-dashed p-2.5">
                        {item.revision.changes
                          .filter((c) => visibleChange(c.field))
                          .map((change) => (
                            <div key={change.field}>
                              <div className="text-destructive">
                                − {prettyField(change.field)}: {change.from}
                              </div>
                              <div className="text-primary">
                                + {prettyField(change.field)}: {change.to}
                              </div>
                            </div>
                          ))}
                      </div>
                    </details>
                  </div>
                  </TimelineRow>
                );
              }

              if (item.kind === "contribution") {
                const c = item.contribution;
                return (
                  <TimelineRow key={index} dot>
                  <p className="text-sm text-muted-foreground pt-1.5">
                    <span className="font-medium text-foreground">{c.contributorName}</span>{" "}
                    {c.kind === "ticket" ? "took a ticket" : "chipped in"} —{" "}
                    {c.currency === "eur" ? formatEur(c.grossAmount) : formatTokens(c.grossAmount)}
                    {c.adminFee > 0 && ` (${formatEur(c.adminFee)} admin fee)`} · {ago(item.at)}
                  </p>
                  </TimelineRow>
                );
              }

              if (item.kind === "rsvp") {
                return (
                  <TimelineRow key={index} dot>
                  <p className="text-sm text-muted-foreground pt-1.5">
                    <span className="font-medium text-foreground">{item.rsvp.name}</span>{" "}
                    {item.rsvp.state === "going" ? "is interested" : "cannot make it"} · {ago(item.at)}
                  </p>
                  </TimelineRow>
                );
              }

              if (item.kind === "refund") {
                return (
                  <TimelineRow key={index} dot>
                  <p className="text-sm text-primary pt-1.5">
                    Everyone was refunded — {item.refunds.length}{" "}
                    {item.refunds.length === 1 ? "contribution" : "contributions"} went back ·{" "}
                    {ago(item.at)}
                    {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
                  </p>
                  </TimelineRow>
                );
              }

              return (
                <TimelineRow key={index} dot>
                <p className="text-sm pt-1.5">
                  <span className="font-medium">{item.by}</span> marked this{" "}
                  {statusLabel(item.status).toLowerCase()} · {ago(item.at)}
                  {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
                </p>
                </TimelineRow>
              );
            })}



            <TimelineRow who={account?.displayName ?? undefined} dot={!account}>
              <CommentBox proposalId={proposal.id} authorName={account?.displayName ?? null} />
            </TimelineRow>

            {isSteward(account) && proposal.status !== "confirmed" && (
              <TimelineRow dot>
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
              </TimelineRow>
            )}

            {/* the ledger, folded away at the end for whoever wants the full record */}
            <details className="relative pl-11">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none list-none">
                <span className="absolute left-0 top-0 w-8 flex justify-center pt-1">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-border bg-background block" />
                </span>
                Activity log
                {photoCount > 0 && ` · ${photoCount} ${photoCount === 1 ? "photo" : "photos"}`} ▸
              </summary>
              <div className="mt-3 rounded-lg border bg-card p-4">
                <ActivityLog items={timeline} slug={proposal.eventSlug} />
              </div>
            </details>
            </div>
          </div>

          {/* ── the summary ── */}
          <aside className="space-y-6 order-1 lg:order-2 lg:sticky lg:top-6">
            {/* The main call to action: gather what this needs. */}
            <Card className="border-primary/40">
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="font-semibold">Help make it happen</h2>
                  <p className="text-sm text-muted-foreground">
                    This proposal needs to gather enough resources to go ahead.
                  </p>
                </div>

                {/* Coming along is the first way to help. */}
                <div className="space-y-2">
                  <p className="text-sm tabular-nums">
                    <span className="font-medium">{seats}</span>
                    <span className="text-muted-foreground">
                      {proposal.minAttendees !== null && ` of at least ${proposal.minAttendees}`}
                      {" coming"}
                      {proposal.maxAttendees !== null && ` · max ${proposal.maxAttendees}`}
                    </span>
                  </p>
                  {proposal.minAttendees !== null && seats < proposal.minAttendees && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Still {proposal.minAttendees - seats} short of the minimum for it to happen.
                    </p>
                  )}
                  <AttendButton
                    proposalId={proposal.id}
                    dateSet={!!proposal.confirmedSlotId}
                    alreadyGoing={!!account && going.some((r) => r.contributorId === account.id)}
                    full={
                      proposal.maxAttendees !== null && seats >= proposal.maxAttendees
                    }
                    symbol={TOKEN_SYMBOL}
                    signedIn={!!account}
                  />
                </div>

                <hr className="border-border" />

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
                  walletAddress={wallet?.address ?? null}
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
