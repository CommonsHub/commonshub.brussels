"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Image from "@/components/optimized-image";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { ImageLightbox, ImageLightboxHandle } from "./image-lightbox";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import settings from "@/settings/settings.json";

interface ActivityImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  filePath?: string;
  sourceUrl: string;
  channelId: string;
  messageId: string;
  author: {
    displayName: string;
    avatar: string | null;
  };
  caption: string;
  timestamp: string;
}

interface CommunityActivityGalleryProps {
  channelId: string;
  title?: string;
  maxImages?: number;
  layout?: "grid" | "horizontal";
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function normalizeDataFilePath(filePath?: string): string | null {
  if (!filePath) return null;
  const trimmed = filePath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/data/")) return trimmed;
  if (trimmed.startsWith("data/")) return `/${trimmed}`;
  return `/data/${trimmed.replace(/^\/+/, "")}`;
}

export function CommunityActivityGallery({
  channelId,
  title,
  maxImages = 6,
  layout = "grid",
}: CommunityActivityGalleryProps) {
  const lightboxRef = useRef<ImageLightboxHandle>(null);
  const searchParams = useSearchParams();
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [externalFallbackIds, setExternalFallbackIds] = useState<Set<string>>(new Set());

  // Fetch from static JSON file
  const { data } = useSWR<{
    images: Array<{
      url: string;
      proxyUrl?: string;
      filePath?: string;
      id: string;
      author: {
        id: string;
        username: string;
        displayName: string;
        avatar: string | null;
      };
      message: string;
      timestamp: string;
      messageId: string;
      channelId: string;
    }>;
  }>(`/api/images`, fetcher);

  // Filter images by channelId
  const channelImages = (data?.images || []).filter(
    (img) => img.channelId === channelId
  );

  useEffect(() => {
    setFailedImageIds(new Set());
    setExternalFallbackIds(new Set());
  }, [channelId, data]);

  useEffect(() => {
    if (!data) return;

    if (channelImages.length === 0) {
      console.warn("[CommunityActivityGallery] No images found for channel", {
        channelId,
        totalImages: data.images?.length || 0,
      });
      return;
    }

    const missingFilePath = channelImages.filter((img) => !img.filePath).length;
    if (missingFilePath > 0) {
      console.warn("[CommunityActivityGallery] Images missing filePath", {
        channelId,
        missingFilePath,
        totalChannelImages: channelImages.length,
      });
    }
  }, [channelId, channelImages, data]);

  // Map images to ActivityImage format
  const allImages: ActivityImage[] = channelImages.map((image) => {
    const localPath = normalizeDataFilePath(image.filePath);
    const useExternalFallback = externalFallbackIds.has(image.id);
    const primarySource = useExternalFallback
      ? getProxiedImageUrl(image.url, "lg", { relative: true })
      : getProxiedImageUrl(localPath || image.url, "lg", {
          relative: true,
        });

    const thumbnailSource = useExternalFallback
      ? getProxiedImageUrl(image.url, "sm", { relative: true })
      : getProxiedImageUrl(localPath || image.url, "sm", {
          relative: true,
        });

    return {
      id: image.id,
      imageUrl: primarySource,
      thumbnailUrl: thumbnailSource,
      filePath: image.filePath,
      sourceUrl: image.url,
      channelId: image.channelId,
      messageId: image.messageId,
      author: {
        displayName: image.author.displayName || image.author.username,
        avatar: image.author.avatar
          ? `https://cdn.discordapp.com/avatars/${image.author.id}/${image.author.avatar}.png`
          : null,
      },
      caption: image.message,
      timestamp: image.timestamp,
    };
  });
  const images = useMemo(
    () =>
      allImages
        .filter((image) => !failedImageIds.has(image.id))
        .slice(0, maxImages),
    [allImages, failedImageIds, maxImages]
  );
  const hasImages = images.length > 0;

  const openLightbox = useCallback((index: number) => {
    lightboxRef.current?.openLightbox(index);
  }, []);

  const handleImageError = useCallback(
    (image: ActivityImage) => {
      if (!externalFallbackIds.has(image.id)) {
        console.warn("[CommunityActivityGallery] Local image failed, retrying via stored URL", {
          channelId,
          imageId: image.id,
          filePath: image.filePath,
          messageId: image.messageId,
        });
        setExternalFallbackIds((prev) => {
          if (prev.has(image.id)) return prev;
          const next = new Set(prev);
          next.add(image.id);
          return next;
        });
        return;
      }

      console.warn("[CommunityActivityGallery] All image fallbacks failed", {
        channelId,
        imageId: image.id,
        filePath: image.filePath,
        messageId: image.messageId,
        sourceUrl: image.sourceUrl,
      });
      setFailedImageIds((prev) => {
        if (prev.has(image.id)) return prev;
        const next = new Set(prev);
        next.add(image.id);
        return next;
      });
    },
    [channelId, externalFallbackIds]
  );

  // Check if URL has an image parameter and open that image
  // Use a ref to track if we've already opened this image to prevent loops
  const lastOpenedImageId = useRef<string | null>(null);

  useEffect(() => {
    const imageId = searchParams.get("image");

    // Only open if we have images, there's an imageId, and it's different from last opened
    if (imageId && hasImages && imageId !== lastOpenedImageId.current) {
      const imageIndex = images.findIndex((img) => img.id === imageId);
      if (imageIndex !== -1) {
        lastOpenedImageId.current = imageId;
        openLightbox(imageIndex);
      }
    } else if (!imageId) {
      // Clear the ref when there's no image in URL (lightbox closed)
      lastOpenedImageId.current = null;
    }
  }, [searchParams, images, hasImages, openLightbox]);

  if (!hasImages) {
    return null;
  }

  // Convert to ImageLightbox format - need to find the original data to get IDs
  const lightboxImages = images.map((image) => {
    const originalImage = channelImages.find((img) => img.id === image.id);
    return {
      url: image.imageUrl,
      thumbnailUrl: image.thumbnailUrl || image.imageUrl,
      caption: image.caption,
      author: {
        id: originalImage?.author.id || "",
        displayName: image.author.displayName,
        avatar: image.author.avatar,
      },
      timestamp: image.timestamp,
      attachmentId: image.id,
      messageId: image.messageId || originalImage?.messageId || "",
      channelId: image.channelId || channelId,
    };
  });

  return (
    <>
      <div
        className={
          layout === "horizontal"
            ? "flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            : "grid grid-cols-2 md:grid-cols-4 gap-4"
        }
      >
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => openLightbox(index)}
            className={`relative rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
              layout === "horizontal" ? "w-48 h-48 shrink-0" : "aspect-square"
            }`}
          >
            <Image
              src={image.thumbnailUrl || image.imageUrl}
              alt={image.caption || "Community activity photo"}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes={
                layout === "horizontal"
                  ? "192px"
                  : "(max-width: 768px) 50vw, 25vw"
              }
              onError={() => handleImageError(image)}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </button>
        ))}
      </div>

      <ImageLightbox
        ref={lightboxRef}
        images={lightboxImages}
        layout="wrap"
        showThumbnails={false}
        guildId={settings.discord.guildId}
      />
    </>
  );
}
