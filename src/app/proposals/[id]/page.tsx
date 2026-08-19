import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProposal, progressFor, reactionsFor, timelineFor } from "@/modules/proposals/store";
import { formatEur, formatTokens, getRoom, bookableRooms } from "@/modules/proposals/funding";
import { fetchTaskList } from "@/modules/tasks/tasklist";
import { currentCaller } from "@/modules/identity/server";
import { isMember, isSteward } from "@/modules/identity/service";
import { proposalTreasury } from "@/modules/payments/treasury";
import { userWallet } from "@/modules/payments/user-wallet";
import { statusLabel } from "@/components/proposals/status";
import { StatusLine } from "@/components/proposals/status-line";
import { Supporters } from "@/components/proposals/supporters";
import { ActivityLog } from "@/components/proposals/activity-log";
import { ReactionBar } from "@/components/proposals/reaction-bar";
import { ProposalFacts } from "@/components/proposals/facts";
import { AttendButton } from "@/components/proposals/attend-button";
import { Checklist, type ChecklistItem } from "@/components/proposals/checklist";
import { TOKEN_SYMBOL } from "@/modules/payments/chain";
import { describeChanges, prettyField, visibleChange } from "@/modules/proposals/diff-labels";
import { avatarFor } from "@/modules/proposals/avatars";
import { InlineDescription } from "@/components/proposals/inline-description";
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

/** "1" or "2.5" — the number alone, for "x of y tokens" lines. */
function bare(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(1);
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

/** The big date, Option-A style: the one thing everyone scans for first. */
function DateBlock({ slot }: { slot: { date: string; start: string } }) {
  const date = new Date(`${slot.date}T${slot.start}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <div className="w-[76px] shrink-0 rounded-xl border bg-card shadow-sm overflow-hidden text-center">
      <div className="bg-primary text-primary-foreground text-[11px] font-bold tracking-widest uppercase py-1">
        {date.toLocaleDateString("en-BE", { month: "short" })}
      </div>
      <div className="text-3xl font-bold py-1.5">{date.getDate()}</div>
    </div>
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
  const supporterCount = new Set(going.map((r) => r.contributorId)).size;
  const neededPeople = Math.max(2, proposal.minAttendees ?? 2);
  const confirmedSlot = proposal.slots.find((s) => s.id === proposal.confirmedSlotId);
  const headlineSlot = confirmedSlot ?? proposal.slots[0] ?? null;

  const blockedReason = !funding.funded
    ? "Not funded yet — the room still needs covering before this can go on the calendar."
    : !proposal.roomSlug
      ? "Pick a room before confirming."
      : !proposal.confirmedSlotId
        ? "Pick which of the dates it is happening on."
        : null;

  // ── the checklist: the proposal, as the list of what it still needs ──
  const closed = proposal.status === "declined" || proposal.status === "cancelled";
  const tokensTarget = funding.target.tokens;
  const tokensCollected = Math.max(0, tokensTarget - funding.remainingTokens);

  const checklist: ChecklistItem[] = [
    {
      key: "date",
      done: !!confirmedSlot,
      title: "A date",
      detail: confirmedSlot
        ? whenShort(confirmedSlot)
        : proposal.slots.length === 1
          ? `${whenShort(proposal.slots[0])} — proposed, not locked in yet`
          : `${proposal.slots.length} options on the table — one still to pick`,
    },
    {
      key: "room",
      done: !!room,
      title: "A room that fits",
      detail: room ? `${room.name} · seats ${room.capacity}` : "Any room — to be decided",
    },
    {
      key: "people",
      done: supporterCount >= neededPeople,
      title: `${neededPeople} people from the community`,
      detail: (
        <div className="space-y-2">
          <Supporters proposal={proposal} />
          {supporterCount < neededPeople && (
            <p>
              {supporterCount} of {neededPeople} — the next seat is yours.
            </p>
          )}
        </div>
      ),
      action: (
        <AttendButton
          proposalId={proposal.id}
          dateSet={!!proposal.confirmedSlotId}
          alreadyGoing={!!account && going.some((r) => r.contributorId === account.id)}
          full={proposal.maxAttendees !== null && seats >= proposal.maxAttendees}
          symbol={TOKEN_SYMBOL}
          signedIn={!!account}
        />
      ),
    },
    {
      key: "tokens",
      done: funding.funded,
      title: `${formatTokens(tokensTarget)} for the room`,
      detail: (
        <p>
          {bare(tokensCollected)} of {bare(tokensTarget)} in · every RSVP adds one
          {funding.target.estimated && " · estimate until a room is picked"}
        </p>
      ),
      action: (
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
          tokensOnly
        />
      ),
    },
    ...(taskList?.tasks ?? []).map((task): ChecklistItem => ({
      key: `task-${task.id}`,
      done: task.done,
      title: task.title,
      detail: !task.done && task.assigneeName ? `${task.assigneeName} is on it` : undefined,
      action:
        !task.done && !task.assigneeName && proposal.taskListId ? (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <a
              href={`https://tasklist.sh/#${proposal.taskListId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              I&apos;ll take it <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </Button>
        ) : undefined,
    })),
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/proposals">
          <Button variant="ghost" size="sm" className="gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" /> All proposals
          </Button>
        </Link>

        {/* ── the header: the date, the title, the facts ── */}
        <div className="flex gap-5 items-start mb-8">
          {headlineSlot && <DateBlock slot={headlineSlot} />}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusLine status={proposal.status} />
              <span className="text-xs text-muted-foreground">Proposal #{proposal.number}</span>
            </div>

            <h1 className="text-3xl font-bold">{proposal.title}</h1>

            {/* date, time, place — the facts, tappable for the author */}
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

            <p className="text-sm text-muted-foreground">
              Proposed by {proposal.proposerName} · {ago(proposal.createdAt)}
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
              {" · "}
              <Link href={`/events/${proposal.eventSlug}`} className="text-primary hover:underline">
                event page →
              </Link>
              {proposal.link && (
                <>
                  {" · "}
                  <a
                    href={proposal.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    announcement ↗
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* what it is */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
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

          {/* what it needs — every open row carries its own way to close it */}
          {!closed && (
            <Checklist
              items={checklist}
              footer={
                <>
                  <p>
                    If the list never fills, the event does not happen and everyone gets their
                    tokens back.
                  </p>
                  {treasury && (
                    <p>
                      Tokens collect in this proposal&apos;s own Safe
                      {treasury.tokenBalance > 0 && (
                        <> — holding {treasury.tokenBalance} {treasury.symbol} right now</>
                      )}
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
                  )}
                </>
              }
            />
          )}

          {/* ── the thread, github-issue style: one line, avatars on it ── */}
          <h2 className="font-semibold pt-2">Questions &amp; updates</h2>
          <div className="relative">
            <span className="absolute left-4 top-4 bottom-4 w-px bg-border" aria-hidden />
            <div className="space-y-5">
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
        </div>
      </div>
    </div>
  );
}
