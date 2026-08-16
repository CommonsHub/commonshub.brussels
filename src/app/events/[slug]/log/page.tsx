import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProposal, timelineFor } from "@/modules/proposals/store";
import { ActivityLog } from "@/components/proposals/activity-log";

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
    title: `Activity — ${proposal.title} | Commons Hub Brussels`,
    description: `Everything that happened on the way to ${proposal.title}: contributions, refunds, changes and decisions.`,
  };
}

/** The full ledger for an event, on its own page. */
export default async function EventLogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const proposal = getProposal(slug);
  if (!proposal) notFound();

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <Link href={`/events/${proposal.eventSlug}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to the event
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-muted-foreground mt-2">
            {proposal.title} · everything that happened, in order.{" "}
            <Link href={`/proposals/${proposal.number}`} className="text-primary hover:underline">
              Proposal #{proposal.number}
            </Link>
          </p>
        </div>

        <ActivityLog items={timelineFor(proposal)} slug={proposal.eventSlug} />
      </div>
    </div>
  );
}
