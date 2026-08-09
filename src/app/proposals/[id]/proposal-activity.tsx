"use client"

import { useState } from "react"
import type { ProposalComment, ProposalContribution } from "@/lib/proposals-data"
import { Coins, Globe, Lock, ExternalLink, ImageIcon, ChevronLeft, ChevronRight, X } from "lucide-react"

interface Props {
  comments: ProposalComment[]
  contributions: ProposalContribution[]
  token: string
}

type ActivityItem =
  | { kind: "comment"; data: ProposalComment; sortDate: string }
  | { kind: "contribution"; data: ProposalContribution; sortDate: string }

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// Collect all images from comments for the lightbox
function getAllImages(comments: ProposalComment[]) {
  const images: { url: string; caption: string; author: ProposalComment["author"]; date: string }[] = []
  for (const c of comments) {
    if (c.images) {
      for (const url of c.images) {
        images.push({ url, caption: c.content, author: c.author, date: c.date })
      }
    }
  }
  return images
}

function Lightbox({ images, initialIndex, onClose }: {
  images: { url: string; caption: string; author: { name: string; avatar: string }; date: string }[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const img = images[index]

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 z-10 text-white/80 hover:text-white p-2">
        <X className="w-6 h-6" />
      </button>
      {/* Image */}
      <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {index > 0 && (
          <button onClick={() => setIndex(index - 1)} className="absolute left-4 text-white/80 hover:text-white p-2">
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}
        <img src={img.url} alt={img.caption} className="max-h-[80vh] max-w-[90vw] object-contain rounded" />
        {index < images.length - 1 && (
          <button onClick={() => setIndex(index + 1)} className="absolute right-4 text-white/80 hover:text-white p-2">
            <ChevronRight className="w-8 h-8" />
          </button>
        )}
      </div>
      {/* Caption */}
      <div className="p-4 bg-gradient-to-t from-black/80 to-transparent" onClick={(e) => e.stopPropagation()}>
        <div className="max-w-2xl mx-auto flex items-start gap-3">
          <img src={img.author.avatar} alt={img.author.name} className="w-8 h-8 rounded-full" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm">{img.author.name}</span>
              <span className="text-white/50 text-xs">{timeAgo(img.date)}</span>
            </div>
            <p className="text-white/80 text-sm mt-1 line-clamp-2">{img.caption}</p>
          </div>
        </div>
        <div className="text-center text-white/50 text-xs mt-2">{index + 1} / {images.length}</div>
      </div>
    </div>
  )
}

export function ProposalActivity({ comments, contributions, token }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const allImages = getAllImages(comments)

  // Merge and sort chronologically
  // Skip standalone contributions if they match a comment's tokenContribution (same txHash)
  const commentTxHashes = new Set(
    comments.filter((c) => c.tokenContribution).map((c) => c.tokenContribution!.txHash)
  )

  const items: ActivityItem[] = [
    ...comments.map((c) => ({ kind: "comment" as const, data: c, sortDate: c.date })),
    ...contributions
      .filter((c) => !commentTxHashes.has(c.txHash))
      .map((c) => ({ kind: "contribution" as const, data: c, sortDate: c.date })),
  ].sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime())

  // Get global image index for a specific image URL
  function getGlobalImageIndex(url: string): number {
    return allImages.findIndex((img) => img.url === url)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No activity yet. Be the first to comment!
      </div>
    )
  }

  return (
    <>
      <div className="space-y-0">
        {items.map((item) => {
          if (item.kind === "contribution") {
            const c = item.data
            return (
              <div key={`contrib-${c.id}`} className="flex items-center gap-3 py-2.5 px-4 bg-green-50 dark:bg-green-950/20 border-l-2 border-green-500 mb-3 rounded-r-lg">
                <Coins className="w-4 h-4 text-green-600 flex-shrink-0" />
                <img src={c.author.avatar} alt={c.author.name} className="w-5 h-5 rounded-full" />
                <span className="text-sm">
                  <span className="font-medium">{c.author.name}</span>
                  {" "}contributed{" "}
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {c.amount.toLocaleString()} {c.token}
                  </span>
                </span>
                <a
                  href={`https://txinfo.xyz/tx/${c.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  tx <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-xs text-muted-foreground ml-auto">{timeAgo(c.date)}</span>
              </div>
            )
          }

          const c = item.data as ProposalComment
          const isEncrypted = !!c.encrypted
          const hasImages = c.images && c.images.length > 0
          const hasContribution = !!c.tokenContribution

          return (
            <div key={`comment-${c.id}`} className="border border-border rounded-lg overflow-hidden mb-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
                <img src={c.author.avatar} alt={c.author.name} className="w-5 h-5 rounded-full" />
                <span className="text-sm font-medium">{c.author.name}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(c.date)}</span>
                {hasContribution && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full">
                    <Coins className="w-3 h-3" />
                    +{c.tokenContribution!.amount.toLocaleString()} {c.tokenContribution!.token}
                  </span>
                )}
                {hasImages && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ImageIcon className="w-3 h-3" />
                    {c.images!.length}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {isEncrypted ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600" title={`Encrypted for: ${c.encrypted!.for.join(", ")}`}>
                      <Lock className="w-3 h-3" />
                      {c.encrypted!.for.join(", ")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Public message">
                      <Globe className="w-3 h-3" />
                      public
                    </span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3">
                {isEncrypted ? (
                  <p className="text-sm text-muted-foreground italic">
                    🔒 This message is encrypted for {c.encrypted!.for.join(" and ")}.
                    {" "}
                    <span className="text-xs">(Sign in to decrypt if you&apos;re a recipient)</span>
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>

                    {/* Inline contribution banner */}
                    {hasContribution && (
                      <div className="flex items-center gap-2 mt-2 py-1.5 px-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-900">
                        <Coins className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs text-green-700 dark:text-green-400">
                          Contributed <span className="font-semibold">{c.tokenContribution!.amount.toLocaleString()} {c.tokenContribution!.token}</span>
                        </span>
                        <a
                          href={`https://txinfo.xyz/tx/${c.tokenContribution!.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5 ml-auto"
                        >
                          view tx <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}

                    {/* Images */}
                    {hasImages && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {c.images!.map((url, imgIdx) => (
                          <button
                            key={imgIdx}
                            onClick={() => setLightboxIndex(getGlobalImageIndex(url))}
                            className="relative w-32 h-24 rounded-lg overflow-hidden group cursor-pointer"
                          >
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && allImages.length > 0 && (
        <Lightbox
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}

// Export for sidebar use
export { getAllImages }
