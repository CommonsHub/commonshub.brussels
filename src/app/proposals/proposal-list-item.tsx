import Link from "next/link"
import type { Proposal } from "@/lib/proposals-data"
import {
  DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
  MessageCircle,
} from "lucide-react"
import roomsData from "@/settings/rooms.json"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
}

interface Props {
  proposal: Proposal
  types: { id: string; label: string; icon: string; color: string }[]
  statuses: { id: string; label: string; color: string }[]
  isLast: boolean
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function getRoomName(slug: string): string {
  const room = roomsData.rooms.find((r: { slug?: string; id?: string; name: string }) => r.slug === slug || r.id === slug)
  return room?.name || slug
}

export function ProposalListItem({ proposal, types, statuses, isLast }: Props) {
  const type = types.find((t) => t.id === proposal.type)
  const status = statuses.find((s) => s.id === proposal.status)
  const Icon = type ? ICONS[type.icon] : MessageSquare
  const commentCount = proposal.comments.length
  const contributionCount = proposal.contributions.length

  const hasFunding = proposal.priceTotal > 0
  const fundingPercent = hasFunding ? Math.min(100, (proposal.pricePaid / proposal.priceTotal) * 100) : 0

  const hasRoomDate = (proposal.type === "booking" || proposal.type === "event" || proposal.type === "workshop")

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className={`block px-4 py-3 hover:bg-muted/50 transition-colors ${
        !isLast ? "border-b border-border" : ""
      }`}
    >
      {/* Row 1: Icon + Title + badges + #id */}
      <div className="flex items-start gap-2.5">
        <div
          className="mt-0.5 p-1.5 rounded-md flex-shrink-0"
          style={{ backgroundColor: `${type?.color}15`, color: type?.color }}
        >
          {Icon && <Icon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-foreground text-sm leading-tight">
                {proposal.title}
              </span>
              <span className="inline-flex items-center gap-1.5 ml-2">
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                  style={{ backgroundColor: type?.color }}
                >
                  {type?.label}
                </span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                  style={{ borderColor: status?.color, color: status?.color }}
                >
                  {status?.label}
                </span>
              </span>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">#{proposal.id}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Opened by */}
      <div className="ml-[38px] mt-1 text-xs text-muted-foreground">
        opened {timeAgo(proposal.createdAt)} by {proposal.author.name}
      </div>

      {/* Row 3: Room + Date (if applicable) */}
      {hasRoomDate && (proposal.room || proposal.date) && (
        <div className="ml-[38px] mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {proposal.room && (
            <span>📍 {getRoomName(proposal.room)}</span>
          )}
          {proposal.date && (
            <span>📅 {new Date(proposal.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{proposal.startTime ? ` ${proposal.startTime}` : ""}</span>
          )}
        </div>
      )}

      {/* Row 4: Funding + stats */}
      <div className="ml-[38px] mt-1.5 flex items-center gap-3 flex-wrap">
        {/* Funding bar */}
        {hasFunding && (
          <div className="flex items-center gap-2">
            <div className="w-[80px] h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${fundingPercent}%`,
                  backgroundColor: fundingPercent >= 100 ? "#10b981" : "#f59e0b",
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {proposal.pricePaid.toLocaleString()}/{proposal.priceTotal.toLocaleString()} {proposal.token}
            </span>
          </div>
        )}

        {/* Stats inline */}
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          {contributionCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Coins className="w-3 h-3" />
              {contributionCount}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="w-3 h-3" />
              {commentCount}
            </span>
          )}
          {/* Participant avatars */}
          <div className="flex -space-x-1.5">
            {[...new Map(
              [...proposal.contributions, ...proposal.comments]
                .map((c) => [c.author.discordId, c.author])
            ).values()]
              .slice(0, 3)
              .map((author) => (
                <img
                  key={author.discordId}
                  src={author.avatar}
                  alt={author.name}
                  className="w-4 h-4 rounded-full border border-background"
                />
              ))}
          </div>
        </div>
      </div>
    </Link>
  )
}
