import { redirect, notFound } from "next/navigation";
import { getProposal } from "@/modules/proposals/store";

export const dynamic = "force-dynamic";

/** Short link: /e/7 — the one you can say out loud. */
export default async function ShortLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = getProposal(id);
  if (!proposal) notFound();
  redirect(`/proposals/${proposal.number}`);
}
