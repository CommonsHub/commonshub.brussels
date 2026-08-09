import { notFound } from "next/navigation"
import { getProposal, getProposals } from "@/lib/proposals-data"
import proposalSettings from "@/settings/proposals.json"
import roomsData from "@/settings/rooms.json"
import Link from "next/link"
import {
  ArrowLeft, DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
  Clock, MapPin, Users, ExternalLink, Lock, Globe, Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProposalActivity } from "./proposal-activity"
import { CommentBox } from "./proposal-comment-box"
import { MediaGallery } from "./proposal-media-gallery"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  return getProposals().map((p) => ({ id: String(p.id) }))
}

function getRoomName(slug: string): string {
  const room = roomsData.rooms.find((r: { slug?: string; id?: string; name: string }) => r.slug === slug || r.id === slug)
  return room?.name || slug
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function ProposalPage({ params }: PageProps) {
  const { id } = await params
  const proposal = getProposal(parseInt(id))

  if (!proposal) {
    notFound()
  }

  const type = proposalSettings.types.find((t) => t.id === proposal.type)
  const status = proposalSettings.statuses.find((s) => s.id === proposal.status)
  const Icon = type ? ICONS[type.icon] : MessageSquare

  const hasFunding = proposal.priceTotal > 0
  const fundingPercent = hasFunding ? Math.min(100, (proposal.pricePaid / proposal.priceTotal) * 100) : 0
  const isFunded = fundingPercent >= 100

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24">
        <section className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Back */}
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link href="/proposals">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Proposals
              </Link>
            </Button>

            {/* Title area */}
            <div className="flex items-start gap-3 mb-6">
              <div
                className="mt-1 p-2 rounded-lg flex-shrink-0"
                style={{ backgroundColor: `${type?.color}15`, color: type?.color }}
              >
                {Icon && <Icon className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  {proposal.title}
                  <span className="text-muted-foreground font-normal ml-2">#{proposal.id}</span>
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Status */}
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: status?.color }}
                  >
                    {status?.label}
                  </span>
                  {/* Type */}
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full border"
                    style={{ borderColor: type?.color, color: type?.color }}
                  >
                    {type?.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    opened by <span className="font-medium text-foreground">{proposal.author.name}</span>
                    {" "}on {formatDate(proposal.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
              {/* Main content */}
              <div className="space-y-6">
                {/* Description */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
                    <img
                      src={proposal.author.avatar}
                      alt={proposal.author.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span className="text-sm font-medium">{proposal.author.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(proposal.createdAt)}</span>
                    <Globe className="w-3 h-3 text-muted-foreground ml-auto" title="Public message" />
                  </div>
                  <div className="px-4 py-3 prose prose-sm max-w-none dark:prose-invert">
                    {proposal.description.split("\n").map((line, i) => {
                      if (line.startsWith("**") && line.endsWith("**")) {
                        return <p key={i}><strong>{line.slice(2, -2)}</strong></p>
                      }
                      if (line.startsWith("- ")) {
                        return <li key={i}>{line.slice(2)}</li>
                      }
                      if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ") || line.startsWith("4. ") || line.startsWith("5. ")) {
                        return <li key={i}>{line.slice(3)}</li>
                      }
                      if (line.trim() === "") return <br key={i} />
                      return <p key={i}>{line}</p>
                    })}
                  </div>
                </div>

                {/* Activity timeline */}
                <ProposalActivity
                  comments={proposal.comments}
                  contributions={proposal.contributions}
                  token={proposal.token}
                />

                {/* Comment box */}
                <CommentBox token={proposal.token} isFunded={isFunded} />
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Funding */}
                {hasFunding && (
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3">Funding</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {proposal.pricePaid.toLocaleString()} / {proposal.priceTotal.toLocaleString()} {proposal.token}
                        </span>
                        <span className={`font-medium ${isFunded ? "text-green-600" : "text-amber-600"}`}>
                          {Math.round(fundingPercent)}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${fundingPercent}%`,
                            backgroundColor: isFunded ? "#10b981" : "#f59e0b",
                          }}
                        />
                      </div>

                      {/* Contributors */}
                      {proposal.contributions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {proposal.contributions.map((c) => (
                            <div key={c.id} className="flex items-center gap-2">
                              <img src={c.author.avatar} alt={c.author.name} className="w-5 h-5 rounded-full" />
                              <span className="text-xs flex-1">{c.author.name}</span>
                              <span className="text-xs font-medium">
                                {c.amount.toLocaleString()} {c.token}
                              </span>
                              <a
                                href={`https://txinfo.xyz/tx/${c.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                tx
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isFunded && (
                        <Button size="sm" className="w-full mt-3" disabled>
                          <Coins className="w-3.5 h-3.5 mr-1.5" />
                          Contribute {proposal.token}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Details */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Details</h3>
                  <div className="space-y-2.5 text-sm">
                    {proposal.room && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span>{getRoomName(proposal.room)}</span>
                      </div>
                    )}
                    {proposal.date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>{formatDate(proposal.date)}</span>
                      </div>
                    )}
                    {proposal.startTime && proposal.duration && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>{proposal.startTime} — {proposal.duration} min</span>
                      </div>
                    )}
                    {proposal.metadata.attendees && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4 flex-shrink-0" />
                        <span>{String(proposal.metadata.attendees)} attendees</span>
                      </div>
                    )}
                    {proposal.metadata.equipment && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(proposal.metadata.equipment as string[]).map((eq) => (
                          <span key={eq} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                            {eq}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Organisers */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Organisers</h3>
                  <div className="space-y-2">
                    {proposal.organisers.map((org) => (
                      <div key={org.discordId} className="flex items-center gap-2">
                        <img src={org.avatar} alt={org.name} className="w-6 h-6 rounded-full" />
                        <span className="text-sm">{org.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expense */}
                {proposal.expenseUrl && (
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3">Expense</h3>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href={proposal.expenseUrl} target="_blank" rel="noopener noreferrer">
                        <Receipt className="w-3.5 h-3.5 mr-1.5" />
                        Submit expense on Open Collective
                        <ExternalLink className="w-3 h-3 ml-1.5" />
                      </a>
                    </Button>
                  </div>
                )}

                {/* Media Gallery */}
                <MediaGallery comments={proposal.comments} />

                {/* Wallet */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Wallet</h3>
                  <code className="text-[10px] text-muted-foreground break-all">
                    {proposal.walletAddress}
                  </code>
                  <a
                    href={`https://txinfo.xyz/address/${proposal.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                  >
                    View on txinfo.xyz <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
