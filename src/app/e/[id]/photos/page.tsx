import { redirect, notFound } from "next/navigation";
import { getProposal } from "@/modules/proposals/store";

export const dynamic = "force-dynamic";

/** Short link to the photos: /e/7/photos */
export default async function ShortPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = getProposal(id);
  if (!proposal) notFound();
  redirect(`/events/${proposal.eventSlug}/photos`);
}
