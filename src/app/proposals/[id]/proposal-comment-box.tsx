"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Coins, ImagePlus, Paperclip } from "lucide-react"

interface Props {
  token: string
  isFunded: boolean
}

export function CommentBox({ token, isFunded }: Props) {
  const [showContribution, setShowContribution] = useState(false)
  const [attachedImages, setAttachedImages] = useState<string[]>([])

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
        <span className="text-sm font-medium">Add a comment</span>
      </div>
      <div className="p-4 space-y-3">
        <textarea
          placeholder="Leave a comment... (sign in with Discord to post)"
          className="w-full h-24 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          disabled
        />

        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedImages.map((url, i) => (
              <div key={i} className="relative w-20 h-16 rounded overflow-hidden group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Contribution toggle */}
        {showContribution && (
          <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <Coins className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-xs text-green-700 dark:text-green-400">Contribute</span>
            <input
              type="number"
              placeholder="0"
              min="0"
              step="0.5"
              className="w-20 px-2 py-1 text-sm border border-green-300 dark:border-green-800 rounded bg-white dark:bg-green-950/30 focus:outline-none focus:ring-1 focus:ring-green-500"
              disabled
            />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">{token}</span>
            <button
              onClick={() => setShowContribution(false)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {}}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Attach image"
              disabled
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {}}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Attach file"
              disabled
            >
              <Paperclip className="w-4 h-4" />
            </button>
            {!isFunded && !showContribution && (
              <button
                onClick={() => setShowContribution(true)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
              >
                <Coins className="w-3.5 h-3.5" />
                Contribute {token}
              </button>
            )}
            <span className="text-[10px] text-muted-foreground ml-2">
              Published as Nostr events
            </span>
          </div>
          <Button size="sm" disabled>
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}
