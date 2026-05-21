"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { DiscordMessage } from "@/components/discord-message"

interface Introduction {
  content: string
  timestamp: string
  attachments?: Array<{ url: string; proxyUrl: string; contentType?: string }>
}

function withAttachmentIds(
  attachments: Introduction["attachments"],
): Array<{ id: string; url: string; proxyUrl: string; contentType?: string }> | undefined {
  return attachments?.map((attachment, index) => ({
    id: attachment.url || attachment.proxyUrl || String(index),
    ...attachment,
  }))
}

interface MemberIntroductionProps {
  introductions: Introduction[]
  userMap: Record<string, string>
  channelMap: Record<string, string>
  guildId: string
}

const MAX_CHARS = 512

function smartTruncate(text: string, maxLength: number): { truncated: string; wasTruncated: boolean } {
  if (text.length <= maxLength) {
    return { truncated: text, wasTruncated: false }
  }

  // Find the last space before maxLength
  let truncateAt = maxLength
  while (truncateAt > 0 && text[truncateAt] !== " ") {
    truncateAt--
  }

  // If no space found, just truncate at maxLength
  if (truncateAt === 0) {
    truncateAt = maxLength
  }

  return {
    truncated: text.substring(0, truncateAt).trim() + "...",
    wasTruncated: true,
  }
}

export function MemberIntroduction({
  introductions,
  userMap,
  channelMap,
  guildId,
}: MemberIntroductionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (introductions.length === 0) {
    return (
      <div className="border-t border-border pt-6">
        <div className="bg-muted/30 rounded-lg p-6 text-center">
          <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">This member hasn't shared about themselves yet.</p>
        </div>
      </div>
    )
  }

  const firstIntro = introductions[0]
  const hasMoreIntros = introductions.length > 1
  const { truncated, wasTruncated } = smartTruncate(firstIntro.content, MAX_CHARS)

  const shouldShowMore = wasTruncated || hasMoreIntros
  const displayContent = isExpanded ? firstIntro.content : truncated

  return (
    <div className="border-t border-border pt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">About me</h2>
      </div>

      <div className="space-y-4">
        {/* First introduction (always shown, possibly truncated) */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div>
            <DiscordMessage
              content={displayContent}
              userMap={userMap}
              channelMap={channelMap}
              guildId={guildId}
              attachments={withAttachmentIds(firstIntro.attachments)}
              timestamp={firstIntro.timestamp}
            />
            {/* Inline "show more" link */}
            {shouldShowMore && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="text-primary hover:underline text-sm ml-1 cursor-pointer"
              >
                show more
                {hasMoreIntros && ` (${introductions.length - 1} more message${introductions.length - 1 > 1 ? "s" : ""})`}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Posted on{" "}
            {new Date(firstIntro.timestamp).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Additional introductions (shown when expanded) */}
        {isExpanded &&
          introductions.slice(1).map((intro, index) => (
            <div key={index + 1} className="bg-muted/50 rounded-lg p-4">
              <DiscordMessage
                content={intro.content}
                userMap={userMap}
                channelMap={channelMap}
                guildId={guildId}
                attachments={withAttachmentIds(intro.attachments)}
                timestamp={intro.timestamp}
              />
              <p className="text-xs text-muted-foreground mt-3">
                Posted on{" "}
                {new Date(intro.timestamp).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}

        {/* Show less link */}
        {isExpanded && (
          <div className="text-center">
            <button
              onClick={() => setIsExpanded(false)}
              className="text-primary hover:underline text-sm cursor-pointer"
            >
              show less
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
