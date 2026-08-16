import { notFound, redirect } from "next/navigation";
import { getProposal } from "@/modules/proposals/store";

export const dynamic = "force-dynamic";

/** /events/repair-cafe/proposal → the proposal behind the event. */
export default async function EventProposalRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const proposal = getProposal(slug);
  if (!proposal) notFound();
  redirect(`/proposals/${proposal.number}`);
}
