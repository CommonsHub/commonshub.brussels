import Link from "next/link";
import { ArrowRight, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listProposals } from "@/modules/proposals/store";

/**
 * The two ways in. The split is public versus private, not free versus paid:
 * a community event can sell tickets, and a private booking can be free.
 */
export function EventFork() {
  const open = listProposals().filter((p) => p.status === "open" || p.status === "funded");

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">What do you want to do at the hub?</h2>
          <p className="text-muted-foreground mt-2">
            Two ways in. Pick the one that matches your event.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-primary/40 flex flex-col">
            <CardHeader>
              <p className="text-xs uppercase tracking-wide text-primary flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Public · anyone can join in
              </p>
              <CardTitle>Organise an event for the community</CardTitle>
              <CardDescription>
                A workshop, a talk, a repair café, a potluck. You write a proposal, it becomes a
                public thread: people comment, help out, chip in towards the room, and say they are
                coming.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-3">
              <Button asChild className="w-full">
                <Link href="/events/propose">
                  Start a proposal <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {open.length > 0 ? (
                  <Link href="/events/proposals" className="hover:text-primary">
                    {open.length} {open.length === 1 ? "proposal is" : "proposals are"} open right now
                  </Link>
                ) : (
                  <Link href="/events/proposals" className="hover:text-primary">
                    See what has been proposed
                  </Link>
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Private · handled by the team
              </p>
              <CardTitle>Book the venue for your private event</CardTitle>
              <CardDescription>
                An offsite, a board meeting, a client workshop. Tell us what you need and we reply
                by email with availability and a quote. Nothing is published.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/book">
                  Request a booking <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Usually answered within two days
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
