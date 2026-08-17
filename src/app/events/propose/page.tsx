import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bookableRooms } from "@/modules/proposals/funding";
import { currentCaller } from "@/modules/identity/server";
import { publicProfile } from "@/modules/identity/service";
import { ProposeForm } from "./propose-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Propose an event | Commons Hub Brussels",
  description:
    "Propose an event for the community. It becomes a public thread anyone can join, fund and help with.",
};

export default async function ProposePage() {
  const caller = await currentCaller();
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
          <Link href="/proposals">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              All proposals
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Organise an event with the community</h1>
          <p className="text-muted-foreground mt-2">
            Would you love to organise an event at the Commons Hub? Make a proposal to organise it
            with members of the community. Share the idea even if it is not fully baked yet — see
            who else in the community is interested and secure your first participants. Community
            members can RSVP with their tokens, and externals can buy a ticket with their old
            tokens aka euros. You can also make it a free event, of course.
          </p>
        </div>

        <ProposeForm
          rooms={rooms}
          me={caller ? (publicProfile(caller.account) as never) : null}
        />
      </div>
    </div>
  );
}
