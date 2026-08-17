import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProposal } from "@/modules/proposals/store";
import { bookableRooms } from "@/modules/proposals/funding";
import { currentCaller } from "@/modules/identity/server";
import { isSteward, publicProfile } from "@/modules/identity/service";
import { ProposeForm } from "@/app/events/propose/propose-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit proposal | Commons Hub Brussels" };

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposal = getProposal(id);
  if (!proposal) notFound();

  const caller = await currentCaller();
  const mayEdit =
    caller && (proposal.proposerId === caller.account.id || isSteward(caller.account));
  if (!mayEdit) redirect(`/proposals/${proposal.number}`);

  const rooms = bookableRooms().map((room) => ({
    slug: room.slug,
    name: room.name,
    capacity: room.capacity,
    pricePerHour: room.pricePerHour ?? 0,
    tokensPerHour: room.tokensPerHour ?? 0,
    image: room.heroImage,
  }));

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <Link href={`/proposals/${proposal.number}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to the proposal
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Edit proposal #{proposal.number}</h1>
          <p className="text-muted-foreground mt-2">
            Every change lands in the thread as a new version with a diff — nothing is edited
            quietly.
          </p>
        </div>

        <ProposeForm
          rooms={rooms}
          me={publicProfile(caller.account) as never}
          initial={{
            id: proposal.id,
            number: proposal.number,
            title: proposal.title,
            description: proposal.description,
            link: proposal.link,
            slots: proposal.slots.map(({ date, start, duration }) => ({ date, start, duration })),
            roomSlug: proposal.roomSlug,
            expectedPeople: proposal.expectedPeople,
            minAttendees: proposal.minAttendees,
            maxAttendees: proposal.maxAttendees,
            audience: proposal.audience,
            tickets: proposal.tickets,
          }}
        />
      </div>
    </div>
  );
}
