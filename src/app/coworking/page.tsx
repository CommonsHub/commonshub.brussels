import Link from "next/link";
import Image from "@/components/optimized-image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Coffee, Users } from "lucide-react";
import { CommunityActivityGallery } from "@/components/community-activity-gallery";
import roomsData from "@/settings/rooms.json";
import settings from "@/settings/settings.json";

export const metadata = {
  title: "Coworking | Commons Hub Brussels",
  description:
    "Open coworking space in the heart of Brussels — work, connect, and collaborate with our community of commoners.",
};

export default function CoworkingPage() {
  const coworking = roomsData.rooms.find((r) => r.slug === "coworking");
  const phonebooth = roomsData.rooms.find((r) => r.slug === "phonebooth");
  const playroom = roomsData.rooms.find((r) => r.slug === "playroom");

  return (
    <div className="min-h-screen bg-background">
      <main>
        <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-linear-to-b from-primary/10 to-background">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
              Coworking at the Commons Hub
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              {coworking?.description ||
                "Our open coworking area where community members come together to work, connect, and collaborate."}
            </p>
            <div className="flex flex-wrap justify-center gap-8 mt-10 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" /> High-speed WiFi
              </span>
              <span className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-primary" /> Coffee &amp; tea
              </span>
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Community of
                commoners
              </span>
            </div>
            <div className="mt-10 flex justify-center">
              <Button asChild size="lg">
                <Link href="/membership">Become a Member</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Life at the coworking
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Snapshots from our shared workspace — captured by the community
                on Discord.
              </p>
            </div>
            <CommunityActivityGallery
              channelId={settings.discord.channels.activities.coworking}
              maxImages={12}
            />
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                More than just a desk
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Need a private spot for a call, or a break to clear your head?
                Coworkers have access to the phonebooth and the kicker room.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {playroom && (
                <Link
                  href={`/rooms/${playroom.slug}`}
                  className="group block rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="relative h-64">
                    <Image
                      src={playroom.heroImage || "/placeholder.svg"}
                      alt={playroom.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center justify-between">
                      Kicker room
                      <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {playroom.description}
                    </p>
                  </div>
                </Link>
              )}

              {phonebooth && (
                <Link
                  href={`/rooms/${phonebooth.slug}`}
                  className="group block rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="relative h-64">
                    <Image
                      src={phonebooth.heroImage || "/placeholder.svg"}
                      alt={phonebooth.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center justify-between">
                      Phonebooth
                      <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {phonebooth.description}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Come work with us
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              The coworking is reserved for members. Join the community to get
              access — and a desk full of friendly faces.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/membership">Become a Member</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/rooms">All our spaces</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
