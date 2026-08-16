import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProposal } from "@/modules/proposals/store";
import { isImage } from "@/modules/tasks/blossom";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const proposal = getProposal(slug);
  if (!proposal) return { title: "Not found | Commons Hub Brussels" };
  return {
    title: `Photos — ${proposal.title} | Commons Hub Brussels`,
    description: `Photos shared on proposal #${proposal.number}, ${proposal.title}.`,
  };
}

/** Every photo people attached, in one wall. Shareable on its own. */
export default async function PhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const proposal = getProposal(slug);
  if (!proposal) notFound();

  const photos = proposal.comments.flatMap((comment) =>
    (comment.attachments ?? [])
      .filter((a) => isImage(a.mime))
      .map((attachment) => ({ ...attachment, by: comment.authorName, at: comment.createdAt })),
  );

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <Link href={`/events/proposals/${proposal.slug}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to the proposal
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Photos</h1>
          <p className="text-muted-foreground mt-2">
            #{proposal.number} · {proposal.title}
            {photos.length > 0 && ` · ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
          </p>
        </div>

        {photos.length === 0 ? (
          <p className="text-muted-foreground">
            No photos yet. Add one to a comment on the proposal and it shows up here.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <a
                key={photo.url}
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg overflow-hidden border hover:border-primary transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.name}
                  loading="lazy"
                  className="w-full aspect-square object-cover"
                />
                <p className="px-2 py-1.5 text-xs text-muted-foreground truncate">{photo.by}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
