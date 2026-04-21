import Link from "next/link";
import Image from "@/components/optimized-image";
import { RecentContributors } from "@/components/recent-contributors";
import { OtherMembers } from "@/components/other-members";
import { DiscordStatsDisplay } from "@/components/discord-stats";
import { CommunityActivityGallery } from "@/components/community-activity-gallery";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Utensils, Users, Leaf, Heart } from "lucide-react";
import partnersData from "@/settings/partners.json";
import settings from "@/settings/settings.json";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import * as fs from "fs";
import * as path from "path";
import type { MembersFile } from "@/types/members";
import { DATA_DIR } from "@/lib/data-paths";

interface Partner {
  name: string;
  logo: string;
  website: string;
  description: string;
}

const partners: Partner[] = partnersData;

function readLatestMembersFile(): MembersFile | null {
  try {
    const filePath = path.join(DATA_DIR, "latest", "generated", "members.json");
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as MembersFile;
  } catch {
    return null;
  }
}

export default function MembersPage() {
  const membersData = readLatestMembersFile();
  const activeCommoners = membersData?.summary?.activeMembers ?? null;
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24">
        {/* Hero Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-linear-to-b from-primary/5 to-background">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
              Our Community of Commoners
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              The Commons Hub Brussels is home to a diverse community of
              organizations and individuals working together to reimagine shared
              resources and collective ownership.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap justify-center gap-12 md:gap-16 text-center">
              <div>
                <div className="flex justify-center mb-3">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {partners.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Partner Organizations
                </p>
              </div>
              {activeCommoners !== null && (
                <Link href="/members/list" className="group">
                  <div className="flex justify-center mb-3">
                    <Heart className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {activeCommoners}
                  </p>
                  <p className="text-sm text-muted-foreground group-hover:text-primary/80 transition-colors">
                    Active Commoners
                  </p>
                </Link>
              )}
              <DiscordStatsDisplay />
            </div>
          </div>
        </section>

        {/* Member Organizations */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Partner Organizations
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                These organizations share our vision of building commons and
                fostering community collaboration.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {partners.map((partner) => (
                <HoverCard key={partner.name} openDelay={100} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-center p-4 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all w-24 h-24 grayscale hover:grayscale-0"
                    >
                      <Image
                        src={partner.logo || "/placeholder.svg"}
                        alt={partner.name}
                        width={80}
                        height={80}
                        className="object-contain max-h-16 max-w-16"
                      />
                    </a>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <Image
                          src={partner.logo || "/placeholder.svg"}
                          alt={partner.name}
                          width={48}
                          height={48}
                          className="object-contain"
                        />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold">
                          {partner.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {partner.description}
                        </p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>
          </div>
        </section>

        {/* Members */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Members
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Meet our community members who actively contribute to the
                Commons Hub.
              </p>
            </div>

            <RecentContributors />
            <OtherMembers />

            <div className="mt-12 text-center space-y-4">
              <Button asChild variant="default">
                <Link href="/contributions">
                  View how members contribute{" "}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <div>
                <Button asChild variant="outline">
                  <a
                    href="https://discord.commonshub.brussels"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join our Discord <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Meet the Community section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Utensils className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Meet the Community
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Every Friday lunch time, we share food. Bring something to share
                and join us.
              </p>
            </div>
            <CommunityActivityGallery
              channelId={settings.discord.channels.activities.potluck}
              maxImages={6}
            />
          </div>
        </section>

        {/* Heartbeat Meeting section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Heartbeat Meeting
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Every Monday, members are invited to join the weekly heartbeat
                meeting where we review the latest updates, upcoming events and
                proposals.
              </p>
            </div>
            <CommunityActivityGallery
              channelId={settings.discord.channels.activities.heartbeat}
              maxImages={6}
            />
          </div>
        </section>

        {/* Park Cleaning section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Leaf className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Park Cleaning
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Every Friday at noon, before the community potluck, we get our
                hands dirty to clean up the park in front of the Commons Hub.
                Great way to get your first token!
              </p>
            </div>
            <CommunityActivityGallery
              channelId={settings.discord.channels.activities.parkCleaning}
              maxImages={6}
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Become Part of the Community
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join our community of commoners and help us build a more
              collaborative future.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/membership">Become a Member</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/rooms">Book a Room</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
