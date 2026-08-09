"use client"

import { useState } from "react"
import type { ProposalComment } from "@/lib/proposals-data"
import { ImageIcon, ChevronLeft, ChevronRight, X } from "lucide-react"

interface GalleryImage {
  url: string
  caption: string
  author: { name: string; avatar: string }
  date: string
}

function getAllImages(comments: ProposalComment[]): GalleryImage[] {
  const images: GalleryImage[] = []
  for (const c of comments) {
    if (c.images) {
      for (const url of c.images) {
        images.push({ url, caption: c.content, author: c.author, date: c.date })
      }
    }
  }
  return images
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export function MediaGallery({ comments }: { comments: ProposalComment[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const images = getAllImages(comments)

  if (images.length === 0) return null

  return (
    <>
      <div className="border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
          Media ({images.length})
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setLightboxIndex(i)}
              className="relative aspect-square rounded-md overflow-hidden group cursor-pointer"
            >
              <img
                src={img.url}
                alt={img.caption}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setLightboxIndex(null)}>
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 text-white/80 hover:text-white p-2"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {lightboxIndex > 0 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute left-4 text-white/80 hover:text-white p-2"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            <img
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].caption}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded"
            />
            {lightboxIndex < images.length - 1 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute right-4 text-white/80 hover:text-white p-2"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
          </div>
          {/* Caption */}
          <div className="p-4 bg-gradient-to-t from-black/80 to-transparent" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-2xl mx-auto flex items-start gap-3">
              <img
                src={images[lightboxIndex].author.avatar}
                alt={images[lightboxIndex].author.name}
                className="w-8 h-8 rounded-full"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{images[lightboxIndex].author.name}</span>
                  <span className="text-white/50 text-xs">{timeAgo(images[lightboxIndex].date)}</span>
                </div>
                <p className="text-white/80 text-sm mt-1 line-clamp-2">{images[lightboxIndex].caption}</p>
              </div>
            </div>
            <div className="text-center text-white/50 text-xs mt-2">
              {lightboxIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
